import type { LoanInstallmentPayment } from '@/types';
import { fmt, fmtDate } from '@/lib/utils';
import { sumInstallmentPayments } from '@/lib/loanPaymentActions';

interface InstallmentPaymentsListProps {
  payments: LoanInstallmentPayment[];
  /** Compact spacing for nested modals. */
  compact?: boolean;
}

/**
 * Renders the real payment history for one installment
 * (amount + date + optional per-payment note).
 */
export function InstallmentPaymentsList({
  payments,
  compact = false,
}: InstallmentPaymentsListProps) {
  if (!payments.length) {
    return (
      <p className={`text-[12px] text-muted2 ${compact ? 'mb-2' : 'mb-3'}`}>
        No payments posted yet.
      </p>
    );
  }

  const total = sumInstallmentPayments(payments);

  return (
    <div className={compact ? 'mb-2' : 'mb-3'}>
      <div className="text-[11px] text-muted uppercase tracking-wider mb-1.5">
        Payments ({payments.length})
      </div>
      <ul className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto scrollable">
        {payments.map((p, i) => (
          <li
            key={`${p.date}-${p.amount}-${i}`}
            className="flex items-start justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-surface text-[12px]"
          >
            <div className="min-w-0">
              <div className="text-muted2 tabular-nums">
                {p.date ? fmtDate(p.date) : '—'}
              </div>
              {p.note?.trim() && (
                <div className="text-muted text-[11px] mt-0.5 break-words">{p.note.trim()}</div>
              )}
            </div>
            <span className="font-mono font-medium text-ink tabular-nums shrink-0">
              {fmt(p.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between items-center mt-1.5 px-0.5 text-[12px]">
        <span className="text-muted2">Posted total</span>
        <span className="font-mono font-medium text-green tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  );
}
