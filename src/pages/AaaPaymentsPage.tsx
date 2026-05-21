import { Section } from '@/components/Section';
import { AaaPaymentForm } from '@/components/AaaPaymentForm';
import { AaaPaymentsHistorySection } from '@/components/AaaPaymentsHistorySection';
import type { UseDataResult } from '@/hooks/useData';

interface AaaPaymentsPageProps
  extends Pick<UseDataResult, 'aaaPayments' | 'addAaaPayment' | 'clientInsurance'> {
  onEditPayment: (id: number) => void;
}

export function AaaPaymentsPage({
  aaaPayments,
  addAaaPayment,
  clientInsurance,
  onEditPayment,
}: AaaPaymentsPageProps) {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">AAA Payments</h1>
      </div>

      <div className="mb-3">
        <Section title="Record payment">
          <AaaPaymentForm
            clientInsurance={clientInsurance}
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
