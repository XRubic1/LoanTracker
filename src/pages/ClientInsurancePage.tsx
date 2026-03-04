import { useState } from 'react';
import { Section } from '@/components/Section';
import { Modal } from '@/components/Modal';
import {
  getClientInsuranceStatusLabel,
  isClientInsuranceWarning,
  isClientInsuranceOut,
  isClientInsuranceInactiveOrOut,
} from '@/lib/clientInsuranceUtils';
import { printCancellationReport } from '@/lib/printClientInsurance';
import type { UseDataResult } from '@/hooks/useData';

interface ClientInsurancePageProps extends Pick<
  UseDataResult,
  'clientInsurance' | 'addClientInsurance' | 'insuranceVerification' | 'updateInsuranceVerification'
> {
  onAddClient: () => void;
  onViewClient: (id: number) => void;
}

export function ClientInsurancePage({
  clientInsurance,
  insuranceVerification,
  updateInsuranceVerification,
  onAddClient,
  onViewClient,
}: ClientInsurancePageProps) {
  const [hideInactive, setHideInactive] = useState(true);
  const [recordVerificationOpen, setRecordVerificationOpen] = useState(false);
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordCheckedBy, setRecordCheckedBy] = useState('');
  const [savingVerification, setSavingVerification] = useState(false);

  const handleRecordVerification = async () => {
    const name = recordCheckedBy.trim();
    if (!name) return;
    setSavingVerification(true);
    try {
      await updateInsuranceVerification({ last_checked_date: recordDate, checked_by: name });
      setRecordVerificationOpen(false);
      setRecordCheckedBy('');
      setRecordDate(new Date().toISOString().split('T')[0]);
    } finally {
      setSavingVerification(false);
    }
  };

  const list = hideInactive
    ? clientInsurance.filter((c) => !isClientInsuranceInactiveOrOut(c))
    : clientInsurance;

  return (
    <>
      {/* Last verified: date + name; button to record verification */}
      <div className="mb-4 rounded-xl border border-border bg-card/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted2">
          {insuranceVerification?.last_checked_date && insuranceVerification?.checked_by ? (
            <>
              Last verified:{' '}
              <span className="text-text font-medium">
                {new Date(insuranceVerification.last_checked_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {' by '}
              <span className="text-text font-medium">{insuranceVerification.checked_by}</span>
            </>
          ) : (
            <span className="text-muted">Not verified yet. Record a verification after reviewing client insurance.</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRecordVerificationOpen(true)}
          className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border border-border text-xs font-medium text-muted2 bg-transparent transition-all hover:border-accent hover:text-accent hover:bg-accent/5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Record verification
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-7 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-semibold">Client Insurance</h1>
        <div className="flex flex-wrap gap-2 justify-start sm:justify-end items-center">
          <button
            type="button"
            onClick={() => setHideInactive((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              hideInactive
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted2 hover:text-text'
            }`}
          >
            <span
              className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center text-[10px] ${
                hideInactive ? 'bg-accent border-accent text-white' : 'border-border'
              }`}
            >
              {hideInactive ? '✓' : ''}
            </span>
            <span>Hide Inactive clients</span>
          </button>
          <button
            type="button"
            onClick={() => printCancellationReport(clientInsurance)}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border border-border text-xs font-medium text-muted2 bg-transparent transition-all hover:border-accent hover:text-accent hover:bg-accent/5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print cancellation report
          </button>
          <button
            type="button"
            onClick={onAddClient}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium transition-colors hover:bg-[#3a7de8]"
          >
            + Add client
          </button>
        </div>
      </div>

      <Section title="Clients" count={list.length}>
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
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted text-[13px]">
                  {clientInsurance.length === 0
                    ? 'No clients yet. Add a client or run the seed SQL to load initial data.'
                    : 'No clients to show. Turn off "Hide Inactive clients" to see Inactive and OUT.'}
                </td>
              </tr>
            ) : (
              list.map((c) => {
                const isOut = isClientInsuranceOut(c);
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
                          isOut
                            ? 'text-red font-medium'
                            : isWarning
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

      <Modal
        open={recordVerificationOpen}
        onClose={() => !savingVerification && setRecordVerificationOpen(false)}
        title="Record insurance verification"
      >
        <p className="text-[13px] text-muted2 mb-4">
          Set the date and name of the person who reviewed client insurance. This is checked weekly; the Overview will show a warning if not verified within 7 days.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted2 mb-1.5">Date checked</label>
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted2 mb-1.5">Checked by</label>
            <input
              type="text"
              value={recordCheckedBy}
              onChange={(e) => setRecordCheckedBy(e.target.value)}
              placeholder="Name of reviewer"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-muted2"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => !savingVerification && setRecordVerificationOpen(false)}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRecordVerification}
            disabled={!recordCheckedBy.trim() || savingVerification}
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3a7de8]"
          >
            {savingVerification ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </>
  );
}
