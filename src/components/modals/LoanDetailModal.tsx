import { useState, useEffect } from 'react';
import type { Loan } from '@/types';
import { Modal } from '@/components/Modal';
import { InstallmentPaymentsList } from '@/components/InstallmentPaymentsList';
import { getInstallmentPayments } from '@/lib/loanPaymentActions';
import { fmt, fmtDate, getLoanInstallmentAmount, getLoanOpenInstallmentRemaining, getLoanRemaining, getScheduleDueDateOnly } from '@/lib/utils';

interface LoanDetailModalProps {
  loan: Loan | null;
  open: boolean;
  onClose: () => void;
  onMarkPaid: () => void;
  onReverse: () => void;
  onDelete: () => void;
  /** Toggle whether this loan is hidden from the dashboard lists. */
  onToggleHidden: (hidden: boolean) => void;
  /** Run destructive action only when the current user is the account admin. */
  runIfAccountAdmin: (action: () => void) => void;
  isAccountAdmin: boolean;
  onCloseLoan: () => void;
  onUpdateInstallmentNote: (index: number, note: string) => void;
  /** When set, posts paymentAmount toward the open installment (partial / full / overpay). */
  onCloseInstallmentWithNote?: (
    index: number,
    note: string,
    paidDate: string,
    paymentAmount: number
  ) => Promise<void>;
  /** Update the paid date for an already-closed installment. */
  onUpdatePaymentDate?: (index: number, date: string) => Promise<void>;
}

/** Small note icon (click to open installment popup) */
function NoteIcon({ hasNote, onClick }: { hasNote: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted2 hover:bg-accent/10 hover:text-accent transition-colors"
      title={hasNote ? 'View or edit note' : 'Add note'}
      aria-label="Note"
    >
      {hasNote ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-2-9H8v2h8v-2zm0 4H8v2h8v-2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )}
    </button>
  );
}

