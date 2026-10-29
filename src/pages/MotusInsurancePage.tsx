import { FormEvent, useMemo, useRef, useState } from 'react';
import { MotusAutoCheckTab } from '@/components/MotusAutoCheckTab';
import { countMotusIssues } from '@/lib/motusAutoCheck';
import { useMotusAutoCheckContext } from '@/contexts/MotusAutoCheckContext';
import * as XLSX from 'xlsx';
import { lookupMotusInsurance } from '@/lib/motusInsuranceClient';
import { parseMotusDotSheet, type MotusSheetEntry } from '@/lib/motusDotSheet';
import {
  calendarIso,
  cancellationDateNeedsUpdate,
  classifyMotusReport,
  currentMotusPolicies,
  isRetryableMotusFailure,
  latestCancellationIso,
  motusQueryForRecord,
  type MotusAuthority,
  type MotusInsurancePolicy,
  type MotusInsuranceReport,
  type MotusListVerdict,
} from '@/lib/motusInsurance';
import { ConfirmRenewedButton, type SaveInsurance } from '@/components/InsuranceRenewalActions';
import type { ClientInsurance } from '@/types';

type BatchRow = {
  rowKey: string;
  insuranceId: number | null;
  query: string;
  sheetName: string;
  state: 'pending' | 'checking' | 'done' | 'error';
  legalName: string;
  dotNumber: string;
  verdict: MotusListVerdict | null;
  authorityStatus: string;
  docketNumber: string;
  cancellationDates: string;
  storedCancellationIso: string | null;
  storedIsCancellation: boolean;
  proposedCancellationIso: string | null;
  updateState: 'idle' | 'saving' | 'saved' | 'error';
  updateError: string;
  summary: string;
  accountUrl: string;
};

type UpdateCancellation = (id: number, expirationDate: string) => Promise<ClientInsurance>;

const motusQueryForClient = motusQueryForRecord;

function displayIso(iso: string | null): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

const VERDICT_ORDER: MotusListVerdict[] = ['good', 'cancellation', 'inactive'];

const VERDICT_COPY: Record<MotusListVerdict, { title: string; detail: string; tone: string }> = {
  good: {
    title: 'Good',
    detail: 'Authority is active and insurance is active with no cancellation date on that policy.',
    tone: 'bg-tag-ok text-tag-ok-fg',
  },
  cancellation: {
    title: 'Cancellation',
    detail: 'Authority is active, and the insurance on file is canceled or has a cancellation date.',
    tone: 'bg-tag-due text-tag-due-fg',
  },
  inactive: {
    title: 'Inactive',
    detail: 'The operating authority is not active, or there is no insurance on file.',
    tone: 'bg-surface text-muted',
  },
};

function showDate(value: string | null): string {
  return value || '—';
}

