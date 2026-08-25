import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAllClientInsuranceForAdmin,
  fetchAllLoansForAdmin,
  fetchCompaniesForAdmin,
  triggerBrokerSnapshotSync,
  updateClientInsurance,
  type AdminInsuranceRow,
  type AdminLoanRow,
} from '@/lib/supabase-db';
import { isBrokerSnapshotEligibleStatus } from '@/lib/brokersnapshot';
import {
  getClientInsuranceStatusLabel,
  getDaysUntilCancellation,
  getInsuranceCancelDateForDisplay,
  isClientInsuranceCancellationWithDate,
} from '@/lib/clientInsuranceUtils';
import {
  fmt,
  fmtDate,
  getLoanOverdueStatusLabel,
  getLoanProviderDisplay,
  getLoanRemaining,
  isDueThisWeek,
} from '@/lib/utils';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import type { ClientInsurance, Loan } from '@/types';

/** Pause between one-client edge invokes — keeps under idle timeout and eases API load. */
const CLIENT_CHECK_PAUSE_MS = 700;
/** Seed ETA until the first few clients finish (ms per client). */
const INITIAL_MS_PER_CLIENT = 2800;
/** Survives tab refresh so interrupted checks can resume. */
const CHECK_CHECKPOINT_KEY = 'opsdesk.clientInsuranceCheckCheckpoint';

type KindFilter = 'all' | 'ok' | 'cancellation' | 'inactive' | 'out';

type FoundCancellation = {
  id: number;
  client: string;
  mc: string;
  team: string | null;
  cancellationDate: string | null;
};

/** FMCSA Out of Service / inactive authority found during Check API. */
type FoundOutOfService = {
  id: number;
  client: string;
  mc: string;
  team: string | null;
  operatingStatus: string;
  appStatus: string;
};

/** Per-client snapshot captured during Check API for the Log button. */
type ClientCheckLogEntry = {
  id: number;
  client: string;
  mc: string;
  dot: string;
  status: string;
  expirationDate: string | null;
  lastCancellationDate: string | null;
  team: string | null;
  companyId: number | null;
  /** MC string sent to BrokerSnapshot (lookup is MC-only; DOT is never used). */
  requestMc: string;
  mcLooksLikeDot: boolean;
  mcEqualsDot: boolean;
  syncRunId: number | null;
  clientsChecked: number;
  cancellationsFound: number;
  outOfServiceFound: number;
  errorsCount: number;
  cancellationHits: {
    client_insurance_id: number;
    client: string;
    mc: string;
    cancellation_date: string | null;
  }[];
  outOfServiceHits: {
    client_insurance_id: number;
    client: string;
    mc: string;
    operating_status: string;
    app_status: string;
    status_updated: boolean;
  }[];
  error: string | null;
  /** Full insurance row at check time. */
  insurance: ClientInsurance;
};

/** True when MC looks like a USDOT (often 7+ digits) rather than a typical MC. */
function mcLooksLikeDotNumber(mc: string, dot: string): boolean {
  const mcDigits = String(mc ?? '').replace(/\D/g, '');
  const dotDigits = String(dot ?? '').replace(/\D/g, '');
  if (!mcDigits) return false;
  if (dotDigits && mcDigits === dotDigits) return true;
  return mcDigits.length >= 7;
}

type CheckCheckpoint = {
  companyFilter: number | 'all';
  /** Full ordered queue of client_insurance ids for this run. */
  queueIds: number[];
  /** Next index in queueIds to process. */
  nextIndex: number;
  foundCancellations: FoundCancellation[];
  foundOutOfService?: FoundOutOfService[];
  errorsCount: number;
  runErrors: string[];
  startedAt: number;
  reason: 'stopped' | 'error' | 'interrupted';
};

type CheckProgress = {
  total: number;
  completed: number;
  currentClient: string;
  currentMc: string;
  currentTeam: string | null;
  startedAt: number;
  cancellationsFound: number;
  foundCancellations: FoundCancellation[];
  outOfServiceFound: number;
  foundOutOfService: FoundOutOfService[];
  errorsCount: number;
  stopped: boolean;
};

/** Last Check API run summary shown after finish / interrupt. */
type CheckResults = {
  status: 'finished' | 'stopped' | 'error' | 'interrupted';
  checked: number;
  total: number;
  foundCancellations: FoundCancellation[];
  foundOutOfService: FoundOutOfService[];
  errorsCount: number;
  runErrors: string[];
  finishedAt: number;
  /** Full per-client details for the Log button. */
  clientLogs: ClientCheckLogEntry[];
};