export function LoanDetailModal({
  loan,
  open,
  onClose,
  onMarkPaid,
  onReverse,
  onDelete,
  onToggleHidden,
  runIfAccountAdmin,
  isAccountAdmin,
  onCloseLoan,
  onUpdateInstallmentNote,
  onCloseInstallmentWithNote,
  onUpdatePaymentDate,
}: LoanDetailModalProps) {
  const [selectedInstallmentIndex, setSelectedInstallmentIndex] = useState<number | null>(null);
  const [popupNote, setPopupNote] = useState('');
  const [popupCloseDate, setPopupCloseDate] = useState('');
  const [popupAmount, setPopupAmount] = useState('');
  const [popupError, setPopupError] = useState<string | null>(null);
  const [popupSubmitting, setPopupSubmitting] = useState(false);

  const todayStr = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (loan && selectedInstallmentIndex !== null) {
      const notes = loan.paymentNotes ?? [];
      // Open installment: blank note for this payment only (avoid re-posting
      // prior auto "Partial $X on DATE" lines). Paid slots: edit existing note.
      if (selectedInstallmentIndex === loan.paidCount) {
        setPopupNote('');
      } else {
        setPopupNote(notes[selectedInstallmentIndex] ?? '');
      }
      const existingPaidDate = loan.paymentDates?.[selectedInstallmentIndex];
      setPopupCloseDate(existingPaidDate ?? todayStr());
      setPopupError(null);
      if (selectedInstallmentIndex === loan.paidCount) {
        const rem = getLoanOpenInstallmentRemaining(loan);
        setPopupAmount(String(rem > 0 ? rem : loan.installment));
      } else {
        setPopupAmount('');
      }
    }
  }, [loan, selectedInstallmentIndex]);

  if (!loan) return null;

  const remaining = getLoanRemaining(loan);
  const isFullyPaid = loan.paidCount >= loan.totalInstallments;
  const canReverse = loan.paidCount > 0;
  const notes = loan.paymentNotes ?? [];
  const openPartial = Number(loan.partialPaidAmount ?? 0) || 0;

  const handleDelete = () => {
    runIfAccountAdmin(() => {
      if (!window.confirm('Delete this loan?')) return;
      onDelete();
    });
  };

  const handleReverse = () => {
    runIfAccountAdmin(() => onReverse());
  };

  const handleCloseLoan = () => {
    if (!window.confirm('Mark this loan as fully paid (close it)?')) return;
    onCloseLoan();
  };

  const openInstallmentPopup = (index: number) => {
    setSelectedInstallmentIndex(index);
    // Blank for open installment payments; keep existing text when editing paid notes.
    setPopupNote(index === loan.paidCount ? '' : (notes[index] ?? ''));
  };

  const closeInstallmentPopup = () => {
    setSelectedInstallmentIndex(null);
  };

  /** Post payment toward the next unpaid installment (partial / full / overpay). */
  const handleCloseInstallment = async () => {
    if (selectedInstallmentIndex === null) return;

    if (selectedInstallmentIndex < loan.paidCount) {
      const msg = `Installment #${selectedInstallmentIndex + 1} is already fully paid. Nothing left to post on this installment.`;
      setPopupError(msg);
      window.alert(msg);
      return;
    }

    if (selectedInstallmentIndex !== loan.paidCount) {
      onUpdateInstallmentNote(selectedInstallmentIndex, popupNote.trim());
      closeInstallmentPopup();
      return;
    }

    const amountNum = popupAmount.trim() ? parseFloat(popupAmount) : NaN;
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setPopupError('Enter a payment amount greater than 0.');
      return;
    }

    setPopupSubmitting(true);
    setPopupError(null);
    try {
      if (onCloseInstallmentWithNote) {
        await onCloseInstallmentWithNote(
          selectedInstallmentIndex,
          popupNote.trim(),
          popupCloseDate || todayStr(),
          amountNum
        );
      } else {
        onUpdateInstallmentNote(selectedInstallmentIndex, popupNote.trim());
        await onMarkPaid();
      }
      closeInstallmentPopup();
    } catch (err) {
      setPopupError(err instanceof Error ? err.message : String(err));
    } finally {
      setPopupSubmitting(false);
    }
  };

  const handleSaveNoteOnly = () => {
    if (selectedInstallmentIndex === null) return;
    onUpdateInstallmentNote(selectedInstallmentIndex, popupNote.trim());
    closeInstallmentPopup();
  };

  const handleSaveDate = async () => {
    if (selectedInstallmentIndex === null || !onUpdatePaymentDate || !popupCloseDate) return;
    await onUpdatePaymentDate(selectedInstallmentIndex, popupCloseDate);
  };

  const selectedIsPaid = selectedInstallmentIndex !== null && selectedInstallmentIndex < loan.paidCount;

  const isInstallmentPopupOpen = selectedInstallmentIndex !== null;
  const selectedIsNextUnpaid = selectedInstallmentIndex === loan.paidCount;

  /** Open print-friendly loan details in a new window with TRUFUNDING LLC as provider. */
  const handlePrint = () => {
    const printDate = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const rows = Array.from({ length: loan.totalInstallments }, (_, i) => {
      const dueStr = getScheduleDueDateOnly(loan.startDate, i, loan.freqDays ?? 7);
      const [sy, sm, sd] = dueStr.split('-').map(Number);
      const scheduledStr = new Date(sy, sm - 1, sd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const actualStr = loan.paymentDates?.[i]
        ? new Date(loan.paymentDates[i]).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '—';
      const noteStr = (notes[i] ?? '').trim() || '—';
      const status = i < loan.paidCount ? 'Paid' : i === loan.paidCount ? 'Next' : 'Pending';
      return `<tr>
        <td>${i + 1}</td>
        <td>${scheduledStr}</td>
        <td>${actualStr}</td>
        <td>${fmt(loan.installment)}</td>
        <td>${status}</td>
        <td style="max-width:200px;word-break:break-word">${noteStr.replace(/</g, '&lt;')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Loan Details — ${loan.client} (${loan.ref})</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
    .provider { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .sub { font-size: 11px; color: #666; margin-bottom: 20px; }
    h2 { font-size: 16px; margin: 20px 0 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .summary-table td:first-child { color: #666; width: 140px; }
    .summary-table td:last-child { font-weight: 600; }
    .footer { margin-top: 24px; font-size: 11px; color: #666; }
  </style>
</head>
<body>
  <div class="provider">TRUFUNDING LLC</div>
  <div class="sub">Loan details — printed ${printDate}</div>

  <h2>Loan summary</h2>
  <table class="summary-table">
    <tr><td>Client</td><td>${loan.client}</td></tr>
    <tr><td>Reference</td><td>${loan.ref || '—'}</td></tr>
    <tr><td>Total loan</td><td>${fmt(loan.total)}</td></tr>
    <tr><td>Installment amount</td><td>${fmt(loan.installment)}</td></tr>
    <tr><td>Total installments</td><td>${loan.totalInstallments}</td></tr>
    <tr><td>Paid</td><td>${loan.paidCount}</td></tr>
    <tr><td>Remaining balance</td><td>${fmt(remaining)}</td></tr>
    <tr><td>Start date</td><td>${new Date(loan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td></tr>
    ${loan.note ? `<tr><td>Loan note</td><td>${loan.note.replace(/</g, '&lt;')}</td></tr>` : ''}
  </table>

  <h2>Installments & notes</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Scheduled date</th>
        <th>Paid date</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">TRUFUNDING LLC — Loan reference: ${loan.ref || loan.client}</div>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        w.close();
      }, 250);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`${loan.client} — ${loan.ref}`}>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-1.5 border-b border-border text-[13px]">
            <span className="text-muted2">Total Loan</span>
            <span className="font-mono font-medium">{fmt(loan.total)}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border text-[13px]">
            <span className="text-muted2">Installment</span>
            <span className="font-mono font-medium text-yellow">{fmt(loan.installment)}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border text-[13px]">
            <span className="text-muted2">Total Installments</span>
            <span className="font-mono font-medium">{loan.totalInstallments}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border text-[13px]">
            <span className="text-muted2">Paid</span>
            <span className="font-mono font-medium text-green">{loan.paidCount}</span>
          </div>
          {loan.note && (
            <div className="flex justify-between items-center py-1.5 border-b border-border text-[13px]">
              <span className="text-muted2">Note</span>
              <span className="text-xs text-muted">{loan.note}</span>
            </div>
          )}

          <div className="text-[11px] text-muted uppercase tracking-wider mt-4 mb-2">
            Installments — click a row to view payments, add a note, or post payment
          </div>
          <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto scrollable">
            {Array.from({ length: loan.totalInstallments }, (_, i) => {
              const paid = i < loan.paidCount;
              const isNext = i === loan.paidCount;
              const partialHere = isNext && openPartial > 0 ? openPartial : 0;
              const dueStr = getScheduleDueDateOnly(loan.startDate, i, loan.freqDays ?? 7);
              const [sy, sm, sd] = dueStr.split('-').map(Number);
              const scheduledDate = new Date(sy, sm - 1, sd);
              const actualDate =
                loan.paymentDates?.[i] ? fmtDate(loan.paymentDates[i]) : null;
              const hasNote = !!(notes[i] ?? '').trim();
              const paymentCount = getInstallmentPayments(loan, i).length;
              const slotAmount = getLoanInstallmentAmount(loan, i);
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => openInstallmentPopup(i)}
                  onKeyDown={(e) => e.key === 'Enter' && openInstallmentPopup(i)}
                  className={`flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-[10px] bg-surface text-[13px] cursor-pointer hover:bg-border/60 transition-colors ${paid ? 'opacity-90' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted2 text-[11px] shrink-0">
                      #{i + 1} · {fmtDate(scheduledDate)}
                      {actualDate && (
                        <span className="text-green ml-1">→ paid {actualDate}</span>
                      )}
                    </span>
                    {paymentCount > 0 && (
                      <span
                        className="shrink-0 text-[10px] text-accent px-1.5 py-0.5 rounded bg-accent/10"
                        title={`${paymentCount} payment${paymentCount === 1 ? '' : 's'}`}
                      >
                        {paymentCount} pay{paymentCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {hasNote && (
                      <span className="shrink-0 text-[10px] text-muted px-1.5 py-0.5 rounded bg-border/50" title={notes[i]}>
                        note
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-yellow">
                      {partialHere > 0
                        ? `${fmt(partialHere)} / ${fmt(slotAmount)}`
                        : fmt(slotAmount)}
                    </span>
                    <NoteIcon hasNote={hasNote || paymentCount > 0} onClick={() => openInstallmentPopup(i)} />
                    <span
                      className={`text-[11px] w-14 text-right ${paid ? 'text-green' : partialHere > 0 ? 'text-yellow' : isNext ? 'text-yellow' : 'text-muted'}`}
                    >
                      {paid ? '✓ Paid' : partialHere > 0 ? 'Partial' : isNext ? 'Next' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center py-3 px-3.5 bg-surface rounded-[10px] text-[13px]">
            <span className="text-muted2">Remaining Balance</span>
            <span className="font-mono font-semibold text-accent">{fmt(remaining)}</span>
          </div>

          <div className="flex flex-wrap gap-2.5 justify-end mt-5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleHidden(!(loan.hidden ?? false));
              }}
              className="mr-auto flex items-center gap-2 text-[11px] text-muted2 cursor-pointer rounded-md py-1.5 pr-2 pl-1 border-0 bg-transparent row-hover text-left"
            >
              <span
                className={`flex items-center justify-center w-[22px] h-[22px] rounded-md border flex-shrink-0 transition-all
                  ${(loan.hidden ?? false) ? 'bg-green border-green' : 'bg-surface border-border'}`}
              >
                {(loan.hidden ?? false) && (
                  <svg className="w-3 h-3 stroke-white stroke-[2.5] fill-none" viewBox="0 0 12 12">
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </span>
              <span>{(loan.hidden ?? false) ? 'Hidden from dashboard lists' : 'Hide this loan from dashboard'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
              title="Print loan details (TRUFUNDING LLC)"
            >
              Print
            </button>
            {isAccountAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                className="py-1.5 px-3.5 rounded-lg border border-red/30 text-red text-xs font-medium bg-transparent hover:bg-red/10"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
            >
              Close
            </button>
            {isAccountAdmin && (
              <button
                type="button"
                onClick={handleReverse}
                disabled={!canReverse}
                className="py-1.5 px-3.5 rounded-lg border border-border text-muted text-xs font-medium bg-transparent hover:bg-surface hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ↩ Reverse
              </button>
            )}
            {!isFullyPaid && (
              <button
                type="button"
                onClick={handleCloseLoan}
                className="py-1.5 px-3.5 rounded-lg border border-green/30 text-green text-xs font-medium bg-transparent hover:bg-green/10"
              >
                ✓ Close loan
              </button>
            )}
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={isFullyPaid}
              className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFullyPaid ? 'Fully Paid' : 'Mark Next Paid'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Installment popup: note + close this installment only */}
      {isInstallmentPopupOpen && selectedInstallmentIndex !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center"
          onClick={closeInstallmentPopup}
          role="dialog"
          aria-modal="true"
          aria-labelledby="installment-modal-title"
        >
          <div
            className="bg-panel border border-border rounded-[20px] p-6 w-[400px] max-w-[95vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="installment-modal-title" className="text-base font-semibold mb-1">
              Installment #{selectedInstallmentIndex + 1}
            </h3>
            <p className="text-[12px] text-muted2 mb-3">
              {(() => {
                const dueStr = getScheduleDueDateOnly(
                  loan.startDate,
                  selectedInstallmentIndex,
                  loan.freqDays ?? 7
                );
                const [sy, sm, sd] = dueStr.split('-').map(Number);
                const paidDate = loan.paymentDates?.[selectedInstallmentIndex];
                return (
                  <>
                    Scheduled: {fmtDate(new Date(sy, sm - 1, sd))}
                    {paidDate && (
                      <span className="text-green ml-1"> · Paid {fmtDate(paidDate)}</span>
                    )}
                  </>
                );
              })()}
            </p>

            <InstallmentPaymentsList
              payments={getInstallmentPayments(loan, selectedInstallmentIndex)}
              compact
            />

            <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
              Payment date
            </label>
            <input
              type="date"
              value={popupCloseDate}
              onChange={(e) => setPopupCloseDate(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent mb-4"
            />
            {selectedIsNextUnpaid && (
              <>
                {openPartial > 0 && (
                  <p className="text-[12px] text-muted2 mb-2">
                    Already posted: {fmt(openPartial)} · Remaining:{' '}
                    {fmt(getLoanOpenInstallmentRemaining(loan))}
                  </p>
                )}
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
                  Payment amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={popupAmount}
                  onChange={(e) => setPopupAmount(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent mb-4 tabular-nums"
                />
              </>
            )}
            <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
              {selectedIsNextUnpaid ? 'Note for this payment' : 'Installment note'}
            </label>
            <textarea
              value={popupNote}
              onChange={(e) => setPopupNote(e.target.value)}
              placeholder={
                selectedIsNextUnpaid
                  ? 'Optional note for this payment…'
                  : 'Edit installment note…'
              }
              rows={2}
              className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink placeholder:text-muted outline-none focus:border-accent resize-none"
            />
            {popupError && (
              <p className="text-[12px] text-red-400 mt-2" role="alert">
                {popupError}
              </p>
            )}
            <div className="flex flex-wrap gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={closeInstallmentPopup}
                disabled={popupSubmitting}
                className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Cancel
              </button>
              {selectedIsNextUnpaid && !isFullyPaid ? (
                <button
                  type="button"
                  onClick={() => void handleCloseInstallment()}
                  disabled={popupSubmitting}
                  className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {popupSubmitting ? 'Posting…' : 'Post payment'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSaveNoteOnly}
                    className="py-1.5 px-3.5 rounded-lg border border-accent/50 text-accent text-xs font-medium hover:bg-accent/10"
                  >
                    Save note
                  </button>
                  {selectedIsPaid && onUpdatePaymentDate && (
                    <button
                      type="button"
                      onClick={() => void handleSaveDate()}
                      className="py-1.5 px-3.5 rounded-lg border border-accent/50 text-accent text-xs font-medium hover:bg-accent/10"
                    >
                      Save date
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
