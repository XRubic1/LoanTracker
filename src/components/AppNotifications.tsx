import { useState } from 'react';
import type { ClientInsurance, Loan } from '@/types';
import { Modal } from '@/components/Modal';
import { getDateWeekLabel, isNewLoan } from '@/lib/utils';
import {
  getDaysUntilCancellation,
  isClientInsuranceCancellationSoon,
  isClientInsuranceCancellationWithDate,
} from '@/lib/clientInsuranceUtils';

interface AppNotificationsProps {
  loans: Loan[];
  clientInsurance: ClientInsurance[];
}

export function AppNotifications({ loans, clientInsurance }: AppNotificationsProps) {
  const [cancellationPopupOpen, setCancellationPopupOpen] = useState(false);

  const visibleLoans = loans.filter((l) => !l.hidden);
  const activeLoans = visibleLoans.filter((l) => l.paidCount < l.totalInstallments);
  const newLoans = activeLoans.filter(isNewLoan);

  const cancellationWithDate = clientInsurance
    .filter(isClientInsuranceCancellationWithDate)
    .map((c) => ({ ...c, _sortDate: c.expiration_date ? new Date(c.expiration_date).getTime() : 0 }))
    .sort((a, b) => a._sortDate - b._sortDate)
    .map(({ _sortDate: _, ...c }) => c);

  const cancellationSoon = cancellationWithDate
    .filter((c) => isClientInsuranceCancellationSoon(c, 7))
    .map((c) => ({ ...c, daysUntil: getDaysUntilCancellation(c) ?? 0 }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const showCancellation = cancellationWithDate.length > 0;
  const showNewLoans = newLoans.length > 0;

  if (!showCancellation && !showNewLoans) return null;

  return (
    <>
      <div className="w-full flex-shrink-0 flex flex-col gap-[6px] px-6 py-[10px] bg-page border-b border-border/60">
        {showCancellation && (
          <button
            type="button"
            onClick={() => setCancellationPopupOpen(true)}
            className="alert-banner-warn transition-colors"
            role="alert"
          >
            <svg className="h-[14px] w-[14px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="flex-1 min-w-0 truncate">
              <strong className="font-medium">
                {cancellationSoon.length > 0 ? 'Insurance cancellation upcoming' : 'Client insurance'}
              </strong>
              {' — '}
              {cancellationSoon.length > 0
                ? cancellationSoon
                    .slice(0, 2)
                    .map((c) => {
                      const d = c.expiration_date
                        ? new Date(c.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'No date';
                      return `${c.client} · ${d}, in ${c.daysUntil} day${c.daysUntil === 1 ? '' : 's'}`;
                    })
                    .join(' / ') + (cancellationSoon.length > 2 ? ` +${cancellationSoon.length - 2} more` : '')
                : `${cancellationWithDate.length} client${cancellationWithDate.length !== 1 ? 's' : ''} with cancellation date`}
            </span>
            <svg className="w-[12px] h-[12px] flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {showNewLoans && (
          <div className="alert-banner-info" role="alert">
            <svg className="h-[14px] w-[14px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="flex-1 min-w-0">
              <strong className="font-medium">{newLoans.length} new loan{newLoans.length !== 1 ? 's' : ''}</strong>
              {' — first installment due soon · '}
              {newLoans.map((l, i) => {
                const weekLabel = getDateWeekLabel(l.startDate);
                const isThisWeek = weekLabel === 'this_week';
                return (
                  <span key={l.id}>
                    {i > 0 && ', '}
                    {l.client}
                    <span
                      className={
                        isThisWeek ? 'alert-week-badge' : 'alert-week-badge alert-week-badge--next'
                      }
                    >
                      {isThisWeek ? 'THIS WEEK' : 'NEXT WEEK'}
                    </span>
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>

      {showCancellation && (
        <Modal
          open={cancellationPopupOpen}
          onClose={() => setCancellationPopupOpen(false)}
          title="Clients with cancellation (by date, oldest first)"
        >
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-2 pr-3 text-left border-b border-border">
                    Client
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-2 pr-3 text-left border-b border-border">
                    MC
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-2 pr-3 text-left border-b border-border">
                    Cancellation
                  </th>
                </tr>
              </thead>
              <tbody>
                {cancellationWithDate.map((c) => (
                  <tr key={c.id} className="border-b border-border/40">
                    <td className="py-1.5 pr-2 font-medium">{c.client}</td>
                    <td className="py-1.5 pr-2 font-mono">{c.mc}</td>
                    <td className="py-1.5 pr-2 font-mono text-muted2">
                      {c.expiration_date
                        ? new Date(c.expiration_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={() => setCancellationPopupOpen(false)}
              className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
