import { useState, useEffect } from 'react';
import type { Reserve } from '@/types';
import { Modal } from '@/components/Modal';
import { fmt, fmtDate } from '@/lib/utils';

interface ReserveDetailModalProps {
  reserve: Reserve | null;
  open: boolean;
  onClose: () => void;
  onMarkDeducted: () => void;
  onReverse: () => void;
  onDelete: () => void;
  /** Run destructive action only after password confirmation. */
  runWithPasswordProtection: (action: () => void) => void;
  onCloseReserve: () => void;
  onUpdateDeductionNote: (index: number, note: string) => void;
  /** When set, "Close deduction" uses this single update (saves note + marks deducted) to avoid race. */
  onCloseDeductionWithNote?: (index: number, note: string) => Promise<void>;
}

/** Small note icon (click to open deduction popup) */
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

export function ReserveDetailModal({
  reserve,
  open,
  onClose,
  onMarkDeducted,
  onReverse,
  onDelete,
  runWithPasswordProtection,
  onCloseReserve,
  onUpdateDeductionNote,
  onCloseDeductionWithNote,
}: ReserveDetailModalProps) {
  const [selectedDeductionIndex, setSelectedDeductionIndex] = useState<number | null>(null);
  const [popupNote, setPopupNote] = useState('');

  useEffect(() => {
    if (reserve && selectedDeductionIndex !== null) {
      const notes = reserve.deductionNotes ?? [];
      setPopupNote(notes[selectedDeductionIndex] ?? '');
    }
  }, [reserve, selectedDeductionIndex]);

  if (!reserve) return null;

  const perInst = reserve.amount / reserve.installments;
  const remaining = perInst * (reserve.installments - reserve.paidCount);
  const isClosed = reserve.paidCount >= reserve.installments;
  const canReverse = reserve.paidCount > 0;
  const freq = reserve.freqDays ?? 7;
  const notes = reserve.deductionNotes ?? [];

  const handleDelete = () => {
    runWithPasswordProtection(() => {
      if (!window.confirm('Delete this reserve?')) return;
      onDelete();
    });
  };

  const handleReverse = () => {
    runWithPasswordProtection(() => onReverse());
  };

  const handleCloseReserve = () => {
    if (!window.confirm('Mark this reserve as fully deducted (close it)?')) return;
    onCloseReserve();
  };

  const openDeductionPopup = (index: number) => {
    setSelectedDeductionIndex(index);
    setPopupNote(notes[index] ?? '');
  };

  const closeDeductionPopup = () => {
    setSelectedDeductionIndex(null);
  };

  /** Save note and close this deduction (only when it's the next unpaid). */
  const handleCloseDeduction = async () => {
    if (selectedDeductionIndex === null) return;
    if (selectedDeductionIndex === reserve.paidCount && onCloseDeductionWithNote) {
      await onCloseDeductionWithNote(selectedDeductionIndex, popupNote.trim());
    } else {
      onUpdateDeductionNote(selectedDeductionIndex, popupNote.trim());
      if (selectedDeductionIndex === reserve.paidCount) {
        await onMarkDeducted();
      }
    }
    closeDeductionPopup();
  };

  const handleSaveNoteOnly = () => {
    if (selectedDeductionIndex === null) return;
    onUpdateDeductionNote(selectedDeductionIndex, popupNote.trim());
    closeDeductionPopup();
  };

  const isDeductionPopupOpen = selectedDeductionIndex !== null;
  const selectedIsNextUnpaid = selectedDeductionIndex === reserve.paidCount;

  return (
    <>
      <Modal open={open} onClose={onClose} title={`${reserve.client} — Reserve`}>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Total Amount</span>
            <span className="font-mono font-medium">{fmt(reserve.amount)}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Per Deduction</span>
            <span className="font-mono font-medium">{fmt(perInst)}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Installments</span>
            <span className="font-mono font-medium">{reserve.installments}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Deducted</span>
            <span className="font-mono font-medium text-green">{reserve.paidCount}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Start Date</span>
            <span className="font-mono font-medium">{fmtDate(reserve.date)}</span>
          </div>
          {reserve.note && (
            <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
              <span className="text-muted2">Note</span>
              <span className="text-xs text-yellow">{reserve.note}</span>
            </div>
          )}

          <div className="text-[11px] text-muted uppercase tracking-wider mt-4 mb-2">
            Deductions — click row or note icon to add note or mark deducted
          </div>
          <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto scrollable">
            {Array.from({ length: reserve.installments }, (_, i) => {
              const paid = i < reserve.paidCount;
              const isNext = i === reserve.paidCount;
              const scheduledDate = new Date(reserve.date);
              scheduledDate.setDate(scheduledDate.getDate() + i * freq);
              const actualDate =
                reserve.deductionDates?.[i] ? fmtDate(reserve.deductionDates[i]) : null;
              const hasNote = !!(notes[i] ?? '').trim();
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDeductionPopup(i)}
                  onKeyDown={(e) => e.key === 'Enter' && openDeductionPopup(i)}
                  className={`flex items-center justify-between gap-2 py-2.5 px-3.5 rounded-[10px] bg-surface text-[13px] cursor-pointer hover:bg-white/[0.04] transition-colors ${paid ? 'opacity-90' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted2 text-[11px] shrink-0">
                      #{i + 1} · {fmtDate(scheduledDate)}
                      {actualDate && (
                        <span className="text-green ml-1">→ deducted {actualDate}</span>
                      )}
                    </span>
                    {hasNote && (
                      <span className="shrink-0 text-[10px] text-muted px-1.5 py-0.5 rounded bg-border/50" title={notes[i]}>
                        note
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono">{fmt(perInst)}</span>
                    <NoteIcon hasNote={hasNote} onClick={() => openDeductionPopup(i)} />
                    <span
                      className={`text-[11px] w-12 text-right ${paid ? 'text-green' : isNext ? 'text-yellow' : 'text-muted'}`}
                    >
                      {paid ? '✓ Deducted' : isNext ? 'Next' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center py-3 px-3.5 bg-surface rounded-[10px] text-[13px] mt-1">
            <span className="text-muted2">Remaining</span>
            <span className="font-mono font-semibold text-accent2">{fmt(remaining)}</span>
          </div>

          <div className="flex flex-wrap gap-2.5 justify-end mt-5">
            <button
              type="button"
              onClick={handleDelete}
              className="py-1.5 px-3.5 rounded-lg border border-red/30 text-red text-xs font-medium bg-transparent hover:bg-red/10"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleReverse}
              disabled={!canReverse}
              className="py-1.5 px-3.5 rounded-lg border border-yellow/30 text-yellow text-xs font-medium bg-transparent hover:bg-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↩ Reverse
            </button>
            {!isClosed && (
              <button
                type="button"
                onClick={handleCloseReserve}
                className="py-1.5 px-3.5 rounded-lg border border-green/30 text-green text-xs font-medium bg-transparent hover:bg-green/10"
              >
                ✓ Close reserve
              </button>
            )}
            <button
              type="button"
              onClick={onMarkDeducted}
              disabled={isClosed}
              className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClosed ? 'Fully Deducted' : '✓ Mark Deducted'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Deduction popup: note + close this deduction only */}
      {isDeductionPopupOpen && selectedDeductionIndex !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center"
          onClick={closeDeductionPopup}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deduction-modal-title"
        >
          <div
            className="bg-card border border-border rounded-[20px] p-6 w-[400px] max-w-[95vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="deduction-modal-title" className="text-base font-semibold mb-1">
              Deduction #{selectedDeductionIndex + 1}
            </h3>
            <p className="text-[12px] text-muted2 mb-4">
              {(() => {
                const d = new Date(reserve.date);
                d.setDate(d.getDate() + selectedDeductionIndex * freq);
                const deductedDate = reserve.deductionDates?.[selectedDeductionIndex];
                return (
                  <>
                    Scheduled: {fmtDate(d)}
                    {deductedDate && (
                      <span className="text-green ml-1"> · Deducted {fmtDate(deductedDate)}</span>
                    )}
                  </>
                );
              })()}
            </p>
            <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
              Note
            </label>
            <textarea
              value={popupNote}
              onChange={(e) => setPopupNote(e.target.value)}
              placeholder="Add a note (optional)…"
              rows={3}
              className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-text placeholder:text-muted outline-none focus:border-accent resize-none"
            />
            <div className="flex flex-wrap gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={closeDeductionPopup}
                className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
              >
                Cancel
              </button>
              {selectedIsNextUnpaid && !isClosed ? (
                <button
                  type="button"
                  onClick={handleCloseDeduction}
                  className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8]"
                >
                  Close deduction
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveNoteOnly}
                  className="py-1.5 px-3.5 rounded-lg border border-accent/50 text-accent text-xs font-medium hover:bg-accent/10"
                >
                  Save note
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
