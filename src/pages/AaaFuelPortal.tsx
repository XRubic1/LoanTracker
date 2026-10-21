import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Section } from '@/components/Section';
import {
  aaaDuePaid,
  aaaDueRemaining,
  aaaDueStatus,
  weekLabel,
  weekStartOf,
} from '@/lib/aaaDues';
import { AaaDueModal } from '@/components/modals/AaaDueModal';
import { AaaFuelInvoicePanel } from '@/components/AaaFuelInvoicePanel';
import {
  createAaaFuelDue,
  deleteAaaFuelDue,
  fetchAaaFuelData,
  matchTruClient,
  postAaaFuelDeduction,
  ALLOW_TWO_DAYS_MESSAGE,
  canMarkNotReceived,
  groupPaymentsByInvoice,
  invoiceReceiptState,
  setAaaFuelInvoiceReceipt,
  setAaaFuelReceipt,
  type AaaFuelData,
  type AaaReceiptStatus,
  type InvoiceGroup,
} from '@/lib/aaaFuel';
import { fmt, fmtDate } from '@/lib/utils';

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

/** Small receipt summary for a whole invoice. */
function InvoiceReceiptBadge({ group }: { group: InvoiceGroup }) {
  if (group.payments.length === 0) return <span className="text-[11px] text-muted">No payments yet</span>;
  const state = invoiceReceiptState(group);
  if (state === 'received') return <Badge variant="ok">All received</Badge>;
  if (state === 'not_received') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge variant="overdue">Not received</Badge>
        <span className="text-[10px] text-muted">
          {group.notReceived} of {group.payments.length} payment{group.payments.length === 1 ? '' : 's'}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="closed">Awaiting</Badge>
      {group.received > 0 && (
        <span className="text-[10px] text-muted">
          {group.received} of {group.payments.length} received
        </span>
      )}
    </div>
  );
}

