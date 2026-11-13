/**
 * Upload tab backend. Saves client-portal logins (password encrypted with the PORTAL_CRED_KEY secret)
 * and uploads files to a TruFunding batch.
 *
 * JSON body:  { action: 'list' | 'save' | 'delete', ... }
 * Form body:  action=upload, accountId, batchId ('new' or an existing BatchUploadId), process ('true'|'false'), files[]
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { findFamily, nextRevisionNumber, revisionSuffix, stripRevision } from '../../../src/lib/revisedInvoices.ts';
import {
  base64,
  createBatch,
  createRevisedInvoice,
  createSchedule,
  deleteInvoiceInput,
  listInvoiceInputFiles,
  listPendingInvoiceInputs,
  uploadToInvoiceInput,
  MAX_INVOICE_IMAGE_BYTES as MAX_REVISED_FILE_BYTES,
  fetchInvoiceFile,
  findBatch,
  listBatchInvoices,
  listBatches,
  listInvoiceFiles,
  MAX_INVOICE_IMAGE_BYTES,
  normalizePortalUrl,
  portalLogin,
  processBatch,
  searchInvoices,
  uploadInvoiceImage,
  uploadToBatch,
} from '../_shared/truPortal.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// --- password encryption (AES-GCM) ---

async function cryptoKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('PORTAL_CRED_KEY');
  if (!secret || secret.length < 16) {
    throw new Error('PORTAL_CRED_KEY is not set. Add it as a Supabase function secret (16+ characters).');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), new TextEncoder().encode(plain))
  );
  return `${toB64(iv)}.${toB64(cipher)}`;
}

async function decrypt(stored: string): Promise<string> {
  const [iv, cipher] = stored.split('.');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    await cryptoKey(),
    fromB64(cipher)
  );
  return new TextDecoder().decode(plain);
}

// --- request context ---

interface Caller {
  userId: string;
  email: string;
  /** The team owner whose accounts this person works with. */
  ownerId: string;
  /** Every team under the super admin. Anyone can use their logins to upload. */
  sharedOwnerIds: string[];
  isOwner: boolean;
  /** Super admins may change any login. */
  isPlatformAdmin: boolean;
}

/** Every team the super admin has set up. They all share client logins for uploading. */
async function allTeamOwnerIds(admin: ReturnType<typeof createClient>, ownerId: string): Promise<string[]> {
  const { data } = await admin.from('companies').select('owner_id').not('owner_id', 'is', null);
  const ids = new Set<string>([ownerId]);
  for (const row of (data as { owner_id: string | null }[] | null) ?? []) {
    if (row.owner_id) ids.add(row.owner_id);
  }
  return [...ids];
}

async function resolveCaller(
  req: Request,
  admin: ReturnType<typeof createClient>
): Promise<Caller | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  if (!data.user) return null;
  const { data: membership } = await admin
    .from('team_members')
    .select('owner_id')
    .eq('member_id', data.user.id)
    .limit(1)
    .maybeSingle();
  const ownerId = (membership?.owner_id as string | undefined) ?? data.user.id;
  const email = (data.user.email ?? '').trim().toLowerCase();
  const { data: isAdmin } = email
    ? await admin.from('platform_admins').select('email').eq('email', email).maybeSingle()
    : { data: null };
  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    ownerId,
    sharedOwnerIds: await allTeamOwnerIds(admin, ownerId),
    isOwner: ownerId === data.user.id,
    isPlatformAdmin: Boolean(isAdmin),
  };
}

type AccountRow = {
  id: number;
  owner_id: string;
  label: string;
  portal_url: string;
  username: string;
  password_enc: string;
  client_id: number | null;
};

/** Only the team that saved a login (or a super admin) can change it. Everyone else can only upload with it. */
const canEditAccount = (caller: Caller, a: AccountRow) =>
  caller.isPlatformAdmin || (caller.isOwner && a.owner_id === caller.ownerId);

