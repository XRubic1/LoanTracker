import { Section } from '@/components/Section';
import { getClientInsuranceStatusLabel, isClientInsuranceWarning } from '@/lib/clientInsuranceUtils';
import type { ClientInsurance } from '@/types';
import type { UseDataResult } from '@/hooks/useData';

interface ClientInsurancePageProps extends Pick<UseDataResult, 'clientInsurance' | 'addClientInsurance'> {
  onAddClient: () => void;
  onViewClient: (id: number) => void;
}

export function ClientInsurancePage({
  clientInsurance,
  onAddClient,
  onViewClient,
}: ClientInsurancePageProps) {
  return (
    <>
      <div className="flex flex-col gap-3 mb-7 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-semibold">Client Insurance</h1>
        <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
          <button
            type="button"
            onClick={onAddClient}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium transition-colors hover:bg-[#3a7de8]"
          >
            + Add client
          </button>
        </div>
      </div>

      <Section title="Clients" count={clientInsurance.length}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Client
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                MC
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Status
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border w-16" />
            </tr>
          </thead>
          <tbody>
            {clientInsurance.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted text-[13px]">
                  No clients yet. Add a client or run the seed SQL to load initial data.
                </td>
              </tr>
            ) : (
              clientInsurance.map((c) => {
                const isWarning = isClientInsuranceWarning(c);
                const statusLabel = getClientInsuranceStatusLabel(c);
                const copyMc = () => {
                  navigator.clipboard.writeText(c.mc).then(() => {}, () => {});
                };
                return (
                  <tr key={c.id} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <div className="font-medium text-text">{c.client}</div>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <div className="flex items-center gap-1.5 font-mono text-[13px]">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); copyMc(); }}
                          className="p-0.5 rounded text-muted2 hover:text-accent hover:bg-accent/10"
                          title="Copy MC"
                          aria-label="Copy"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        {c.mc}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <span
                        className={
                          isWarning
                            ? 'text-yellow font-medium'
                            : statusLabel.toLowerCase() === 'ok'
                              ? 'text-green'
                              : ''
                        }
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <button
                        type="button"
                        onClick={() => onViewClient(c.id)}
                        className="text-[11px] text-accent hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Section>
    </>
  );
}