/** The only screen AAA Fuel sees: AAA Mega Fuel invoices, the payments posted on them, and what is past due. */
export function AaaFuelPortal() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<AaaFuelData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<'payments' | 'history'>('payments');
  const [historyQuery, setHistoryQuery] = useState('');
  const [receivedFilter, setReceivedFilter] = useState<'all' | 'waiting' | 'received' | 'not_received'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  /** Inline notice under one payment or invoice (e.g. the 2-day rule). */
  const [notice, setNotice] = useState<{ key: string; text: string } | null>(null);

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

  const groups = useMemo(() => groupPaymentsByInvoice(data.closedPayments), [data.closedPayments]);
  const groupByDue = useMemo(() => {
    const map = new Map<number, InvoiceGroup>();
    for (const g of groups) if (g.dueId != null) map.set(g.dueId, g);
    return map;
  }, [groups]);
  const openDueIds = useMemo(() => new Set(data.openDues.map((d) => d.id)), [data.openDues]);

  /** History = invoices that are fully deducted, plus older stand-alone records. Open invoices live on Payments. */
  const historyGroups = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return groups.filter((g) => {
      if (g.dueId != null && openDueIds.has(g.dueId)) return false;
      if (q && !g.client.toLowerCase().includes(q)) return false;
      const state = invoiceReceiptState(g);
      return receivedFilter === 'all' || state === receivedFilter || (receivedFilter === 'waiting' && state === 'waiting');
    });
  }, [groups, openDueIds, historyQuery, receivedFilter]);
  const allHistory = useMemo(
    () => groups.filter((g) => g.dueId == null || !openDueIds.has(g.dueId)),
    [groups, openDueIds]
  );
  const countState = (state: 'received' | 'not_received' | 'waiting') =>
    allHistory.filter((g) => invoiceReceiptState(g) === state).length;
  const historyTotal = historyGroups.reduce((sum, g) => sum + g.deducted, 0);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setPaymentReceipt = async (id: number, paymentDate: string, status: AaaReceiptStatus) => {
    setNotice(null);
    if (status === 'not_received' && !canMarkNotReceived(paymentDate)) {
      setNotice({ key: `p-${id}`, text: ALLOW_TWO_DAYS_MESSAGE });
      return;
    }
    setBusy(true);
    try {
      await setAaaFuelReceipt(id, status);
      await reload();
    } catch (err) {
      setNotice({ key: `p-${id}`, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const setInvoiceReceipt = async (group: InvoiceGroup, status: AaaReceiptStatus) => {
    const key = `inv-${group.key}`;
    setNotice(null);
    if (status === 'not_received' && !group.payments.every((p) => canMarkNotReceived(p.paymentDate))) {
      setNotice({ key, text: ALLOW_TWO_DAYS_MESSAGE });
      return;
    }
    setBusy(true);
    try {
      if (group.dueId != null) {
        await setAaaFuelInvoiceReceipt(group.dueId, status);
      } else {
        for (const p of group.payments) await setAaaFuelReceipt(p.id, status);
      }
      await reload();
    } catch (err) {
      setNotice({ key, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const g_dueOpen = (group: InvoiceGroup) => group.dueId != null && openDueIds.has(group.dueId);

  const panelFor = (group: InvoiceGroup) => (
    <AaaFuelInvoicePanel
      group={group}
      busy={busy}
      notice={notice}
      onPayment={(id, date, status) => void setPaymentReceipt(id, date, status)}
      onInvoice={(g, status) => void setInvoiceReceipt(g, status)}
      onPostPayment={g_dueOpen(group) ? () => setOpenId(group.dueId) : undefined}
    />
  );

  const thClass =
    'border-b border-border px-4 py-2 text-left text-[10px] font-normal uppercase tracking-[0.05em] text-label';

  return (
    <div className="flex h-full w-full flex-col">
      <header className="topbar flex flex-shrink-0 items-center justify-between gap-3 px-6 py-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">AAA Mega Fuel</div>
          <div className="text-[11px] text-muted">Payments portal · {user?.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={() => void signOut()} className="theme-toggle">
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

          <div className="flex gap-1 border-b border-border" role="tablist">
            {(
              [
                ['payments', 'Payments', data.openDues.length],
                ['history', 'History', allHistory.length],
              ] as const
            ).map(([id, label, count]) => (
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
                <span className="count-badge">{count}</span>
              </button>
            ))}
          </div>

          {tab === 'payments' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Tile
                  label="Open payments"
                  value={String(data.openDues.length)}
                  sub="Waiting to be deducted"
                  tone="bg-accent"
                />
                <Tile
                  label="Left to be deducted"
                  value={fmt(totalLeft)}
                  sub="Across all open payments"
                  tone="bg-yellow"
                />
                <Tile
                  label="Past due"
                  value={String(pastDue.length)}
                  sub={pastDue.length ? `${fmt(pastDueLeft)} not yet deducted` : 'Nothing past due'}
                  tone={pastDue.length ? 'bg-red' : 'bg-label'}
                />
              </div>

              <Section title="Open payments" count={data.openDues.length} noPadding>
                <table className="w-full table-fixed border-collapse" data-no-sort>
                  <colgroup>
                    <col style={{ width: '27%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '27%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {['Client', 'Week', 'Amount', 'Received?', 'Status'].map((h) => (
                        <th key={h} className={thClass}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.openDues.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[12px] text-muted">
                          {loading ? 'Loading…' : 'No open payments. Use “Add payment” to create one.'}
                        </td>
                      </tr>
                    ) : (
                      data.openDues.map((d) => {
                        const status = aaaDueStatus(d);
                        const paid = aaaDuePaid(d);
                        const left = aaaDueRemaining(d);
                        const group: InvoiceGroup =
                          groupByDue.get(d.id) ??
                          ({
                            key: `due-${d.id}`,
                            dueId: d.id,
                            client: d.client,
                            weekStart: d.weekStart,
                            total: d.amount,
                            deducted: 0,
                            payments: [],
                            latestDate: d.weekStart,
                            received: 0,
                            notReceived: 0,
                          } as InvoiceGroup);
                        const isOpen = expanded.has(group.key);
                        return (
                          <Fragment key={d.id}>
                            <tr
                              role="button"
                              tabIndex={0}
                              onClick={() => toggle(group.key)}
                              onKeyDown={(e) => e.key === 'Enter' && toggle(group.key)}
                              className="row-hover cursor-pointer transition-colors"
                            >
                              <td className="overflow-hidden border-b border-border px-4 py-[11px] align-middle">
                                <div className="truncate text-[12px] font-medium text-ink">{d.client}</div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(group.key);
                                  }}
                                  aria-expanded={isOpen}
                                  className={`mt-0.5 inline-flex items-center gap-1 text-[11px] hover:underline ${
                                    group.payments.length === 0 ? 'text-muted' : 'text-accent'
                                  }`}
                                >
                                  <span className="inline-block w-2">{isOpen ? '▾' : '▸'}</span>
                                  {group.payments.length} payment{group.payments.length === 1 ? '' : 's'}
                                </button>
                              </td>
                              <td className="border-b border-border px-4 py-[11px] align-middle">
                                <span className="whitespace-nowrap text-[11px] text-muted2">
                                  {weekLabel(d.weekStart)}
                                </span>
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
                                <InvoiceReceiptBadge group={group} />
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
                            {isOpen && (
                              <tr>
                                <td colSpan={5} className="border-b border-border p-0">
                                  {panelFor(group)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Section>
            </>
          )}

          {tab === 'history' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="search"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Search client"
                  className="min-w-[220px] flex-1 border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none sm:max-w-sm"
                />
                <div className="flex gap-1" role="group" aria-label="Filter by received">
                  {(
                    [
                      ['all', 'All', allHistory.length],
                      ['waiting', 'Awaiting', countState('waiting')],
                      ['received', 'Received', countState('received')],
                      ['not_received', 'Not received', countState('not_received')],
                    ] as const
                  ).map(([id, label, count]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setReceivedFilter(id)}
                      className={`filter-btn ${receivedFilter === id ? 'filter-btn-active' : ''}`}
                    >
                      {label} <span className="text-muted">{count}</span>
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-muted2">
                  {historyGroups.length} invoice{historyGroups.length === 1 ? '' : 's'} · Total{' '}
                  <span className="font-medium text-green">{fmt(historyTotal)}</span>
                </span>
              </div>

              <Section title="Deducted invoices" count={historyGroups.length} noPadding>
                <table className="w-full table-fixed border-collapse" data-no-sort>
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {['Last payment', 'Client', 'Week', 'Amount', 'Received?'].map((h) => (
                        <th key={h} className={thClass}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyGroups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[12px] text-muted">
                          {loading
                            ? 'Loading…'
                            : historyQuery.trim() || receivedFilter !== 'all'
                              ? 'No invoices match that search.'
                              : 'Nothing has been fully deducted yet.'}
                        </td>
                      </tr>
                    ) : (
                      historyGroups.map((g) => {
                        const isOpen = expanded.has(g.key);
                        return (
                          <Fragment key={g.key}>
                            <tr
                              role="button"
                              tabIndex={0}
                              onClick={() => toggle(g.key)}
                              onKeyDown={(e) => e.key === 'Enter' && toggle(g.key)}
                              className="row-hover cursor-pointer transition-colors"
                            >
                              <td className="border-b border-border px-4 py-[11px] align-top text-[11px] text-muted2">
                                {fmtDate(g.latestDate)}
                              </td>
                              <td className="border-b border-border px-4 py-[11px] align-top">
                                <div className="text-[12px] font-medium text-ink">{g.client}</div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(g.key);
                                  }}
                                  aria-expanded={isOpen}
                                  className={`mt-0.5 inline-flex items-center gap-1 text-[11px] hover:underline ${
                                    g.payments.length === 0 ? 'text-muted' : 'text-accent'
                                  }`}
                                >
                                  <span className="inline-block w-2">{isOpen ? '▾' : '▸'}</span>
                                  {g.payments.length} payment{g.payments.length === 1 ? '' : 's'}
                                </button>
                              </td>
                              <td className="border-b border-border px-4 py-[11px] align-top text-[11px] text-muted2">
                                {g.weekStart ? weekLabel(g.weekStart) : '—'}
                              </td>
                              <td className="border-b border-border px-4 py-[11px] align-top">
                                <div className="text-[13px] font-medium text-green">{fmt(g.deducted)}</div>
                                {g.total - g.deducted > 0.001 && (
                                  <div className="text-[10px] text-muted">of {fmt(g.total)}</div>
                                )}
                              </td>
                              <td className="border-b border-border px-4 py-[11px] align-top">
                                <InvoiceReceiptBadge group={g} />
                              </td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={5} className="border-b border-border p-0">
                                  {panelFor(g)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Section>
            </>
          )}
        </div>
      </main>

      <AddFuelPaymentModal
        open={addOpen}
        clients={data.clients}
        onClose={() => setAddOpen(false)}
        onCreated={reload}
      />
      <AaaDueModal
        due={selected}
        open={selected != null}
        onClose={() => setOpenId(null)}
        onPost={async (due, deduction) => {
          const result = await postAaaFuelDeduction(due, deduction);
          await reload();
          return result;
        }}
        onDelete={async (id) => {
          await deleteAaaFuelDue(id);
          await reload();
        }}
      />
    </div>
  );
}
