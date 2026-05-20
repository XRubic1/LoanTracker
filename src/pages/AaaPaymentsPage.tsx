import { Section } from '@/components/Section';
import { AaaPaymentForm } from '@/components/AaaPaymentForm';
import { AaaPaymentsHistorySection } from '@/components/AaaPaymentsHistorySection';
import type { UseDataResult } from '@/hooks/useData';

interface AaaPaymentsPageProps extends Pick<UseDataResult, 'aaaPayments' | 'addAaaPayment'> {
  onEditPayment: (id: number) => void;
}

export function AaaPaymentsPage({ aaaPayments, addAaaPayment, onEditPayment }: AaaPaymentsPageProps) {
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

      <AaaPaymentsHistorySection payments={aaaPayments} onEdit={onEditPayment} />
    </>
  );
}
