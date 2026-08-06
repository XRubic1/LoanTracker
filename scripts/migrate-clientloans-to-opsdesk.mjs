/**
 * One-shot data copy: ClientLoans (source) → OpsDesk (dest).
 *
 * Requires env vars (do not hardcode passwords):
 *   SRC_DB_URL  – pooler URL for source project
 *   DST_DB_URL  – pooler URL for dest project
 *
 * Example:
 *   $env:SRC_DB_URL="postgresql://postgres.OLDREF:PASS@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
 *   $env:DST_DB_URL="postgresql://postgres.NEWREF:PASS@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
 *   node scripts/migrate-clientloans-to-opsdesk.mjs
 */
import pg from 'pg';

const { Client } = pg;

const SRC = process.env.SRC_DB_URL;
const DST = process.env.DST_DB_URL;

if (!SRC || !DST) {
  console.error('Set SRC_DB_URL and DST_DB_URL before running.');
  process.exit(1);
}

const ssl = { rejectUnauthorized: false };

const PUBLIC_TABLES = [
  'platform_admins',
  'owner_company_groups',
  'companies',
  'owner_company_group_members',
  'company_invites',
  'team_members',
  'clients',
  'loans',
  'reserves',
  'client_insurance',
  'insurance_verification',
  'aaa_payments',
  'worksheet_entries',
  'client_insurance_cancellation_audit',
  'brokersnapshot_sync_runs',
  'brokersnapshot_api_logs',
  'brokersnapshot_cancellation_suggestions',
];

const AUTH_USERS_SKIP = new Set(['confirmed_at', 'email', 'phone']);
const AUTH_IDENTITIES_SKIP = new Set(['email']);

async function tableExists(client, schema, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  return rows.length > 0;
}

async function getInsertableColumns(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, udt_name, is_generated
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return rows.filter((r) => r.is_generated !== 'ALWAYS');
}

function isJsonType(col) {
  return col.data_type === 'json' || col.data_type === 'jsonb' || col.udt_name === 'json' || col.udt_name === 'jsonb';
}

function prepareValue(val, col) {
  if (val === null || val === undefined) return null;
  if (isJsonType(col)) {
    if (typeof val === 'string') {
      try {
        JSON.parse(val);
        return val;
      } catch {
        return JSON.stringify(val);
      }
    }
    return JSON.stringify(val);
  }
  return val;
}

async function copyTable(src, dst, schema, table, { truncate = true, skipCols = new Set() } = {}) {
  if (!(await tableExists(src, schema, table))) {
    console.log(`  skip ${schema}.${table} (missing on source)`);
    return 0;
  }
  if (!(await tableExists(dst, schema, table))) {
    console.log(`  skip ${schema}.${table} (missing on dest)`);
    return 0;
  }

  const srcCols = (await getInsertableColumns(src, schema, table)).filter(
    (c) => !skipCols.has(c.column_name)
  );
  const dstColNames = new Set(
    (await getInsertableColumns(dst, schema, table)).map((c) => c.column_name)
  );
  const cols = srcCols.filter((c) => dstColNames.has(c.column_name));
  if (cols.length === 0) {
    console.log(`  skip ${schema}.${table} (no shared columns)`);
    return 0;
  }

  const colList = cols.map((c) => `"${c.column_name}"`).join(', ');
  const { rows } = await src.query(`SELECT ${colList} FROM "${schema}"."${table}"`);
  if (rows.length === 0) {
    console.log(`  ${schema}.${table}: 0 rows`);
    return 0;
  }

  if (truncate) {
    await dst.query(`TRUNCATE TABLE "${schema}"."${table}" CASCADE`);
  }

  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const insertSql = `INSERT INTO "${schema}"."${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let inserted = 0;
  let failed = 0;
  let firstErr = null;
  for (const row of rows) {
    const values = cols.map((c) => prepareValue(row[c.column_name], c));
    try {
      await dst.query(insertSql, values);
      inserted++;
    } catch (err) {
      failed++;
      if (!firstErr) firstErr = err.message;
    }
  }
  console.log(
    `  ${schema}.${table}: ${inserted}/${rows.length} ok` +
      (failed ? ` (${failed} failed: ${firstErr})` : '')
  );
  return inserted;
}

async function copyAuth(src, dst) {
  console.log('Copying auth.users + auth.identities…');
  await dst.query('SET session_replication_role = replica');
  await copyTable(src, dst, 'auth', 'users', { truncate: false, skipCols: AUTH_USERS_SKIP });
  await copyTable(src, dst, 'auth', 'identities', {
    truncate: false,
    skipCols: AUTH_IDENTITIES_SKIP,
  });
  await dst.query('SET session_replication_role = DEFAULT');
}

async function resetSequences(dst) {
  console.log('Resetting sequences…');
  const { rows } = await dst.query(`
    SELECT tbl.relname AS tbl, col.attname AS col
    FROM pg_class seq
    JOIN pg_depend d ON d.objid = seq.oid AND d.deptype = 'a'
    JOIN pg_class tbl ON d.refobjid = tbl.oid
    JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = d.refobjsubid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE seq.relkind = 'S' AND ns.nspname = 'public'
  `);
  for (const r of rows) {
    await dst.query(
      `SELECT setval(
        pg_get_serial_sequence('public.${r.tbl}', '${r.col}'),
        COALESCE((SELECT MAX("${r.col}") FROM public."${r.tbl}"), 1)
      )`
    );
  }
  console.log(`  updated ${rows.length} sequences`);
}

async function main() {
  const src = new Client({ connectionString: SRC, ssl });
  const dst = new Client({ connectionString: DST, ssl });

  console.log('Connecting…');
  await src.connect();
  await dst.connect();
  console.log('Connected.');

  await copyAuth(src, dst);

  console.log('Copying public tables…');
  await dst.query('SET session_replication_role = replica');
  for (const table of PUBLIC_TABLES) {
    await copyTable(src, dst, 'public', table, { truncate: true });
  }
  await dst.query('SET session_replication_role = DEFAULT');
  await resetSequences(dst);

  for (const t of ['loans', 'reserves', 'companies', 'clients', 'worksheet_entries', 'team_members']) {
    const { rows } = await dst.query(`SELECT count(*)::int AS n FROM public."${t}"`);
    console.log(`VERIFY public.${t} = ${rows[0].n}`);
  }
  const { rows: users } = await dst.query(`SELECT count(*)::int AS n FROM auth.users`);
  console.log(`VERIFY auth.users = ${users[0].n}`);
  const { rows: ids } = await dst.query(`SELECT count(*)::int AS n FROM auth.identities`);
  console.log(`VERIFY auth.identities = ${ids[0].n}`);

  await src.end();
  await dst.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