const publicAccount = (a: AccountRow, caller: Caller) => ({
  id: a.id,
  can_edit: canEditAccount(caller, a),
  client_id: a.client_id,
  label: a.label,
  portal_url: a.portal_url,
  username: a.username,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = await resolveCaller(req, admin);
    if (!caller) return json({ error: 'Sign in to use uploads.' }, 401);

    const isForm = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
    const form = isForm ? await req.formData() : null;
    const body = (form ? {} : await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(form ? form.get('action') : body.action ?? '');

    if (action === 'list') {
      const [{ data: accounts }, { data: log }] = await Promise.all([
        admin.from('portal_upload_accounts').select('*').in('owner_id', caller.sharedOwnerIds).order('label'),
        admin
          .from('portal_upload_log')
          .select('id, account_label, batch_no, file_names, processed, status, message, uploaded_by, created_at')
          .in('owner_id', caller.sharedOwnerIds)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      return json({
        accounts: ((accounts ?? []) as AccountRow[]).map((a) => publicAccount(a, caller)),
        log: log ?? [],
        canManage: caller.isOwner || caller.isPlatformAdmin,
      });
    }

    if (action === 'save' || action === 'delete') {
      if (!caller.isOwner && !caller.isPlatformAdmin) {
        return json({ error: 'Only the account owner can change saved logins.' }, 403);
      }
    }

    if (action === 'save') {
      const label = String(body.label ?? '').trim();
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      const portalUrl = normalizePortalUrl(String(body.portal_url ?? 'https://clients.trufunding.net'));
      const clientId = body.client_id != null ? Number(body.client_id) : null;
      let id = body.id != null ? Number(body.id) : null;
      if (id == null && clientId != null) {
        // One login per client: saving again updates the existing one.
        const { data: existingForClient } = await admin
          .from('portal_upload_accounts')
          .select('id')
          .in('owner_id', caller.sharedOwnerIds)
          .eq('client_id', clientId)
          .maybeSingle();
        if (existingForClient) id = existingForClient.id as number;
      }
      if (id == null && clientId != null) {
        // A login saved before logins were tied to clients: take it over instead of adding a second one.
        const { data: unlinked } = await admin
          .from('portal_upload_accounts')
          .select('id')
          .in('owner_id', caller.sharedOwnerIds)
          .is('client_id', null)
          .ilike('label', label)
          .limit(1)
          .maybeSingle();
        if (unlinked) id = unlinked.id as number;
      }
      if (id != null) {
        const { data: target } = await admin
          .from('portal_upload_accounts')
          .select('*')
          .eq('id', id)
          .in('owner_id', caller.sharedOwnerIds)
          .maybeSingle();
        if (!target) return json({ error: 'Login not found.' }, 404);
        if (!canEditAccount(caller, target as AccountRow)) {
          return json({ error: 'This login was saved by another team. Only that team can change it.' }, 403);
        }
      }
      if (!label || !username) return json({ error: 'Enter a client name and username.' }, 400);
      if (!portalUrl) return json({ error: 'The portal address must be an https trufunding.net address.' }, 400);
      if (id == null && !password) return json({ error: 'Enter the password.' }, 400);

      // Make sure the credentials work before saving them.
      let checkPassword = password;
      if (id != null && !password) {
        const { data: existing } = await admin
          .from('portal_upload_accounts')
          .select('password_enc')
          .eq('id', id)
          .in('owner_id', caller.sharedOwnerIds)
          .maybeSingle();
        if (!existing) return json({ error: 'Login not found.' }, 404);
        checkPassword = await decrypt(existing.password_enc as string);
      }
      try {
        await portalLogin(portalUrl, username, checkPassword);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Portal login failed.' }, 400);
      }

      const row: Record<string, unknown> = { label, username, portal_url: portalUrl };
      if (clientId != null) row.client_id = clientId;
      if (password) row.password_enc = await encrypt(password);
      const query =
        id != null
          ? admin.from('portal_upload_accounts').update(row).eq('id', id).in('owner_id', caller.sharedOwnerIds)
          : admin.from('portal_upload_accounts').insert({ ...row, owner_id: caller.ownerId });
      const { data, error } = await query.select('*').single();
      if (error) return json({ error: error.message }, 400);
      return json({ account: publicAccount(data as AccountRow, caller) });
    }

    if (action === 'delete') {
      const { data: target } = await admin
        .from('portal_upload_accounts')
        .select('*')
        .eq('id', Number(body.id))
        .in('owner_id', caller.sharedOwnerIds)
        .maybeSingle();
      if (!target) return json({ error: 'Login not found.' }, 404);
      if (!canEditAccount(caller, target as AccountRow)) {
        return json({ error: 'This login was saved by another team. Only that team can remove it.' }, 403);
      }
      const { error } = await admin
        .from('portal_upload_accounts')
        .delete()
        .eq('id', Number(body.id))
        .in('owner_id', caller.sharedOwnerIds);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (
      action === 'batches' ||
      action === 'upload' ||
      action === 'invoice_search' ||
      action === 'invoice_upload' ||
      action === 'invoice_files' ||
      action === 'invoice_download' ||
      action === 'invoice_download_log' ||
      action === 'invoice_package' ||
      action === 'revised_create' ||
      action === 'revised_list' ||
      action === 'revised_remove' ||
      action === 'revised_process' ||
      action === 'revised_upload' ||
      action === 'batch_find' ||
      action === 'batch_invoice_package' ||
      action === 'batch_download_log'
    ) {
      const accountId = Number(form ? form.get('accountId') : body.accountId);
      const { data: account } = await admin
        .from('portal_upload_accounts')
        .select('*')
        .eq('id', accountId)
        .in('owner_id', caller.sharedOwnerIds)
        .maybeSingle();
      if (!account) return json({ error: 'Login not found.' }, 404);
      const acct = account as AccountRow;
      const base = normalizePortalUrl(acct.portal_url);
      if (!base) return json({ error: 'This saved login has an invalid portal address.' }, 400);

      const session = await portalLogin(base, acct.username, await decrypt(acct.password_enc)).catch((err) => {
        throw new Error(err instanceof Error ? err.message : 'Portal login failed.');
      });

      if (action === 'batches') {
        const batches = await listBatches(session);
        return json({
          batches: batches.map((b) => ({ id: b.BatchUploadId, batch_no: b.BatchNo, note: b.Note ?? '' })),
        });
      }

      if (action === 'invoice_search') {
        const invoice = String(body.invoice ?? '').trim();
        const debtorName = String(body.debtorName ?? '').trim();
        const poId = String(body.poId ?? '').trim();
        if (!invoice && !debtorName && !poId) {
          return json({ error: 'Enter an invoice number, a customer name or a PO number.' }, 400);
        }
        return json({ invoices: await searchInvoices(session, { invoice, debtorName, poId }) });
      }

      // ---- revised invoices ----
      type RevisedRow = {
        id: number;
        owner_id: string;
        account_id: number;
        invoice_input_id: number;
        original_invoice_no: string;
        new_invoice_no: string;
        po_no: string;
        broker: string;
        amount: number;
        status: string;
        created_by: string | null;
        created_at: string;
      };
      const logRevised = (label: string, names: string[], message: string, status = 'success') =>
        admin.from('portal_upload_log').insert({
          owner_id: caller.ownerId,
          account_id: acct.id,
          account_label: acct.label,
          batch_no: `Revised · ${label}`,
          file_names: names,
          processed: false,
          status,
          message,
          uploaded_by: caller.email,
        });
      const openRevised = async (): Promise<RevisedRow[]> => {
        const { data } = await admin
          .from('portal_revised_invoices')
          .select('*')
          .eq('account_id', acct.id)
          .in('owner_id', caller.sharedOwnerIds)
          .eq('status', 'created')
          .order('created_at', { ascending: false });
        return (data ?? []) as RevisedRow[];
      };
      const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

      if (action === 'revised_list') {
        const rows = await openRevised();
        const waiting = new Set((await listPendingInvoiceInputs(session)).map((p) => p.invoiceInputId));
        const attached = new Map<number, string[]>();
        await Promise.all(
          rows
            .filter((r) => waiting.has(Number(r.invoice_input_id)))
            .map(async (r) => attached.set(r.id, await listInvoiceInputFiles(session, Number(r.invoice_input_id))))
        );
        return json({
          revised: rows.map((r) => ({
            files: attached.get(r.id) ?? [],
            id: r.id,
            original_invoice_no: r.original_invoice_no,
            new_invoice_no: r.new_invoice_no,
            po_no: r.po_no,
            broker: r.broker,
            amount: Number(r.amount),
            created_by: r.created_by,
            created_at: r.created_at,
            // False when the invoice was processed or removed in the portal itself.
            in_portal: waiting.has(Number(r.invoice_input_id)),
          })),
        });
      }

      if (action === 'revised_create') {
        const invoiceKey = Number(body.invoiceKey);
        const invoiceNo = String(body.invoiceNo ?? '').trim();
        const amount = Math.round(Number(body.amount) * 100) / 100;
        const description = String(body.description ?? '').trim().slice(0, 200);
        if (!invoiceKey || !invoiceNo) return json({ error: 'Find the invoice first.' }, 400);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
          return json({ error: 'Enter the difference amount, greater than 0.' }, 400);
        }
        // The invoice may be the original or one of its revisions; either way the family is the same.
        const results = await searchInvoices(session, { invoice: stripRevision(invoiceNo) || invoiceNo });
        const picked = results.find((i) => i.invoiceKey === invoiceKey);
        if (!picked) return json({ error: `Invoice ${invoiceNo} was not found for ${acct.label}.` }, 404);
        const { base, members, original } = findFamily(results, picked);
        const source = original ?? picked;
        const basePo = (source.poId || picked.poId).replace(/R\d*$/i, '');
        if (!basePo) return json({ error: `Invoice ${base} has no PO number, so a revised one cannot be made.` }, 400);

        const suffix = revisionSuffix(nextRevisionNumber(members));
        const newInvoiceNo = `${base}${suffix}`;
        const newPoNo = `${basePo}${suffix}`;

        const already = (await openRevised()).find((r) => r.original_invoice_no === base);
        if (already) {
          return json({ error: `A revised invoice for #${base} (#${already.new_invoice_no}) is already waiting. Process or remove it first.` }, 409);
        }
        const waitingInPortal = (await listPendingInvoiceInputs(session)).find((p) => p.invoiceNo === newInvoiceNo);
        if (waitingInPortal) {
          return json({ error: `The portal already has an unprocessed invoice #${newInvoiceNo}.` }, 409);
        }

        const created = await createRevisedInvoice(session, source, amount, description, newInvoiceNo, newPoNo);
        const { data: saved, error: saveError } = await admin
          .from('portal_revised_invoices')
          .insert({
            owner_id: caller.ownerId,
            account_id: acct.id,
            account_label: acct.label,
            invoice_input_id: created.invoiceInputId,
            original_invoice_key: source.invoiceKey,
            original_invoice_no: base,
            new_invoice_no: created.newInvoiceNo,
            po_no: created.poNo,
            broker: created.broker,
            amount,
            created_by: caller.email,
          })
          .select('id')
          .single();
        if (saveError) {
          return json({
            error: `Invoice #${created.newInvoiceNo} was created in the portal but could not be recorded here (${saveError.message}). Check the schedule page in the portal.`,
          }, 500);
        }
        await logRevised(
          `Invoice ${created.newInvoiceNo}`,
          [created.newInvoiceNo],
          `Created for ${money(amount)} from invoice #${base}, ${created.broker}, PO ${created.poNo}.`
        );
        return json({
          revised: {
            id: saved.id,
            original_invoice_no: base,
            new_invoice_no: created.newInvoiceNo,
            po_no: created.poNo,
            broker: created.broker,
            amount,
          },
        });
      }

      if (action === 'revised_upload') {
        const row = (await openRevised()).find((r) => r.id === Number(form?.get('id')));
        if (!row) return json({ error: 'That revised invoice is no longer waiting.' }, 404);
        const stillWaiting = (await listPendingInvoiceInputs(session)).some(
          (p) => p.invoiceInputId === Number(row.invoice_input_id)
        );
        if (!stillWaiting) return json({ error: "That invoice is no longer on the portal's schedule list." }, 409);

        const docs = (form?.getAll('files') ?? []).filter((f): f is File => f instanceof File);
        if (docs.length === 0) return json({ error: 'Choose at least one file.' }, 400);
        const tooBig = docs.find((f) => f.size > MAX_INVOICE_IMAGE_BYTES);
        if (tooBig) return json({ error: `${tooBig.name} is larger than 16 MB.` }, 400);

        try {
          await uploadToInvoiceInput(session, Number(row.invoice_input_id), docs);
          await logRevised(
            `Documents ${row.new_invoice_no}`,
            docs.map((f) => f.name),
            `Uploaded ${docs.length} document${docs.length === 1 ? '' : 's'} to invoice #${row.new_invoice_no}.`
          );
          return json({ uploaded: docs.length });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed.';
          await logRevised(`Documents ${row.new_invoice_no}`, docs.map((f) => f.name), message, 'failed');
          return json({ error: message }, 502);
        }
      }

      if (action === 'revised_remove') {
        const row = (await openRevised()).find((r) => r.id === Number(body.id));
        if (!row) return json({ error: 'That revised invoice is no longer waiting.' }, 404);
        const waiting = (await listPendingInvoiceInputs(session)).some((p) => p.invoiceInputId === Number(row.invoice_input_id));
        if (waiting) await deleteInvoiceInput(session, Number(row.invoice_input_id));
        await admin
          .from('portal_revised_invoices')
          .update({ status: 'removed', finished_by: caller.email, finished_at: new Date().toISOString() })
          .eq('id', row.id);
        await logRevised(`Removed ${row.new_invoice_no}`, [row.new_invoice_no], `Removed before processing (${money(Number(row.amount))}).`);
        return json({ ok: true });
      }

      if (action === 'revised_process') {
        const ids = (Array.isArray(body.ids) ? (body.ids as unknown[]).map(Number) : []).filter(Number.isFinite).slice(0, 100);
        if (ids.length === 0) return json({ error: 'Choose at least one invoice to process.' }, 400);
        const rows = (await openRevised()).filter((r) => ids.includes(r.id));
        if (rows.length !== new Set(ids).size) {
          return json({ error: 'Some of the chosen invoices are no longer waiting. Refresh the list and try again.' }, 409);
        }
        const waiting = new Set((await listPendingInvoiceInputs(session)).map((p) => p.invoiceInputId));
        const gone = rows.filter((r) => !waiting.has(Number(r.invoice_input_id)));
        if (gone.length) {
          return json({
            error: `These are no longer on the portal's schedule list: ${gone.map((r) => '#' + r.new_invoice_no).join(', ')}. Remove them from the list and try again.`,
          }, 409);
        }

        const total = rows.reduce((n, r) => n + Number(r.amount), 0);
        const names = rows.map((r) => r.new_invoice_no);
        try {
          const portalMessage = await createSchedule(session, rows.map((r) => Number(r.invoice_input_id)));
          await admin
            .from('portal_revised_invoices')
            .update({ status: 'processed', finished_by: caller.email, finished_at: new Date().toISOString() })
            .in('id', rows.map((r) => r.id));
          await logRevised(
            `Processed ${rows.length} invoice${rows.length === 1 ? '' : 's'}`,
            names,
            `Processed ${rows.length} revised invoice${rows.length === 1 ? '' : 's'}, ${money(total)}. ${portalMessage}`
          );
          return json({ processed: rows.length, total, message: portalMessage });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Processing failed.';
          await logRevised(`Process failed`, names, message, 'failed');
          return json({ error: message }, 502);
        }
      }

      if (action === 'batch_find') {
        const batchNo = Number(String(body.batchNo ?? '').replace(/\D/g, ''));
        if (!batchNo) return json({ error: 'Enter a batch number.' }, 400);
        const batch = await findBatch(session, batchNo);
        if (!batch) return json({ error: `Batch ${batchNo} was not found for ${acct.label}.` }, 404);
        const invoices = await listBatchInvoices(session, batch.transKey);
        return json({
          batch: {
            trans_key: batch.transKey,
            batch_no: batch.batchNo,
            post_date: batch.postDate,
            check_amount: batch.checkAmount,
            status: batch.status,
          },
          invoices: invoices.map((i) => ({
            invoice_key: i.invoiceKey,
            invoice_no: i.invoiceNo,
            customer: i.customer,
            amount: i.amount,
          })),
        });
      }

      if (action === 'batch_invoice_package') {
        const transKey = Number(body.transKey);
        const invoiceKey = Number(body.invoiceKey);
        if (!transKey || !invoiceKey) return json({ error: 'Find the batch first.' }, 400);
        // The invoice must be part of that batch, and the batch part of this login's account.
        const inBatch = (await listBatchInvoices(session, transKey)).find((i) => i.invoiceKey === invoiceKey);
        if (!inBatch) return json({ error: 'That invoice is not in this batch.' }, 404);

        const available = await listInvoiceFiles(session, invoiceKey);
        const out: { file_name: string; data: string }[] = [];
        let total = 0;
        for (let i = 0; i < available.length; i += 4) {
          const group = available.slice(i, i + 4);
          const bytes = await Promise.all(group.map((f) => fetchInvoiceFile(f)));
          bytes.forEach((b, k) => {
            total += b.length;
            out.push({ file_name: group[k].fileName, data: base64(b) });
          });
          if (total > 28 * 1024 * 1024) {
            return json({ error: `Invoice ${inBatch.invoiceNo} has more than 28 MB of documents.` }, 413);
          }
        }
        return json({ invoice_no: inBatch.invoiceNo, customer: inBatch.customer, files: out });
      }

      if (action === 'batch_download_log') {
        const batchNo = Number(body.batchNo);
        const message = String(body.message ?? '').slice(0, 300);
        await admin.from('portal_upload_log').insert({
          owner_id: caller.ownerId,
          account_id: acct.id,
          account_label: acct.label,
          batch_no: `Download · Batch ${batchNo}`,
          file_names: [`Batch_${batchNo}.zip`],
          processed: false,
          status: 'success',
          message,
          uploaded_by: caller.email,
        });
        return json({ ok: true });
      }

      if (
        action === 'invoice_files' ||
        action === 'invoice_download' ||
        action === 'invoice_download_log' ||
        action === 'invoice_package'
      ) {
        const invoiceKey = Number(body.invoiceKey);
        const invoiceNo = String(body.invoiceNo ?? '').trim();
        if (!invoiceKey || !invoiceNo) return json({ error: 'Find the invoice first.' }, 400);

        // The invoice must really belong to this login.
        const found = (await searchInvoices(session, { invoice: invoiceNo })).find((i) => i.invoiceKey === invoiceKey);
        if (!found) return json({ error: `Invoice ${invoiceNo} was not found for ${acct.label}.` }, 404);

        const logDownload = (fileNames: string[], message: string) =>
          admin.from('portal_upload_log').insert({
            owner_id: caller.ownerId,
            account_id: acct.id,
            account_label: acct.label,
            batch_no: `Download · Invoice ${found.invoiceNo}`,
            file_names: fileNames,
            processed: false,
            status: 'success',
            message,
            uploaded_by: caller.email,
          });

        // One history line for a combined PDF, written once after all its documents were fetched.
        if (action === 'invoice_download_log') {
          const names = Array.isArray(body.fileNames) ? (body.fileNames as unknown[]).map(String).slice(0, 100) : [];
          await logDownload(
            names,
            String(body.message ?? '').slice(0, 300) ||
              `Combined ${names.length} document${names.length === 1 ? '' : 's'} into one PDF.`
          );
          return json({ ok: true });
        }

        const available = await listInvoiceFiles(session, invoiceKey);

        // Every requested document in one round trip: one login, one lookup, files fetched side by side.
        if (action === 'invoice_package') {
          const wanted = Array.isArray(body.imageKeys) ? (body.imageKeys as unknown[]).map(Number) : null;
          const chosen = wanted ? available.filter((f) => wanted.includes(f.imageKey)) : available;
          const out: { file_name: string; data: string }[] = [];
          let total = 0;
          for (let i = 0; i < chosen.length; i += 4) {
            const group = chosen.slice(i, i + 4);
            const bytes = await Promise.all(group.map((f) => fetchInvoiceFile(f)));
            bytes.forEach((b, k) => {
              total += b.length;
              out.push({ file_name: group[k].fileName, data: base64(b) });
            });
            if (total > 28 * 1024 * 1024) {
              return json({ error: `Invoice ${found.invoiceNo} has more than 28 MB of documents. Download them one at a time.` }, 413);
            }
          }
          if (body.log === true && out.length) {
            await logDownload(
              out.map((f) => f.file_name),
              out.length === 1 ? 'Downloaded.' : `Downloaded ${out.length} documents.`
            );
          }
          return json({ files: out });
        }

        if (action === 'invoice_files') {
          return json({ files: available.map((f) => ({ image_key: f.imageKey, file_name: f.fileName })) });
        }

        const wanted = available.find((f) => f.imageKey === Number(body.imageKey));
        if (!wanted) return json({ error: 'That document is no longer on the invoice.' }, 404);
        const bytes = await fetchInvoiceFile(wanted);
        // Pieces of a combined PDF are logged once as a whole, not one by one.
        if (body.skipLog !== true) await logDownload([wanted.fileName], 'Downloaded.');
        return new Response(bytes, {
          headers: { ...cors, 'Content-Type': 'application/octet-stream' },
        });
      }

      if (action === 'invoice_upload') {
        const invoiceKey = Number(form?.get('invoiceKey'));
        const invoiceNo = String(form?.get('invoiceNo') ?? '').trim();
        const imageFiles = (form?.getAll('files') ?? []).filter((f): f is File => f instanceof File);
        if (!invoiceKey || !invoiceNo) return json({ error: 'Find the invoice first.' }, 400);
        if (imageFiles.length === 0) return json({ error: 'Choose at least one file.' }, 400);
        const tooLarge = imageFiles.find((f) => f.size > MAX_INVOICE_IMAGE_BYTES);
        if (tooLarge) return json({ error: `${tooLarge.name} is larger than 16 MB.` }, 400);

        // The invoice must really belong to this login: look it up again before uploading.
        const found = (await searchInvoices(session, { invoice: invoiceNo })).find((i) => i.invoiceKey === invoiceKey);
        if (!found) return json({ error: `Invoice ${invoiceNo} was not found for ${acct.label}.` }, 404);

        const names = imageFiles.map((f) => f.name);
        const record = (status: string, message: string) =>
          admin.from('portal_upload_log').insert({
            owner_id: caller.ownerId,
            account_id: acct.id,
            account_label: acct.label,
            batch_no: `Invoice ${found.invoiceNo}`,
            file_names: names,
            processed: false,
            status,
            message,
            uploaded_by: caller.email,
          });
        const uploaded: string[] = [];
        try {
          for (const file of imageFiles) {
            await uploadInvoiceImage(session, invoiceKey, file);
            uploaded.push(file.name);
          }
          const message = `Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'} to invoice ${found.invoiceNo}.`;
          await record('success', message);
          return json({ invoice_no: found.invoiceNo, message });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Upload failed.';
          const message = uploaded.length ? `${reason} (${uploaded.join(', ')} went through.)` : reason;
          await record('failed', message);
          return json({ error: message }, 502);
        }
      }

      const files = (form?.getAll('files') ?? []).filter((f): f is File => f instanceof File);
      if (files.length === 0) return json({ error: 'Choose at least one file.' }, 400);
      const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
      if (tooBig) return json({ error: `${tooBig.name} is larger than 25 MB.` }, 400);

      const batchChoice = String(form?.get('batchId') ?? 'new');
      const shouldProcess = String(form?.get('process') ?? 'false') === 'true';
      const hasExcel = files.some((f) => /\.xlsx?$/i.test(f.name));
      if (shouldProcess && !hasExcel) {
        return json({ error: 'The portal needs at least one Excel file (.xls or .xlsx) to process a batch.' }, 400);
      }

      const log = async (status: string, batchNo: string | null, processed: boolean, message: string) => {
        await admin.from('portal_upload_log').insert({
          owner_id: caller.ownerId,
          account_id: acct.id,
          account_label: acct.label,
          batch_no: batchNo,
          file_names: files.map((f) => f.name),
          processed,
          status,
          message,
          uploaded_by: caller.email,
        });
      };

      let batch;
      try {
        batch =
          batchChoice === 'new'
            ? await createBatch(session)
            : (await listBatches(session)).find((b) => String(b.BatchUploadId) === batchChoice);
        if (!batch) throw new Error('That batch is no longer open in the portal.');

        for (const file of files) await uploadToBatch(session, batch, file);

        let message = `Uploaded ${files.length} file${files.length === 1 ? '' : 's'}.`;
        if (shouldProcess) message += ` ${await processBatch(session, batch)}`;
        await log('success', batch.BatchNo, shouldProcess, message);
        return json({ batch_no: batch.BatchNo, processed: shouldProcess, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        await log('failed', batch?.BatchNo ?? null, false, message);
        return json({ error: message, batch_no: batch?.BatchNo ?? null }, 502);
      }
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, 500);
  }
});
