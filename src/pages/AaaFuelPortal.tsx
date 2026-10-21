import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Section } from '@/components/Section';
import {
  aaaDuePaid,
  aaaDueRemaining,
  aaaDueStatus,
  dayLabel,
  sortedDeductions,
  weekLabel,
  weekStartOf,
} from '@/lib/aaaDues';
import { createAaaFuelDue, fetchAaaFuelData, matchTruClient, type AaaFuelData } from '@/lib/aaaFuel';
import { fmt, fmtDate } from '@/lib/utils';
import type { AaaDue } from '@/types';

const EMPTY: AaaFuelData = { openDues: [], closedPayments: [], clients: [] };
const REFRESH_MS = 60_000;

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const labelClass = 'block text-[11px] text-muted uppercase tracking-wider mb-1.5';
const inputClass = 'w-full border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none';

/** Add a Mega Fuel payment. The client must be a real Tru client; the database routes it to their team. */
function AddFuelPaymentModal({
  open,
  clients,
  onClose,
  onCreated,
}: {
  open: boolean;
  clients: string[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [amount, setAmount] = useState('');
  const [anyDay, setAnyDay] = useState(todayStr);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setAmount('');
    setAnyDay(todayStr());
    setError(null);
  }, [open]);

  const match = useMemo(() => matchTruClient(typed, clients), [typed, clients]);
  const amountNum = amount.trim() ? parseFloat(amount) : NaN;
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const week = anyDay ? weekStartOf(anyDay) : '';
  const notTruClient = typed.trim() !== '' && match.suggestions.length === 0 && !match.exact;
  const canCreate = match.exact != null && amountOk && week !== '' && !submitting;

  const accept = (name: string) => {
    setTyped(name);
    setFocused(false);
  };

  const submit = async () => {
    if (!match.exact) return;
    setError(null);
    setSubmitting(true);
    try {
      await createAaaFuelDue({ client: match.exact, amount: Math.round(amountNum * 100) / 100, weekStart: week });
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title="Add AAA Mega Fuel payment">
      <div className="space-y-4">
        <div className="relative">
          <label className={labelClass}>Client</label>
          <input
            type="text"
            value={typed}
            autoComplete="off"
            onChange={(e) => {
              setTyped(e.target.value);
              setFocused(true);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if ((e.key === 'Tab' || e.key === 'Enter') && !match.exact && match.suggestions[0]) {
                e.preventDefault();
                accept(match.suggestions[0]);
              }
            }}
            placeholder="Start typing a client name"
            className={inputClass}
            disabled={submitting}
          />
          {focused && !match.exact && match.suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-0.5 max-h-48 overflow-y-auto border border-border bg-panel">
              {match.suggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => accept(name)}
                    className="block w-full px-3 py-1.5 text-left text-[13px] text-ink hover:bg-surface"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 min-h-[16px] text-[11px]">
            {match.exact ? (
              <span className="font-medium text-green">✓ {match.exact}</span>
            ) : notTruClient ? (
              <span className="font-medium text-red">Not Tru Client</span>
            ) : typed.trim() ? (
              <span className="text-muted2">Pick a client from the list to continue.</span>
            ) : null}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Pay to</label>
            <div className={`${inputClass} text-muted2`}>AAA Mega Fuel</div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Due the week of</label>
          <input type="date" value={anyDay} onChange={(e) => setAnyDay(e.target.value)} className={inputClass} />
          {week && (
            <p className="mt-1.5 text-[11px] text-muted2">
              Week: <span className="font-medium text-ink">{weekLabel(week)}</span> (Mon–Sun)
            </p>
          )}
        </div>

        {error && (
          <p className="text-[12px] text-red" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="py-1.5 px-3.5 border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canCreate}
            className="py-1.5 px-3.5 btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Read-only view of every deduction (by day) posted against one payment. */
function DueDetailModal({ due, onClose }: { due: AaaDue | null; onClose: () => void }) {
  if (!due) return null;
  const paid = aaaDuePaid(due);
  const left = aaaDueRemaining(due);
  const deductions = sortedDeductions(due.deductions);
  return (
    <Modal open onClose={onClose} title={`${due.client} — AAA Mega Fuel`}>
      <div className="space-y-4">
        <p className="text-[13px] text-muted2">
          Week of {weekLabel(due.weekStart)}
          {aaaDueStatus(due) === 'past_due' && <span className="ml-2 font-medium text-red">Past due</span>}
        </p>
        <div className="py-2 border-b border-border text-[13px] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted2">Amount</span>
            <span className="font-mono font-medium text-yellow">{fmt(due.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted2">Deducted so far</span>
            <span className="font-mono text-green">{fmt(paid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted2">Left</span>
            <span className="font-mono font-medium text-accent">{fmt(left)}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted uppercase tracking-wider mb-1.5">Deductions by day</div>
          {deductions.length === 0 ? (
            <p className="text-[12px] text-muted2">Nothing has been deducted yet.</p>
          ) : (
            <ul className="border border-border divide-y divide-border">
              {deductions.map((d, i) => (
                <li key={`${d.date}-${i}`} className="flex items-center justify-between px-3 py-2 text-[12px]">
                  <span className="text-ink">{dayLabel(d.date)}</span>
                  <span className="font-mono font-medium text-green">{fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="panel-surface relative overflow-hidden px-4 py-4 pl-5">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${tone}`} />
      <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-2">{label}</div>
      <div className="kpi-value text-[26px] font-semibold leading-none text-ink">{value}</div>
      <div className="text-[11px] text-muted mt-2">{sub}</div>
    </div>
  );
}

/** The only screen AAA Fuel sees: AAA Mega Fuel payments, when they are deducted, and what is past due. */
export function AaaFuelPortal() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<AaaFuelData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await fetchAaaFuelData());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const pastDue = data.openDues.filter((d) => aaaDueStatus(d) === 'past_due');
  const totalLeft = data.openDues.reduce((sum, d) => sum + aaaDueRemaining(d), 0);
  const pastDueLeft = pastDue.reduce((sum, d) => sum + aaaDueRemaining(d), 0);
  const selected = openId != null ? data.openDues.find((d) => d.id === openId) ?? null : null;

  return (
    <div className="flex h-full w-full flex-col">
      <header className="topbar flex flex-shrink-0 items-center justify-between gap-3 px-6 py-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">AAA Mega Fuel</div>
          <div className="text-[11px] text-muted">Payments portal · {user?.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void signOut()}
            className="theme-toggle"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="main min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="page-title">Mega Fuel payments</h1>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="btn-primary h-8 px-4 text-xs whitespace-nowrap"
            >
              + Add payment
            </button>
          </div>

          {error && (
            <p className="alert-banner-warn text-[12px]" role="alert">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              label="Open payments"
              value={String(data.openDues.length)}
              sub="Waiting to be deducted"
              tone="bg-accent"
            />
            <Tile label="Left to be deducted" value={fmt(totalLeft)} sub="Across all open payments" tone="bg-yellow" />
            <Tile
              label="Past due"
              value={String(pastDue.length)}
              sub={pastDue.length ? `${fmt(pastDueLeft)} not yet deducted` : 'Nothing past due'}
              tone={pastDue.length ? 'bg-red' : 'bg-label'}
            />
          </div>

          <Section title="Open payments" count={data.openDues.length} noPadding>
            <table className="w-full table-fixed border-collapse" data-default-sort="1:asc">
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Client', 'Week', 'Amount', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-4 py-2 text-left text-[10px] font-normal uppercase tracking-[0.05em] text-label"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.openDues.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[12px] text-muted">
                      {loading ? 'Loading…' : 'No open payments. Use “Add payment” to create one.'}
                    </td>
                  </tr>
                ) : (
                  data.openDues.map((d) => {
                    const status = aaaDueStatus(d);
                    const paid = aaaDuePaid(d);
                    const left = aaaDueRemaining(d);
                    return (
                      <tr
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setOpenId(d.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setOpenId(d.id)}
                        className="row-hover cursor-pointer transition-colors"
                      >
                        <td className="overflow-hidden border-b border-border px-4 py-[11px] align-middle">
                          <div className="truncate text-[12px] font-medium text-ink">{d.client}</div>
                        </td>
                        <td className="border-b border-border px-4 py-[11px] align-middle">
                          <span className="whitespace-nowrap text-[11px] text-muted2">{weekLabel(d.weekStart)}</span>
                        </td>
                        <td className="border-b border-border px-4 py-[11px] align-middle">
                          {paid > 0 ? (
                            <div className="max-w-[210px]">
                              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                                <span className="text-[13px] font-semibold text-yellow">{fmt(left)}</span>
                                <span className="text-[10px] text-muted">left</span>
                              </div>
                              <div className="mt-1.5 h-[4px] overflow-hidden bg-border">
                                <div
                                  className="h-full bg-green"
                                  style={{ width: `${Math.min(100, (paid / d.amount) * 100)}%` }}
                                />
                              </div>
                              <div className="mt-1 flex justify-between gap-3 whitespace-nowrap text-[10px] text-muted">
                                <span className="text-green">{fmt(paid)} deducted</span>
                                <span>of {fmt(d.amount)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[13px] font-medium text-yellow">{fmt(d.amount)}</div>
                          )}
                        </td>
                        <td className="border-b border-border px-4 py-[11px] align-middle">
                          <div className="flex flex-col items-start gap-1">
                            {status === 'past_due' ? (
                              <Badge variant="overdue">Past due</Badge>
                            ) : status === 'upcoming' ? (
                              <Badge variant="closed">Upcoming</Badge>
                            ) : (
                              <Badge variant="due">Due</Badge>
                            )}
                            {paid > 0 && <Badge variant="ok">Partial</Badge>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Deducted (closed)" count={data.closedPayments.length} noPadding>
            <table className="w-full table-fixed border-collapse" data-no-sort>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '34%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Closed', 'Client', 'Week', 'Amount'].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-4 py-2 text-left text-[10px] font-normal uppercase tracking-[0.05em] text-label"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.closedPayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[12px] text-muted">
                      {loading ? 'Loading…' : 'Nothing has been fully deducted yet.'}
                    </td>
                  </tr>
                ) : (
                  data.closedPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="border-b border-border px-4 py-[11px] align-top text-[11px] text-muted2">
                        {fmtDate(p.paymentDate)}
                      </td>
                      <td className="border-b border-border px-4 py-[11px] align-top text-[12px] font-medium text-ink">
                        {p.client}
                      </td>
                      <td className="border-b border-border px-4 py-[11px] align-top text-[11px] text-muted2">
                        {p.weekStart ? weekLabel(p.weekStart) : '—'}
                      </td>
                      <td className="border-b border-border px-4 py-[11px] align-top">
                        <div className="text-[13px] font-medium text-green">{fmt(p.amount)}</div>
                        {(p.deductions?.length ?? 0) > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {sortedDeductions(p.deductions ?? []).map((d, i) => (
                              <li
                                key={`${d.date}-${i}`}
                                className="flex items-center justify-between gap-3 text-[10px] text-muted"
                              >
                                <span>{dayLabel(d.date)}</span>
                                <span className="text-muted2">{fmt(d.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Section>
        </div>
      </main>

      <AddFuelPaymentModal
        open={addOpen}
        clients={data.clients}
        onClose={() => setAddOpen(false)}
        onCreated={reload}
      />
      <DueDetailModal due={selected} onClose={() => setOpenId(null)} />
    </div>
  );
}
