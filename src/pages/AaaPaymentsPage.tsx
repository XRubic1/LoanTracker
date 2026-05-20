import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { AaaPaymentForm } from '@/components/AaaPaymentForm';
import { fmt, fmtDate } from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';

interface AaaPaymentsPageProps extends Pick<UseDataResult, 'aaaPayments' | 'addAaaPayment'> {}

export function AaaPaymentsPage({ aaaPayments, addAaaPayment }: AaaPaymentsPageProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-semibold">AAA Payments</h1>
      </div>

      <div className="mb-5">
        <Section title="Record payment">
          <AaaPaymentForm
            onSubmit={async (payload) => {
              await addAaaPayment(payload);
            }}
          />
        </Section>
      </div>

      <Section title="Payment history" count={aaaPayments.length}>
        {aaaPayments.length === 0 ? (
          <div className="text-center py-10 text-muted text-[13px]">No AAA payments recorded yet</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Date
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Client
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Payee
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {aaaPayments.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.015] transition-colors">
                  <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-xs text-muted2">
                    {fmtDate(p.paymentDate)}
                  </td>
                  <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-medium text-text">
                    {p.client}
                  </td>
                  <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                    <Badge variant="closed">{p.payee}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium text-green">
                    {fmt(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
