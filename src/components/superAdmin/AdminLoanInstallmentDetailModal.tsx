import { useEffect, useState } from 'react';
import type { Loan } from '@/types';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { CloseInstallmentModal } from '@/components/modals/CloseInstallmentModal';
import { updateLoan } from '@/lib/supabase-db';
import {
  buildAddInstallment,
  buildCloseLoanFully,
  buildLoanAmountEdit,
  buildPostInstallmentPayment,
  isLoanFullyPaid,
  todayDateOnly,
} from '@/lib/loanPaymentActions';
import {
  fmt,
  getLoanBasePerInstallment,
  getLoanFeePerInstallment,
  getLoanInstallmentAmount,
  getLoanProviderDisplay,
  getLoanRemaining,
  getScheduleDueDateOnly,
} from '@/lib/utils';

interface AdminLoanInstallmentDetailModalProps {
  loan: Loan | null;
  companyName?: string | null;
  /** Highlight this installment when opened from a deduction row. */
  highlightIndex?: number | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful save so parent lists can refresh. */
  onLoanUpdated?: (loan: Loan) => void;
}

/** Format YYYY-MM-DD in local calendar (avoids UTC day shift). */
function fmtLocalDate(dateStr: string | null | undefined): string {
  if (!dateStr?.trim()) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Super Admin loan installment detail — view/edit amounts, add installments,
 * and close installments / full loan.
 */
export function AdminLoanInstallmentDetailModal({
  loan,
  companyName,
  highlightIndex = null,
  open,
  onClose,
  onLoanUpdated,
}: AdminLoanInstallmentDetailModalProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeInstallmentOpen, setCloseInstallmentOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTotal, setEditTotal] = useState('');
  const [editFee, setEditFee] = useState('');
  const [editInstallments, setEditInstallments] = useState('');
  const [adding, setAdding] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addNote, setAddNote] = useState('');

  // Sync edit form when the loan changes or modal opens.
  useEffect(() => {
    if (!loan || !open) {
      setEditing(false);
      setAdding(false);
      return;
    }
    setEditTotal(String(loan.total ?? ''));
    setEditFee(String(loan.factoringFee ?? 0));
    setEditInstallments(String(loan.totalInstallments ?? ''));
    setAddAmount(String(loan.installment ?? ''));
    setAddDate(todayDateOnly());
    setAddNote('');
  }, [loan, open]);

  if (!loan) return null;

  const remaining = getLoanRemaining(loan);
  const basePer = getLoanBasePerInstallment(loan);
  const feePer = getLoanFeePerInstallment(loan);
  const hasFee = feePer > 0;
  const notes = loan.paymentNotes ?? [];
  const paidDates = loan.paymentDates ?? [];
  const fullyPaid = isLoanFullyPaid(loan);

  const editTotalNum = editTotal.trim() ? parseFloat(editTotal) : NaN;
  const editFeeNum = editFee.trim() ? parseFloat(editFee) : 0;
  const editInstNum = editInstallments.trim() ? parseInt(editInstallments, 10) : 0;
  const editEffective =
    Number.isFinite(editTotalNum) && editTotalNum >= 0
      ? editTotalNum + (Number.isFinite(editFeeNum) ? editFeeNum : 0)
      : NaN;
  const editInstallmentPreview =
    editInstNum > 0 && Number.isFinite(editEffective) ? editEffective / editInstNum : NaN;

  const inputClass =
    'w-full bg-surface border border-border rounded-lg py-1.5 px-2.5 text-[12px] text-ink outline-none focus:border-accent tabular-nums';

  /** Persist a mutated loan and notify parent. */
  const persist = async (updated: Loan) => {
    setWorking(true);
    setError(null);
    try {
      const saved = await updateLoan(updated.id, updated);
      onLoanUpdated?.(saved);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setWorking(false);
    }
  };

  const handleCloseInstallment = async (note: string, paidDate: string, paymentAmount: number) => {
    const result = buildPostInstallmentPayment(loan, paymentAmount, note, paidDate);
    if (!result.ok) {
      window.alert(result.error);
      throw new Error(result.error);
    }
    await persist(result.loan);
    if (result.message) window.alert(result.message);
  };

  const handleCloseLoanFully = async () => {
    if (fullyPaid || working) return;
    const remainingCount = loan.totalInstallments - loan.paidCount;
    const refBit = loan.ref ? ` (${loan.ref})` : '';
    const ok = window.confirm(
      `Close this loan completely?\n\nThis will mark the remaining ${remainingCount} installment(s) as deducted for ${loan.client}${refBit}.`
    );
    if (!ok) return;
    const updated = buildCloseLoanFully(loan);
    if (!updated) return;
    try {
      await persist(updated);
    } catch {
      // error already set in persist
    }
  };

  const handleSaveAmounts = async () => {
    if (working) return;
    if (!Number.isFinite(editTotalNum) || editTotalNum < 0) {
      setError('Enter a valid total amount (0 or greater).');
      return;
    }
    if (!Number.isFinite(editFeeNum) || editFeeNum < 0) {
      setError('Enter a valid factoring fee (0 or greater).');
      return;
    }
    if (!Number.isFinite(editInstNum) || editInstNum < 1) {
      setError('Installment count must be at least 1.');
      return;
    }

    if (editInstNum < loan.paidCount) {
      const ok = window.confirm(
        `This loan already has ${loan.paidCount} deducted installment(s).\n` +
          `Reducing to ${editInstNum} will clamp deducted count to ${editInstNum} and drop extra payment dates.\n\nContinue?`
      );
      if (!ok) return;
    }

    const updated = buildLoanAmountEdit(loan, {
      total: editTotalNum,
      totalInstallments: editInstNum,
      factoringFee: editFeeNum,
    });
    if (!updated) {
      setError('Could not apply amount changes — check the values.');
      return;
    }

    try {
      await persist(updated);
      setEditing(false);
    } catch {
      // error already set in persist
    }
  };

  const handleAddInstallment = async () => {
    if (working) return;
    const amount = addAmount.trim() ? parseFloat(addAmount) : NaN;
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid installment amount (0 or greater).');
      return;
    }
    const paidDate = addDate.trim() || undefined;
    const updated = buildAddInstallment(loan, {
      amount,
      paidDate,
      note: addNote.trim() || undefined,
    });
    if (!updated) {
      setError('Could not add installment — check the values.');
      return;
    }
    try {
      await persist(updated);
      setAdding(false);
      setAddAmount(String(loan.installment ?? ''));
      setAddDate(todayDateOnly());
      setAddNote('');
    } catch {
      // error already set in persist
    }
  };

  const startEditing = () => {
    setError(null);
    setAdding(false);
    setEditTotal(String(loan.total ?? ''));
    setEditFee(String(loan.factoringFee ?? 0));
    setEditInstallments(String(loan.totalInstallments ?? ''));
    setEditing(true);
  };

  const cancelEditing = () => {
    setError(null);
    setEditing(false);
    setEditTotal(String(loan.total ?? ''));
    setEditFee(String(loan.factoringFee ?? 0));
    setEditInstallments(String(loan.totalInstallments ?? ''));
  };

  const startAdding = () => {
    setError(null);
    setEditing(false);
    setAddAmount(String(loan.installment ?? ''));
    setAddDate(todayDateOnly());
    setAddNote('');
    setAdding(true);
  };

  const cancelAdding = () => {
    setError(null);
    setAdding(false);
    setAddAmount(String(loan.installment ?? ''));
    setAddDate(todayDateOnly());
    setAddNote('');
  };

  const titleRef = loan.ref ? ` — ${loan.ref}` : '';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`${loan.client}${titleRef}`}
        panelClassName="panel-surface rounded-xl p-5 w-[760px] max-w-[96vw] max-h-[90vh] flex flex-col"
      >
        <div className="space-y-4 min-h-0 flex flex-col">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Team</div>
              <div className="text-[12px] font-medium text-ink truncate">
                {companyName ?? 'Unassigned'}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Provider</div>
              <div className="text-[12px] font-medium text-ink truncate">
                {getLoanProviderDisplay(loan)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Balance</div>
              <div className="text-[12px] font-medium text-ink tabular-nums">{fmt(remaining)}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Deducted</div>
              <div className="text-[12px] font-medium text-ink tabular-nums">
                {loan.paidCount}/{loan.totalInstallments}
              </div>
            </div>
          </div>

          {!editing && !adding ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted2 flex-shrink-0">
              <span>
                Total <span className="text-ink font-medium tabular-nums">{fmt(loan.total)}</span>
              </span>
              {hasFee && (
                <span>
                  Fee{' '}
                  <span className="text-ink font-medium tabular-nums">{fmt(loan.factoringFee)}</span>
                </span>
              )}
              <span>
                Installment{' '}
                <span className="text-ink font-medium tabular-nums">{fmt(loan.installment)}</span>
                {hasFee && (
                  <span className="text-muted2">
                    {' '}
                    ({fmt(basePer)} + {fmt(feePer)})
                  </span>
                )}
              </span>
              <span>
                Start <span className="text-ink font-medium">{fmtLocalDate(loan.startDate)}</span>
              </span>
              <span>
                Every{' '}
                <span className="text-ink font-medium">
                  {loan.freqDays === 1 ? 'weekday' : `${loan.freqDays} days`}
                </span>
              </span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={startAdding}
                  disabled={working}
                  className="py-1 px-2.5 rounded-md border border-border text-[11px] font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Add installment
                </button>
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={working}
                  className="py-1 px-2.5 rounded-md border border-border text-[11px] font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Edit amounts
                </button>
              </div>
            </div>
          ) : null}

          {editing && (
            <div className="rounded-lg border border-border bg-surface/40 px-3 py-3 space-y-3 flex-shrink-0">
              <div className="text-[11px] uppercase tracking-wider text-label">Edit loan amounts</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">
                    Total
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editTotal}
                    onChange={(e) => setEditTotal(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">
                    Factoring fee
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">
                    # Installments
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={editInstallments}
                    onChange={(e) => setEditInstallments(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="text-[12px] text-muted2">
                New unpaid installment:{' '}
                <span className="text-ink font-medium tabular-nums">
                  {Number.isFinite(editInstallmentPreview) ? fmt(editInstallmentPreview) : '—'}
                </span>
                <span className="text-muted2"> (total + fee) ÷ installments</span>
              </div>
              <p className="text-[11px] text-muted2">
                Already deducted amounts (e.g. mid-week $500 pulls) are kept. Only unpaid slots use
                the new weekly amount.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={working}
                  className="py-1.5 px-3 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAmounts()}
                  disabled={working}
                  className="py-1.5 px-3 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {working ? 'Saving…' : 'Save amounts'}
                </button>
              </div>
            </div>
          )}

          {adding && (
            <div className="rounded-lg border border-border bg-surface/40 px-3 py-3 space-y-3 flex-shrink-0">
              <div className="text-[11px] uppercase tracking-wider text-label">Add installment</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">
                    Amount
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">
                    Paid date
                  </span>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">
                    Note (optional)
                  </span>
                  <input
                    type="text"
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. mid-week pull"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted2">
                With a paid date, the installment is added as deducted (for mid-week / extra pulls).
                Clear the date to add an unpaid slot at the end.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelAdding}
                  disabled={working}
                  className="py-1.5 px-3 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddInstallment()}
                  disabled={working}
                  className="py-1.5 px-3 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {working ? 'Saving…' : 'Add installment'}
                </button>
              </div>
            </div>
          )}

          {loan.note?.trim() && (
            <p className="text-[12px] text-muted2 flex-shrink-0">
              Note: <span className="text-ink">{loan.note.trim()}</span>
            </p>
          )}

          {error && (
            <div className="rounded border border-red/40 bg-red/10 px-3 py-2 text-[12px] text-red flex-shrink-0 whitespace-pre-wrap break-words">
              {error}
            </div>
          )}

          <div className="text-[11px] text-muted uppercase tracking-wider flex-shrink-0">
            Installment deductions
          </div>

          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll rounded-lg border border-border">
            <table className="w-full border-collapse text-[12px] min-w-[640px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-center font-normal px-3 py-1.5 w-12">#</th>
                  <th className="text-left font-normal px-3 py-1.5">Scheduled</th>
                  <th className="text-left font-normal px-3 py-1.5">Paid</th>
                  <th className="text-right font-normal px-3 py-1.5">Amount</th>
                  {hasFee && (
                    <>
                      <th className="text-right font-normal px-3 py-1.5">Base</th>
                      <th className="text-right font-normal px-3 py-1.5">Fee</th>
                    </>
                  )}
                  <th className="text-left font-normal px-3 py-1.5 w-24">Status</th>
                  <th className="text-left font-normal px-3 py-1.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: loan.totalInstallments }, (_, i) => {
                  const paid = i < loan.paidCount;
                  const isNext = i === loan.paidCount;
                  const partialOnOpen =
                    isNext && (Number(loan.partialPaidAmount ?? 0) || 0) > 0
                      ? Number(loan.partialPaidAmount)
                      : 0;
                  const dueStr = getScheduleDueDateOnly(loan.startDate, i, loan.freqDays ?? 7);
                  const paidStr = (paidDates[i] ?? '').trim();
                  const note = (notes[i] ?? '').trim();
                  const highlighted = highlightIndex === i;
                  const slotAmount = getLoanInstallmentAmount(loan, i);
                  const statusLabel = paid
                    ? 'Deducted'
                    : partialOnOpen > 0
                      ? 'Partial'
                      : isNext
                        ? 'Next'
                        : 'Pending';
                  const statusVariant = paid ? 'ok' : partialOnOpen > 0 || isNext ? 'due' : 'closed';

                  return (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-b-0 ${
                        highlighted ? 'bg-accent/10' : 'row-hover'
                      }`}
                    >
                      <td className="px-3 py-1.5 text-center tabular-nums font-medium text-ink">
                        {i + 1}
                      </td>
                      <td className="px-3 py-1.5 text-muted2 tabular-nums">
                        {fmtLocalDate(dueStr)}
                      </td>
                      <td className="px-3 py-1.5 text-muted2 tabular-nums">
                        {fmtLocalDate(paidStr || null)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium text-ink">
                        {partialOnOpen > 0
                          ? `${fmt(partialOnOpen)} / ${fmt(slotAmount)}`
                          : fmt(slotAmount)}
                      </td>
                      {hasFee && (
                        <>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted2">
                            {fmt(basePer)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted2">
                            {fmt(feePer)}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-1.5">
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </td>
                      <td
                        className="px-3 py-1.5 text-muted2 max-w-[200px] truncate"
                        title={note || undefined}
                      >
                        {note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent disabled:opacity-50"
            >
              Dismiss
            </button>
            {!fullyPaid && !editing && !adding && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCloseLoanFully()}
                  disabled={working}
                  className="py-1.5 px-3.5 rounded-lg border border-green/30 text-green text-xs font-medium bg-transparent hover:bg-green/10 disabled:opacity-50"
                >
                  {working ? 'Saving…' : 'Close loan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCloseInstallmentOpen(true);
                  }}
                  disabled={working}
                  className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Close installment
                </button>
              </>
            )}
            {/* Allow posting even when schedule is exhausted — creates next week. */}
            {fullyPaid && !editing && !adding && (
              <>
                <span className="text-[12px] text-muted2 font-medium mr-auto">Schedule complete</span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCloseInstallmentOpen(true);
                  }}
                  disabled={working}
                  className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Post payment (new week)
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <CloseInstallmentModal
        loan={loan}
        open={closeInstallmentOpen}
        onClose={() => setCloseInstallmentOpen(false)}
        onCloseInstallment={handleCloseInstallment}
      />
    </>
  );
}