function policyTone(policy: MotusInsurancePolicy): string {
  if (policy.active) return 'tag-ok';
  if (policy.activeWithCancellation) return 'tag-due';
  return 'tag-closed';
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-widest text-label">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function AuthorityCard({ authority }: { authority: MotusAuthority }) {
  const policies = currentMotusPolicies(authority.policies);
  const withCancellation = policies.filter((policy) => policy.hasCancellationDate).length;
  return (
    <section className="panel-surface p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{authority.legalName}</h2>
          <p className="mt-1 text-sm text-muted">{authority.authorityType}</p>
        </div>
        <a
          href={authority.detailUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-accent hover:underline"
        >
          Open on MOTUS
        </a>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Docket" value={authority.docketNumber} />
        <Fact label="Current status" value={authority.status} />
        <Fact label="Status reason" value={authority.statusReason || '—'} />
        <Fact label="Minimum insurance" value={authority.minimumInsurance || '—'} />
      </dl>

      <p className="text-sm text-muted">
        {authority.insuranceActive
          ? 'Active insurance is on file, with no cancellation date.'
          : 'No active insurance without a cancellation date.'}{' '}
        {withCancellation > 0 ? 'Current cancellation date on file.' : 'No current cancellation date.'}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {['Company', 'Policy', 'Form', 'Insurance filed', 'Status', 'Received', 'Effective', 'Cancellation'].map(
                (heading) => (
                  <th
                    key={heading}
                    className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border whitespace-nowrap"
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-muted">
                  No insurance filings on this authority.
                </td>
              </tr>
            ) : (
              policies.map((policy) => (
                <tr
                  key={`${policy.policyNumber}-${policy.effectiveDate}-${policy.status}`}
                  className="border-t border-divider"
                >
                  <td className="py-2 pr-2 text-ink">{policy.companyName}</td>
                  <td className="py-2 pr-2">{policy.policyNumber}</td>
                  <td className="py-2 pr-2">{policy.form}</td>
                  <td className="py-2 pr-2">{policy.insuranceFiled}</td>
                  <td className="py-2 pr-2">
                    <span className={policyTone(policy)}>{policy.status}</span>
                  </td>
                  <td className="py-2 pr-2">{showDate(policy.receivedDate)}</td>
                  <td className="py-2 pr-2">{showDate(policy.effectiveDate)}</td>
                  <td className="py-2 pr-2">{showDate(policy.cancellationDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function emptyBatchRow(entry: MotusSheetEntry, insurance?: ClientInsurance | null): BatchRow {
  const status = insurance?.status ?? '';
  const isCancellation = /cancel/i.test(status);
  return {
    rowKey: insurance ? `insurance:${insurance.id}` : `sheet:${entry.query}`,
    insuranceId: insurance?.id ?? null,
    query: entry.query,
    sheetName: entry.label,
    state: 'pending',
    legalName: insurance?.client || entry.label,
    dotNumber: entry.query,
    verdict: null,
    authorityStatus: '',
    docketNumber: '',
    cancellationDates: '',
    storedCancellationIso: calendarIso(insurance?.expiration_date),
    storedIsCancellation: isCancellation,
    proposedCancellationIso: null,
    updateState: 'idle',
    updateError: '',
    summary: '',
    accountUrl: '',
  };
}

function rowNeedsUpdate(row: BatchRow): boolean {
  if (row.updateState === 'saved' || row.insuranceId == null) return false;
  return cancellationDateNeedsUpdate({
    status: row.storedIsCancellation ? 'cancellation' : 'OK',
    expirationDate: row.storedCancellationIso,
    motusIso: row.proposedCancellationIso,
  });
}

function CancellationUpdate({
  row,
  onUpdate,
  record,
  onConfirmRenewed,
}: {
  row: BatchRow;
  onUpdate?: (row: BatchRow) => void;
  /** The client's insurance record, when MOTUS shows no cancellation for a cancellation on file. */
  record?: ClientInsurance | null;
  onConfirmRenewed?: SaveInsurance;
}) {
  if (record && onConfirmRenewed && row.state === 'done' && row.verdict === 'good' && /cancel/i.test(record.status)) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted">MOTUS shows no cancellation, but one is on file.</span>
        <ConfirmRenewedButton record={record} onSave={onConfirmRenewed} />
      </div>
    );
  }
  if (row.updateState === 'saving') return <span className="text-xs text-muted">Saving…</span>;
  if (row.updateState === 'saved') return <span className="text-xs text-tag-ok-fg">Updated</span>;
  if (row.updateState === 'error') return <span className="text-xs text-red">{row.updateError || 'Could not update'}</span>;
  if (!rowNeedsUpdate(row) || !onUpdate) {
    if (row.proposedCancellationIso && row.storedIsCancellation) {
      return <span className="text-xs text-muted">On file</span>;
    }
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => onUpdate(row)}
      className="whitespace-nowrap rounded-lg btn-primary px-2.5 py-1 text-xs"
    >
      Update to {displayIso(row.proposedCancellationIso)}
    </button>
  );
}

function BatchCards({
  rows,
  onUpdate,
  clientInsurance = [],
  onConfirmRenewed,
}: {
  rows: BatchRow[];
  onUpdate?: (row: BatchRow) => void;
  clientInsurance?: ClientInsurance[];
  onConfirmRenewed?: SaveInsurance;
}) {
  if (rows.length === 0) return <p className="px-3 py-4 text-sm text-muted">None</p>;
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.rowKey} className="border-b border-divider px-4 py-3 last:border-b-0 hover:bg-surface">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-sm font-semibold text-ink">
              {row.legalName || row.sheetName || '—'}
            </span>
            {row.accountUrl ? (
              <a
                href={row.accountUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 font-mono text-[13px] text-accent hover:underline"
              >
                {row.dotNumber}
              </a>
            ) : (
              <span className="flex-shrink-0 font-mono text-[13px] text-muted">{row.dotNumber}</span>
            )}
          </div>
          {(row.storedCancellationIso || row.cancellationDates) && (
            <div className="mt-1.5 flex flex-wrap gap-x-5 text-xs text-muted">
              <span>
                On file: <span className="text-ink">{displayIso(row.storedCancellationIso)}</span>
              </span>
              <span>
                MOTUS: <span className="text-ink">{row.cancellationDates || '—'}</span>
              </span>
            </div>
          )}
          {row.summary && row.verdict !== 'good' && row.verdict !== 'cancellation' ? (
            <p className="mt-1.5 text-xs text-muted">{row.summary}</p>
          ) : null}
          <div className="mt-1.5 empty:hidden">
            <CancellationUpdate
              row={row}
              onUpdate={onUpdate}
              record={clientInsurance.find((c) => c.id === row.insuranceId) ?? null}
              onConfirmRenewed={onConfirmRenewed}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BatchTable({
  rows,
  onUpdate,
}: {
  rows: BatchRow[];
  onUpdate?: (row: BatchRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr>
            {['Client', 'DOT', 'On file', 'MOTUS cancellation', 'Note', ''].map((heading) => (
              <th
                key={heading}
                className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowKey} className="border-t border-divider">
              <td className="py-2 pr-2 text-ink">{row.legalName || row.sheetName || '—'}</td>
              <td className="py-2 pr-2">
                {row.accountUrl ? (
                  <a
                    href={row.accountUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {row.dotNumber}
                  </a>
                ) : (
                  row.dotNumber
                )}
              </td>
              <td className="py-2 pr-2">{displayIso(row.storedCancellationIso)}</td>
              <td className="py-2 pr-2">{row.cancellationDates || '—'}</td>
              <td className="py-2 pr-2 text-muted">{row.summary || '—'}</td>
              <td className="py-2 pr-2">
                <CancellationUpdate row={row} onUpdate={onUpdate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MotusDotImport({
  clientInsurance,
  onUpdateCancellation,
  onConfirmRenewed,
}: {
  clientInsurance: ClientInsurance[];
  onUpdateCancellation?: UpdateCancellation;
  onConfirmRenewed?: SaveInsurance;
}) {
  const stopRef = useRef(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [passLabel, setPassLabel] = useState('');

  const finished = rows.filter((row) => row.state === 'done' || row.state === 'error').length;

  function updateRow(rowKey: string, patch: Partial<BatchRow>) {
    setRows((current) => current.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)));
  }

  function insuranceForQuery(query: string): ClientInsurance | null {
    const matches = clientInsurance.filter((record) => motusQueryForClient(record) === query);
    return matches.length === 1 ? matches[0] : null;
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileError(null);
    setRows([]);
    try {
      const entries = parseMotusDotSheet(await file.arrayBuffer());
      setFileName(file.name);
      setRows(entries.map((entry) => emptyBatchRow(entry, insuranceForQuery(entry.query))));
    } catch (err) {
      setFileName('');
      setFileError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  async function applyCancellation(row: BatchRow) {
    if (!onUpdateCancellation || row.insuranceId == null || !row.proposedCancellationIso) return;
    updateRow(row.rowKey, { updateState: 'saving', updateError: '' });
    try {
      await onUpdateCancellation(row.insuranceId, row.proposedCancellationIso);
      updateRow(row.rowKey, {
        updateState: 'saved',
        storedIsCancellation: true,
        storedCancellationIso: row.proposedCancellationIso,
      });
    } catch (err) {
      updateRow(row.rowKey, {
        updateState: 'error',
        updateError: err instanceof Error ? err.message : 'Could not update',
      });
    }
  }

  async function checkEntries(pending: BatchRow[], retryFailures: boolean) {
    const failed: BatchRow[] = [];
    let cursor = 0;
    const worker = async () => {
      while (!stopRef.current) {
        const index = cursor;
        cursor += 1;
        const entry = pending[index];
        if (!entry) return;
        updateRow(entry.rowKey, { state: 'checking', summary: retryFailures ? 'Retrying MOTUS failure' : '' });
        try {
          const report = await lookupMotusInsurance(entry.query);
          const classified = classifyMotusReport(report);
          updateRow(entry.rowKey, {
            state: 'done',
            legalName: report.legalName || entry.sheetName || entry.query,
            dotNumber: report.dotNumber,
            verdict: classified.verdict,
            authorityStatus: classified.authorityStatus,
            docketNumber: classified.docketNumber,
            cancellationDates: classified.cancellationDates.join(', '),
            proposedCancellationIso: latestCancellationIso(classified.cancellationDates),
            summary: classified.summary,
            accountUrl: report.accountUrl,
          });
        } catch (err) {
          const summary = err instanceof Error ? err.message : 'MOTUS lookup failed';
          if (/no motus account|no operating authority/i.test(summary)) {
            updateRow(entry.rowKey, {
              state: 'done',
              verdict: 'inactive',
              authorityStatus: 'Inactive',
              summary,
            });
          } else {
            updateRow(entry.rowKey, {
              state: 'error',
              verdict: null,
              summary,
            });
            if (isRetryableMotusFailure(summary)) failed.push(entry);
          }
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return failed;
  }

  async function runEntries(pending: BatchRow[]) {
    if (!pending.length) return;
    stopRef.current = false;
    setRunning(true);
    setPassLabel('');
    const failed = await checkEntries(pending, false);
    if (!stopRef.current && failed.length) {
      setPassLabel(`Retrying ${failed.length} failed`);
      await checkEntries(failed, true);
    }
    setPassLabel('');
    setRunning(false);
  }

  async function runList() {
    await runEntries(rows.filter((row) => row.state !== 'done'));
  }

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [updatingAll, setUpdatingAll] = useState(false);

  const selectableClients = useMemo(
    () => [...clientInsurance].sort((a, b) => a.client.localeCompare(b.client)),
    [clientInsurance]
  );
  const visibleClients = selectableClients.filter((record) => {
    const haystack = `${record.client} ${record.dot} ${record.mc}`.toLowerCase();
    return haystack.includes(clientQuery.trim().toLowerCase());
  });
  const clientColumns = [visibleClients];
  const checkableVisible = visibleClients.filter((record) => motusQueryForClient(record));
  const visibleAllSelected =
    checkableVisible.length > 0 && checkableVisible.every((record) => selectedIds.includes(record.id));
  const selectedCount = selectedIds.length;
  const changedRows = rows.filter(rowNeedsUpdate);

  function toggleClient(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function runSelected() {
    const chosen = selectableClients.filter(
      (record) => selectedIds.includes(record.id) && motusQueryForClient(record)
    );
    if (!chosen.length) return;
    if (chosen.length > 400) {
      setFileError(`Select up to 400 clients at a time. ${chosen.length} are selected.`);
      return;
    }
    setFileError(null);
    setFileName('');
    const next = chosen.map((record) =>
      emptyBatchRow({ query: motusQueryForClient(record) as string, label: record.client }, record)
    );
    setRows(next);
    void runEntries(next);
  }

  async function updateChanged() {
    setUpdatingAll(true);
    for (const row of rows.filter(rowNeedsUpdate)) {
      await applyCancellation(row);
    }
    setUpdatingAll(false);
  }

  function download() {
    const done = rows.filter((row) => row.state === 'done' && row.verdict);
    const sheet = XLSX.utils.json_to_sheet(
      done.map((row) => ({
        Result: VERDICT_COPY[row.verdict as MotusListVerdict].title,
        Client: row.legalName,
        DOT: row.dotNumber,
        Authority: row.authorityStatus,
        Docket: row.docketNumber,
        'Cancellation dates': row.cancellationDates,
        Note: row.summary,
      }))
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'MOTUS');
    XLSX.writeFile(book, 'motus-dot-check.xlsx');
  }

  return (
    <section className="panel-surface p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Check clients</h2>
        <p className="mt-1 text-sm text-muted">
          Select client insurance records and check their DOT on MOTUS. If MOTUS has a new cancellation date, update
          that record from here.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={clientQuery}
          onChange={(event) => setClientQuery(event.target.value)}
          placeholder="Search clients or DOT"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={running || visibleClients.length === 0}
          onClick={() => {
            const ids = checkableVisible.map((record) => record.id);
            const allSelected = visibleAllSelected;
            setSelectedIds((current) =>
              allSelected
                ? current.filter((id) => !ids.includes(id))
                : [...new Set([...current, ...ids])]
            );
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          {visibleAllSelected ? 'Clear visible' : 'Select visible'}
        </button>
        <button
          type="button"
          disabled={running || selectedCount === 0}
          onClick={runSelected}
          className="inline-flex items-center rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {running ? passLabel || `Checking ${finished} of ${rows.length}` : `Check selected (${selectedCount})`}
        </button>
      </div>
      {running ? (
        <div className="rounded-lg border border-border bg-surface px-3 py-2.5" role="status" aria-live="polite">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span className="font-medium text-ink">
              {passLabel || `Checking clients on MOTUS · ${finished} of ${rows.length}`}
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">
                {rows.length ? Math.round((finished / rows.length) * 100) : 0}%
              </span>
              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                }}
                className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-ink hover:border-accent"
              >
                Stop
              </button>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${rows.length ? Math.max(3, (finished / rows.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-border">
        {visibleClients.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">No client insurance records yet.</p>
        ) : (
          <div className="grid grid-cols-1">
            {clientColumns.map((column, colIndex) => (
              <div key={colIndex} className="min-w-0">
                <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-panel px-3 py-1.5 text-[10px] uppercase tracking-widest text-label">
                  <span className="w-4" />
                  <span className="min-w-0 flex-1">Client</span>
                  <span className="w-20 text-right">On file</span>
                </div>
                <ul>
                  {column.map((record) => {
                    const checked = selectedIds.includes(record.id);
                    const cancelling = /cancel/i.test(record.status);
                    const onFile = cancelling ? displayIso(calendarIso(record.expiration_date)) : '—';
                    const disabled = running || !motusQueryForClient(record);
                    return (
                      <li key={record.id} className="border-b border-divider last:border-b-0">
                        <label
                          className={`flex items-center gap-3 px-3 py-2 hover:bg-surface ${
                            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          } ${checked ? 'bg-accent/10' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleClient(record.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{record.client}</span>
                            <span className="block font-mono text-[11px] text-muted">
                              {record.dot.trim() ? `DOT ${record.dot.trim()}` : 'No DOT'}
                            </span>
                          </span>
                          <span
                            className={`w-20 text-right text-xs ${cancelling ? 'font-medium text-red' : 'text-muted'}`}
                          >
                            {onFile}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">Or import a DOT list</h3>
        <p className="mt-1 text-sm text-muted">
          Upload an Excel or CSV file with a DOT column. A matching client can still be updated from the results.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={running}
          onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
        />
        <button
          type="button"
          disabled={running || rows.length === 0}
          onClick={() => void runList()}
          className="inline-flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {running ? passLabel || `Checking ${finished} of ${rows.length}` : 'Check list'}
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true;
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink"
          >
            Stop
          </button>
        ) : null}
        {rows.some((row) => row.state === 'done') ? (
          <button
            type="button"
            onClick={download}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink"
          >
            Download results
          </button>
        ) : null}
        {changedRows.length > 0 ? (
          <button
            type="button"
            disabled={updatingAll || running}
            onClick={() => void updateChanged()}
            className="rounded-lg btn-primary px-3 py-2 text-sm disabled:opacity-60"
          >
            {updatingAll ? 'Updating…' : `Update ${changedRows.length} cancellation date${changedRows.length === 1 ? '' : 's'}`}
          </button>
        ) : null}
      </div>
      {fileName ? (
        <p className="text-sm text-muted">
          {fileName} · {rows.length} numbers
        </p>
      ) : null}
      {fileError ? <p className="text-sm text-red">{fileError}</p> : null}
      {rows.some((row) => row.state === 'done' || row.state === 'error') ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
            {VERDICT_ORDER.map((verdict) => {
              const group = rows.filter((row) => row.verdict === verdict);
              const copy = VERDICT_COPY[verdict];
              return (
                <div key={verdict} className="min-w-0 overflow-hidden rounded-lg border border-border">
                  <div className={`px-3 py-2 ${copy.tone}`}>
                    <p className="text-sm font-semibold">
                      {copy.title} · {group.length}
                    </p>
                    <p className="text-xs">{copy.detail}</p>
                  </div>
                  <div className="max-h-[32rem] overflow-y-auto">
                    <BatchCards
                      rows={group}
                      onUpdate={(row) => void applyCancellation(row)}
                      clientInsurance={clientInsurance}
                      onConfirmRenewed={onConfirmRenewed}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {rows.some((row) => row.state === 'error') ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red">
                Could not check · {rows.filter((row) => row.state === 'error').length}
              </p>
              <BatchTable rows={rows.filter((row) => row.state === 'error')} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Signed-in MOTUS insurance lookup. Clients come from client insurance. */
export type MotusTab = 'check' | 'auto';

export function MotusInsurancePage({
  clientInsurance,
  onUpdateCancellation,
  onUpdateInsurance,
  tab: controlledTab,
  onTabChange,
}: {
  clientInsurance: ClientInsurance[];
  onUpdateCancellation: UpdateCancellation;
  onUpdateInsurance?: SaveInsurance;
  /** Optional: lets the app open the Auto check tab from the notification banner. */
  tab?: MotusTab;
  onTabChange?: (tab: MotusTab) => void;
}) {
  const autoCheck = useMotusAutoCheckContext();
  const [localTab, setLocalTab] = useState<MotusTab>('check');
  const tab = controlledTab ?? localTab;
  const setTab = (next: MotusTab) => {
    setLocalTab(next);
    onTabChange?.(next);
  };
  const issueCount = autoCheck ? countMotusIssues(autoCheck.data, clientInsurance) : 0;
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MotusInsuranceReport | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = query.trim();
    if (!next) {
      setError('Enter a DOT number, an MC number, or a MOTUS account link.');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      setReport(await lookupMotusInsurance(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MOTUS lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">MOTUS insurance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Reads the public FMCSA MOTUS account for a carrier or broker, opens each operating authority, and checks
            whether insurance is active and whether a cancellation date is on file.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist">
        {(
          [
            ['check', 'Check clients'],
            ['auto', 'Auto check'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
            {id === 'auto' && issueCount > 0 ? (
              <span className="rounded-full bg-red px-1.5 py-px text-[10px] font-semibold text-white">
                {issueCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'auto' && autoCheck ? (
        <MotusAutoCheckTab
          userId={autoCheck.userId}
          data={autoCheck.data}
          loading={autoCheck.loading}
          error={autoCheck.error}
          clientInsurance={clientInsurance}
          onReload={autoCheck.reload}
          onRefreshInsurance={autoCheck.onRefreshInsurance}
          onUpdateInsurance={onUpdateInsurance}
        />
      ) : (
        <>
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="DOT, MC, or motus.dot.gov account link"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      <MotusDotImport
        clientInsurance={clientInsurance}
        onUpdateCancellation={onUpdateCancellation}
        onConfirmRenewed={onUpdateInsurance}
      />

      {error ? (
        <p className="rounded-lg border border-red/30 bg-tag-overdue px-3 py-2 text-sm text-tag-overdue-fg">{error}</p>
      ) : null}

      {report ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              DOT {report.dotNumber}
              {report.insuranceActive ? ' · Active insurance' : ' · No active insurance'}
            </p>
            <a
              href={report.accountUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-accent hover:underline"
            >
              Account on MOTUS
            </a>
          </div>
          {report.authorities.map((authority) => (
            <AuthorityCard key={authority.id} authority={authority} />
          ))}
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
