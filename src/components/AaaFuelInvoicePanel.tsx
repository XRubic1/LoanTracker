import { Badge } from '@/components/Badge';
import { dayLabel } from '@/lib/aaaDues';
import type { InvoiceGroup } from '@/lib/aaaFuel';
import type { AaaReceiptStatus } from '@/lib/aaaFuel';
import { fmt, fmtDate } from '@/lib/utils';

interface AaaFuelInvoicePanelProps {
  group: InvoiceGroup;
  busy: boolean;
  /** key of the payment / invoice the notice belongs to */
  notice: { key: string; text: string } | null;
  onPayment: (id: number, paymentDate: string, status: AaaReceiptStatus) => void;
  onInvoice: (group: InvoiceGroup, status: AaaReceiptStatus) => void;
  /** Open the "post a payment" dialog (only offered for invoices that are still open). */
  onPostPayment?: () => void;
}

/** Dropdown content for one invoice: every payment posted against it, plus whole-invoice actions. */
export function AaaFuelInvoicePanel({
  group,
  busy,
  notice,
  onPayment,
  onInvoice,
  onPostPayment,
}: AaaFuelInvoicePanelProps) {
  const anyMarked = group.received > 0 || group.notReceived > 0;
  const allReceived = group.payments.length > 0 && group.received === group.payments.length;
  const invoiceNotice = notice?.key === `inv-${group.key}` ? notice.text : null;
  /** What is still owed on the invoice after each payment, in the order they were posted. */
  const leftAfter = new Map<number, number>();
  let running = group.total;
  for (const p of group.payments) {
    running = Math.max(0, Math.round((running - p.amount) * 100) / 100);
    leftAfter.set(p.id, running);
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Payments on this invoice · {group.payments.length}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onPostPayment && (
            <button
              type="button"
              disabled={busy}
              onClick={onPostPayment}
              className="h-7 border border-accent px-3 text-[11px] whitespace-nowrap text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              + Post a payment
            </button>
          )}
          {group.payments.length > 0 && (
            <>
            {!allReceived && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onInvoice(group, 'received')}
                className="btn-primary h-7 px-3 text-[11px] whitespace-nowrap disabled:opacity-50"
              >
                Mark whole invoice received
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onInvoice(group, 'not_received')}
              className="h-7 border border-border px-3 text-[11px] whitespace-nowrap text-muted2 hover:border-red hover:text-red disabled:opacity-50"
            >
              Whole invoice not received
            </button>
            {anyMarked && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onInvoice(group, null)}
                className="text-[11px] text-muted2 underline hover:text-red disabled:opacity-50"
              >
                Clear all
              </button>
            )}
            </>
          )}
        </div>
      </div>
      {invoiceNotice && (
        <p className="mb-2 text-[11px] leading-snug text-amber" role="alert">
          {invoiceNotice}
        </p>
      )}

      {group.payments.length === 0 ? (
        <p className="py-2 text-[12px] text-muted">No payments have been posted on this invoice yet.</p>
      ) : (
        <>
        <div className="mb-1 flex items-center gap-x-4 px-3 text-[10px] uppercase tracking-wider text-label">
          <span className="w-[110px]">Day</span>
          <span className="w-[110px]">Payment</span>
          <span className="w-[130px]">Left on invoice</span>
          <span className="flex-1">Received?</span>
        </div>
        <ul className="divide-y divide-border border border-border bg-panel">
          {group.payments.map((p) => {
            const lineNotice = notice?.key === `p-${p.id}` ? notice.text : null;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                <span className="w-[110px] text-[12px] text-ink">{dayLabel(p.paymentDate)}</span>
                <span className="w-[110px] font-mono text-[12px] font-medium text-green">{fmt(p.amount)}</span>
                <span className="w-[130px] font-mono text-[12px]">
                  {(leftAfter.get(p.id) ?? 0) > 0 ? (
                    <>
                      <span className="text-muted">→ </span>
                      <span className="font-medium text-yellow">{fmt(leftAfter.get(p.id) ?? 0)}</span>
                      <span className="font-sans text-[10px] text-muted"> left</span>
                    </>
                  ) : (
                    <span className="font-sans text-[11px] font-medium text-green">→ Paid in full</span>
                  )}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {p.receivedAt ? (
                    <>
                      <Badge variant="ok">Received {fmtDate(p.receivedAt)}</Badge>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPayment(p.id, p.paymentDate, null)}
                        className="text-[10px] text-muted2 underline hover:text-red disabled:opacity-50"
                      >
                        Undo
                      </button>
                    </>
                  ) : p.notReceivedAt ? (
                    <>
                      <Badge variant="overdue">Not received {fmtDate(p.notReceivedAt)}</Badge>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPayment(p.id, p.paymentDate, 'received')}
                        className="text-[10px] text-accent underline disabled:opacity-50"
                      >
                        Mark received
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPayment(p.id, p.paymentDate, null)}
                        className="text-[10px] text-muted2 underline hover:text-red disabled:opacity-50"
                      >
                        Undo
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPayment(p.id, p.paymentDate, 'received')}
                        className="btn-primary h-6 px-2.5 text-[11px] whitespace-nowrap disabled:opacity-50"
                      >
                        Received
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPayment(p.id, p.paymentDate, 'not_received')}
                        className="h-6 border border-border px-2.5 text-[11px] whitespace-nowrap text-muted2 hover:border-red hover:text-red disabled:opacity-50"
                      >
                        Not received
                      </button>
                    </>
                  )}
                </div>
                {lineNotice && (
                  <p className="basis-full text-[11px] leading-snug text-amber" role="alert">
                    {lineNotice}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}