/** Format ms as m:ss for the progress timer. */
function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCheckpoint(): CheckCheckpoint | null {
  try {
    const raw = sessionStorage.getItem(CHECK_CHECKPOINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckCheckpoint;
    if (!Array.isArray(parsed.queueIds) || typeof parsed.nextIndex !== 'number') return null;
    if (parsed.nextIndex >= parsed.queueIds.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCheckpoint(cp: CheckCheckpoint): void {
  try {
    sessionStorage.setItem(CHECK_CHECKPOINT_KEY, JSON.stringify(cp));
  } catch {
    // ignore quota / private mode
  }
}

function clearCheckpoint(): void {
  try {
    sessionStorage.removeItem(CHECK_CHECKPOINT_KEY);
  } catch {
    // ignore
  }
}

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isInactive(status: string): boolean {
  return (status ?? '').trim().toLowerCase() === 'inactive';
}

function isOut(status: string): boolean {
  return (status ?? '').trim().toLowerCase() === 'out';
}

function isOk(status: string): boolean {
  return (status ?? '').trim().toLowerCase() === 'ok';
}

function isPendingCancellation(row: AdminInsuranceRow): boolean {
  const s = (row.insurance.status ?? '').trim().toLowerCase();
  if (s === 'inactive' || s === 'ok' || s === 'out') return false;
  return (
    s.includes('cancellation') ||
    s.includes('cancelled') ||
    s.includes('canceled') ||
    isClientInsuranceCancellationWithDate(row.insurance)
  );
}

function matchesKind(row: AdminInsuranceRow, kind: KindFilter): boolean {
  if (kind === 'all') return true;
  if (kind === 'ok') return isOk(row.insurance.status);
  if (kind === 'inactive') return isInactive(row.insurance.status);
  if (kind === 'out') return isOut(row.insurance.status);
  return isPendingCancellation(row);
}

function isLoanClosed(loan: Loan): boolean {
  return loan.paidCount >= loan.totalInstallments;
}

function getLoanStatus(loan: Loan): {
  variant: 'due' | 'overdue' | 'ok' | 'closed';
  label: string;
} {
  if (isLoanClosed(loan)) return { variant: 'closed', label: 'Closed' };
  try {
    const overdueLabel = getLoanOverdueStatusLabel(loan);
    if (overdueLabel) return { variant: 'overdue', label: overdueLabel };
    if (isDueThisWeek(loan)) return { variant: 'due', label: 'Open' };
  } catch {
    // ignore
  }
  return { variant: 'ok', label: 'Pending' };
}

/** Loans for an insurance client on the same team (name match). */
function loansForInsurance(
  insurance: AdminInsuranceRow,
  loans: AdminLoanRow[]
): AdminLoanRow[] {
  const n = normName(insurance.insurance.client);
  return loans.filter(
    (l) =>
      l.companyId === insurance.companyId &&
      normName(l.loan.client) === n
  );
}

/**
 * Platform Client Insurance view with BrokerSnapshot check and related loans.
 */
export function ClientInsuranceTab() {
  const [rows, setRows] = useState<AdminInsuranceRow[]>([]);
  const [loans, setLoans] = useState<AdminLoanRow[]>([]);
  const [companies, setCompanies] = useState<
    { id: number; name: string; owner_id: string | null }[]
  >([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<CheckProgress | null>(null);
  const [checkNowMs, setCheckNowMs] = useState(() => Date.now());
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<CheckResults | null>(null);
  const [checkCheckpoint, setCheckCheckpoint] = useState<CheckCheckpoint | null>(() =>
    readCheckpoint()
  );
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminInsuranceRow | null>(null);
  const [dotDraft, setDotDraft] = useState('');
  const [savingDot, setSavingDot] = useState(false);
  const [dotError, setDotError] = useState<string | null>(null);
  const stopCheckRef = useRef(false);
  const rowsByIdRef = useRef<Map<number, AdminInsuranceRow>>(new Map());

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const companyId = companyFilter === 'all' ? null : companyFilter;
        const [insuranceRows, companyRows, loanRows] = await Promise.all([
          fetchAllClientInsuranceForAdmin(companyId),
          fetchCompaniesForAdmin(),
          fetchAllLoansForAdmin(companyId),
        ]);
        setRows(insuranceRows);
        setLoans(loanRows);
        setCompanies(
          companyRows.map((c) => ({ id: c.id, name: c.name, owner_id: c.owner_id }))
        );
        rowsByIdRef.current = new Map(
          insuranceRows.map((r) => [r.insurance.id, r] as const)
        );
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : String(err));
        } else {
          console.warn('Insurance refresh failed:', err);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [companyFilter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep DOT draft in sync when the detail modal opens or switches client.
  useEffect(() => {
    if (!detail) {
      setDotDraft('');
      setDotError(null);
      return;
    }
    setDotDraft(detail.insurance.dot ?? '');
    setDotError(null);
  }, [detail]);

  /** Persist DOT on the open insurance record and refresh local row state. */
  const handleSaveDot = async () => {
    if (!detail || savingDot) return;
    const nextDot = dotDraft.trim();
    setSavingDot(true);
    setDotError(null);
    try {
      const saved = await updateClientInsurance(detail.insurance.id, {
        ...detail.insurance,
        dot: nextDot,
      });
      const nextRow: AdminInsuranceRow = {
        ...detail,
        insurance: saved,
      };
      setDetail(nextRow);
      setRows((prev) =>
        prev.map((r) => (r.insurance.id === saved.id ? { ...r, insurance: saved } : r))
      );
      rowsByIdRef.current.set(saved.id, nextRow);
    } catch (err) {
      setDotError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDot(false);
    }
  };


  // Tick the live timer while a Check API run is in progress.
  useEffect(() => {
    if (!checking) return;
    setCheckNowMs(Date.now());
    const id = window.setInterval(() => setCheckNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [checking]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => matchesKind(r, kindFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.insurance.client.toLowerCase().includes(q) ||
          r.insurance.mc.toLowerCase().includes(q) ||
          r.insurance.dot.toLowerCase().includes(q) ||
          (r.companyName?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const aCancel = isPendingCancellation(a);
        const bCancel = isPendingCancellation(b);
        if (aCancel !== bCancel) return aCancel ? -1 : 1;
        if (aCancel && bCancel) {
          const aDays = getDaysUntilCancellation(a.insurance) ?? 9999;
          const bDays = getDaysUntilCancellation(b.insurance) ?? 9999;
          if (aDays !== bDays) return aDays - bDays;
        }
        return a.insurance.client.localeCompare(b.insurance.client);
      });
  }, [rows, search, kindFilter]);

  const counts = useMemo(() => {
    let ok = 0;
    let cancellation = 0;
    let inactive = 0;
    let out = 0;
    for (const r of rows) {
      if (isOk(r.insurance.status)) ok += 1;
      else if (isInactive(r.insurance.status)) inactive += 1;
      else if (isOut(r.insurance.status)) out += 1;
      else if (isPendingCancellation(r)) cancellation += 1;
    }
    return { ok, cancellation, inactive, out, total: rows.length };
  }, [rows]);

  const checkableRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.insurance.mc ?? '').trim().length > 0 &&
          isBrokerSnapshotEligibleStatus(r.insurance.status)
      ),
    [rows]
  );
  const checkableCount = checkableRows.length;

  const checkTimer = useMemo(() => {
    if (!checkProgress) return null;
    const elapsedMs = Math.max(0, checkNowMs - checkProgress.startedAt);
    const done = checkProgress.completed;
    const remaining = Math.max(0, checkProgress.total - done);
    const msPerClient =
      done > 0 ? elapsedMs / done : INITIAL_MS_PER_CLIENT;
    const remainingMs = remaining * msPerClient;
    const etaAt = new Date(checkNowMs + remainingMs);
    const pct =
      checkProgress.total > 0
        ? Math.min(100, Math.round((done / checkProgress.total) * 100))
        : 0;
    return {
      elapsedLabel: formatDuration(elapsedMs),
      remainingLabel: formatDuration(remainingMs),
      etaClock: etaAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      pct,
      remaining,
    };
  }, [checkProgress, checkNowMs]);

  const detailLoans = useMemo(() => {
    if (!detail) return [];
    return loansForInsurance(detail, loans).sort((a, b) => {
      const aClosed = isLoanClosed(a.loan) ? 1 : 0;
      const bClosed = isLoanClosed(b.loan) ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;
      return a.loan.client.localeCompare(b.loan.client);
    });
  }, [detail, loans]);

  const handleStopCheck = () => {
    stopCheckRef.current = true;
    setCheckProgress((prev) => (prev ? { ...prev, stopped: true } : prev));
  };

  const discardCheckpoint = useCallback(() => {
    clearCheckpoint();
    setCheckCheckpoint(null);
    setCheckMessage(null);
    setCheckResults(null);
  }, []);

  /**
   * Run or resume a one-client-at-a-time BrokerSnapshot check.
   * Saves a checkpoint when interrupted so the user can continue later.
   */
  const runCheckQueue = useCallback(
    async (opts: {
      queue: AdminInsuranceRow[];
      startIndex: number;
      companyFilter: number | 'all';
      startedAt: number;
      foundCancellations: FoundCancellation[];
      foundOutOfService: FoundOutOfService[];
      errorsCount: number;
      runErrors: string[];
      confirm?: boolean;
    }) => {
      const {
        queue,
        startIndex,
        companyFilter: filter,
        startedAt,
        confirm = false,
      } = opts;

      if (queue.length === 0 || startIndex >= queue.length) {
        clearCheckpoint();
        setCheckCheckpoint(null);
        setCheckMessage('Nothing left to check.');
        return;
      }

      const remaining = queue.length - startIndex;
      if (confirm) {
        const teamLabel =
          filter === 'all'
            ? 'all teams'
            : companies.find((c) => c.id === filter)?.name ?? 'selected team';
        const estMinutes = Math.max(
          1,
          Math.ceil((remaining * INITIAL_MS_PER_CLIENT) / 60000)
        );
        const resumeNote =
          startIndex > 0
            ? `Resume from client ${startIndex + 1} of ${queue.length} (${remaining} left).`
            : `Check ${queue.length} client(s) on ${teamLabel}.`;
        if (
          !window.confirm(
            `${resumeNote}\n\nOne at a time (~${estMinutes} min for remaining). Progress is saved if interrupted.`
          )
        ) {
          return;
        }
      }

      const ownerIds =
        filter === 'all'
          ? undefined
          : companies
              .filter((c) => c.id === filter && c.owner_id)
              .map((c) => c.owner_id as string);

      stopCheckRef.current = false;
      setChecking(true);
      setCheckMessage(null);
      setError(null);
      // Fresh run clears any prior incomplete checkpoint until we interrupt again.
      if (startIndex === 0) {
        clearCheckpoint();
        setCheckCheckpoint(null);
        setCheckResults(null);
      }

      let foundCancellations = [...opts.foundCancellations];
      let foundOutOfService = [...opts.foundOutOfService];
      let errorsCount = opts.errorsCount;
      let runErrors = [...opts.runErrors];
      let nextIndex = startIndex;
      let fatalMessage: string | null = null;
      const clientLogs: ClientCheckLogEntry[] = [];

      /** Build a log row for one checked client (success or failure). */
      const pushClientLog = (
        row: AdminInsuranceRow,
        result: Awaited<ReturnType<typeof triggerBrokerSnapshotSync>> | null,
        error: string | null
      ) => {
        const ins = row.insurance;
        clientLogs.push({
          id: ins.id,
          client: ins.client,
          mc: ins.mc,
          dot: ins.dot,
          status: ins.status,
          expirationDate: ins.expiration_date,
          lastCancellationDate: ins.last_cancellation_date,
          team: row.companyName,
          companyId: row.companyId,
          requestMc: ins.mc,
          mcLooksLikeDot: mcLooksLikeDotNumber(ins.mc, ins.dot),
          mcEqualsDot: Boolean(
            ins.mc &&
              ins.dot &&
              String(ins.mc).replace(/\D/g, '') === String(ins.dot).replace(/\D/g, '')
          ),
          syncRunId: result?.sync_run_id ?? null,
          clientsChecked: result?.clients_checked ?? 0,
          cancellationsFound: result?.cancellations_found ?? 0,
          outOfServiceFound: result?.out_of_service_found ?? 0,
          errorsCount: result?.errors_count ?? (error ? 1 : 0),
          cancellationHits: result?.cancellation_hits ?? [],
          outOfServiceHits: result?.out_of_service_hits ?? [],
          error,
          insurance: { ...ins },
        });
      };

      const first = queue[startIndex];
      setCheckProgress({
        total: queue.length,
        completed: startIndex,
        currentClient: first?.insurance.client ?? '…',
        currentMc: first?.insurance.mc ?? '',
        currentTeam: first?.companyName ?? null,
        startedAt,
        cancellationsFound: foundCancellations.length,
        foundCancellations,
        outOfServiceFound: foundOutOfService.length,
        foundOutOfService,
        errorsCount,
        stopped: false,
      });

      const persistPartial = (reason: CheckCheckpoint['reason'], index: number) => {
        const cp: CheckCheckpoint = {
          companyFilter: filter,
          queueIds: queue.map((r) => r.insurance.id),
          nextIndex: index,
          foundCancellations,
          foundOutOfService,
          errorsCount,
          runErrors,
          startedAt,
          reason,
        };
        writeCheckpoint(cp);
        setCheckCheckpoint(cp);
      };

      try {
        for (let i = startIndex; i < queue.length; i++) {
          if (stopCheckRef.current) {
            nextIndex = i;
            persistPartial('stopped', i);
            break;
          }

          const row = queue[i];
          setCheckProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: i,
                  currentClient: row.insurance.client,
                  currentMc: row.insurance.mc,
                  currentTeam: row.companyName,
                  cancellationsFound: foundCancellations.length,
                  foundCancellations,
                  outOfServiceFound: foundOutOfService.length,
                  foundOutOfService,
                  errorsCount,
                }
              : prev
          );

          try {
            const result = await triggerBrokerSnapshotSync({
              clientInsuranceIds: [row.insurance.id],
              ...(ownerIds?.length ? { ownerIds } : {}),
            });
            errorsCount += result.errors_count ?? 0;
            pushClientLog(row, result, null);

            const hits = result.cancellation_hits ?? [];
            if (hits.length > 0) {
              for (const hit of hits) {
                if (foundCancellations.some((f) => f.id === hit.client_insurance_id)) continue;
                foundCancellations.push({
                  id: hit.client_insurance_id,
                  client: hit.client || row.insurance.client,
                  mc: hit.mc || row.insurance.mc,
                  team: row.companyName,
                  cancellationDate: hit.cancellation_date,
                });
              }
            } else if ((result.cancellations_found ?? 0) > 0) {
              if (!foundCancellations.some((f) => f.id === row.insurance.id)) {
                foundCancellations.push({
                  id: row.insurance.id,
                  client: row.insurance.client,
                  mc: row.insurance.mc,
                  team: row.companyName,
                  cancellationDate: null,
                });
              }
            }

            const oosHits = result.out_of_service_hits ?? [];
            for (const hit of oosHits) {
              if (foundOutOfService.some((f) => f.id === hit.client_insurance_id)) continue;
              foundOutOfService.push({
                id: hit.client_insurance_id,
                client: hit.client || row.insurance.client,
                mc: hit.mc || row.insurance.mc,
                team: row.companyName,
                operatingStatus: hit.operating_status,
                appStatus: hit.app_status,
              });
            }
          } catch (err) {
            errorsCount += 1;
            const msg = err instanceof Error ? err.message : String(err);
            pushClientLog(row, null, msg);
            if (runErrors.length < 8) {
              runErrors.push(`${row.insurance.client}: ${msg.split('\n')[0]}`);
            }
            // Hard failures (timeout / compute) — pause and offer continue.
            const lower = msg.toLowerCase();
            if (
              lower.includes('idle_timeout') ||
              lower.includes('timeout') ||
              lower.includes('compute') ||
              lower.includes('worker_limit') ||
              lower.includes('504') ||
              lower.includes('failed to send a request')
            ) {
              fatalMessage = msg;
              nextIndex = i; // retry this client on continue
              persistPartial('error', i);
              break;
            }
          }

          nextIndex = i + 1;
          setCheckProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: nextIndex,
                  cancellationsFound: foundCancellations.length,
                  foundCancellations,
                  outOfServiceFound: foundOutOfService.length,
                  foundOutOfService,
                  errorsCount,
                }
              : prev
          );

          // Keep checkpoint fresh so a refresh mid-run can still resume.
          if (nextIndex < queue.length) {
            persistPartial('interrupted', nextIndex);
          }

          if (i < queue.length - 1 && !stopCheckRef.current) {
            await sleep(CLIENT_CHECK_PAUSE_MS);
          }
        }

        const incomplete = nextIndex < queue.length;
        const stopped = stopCheckRef.current;
        if (incomplete) {
          persistPartial(
            fatalMessage ? 'error' : stopped ? 'stopped' : 'interrupted',
            nextIndex
          );
          const reasonLabel = fatalMessage
            ? 'Interrupted by error'
            : stopped
              ? 'Stopped'
              : 'Interrupted';
          const resultStatus: CheckResults['status'] = fatalMessage
            ? 'error'
            : stopped
              ? 'stopped'
              : 'interrupted';
          setCheckResults({
            status: resultStatus,
            checked: nextIndex,
            total: queue.length,
            foundCancellations: [...foundCancellations],
            foundOutOfService: [...foundOutOfService],
            errorsCount,
            runErrors: [...runErrors],
            finishedAt: Date.now(),
            clientLogs: [...clientLogs],
          });
          setCheckMessage(
            `${reasonLabel}: checked ${nextIndex} of ${queue.length}. ` +
              (foundCancellations.length
                ? `${foundCancellations.length} pending cancellation(s)`
                : 'No pending cancellations') +
              (foundOutOfService.length
                ? ` · ${foundOutOfService.length} out-of-service`
                : '') +
              `. Use Continue check to resume.`
          );
          if (fatalMessage) {
            setError(fatalMessage);
          }
        } else {
          clearCheckpoint();
          setCheckCheckpoint(null);
          setCheckResults({
            status: 'finished',
            checked: queue.length,
            total: queue.length,
            foundCancellations: [...foundCancellations],
            foundOutOfService: [...foundOutOfService],
            errorsCount,
            runErrors: [...runErrors],
            finishedAt: Date.now(),
            clientLogs: [...clientLogs],
          });
          setCheckMessage(
            `Finished: checked ${queue.length} client(s) · ${foundCancellations.length} cancellation(s) · ${foundOutOfService.length} OOS · ${errorsCount} error(s)`
          );
        }

        await load({ silent: true });
      } catch (err) {
        persistPartial('error', nextIndex);
        setError(err instanceof Error ? err.message : String(err));
        setCheckResults({
          status: 'error',
          checked: nextIndex,
          total: queue.length,
          foundCancellations: [...foundCancellations],
          foundOutOfService: [...foundOutOfService],
          errorsCount,
          runErrors: [...runErrors],
          finishedAt: Date.now(),
          clientLogs: [...clientLogs],
        });
        setCheckMessage(
          foundCancellations.length > 0 || foundOutOfService.length > 0
            ? `Check interrupted. ${foundCancellations.length} pending cancellation(s), ${foundOutOfService.length} OOS listed in results. Use Continue check to resume.`
            : 'Check interrupted. Use Continue check to resume.'
        );

      } finally {
        setChecking(false);
        setCheckProgress(null);
      }
    },
    [companies, load]
  );

  const handleCheckApi = () => {
    if (checkableCount === 0) {
      window.alert('No clients with MC numbers eligible for BrokerSnapshot check.');
      return;
    }
    const queue = [...checkableRows].sort((a, b) =>
      a.insurance.client.localeCompare(b.insurance.client)
    );
    void runCheckQueue({
      queue,
      startIndex: 0,
      companyFilter,
      startedAt: Date.now(),
      foundCancellations: [],
      foundOutOfService: [],
      errorsCount: 0,
      runErrors: [],
      confirm: true,
    });
  };

  const handleContinueCheck = () => {
    const cp = checkCheckpoint ?? readCheckpoint();
    if (!cp) return;

    if (cp.companyFilter !== companyFilter) {
      const ok = window.confirm(
        'Saved check used a different team filter. Switch to that filter and continue?'
      );
      if (!ok) return;
      setCompanyFilter(cp.companyFilter);
      // Rows for the other filter may not be loaded yet — rebuild from ids where possible.
    }

    const byId = new Map(rows.map((r) => [r.insurance.id, r] as const));
    for (const [id, row] of rowsByIdRef.current) {
      if (!byId.has(id)) byId.set(id, row);
    }

    const queue: AdminInsuranceRow[] = [];
    for (const id of cp.queueIds) {
      const row = byId.get(id);
      if (row) {
        queue.push(row);
      } else {
        // Placeholder so indices stay aligned; skip at runtime if missing.
        queue.push({
          insurance: {
            id,
            client: `Client #${id}`,
            mc: '',
            status: 'OK',
          } as AdminInsuranceRow['insurance'],
          companyName: null,
          companyId: null,
        });
      }
    }

    // Drop leading entries already done; keep nextIndex meaning.
    let startIndex = Math.min(cp.nextIndex, queue.length);
    // Skip placeholders / empty MC at resume point.
    while (
      startIndex < queue.length &&
      (!(queue[startIndex].insurance.mc ?? '').trim() ||
        queue[startIndex].insurance.client.startsWith('Client #'))
    ) {
      startIndex += 1;
    }

    void runCheckQueue({
      queue,
      startIndex,
      companyFilter: cp.companyFilter,
      startedAt: Date.now(),
      foundCancellations: cp.foundCancellations ?? [],
      foundOutOfService: cp.foundOutOfService ?? [],
      errorsCount: cp.errorsCount ?? 0,
      runErrors: cp.runErrors ?? [],
      confirm: true,
    });
  };

  const checkpointRemaining = checkCheckpoint
    ? Math.max(0, checkCheckpoint.queueIds.length - checkCheckpoint.nextIndex)
    : 0;

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {checkProgress && checkTimer && (
        <div className="flex-shrink-0 rounded border border-accent/40 bg-accent/5 px-3 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-ink">
                Checking BrokerSnapshot · {checkProgress.completed} / {checkProgress.total}
                {checkProgress.stopped ? ' · stopping…' : ''}
              </div>
              <div className="text-[13px] text-ink mt-0.5 truncate">
                {checkProgress.currentClient}
                {checkProgress.currentMc ? (
                  <span className="text-muted2"> · MC {checkProgress.currentMc}</span>
                ) : null}
              </div>
              {checkProgress.currentTeam && (
                <div className="text-[11px] text-muted2 truncate">{checkProgress.currentTeam}</div>
              )}
            </div>
            <div className="text-right text-[11px] text-muted2 tabular-nums shrink-0">
              <div>Elapsed {checkTimer.elapsedLabel}</div>
              <div>
                {checkTimer.remaining > 0
                  ? `~${checkTimer.remainingLabel} left · done ~${checkTimer.etaClock}`
                  : 'Wrapping up…'}
              </div>
              <div className="text-ink mt-0.5">
                {checkProgress.cancellationsFound} cancel · {checkProgress.outOfServiceFound} OOS ·{' '}
                {checkProgress.errorsCount} err
              </div>
            </div>
          </div>
          {checkProgress.foundCancellations.length > 0 && (
            <div className="mt-2 text-[11px] text-red max-h-20 overflow-auto">
              Pending cancellations so far:{' '}
              {checkProgress.foundCancellations.map((c) => c.client).join(', ')}
            </div>
          )}
          {checkProgress.foundOutOfService.length > 0 && (
            <div className="mt-1 text-[11px] text-red max-h-20 overflow-auto">
              Out of service so far:{' '}
              {checkProgress.foundOutOfService.map((c) => c.client).join(', ')}
            </div>
          )}
          <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${checkTimer.pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleStopCheck}
              disabled={checkProgress.stopped}
              className="text-[11px] px-2 py-0.5 rounded border border-border text-ink hover:bg-surface disabled:opacity-50"
            >
              {checkProgress.stopped ? 'Stopping…' : 'Stop'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-shrink-0 rounded border border-red/30 bg-red/5 px-3 py-2 text-[12px] text-red whitespace-pre-wrap break-words">
          {error}
        </div>
      )}
      {checkCheckpoint && !checkProgress && (
        <div className="flex-shrink-0 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[12px] text-ink">
          <div className="font-medium">
            Check interrupted · {checkpointRemaining} client(s) left to check
            {checkCheckpoint.reason === 'stopped'
              ? ' (stopped)'
              : checkCheckpoint.reason === 'error'
                ? ' (error)'
                : ''}
          </div>
          <div className="text-muted2 mt-0.5">
            Checked {checkCheckpoint.nextIndex} of {checkCheckpoint.queueIds.length}
            {' · '}
            {checkCheckpoint.foundCancellations.length} pending cancellation(s)
            {' · '}
            {(checkCheckpoint.foundOutOfService ?? []).length} OOS
            {' · '}
            {checkCheckpoint.errorsCount} error(s)
          </div>
          {checkCheckpoint.foundCancellations.length > 0 ? (
            <ul className="mt-2 max-h-28 overflow-auto space-y-0.5 text-[11px]">
              {checkCheckpoint.foundCancellations.map((c) => (
                <li key={c.id} className="text-red">
                  • {c.client}
                  {c.mc ? ` (MC ${c.mc})` : ''}
                  {c.team ? ` · ${c.team}` : ''}
                  {c.cancellationDate ? ` — ${c.cancellationDate}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-[11px] text-muted2">
              No pending cancellations found before the interruption.
            </div>
          )}
          {(checkCheckpoint.foundOutOfService ?? []).length > 0 && (
            <ul className="mt-2 max-h-28 overflow-auto space-y-0.5 text-[11px]">
              {(checkCheckpoint.foundOutOfService ?? []).map((c) => (
                <li key={`oos-${c.id}`} className="text-red">
                  • OOS {c.client}
                  {c.mc ? ` (MC ${c.mc})` : ''}
                  {c.operatingStatus ? ` — ${c.operatingStatus}` : ''}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleContinueCheck}
              disabled={checking || loading || checkpointRemaining === 0}
              className="inline-flex items-center py-1 px-3 rounded-lg btn-primary text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
            >
              Continue check ({checkpointRemaining})
            </button>
            <button
              type="button"
              onClick={discardCheckpoint}
              disabled={checking}
              className="inline-flex items-center py-1 px-3 rounded-lg border border-border text-[12px] text-ink hover:bg-surface disabled:opacity-50"
            >
              Discard progress
            </button>
          </div>
        </div>
      )}
      {checkMessage && !checkProgress && (
        <div className="flex-shrink-0 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-ink whitespace-pre-wrap break-words">
          {checkMessage}
        </div>
      )}
      {checkResults && !checkProgress && (
        <div className="flex-shrink-0 rounded border border-border bg-surface px-3 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-ink uppercase tracking-wider">
                Check results
              </div>
              <div className="text-[12px] text-muted2 mt-0.5">
                {checkResults.status === 'finished'
                  ? 'Finished'
                  : checkResults.status === 'stopped'
                    ? 'Stopped'
                    : checkResults.status === 'error'
                      ? 'Interrupted by error'
                      : 'Interrupted'}
                {' · '}
                checked {checkResults.checked}/{checkResults.total}
                {' · '}
                <span
                  className={
                    checkResults.foundCancellations.length > 0 ? 'text-red font-medium' : ''
                  }
                >
                  {checkResults.foundCancellations.length} pending cancellation(s)
                </span>
                {' · '}
                <span
                  className={
                    checkResults.foundOutOfService.length > 0 ? 'text-red font-medium' : ''
                  }
                >
                  {checkResults.foundOutOfService.length} out-of-service
                </span>
                {' · '}
                {checkResults.errorsCount} error(s)
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const liveById = new Map(rows.map((r) => [r.insurance.id, r]));
                  const clients =
                    checkResults.clientLogs.length > 0
                      ? checkResults.clientLogs.map((log) => {
                          const live = liveById.get(log.id);
                          return {
                            ...log,
                            liveInsurance: live?.insurance ?? null,
                            liveTeam: live?.companyName ?? log.team,
                            displayCancelDate: live
                              ? getInsuranceCancelDateForDisplay(live.insurance)
                              : getInsuranceCancelDateForDisplay(log.insurance),
                            auditLastCancellation:
                              live?.insurance.last_cancellation_date ?? log.lastCancellationDate,
                          };
                        })
                      : // Fallback when results predate per-client logging: dump visible table rows.
                        filtered.map((r) => ({
                          id: r.insurance.id,
                          client: r.insurance.client,
                          mc: r.insurance.mc,
                          dot: r.insurance.dot,
                          status: r.insurance.status,
                          expirationDate: r.insurance.expiration_date,
                          lastCancellationDate: r.insurance.last_cancellation_date,
                          team: r.companyName,
                          companyId: r.companyId,
                          requestMc: r.insurance.mc,
                          mcLooksLikeDot: mcLooksLikeDotNumber(r.insurance.mc, r.insurance.dot),
                          mcEqualsDot: Boolean(
                            r.insurance.mc &&
                              r.insurance.dot &&
                              String(r.insurance.mc).replace(/\D/g, '') ===
                                String(r.insurance.dot).replace(/\D/g, '')
                          ),
                          syncRunId: null,
                          clientsChecked: 0,
                          cancellationsFound: 0,
                          outOfServiceFound: 0,
                          errorsCount: 0,
                          cancellationHits: [],
                          outOfServiceHits: [],
                          error: null,
                          insurance: { ...r.insurance },
                          liveInsurance: r.insurance,
                          liveTeam: r.companyName,
                          displayCancelDate: getInsuranceCancelDateForDisplay(r.insurance),
                          auditLastCancellation: r.insurance.last_cancellation_date,
                        }));

                  const payload = {
                    checkStatus: checkResults.status,
                    checked: checkResults.checked,
                    total: checkResults.total,
                    pendingCancellations: checkResults.foundCancellations.length,
                    outOfService: checkResults.foundOutOfService.length,
                    errors: checkResults.errorsCount,
                    foundCancellations: checkResults.foundCancellations,
                    foundOutOfService: checkResults.foundOutOfService,
                    note:
                      'Cancel date column only shows dates when status is Cancellation. lastCancellationDate is historical audit data and may remain after status returns to OK. BrokerSnapshot lookup uses MC only (requestMc), never DOT. OOS rows are auto-set to status Out.',
                    mcDotSuspects: clients.filter((c) => c.mcLooksLikeDot || c.mcEqualsDot),
                    clients,
                  };

                  console.log('[Client Insurance] Check results — full client dump', payload);
                  console.table(
                    clients.map((c) => ({
                      id: c.id,
                      client: c.client,
                      mc: c.mc,
                      dot: c.dot,
                      status: c.status,
                      requestMc: c.requestMc,
                      expirationDate: c.expirationDate,
                      lastCancellationDate: c.lastCancellationDate,
                      displayCancelDate: c.displayCancelDate,
                      mcLooksLikeDot: c.mcLooksLikeDot,
                      mcEqualsDot: c.mcEqualsDot,
                      team: c.team,
                      error: c.error,
                    }))
                  );
                  void navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)).catch(() => {
                    /* clipboard may be blocked */
                  });
                }}
                className="text-[11px] px-2 py-0.5 rounded border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                title="Logs every checked client to the browser console and copies JSON"
              >
                Log clients ({checkResults.clientLogs.length || filtered.length})
              </button>
              <button
                type="button"
                onClick={() => setCheckResults(null)}
                className="text-[11px] px-2 py-0.5 rounded border border-border text-ink hover:bg-panel"
              >
                Dismiss
              </button>
            </div>
          </div>

          {checkResults.foundCancellations.length > 0 ? (
            <div className="mt-2 max-h-52 overflow-auto rounded border border-border">
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[var(--color-panel)]">
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-label">
                    <th className="text-left font-normal px-2 py-1.5">Client</th>
                    <th className="text-left font-normal px-2 py-1.5">MC</th>
                    <th className="text-left font-normal px-2 py-1.5">Team</th>
                    <th className="text-left font-normal px-2 py-1.5">Cancel date</th>
                  </tr>
                </thead>
                <tbody>
                  {checkResults.foundCancellations.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1.5 font-medium text-red">{c.client}</td>
                      <td className="px-2 py-1.5 text-muted2 tabular-nums">{c.mc || '—'}</td>
                      <td className="px-2 py-1.5 text-muted2">{c.team ?? '—'}</td>
                      <td className="px-2 py-1.5 text-muted2 tabular-nums">
                        {c.cancellationDate ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-muted2">
              No clients with pending cancellation were found in this run.
            </div>
          )}

          {checkResults.foundOutOfService.length > 0 ? (
            <div className="mt-2 max-h-52 overflow-auto rounded border border-border">
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-label border-b border-border">
                Out of service (status set to Out / Inactive)
              </div>
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[var(--color-panel)]">
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-label">
                    <th className="text-left font-normal px-2 py-1.5">Client</th>
                    <th className="text-left font-normal px-2 py-1.5">MC</th>
                    <th className="text-left font-normal px-2 py-1.5">FMCSA status</th>
                    <th className="text-left font-normal px-2 py-1.5">App status</th>
                  </tr>
                </thead>
                <tbody>
                  {checkResults.foundOutOfService.map((c) => (
                    <tr key={`oos-${c.id}`} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1.5 font-medium text-red">{c.client}</td>
                      <td className="px-2 py-1.5 text-muted2 tabular-nums">{c.mc || '—'}</td>
                      <td className="px-2 py-1.5 text-muted2">{c.operatingStatus}</td>
                      <td className="px-2 py-1.5 text-muted2">{c.appStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-muted2">
              No out-of-service / inactive authority clients found in this run.
            </div>
          )}

          {checkResults.runErrors.length > 0 && (
            <div className="mt-2 text-[11px] text-red whitespace-pre-wrap break-words max-h-20 overflow-auto">
              {checkResults.runErrors.slice(0, 8).join('\n')}
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Clients</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink">
              {counts.total}
            </div>
            <div className="text-[10px] text-muted2 mt-1">insurance records</div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">OK</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink">
              {counts.ok}
            </div>
            <div className="text-[10px] text-muted2 mt-1">active</div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Cancellation</div>
            <div
              className={`text-[16px] font-medium leading-none tabular-nums ${
                counts.cancellation > 0 ? 'text-red' : 'text-ink'
              }`}
            >
              {counts.cancellation}
            </div>
            <div className="text-[10px] text-muted2 mt-1">pending</div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Inactive / Out</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink">
              {counts.inactive + counts.out}
            </div>
            <div className="text-[10px] text-muted2 mt-1">not active</div>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
        <div className="flex gap-0.5 flex-wrap">
          {(
            [
              { id: 'all', label: `All (${counts.total})` },
              { id: 'ok', label: `OK (${counts.ok})` },
              { id: 'cancellation', label: `Cancel (${counts.cancellation})` },
              { id: 'inactive', label: `Inactive (${counts.inactive})` },
              { id: 'out', label: `Out (${counts.out})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKindFilter(opt.id)}
              className={`filter-btn ${kindFilter === opt.id ? 'filter-btn-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={companyFilter === 'all' ? 'all' : String(companyFilter)}
          onChange={(e) =>
            setCompanyFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink min-w-[140px]"
          aria-label="Team filter"
        >
          <option value="all">All teams</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Client, MC, DOT, team…"
          className="flex-1 min-w-[140px] rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
        />
        <button
          type="button"
          onClick={() => void handleCheckApi()}
          disabled={checking || loading || checkableCount === 0}
          className="inline-flex items-center py-1 px-3 rounded-lg btn-primary text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
          title="Check one client at a time with live progress (avoids edge timeout)"
        >
          {checking ? 'Checking…' : `Check API (${checkableCount})`}
        </button>
        {!loading && (
          <span className="text-[11px] text-muted2">{filtered.length} shown · click for loans</span>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[12px] py-6 text-center">Loading insurance…</p>
      ) : filtered.length === 0 ? (
        <div className="panel-surface flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-muted2 text-[12px]">No insurance records match filters.</p>
        </div>
      ) : (
        <div className="panel-surface flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll">
            <table className="w-full border-collapse text-[12px] min-w-[820px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-3 py-1.5">Client</th>
                  <th className="text-left font-normal px-3 py-1.5">Status</th>
                  <th className="text-left font-normal px-3 py-1.5">Cancel date</th>
                  <th className="text-left font-normal px-3 py-1.5">MC</th>
                  <th className="text-left font-normal px-3 py-1.5">DOT</th>
                  <th className="text-center font-normal px-3 py-1.5">Loans</th>
                  <th className="text-left font-normal px-3 py-1.5">Team</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const { insurance, companyName } = row;
                  const cancelDate = getInsuranceCancelDateForDisplay(insurance);
                  const daysUntil = getDaysUntilCancellation(insurance);
                  const inactive = isInactive(insurance.status);
                  const related = loansForInsurance(row, loans);
                  const openLoans = related.filter((l) => !isLoanClosed(l.loan)).length;
                  return (
                    <tr
                      key={insurance.id}
                      className="border-b border-border last:border-b-0 row-hover cursor-pointer"
                      onClick={() => setDetail(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetail(row);
                        }
                      }}
                      tabIndex={0}
                      title="View related loans"
                    >
                      <td className="px-3 py-1.5 font-medium text-ink">{insurance.client}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            inactive || isOut(insurance.status)
                              ? 'text-muted2'
                              : daysUntil != null && daysUntil <= 7
                                ? 'text-red font-medium'
                                : 'text-ink'
                          }
                        >
                          {getClientInsuranceStatusLabel(insurance)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted2">
                        {cancelDate ? fmtDate(new Date(cancelDate + 'T12:00:00')) : '—'}
                        {daysUntil != null && daysUntil >= 0 && (
                          <span className="ml-1 text-[10px]">
                            ({daysUntil === 0 ? 'today' : `${daysUntil}d`})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted2 tabular-nums">{insurance.mc || '—'}</td>
                      <td className="px-3 py-1.5 text-muted2 tabular-nums">{insurance.dot || '—'}</td>
                      <td className="px-3 py-1.5 text-center tabular-nums">
                        <span className="text-ink font-medium">{openLoans}</span>
                        <span className="text-muted2">/{related.length}</span>
                      </td>
                      <td className="px-3 py-1.5 text-muted2">{companyName ?? 'Unassigned'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={detail != null}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.insurance.client} — insurance & loans` : 'Insurance'}
        panelClassName="panel-surface rounded-xl p-5 w-[720px] max-w-[96vw] max-h-[90vh] flex flex-col"
      >
        {detail && (
          <div className="space-y-4 min-h-0 flex flex-col overflow-auto admin-table-scroll">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Status</div>
                <div className="text-[12px] font-medium text-ink">
                  {getClientInsuranceStatusLabel(detail.insurance)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Team</div>
                <div className="text-[12px] font-medium text-ink truncate">
                  {detail.companyName ?? 'Unassigned'}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">MC</div>
                <div className="text-[12px] font-medium text-ink tabular-nums">
                  {detail.insurance.mc || '—'}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface/50 px-3 py-2 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">DOT</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={dotDraft}
                    onChange={(e) => setDotDraft(e.target.value)}
                    placeholder="Add DOT..."
                    className="w-full min-w-0 bg-transparent border border-border rounded-md py-1 px-2 text-[12px] font-medium text-ink tabular-nums outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveDot()}
                    disabled={
                      savingDot ||
                      dotDraft.trim() === (detail.insurance.dot ?? '').trim()
                    }
                    className="shrink-0 py-1 px-2 rounded-md btn-primary text-[11px] font-medium hover:opacity-90 disabled:opacity-40"
                  >
                    {savingDot ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {dotError && (
              <div className="rounded border border-red/40 bg-red/10 px-3 py-2 text-[12px] text-red whitespace-pre-wrap break-words">
                {dotError}
              </div>
            )}

            <div className="text-[11px] text-muted uppercase tracking-wider">
              Related loans ({detailLoans.length})
            </div>
            {detailLoans.length === 0 ? (
              <p className="text-[12px] text-muted2 py-4 text-center">
                No loans found for this client on this team.
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                      <th className="text-left font-normal px-3 py-1.5">Loan #</th>
                      <th className="text-left font-normal px-3 py-1.5">Provider</th>
                      <th className="text-right font-normal px-3 py-1.5">Balance</th>
                      <th className="text-center font-normal px-3 py-1.5">Paid</th>
                      <th className="text-left font-normal px-3 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLoans.map(({ loan }) => {
                      const status = getLoanStatus(loan);
                      return (
                        <tr key={loan.id} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted2">
                            {loan.ref || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-muted2">
                            {getLoanProviderDisplay(loan)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-ink">
                            {fmt(getLoanRemaining(loan))}
                          </td>
                          <td className="px-3 py-1.5 text-center tabular-nums">
                            {loan.paidCount}/{loan.totalInstallments}
                          </td>
                          <td className="px-3 py-1.5">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
