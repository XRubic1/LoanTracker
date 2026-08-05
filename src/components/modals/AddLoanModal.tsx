import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import type { Loan, LoanProviderType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLinkedTeams } from '@/hooks/useLinkedTeams';
import { fmt, isWeekdayOnlySchedule, toNextWeekdayOnOrAfter } from '@/lib/utils';

interface AddLoanModalProps {
  open: boolean;
  onClose: () => void;
  /** forOwnerId is the team owner UUID when a platform admin picks a team. */
  onAdd: (payload: Omit<Loan, 'id'>, forOwnerId?: string | null) => Promise<Loan>;
}

const todayStr = new Date().toISOString().split('T')[0];

export function AddLoanModal({ open, onClose, onAdd }: AddLoanModalProps) {
  const { isPlatformAdmin, effectiveOwnerId } = useAuth();
  const { options: teamOptions } = useLinkedTeams(
    effectiveOwnerId,
    isPlatformAdmin ? 'client-pool' : 'linked-group'
  );
  const teamChoices = teamOptions.filter((o) => o.ownerId);

  const [client, setClient] = useState('');
  const [ref, setRef] = useState('');
  const [total, setTotal] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [freqDays, setFreqDays] = useState(7);
  const [startDate, setStartDate] = useState(todayStr);
  const [providerType, setProviderType] = useState<LoanProviderType>('TruFunding');
  const [providerName, setProviderName] = useState('');
  const [factoringFee, setFactoringFee] = useState('');
  const [teamOwnerId, setTeamOwnerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset / default team when modal opens for platform admin.
  useEffect(() => {
    if (!open) return;
    if (!isPlatformAdmin) {
      setTeamOwnerId('');
      return;
    }
    setTeamOwnerId((prev) => {
      if (prev && teamOptions.some((t) => t.ownerId === prev)) return prev;
      const self = teamOptions.find((t) => t.ownerId === effectiveOwnerId);
      return self?.ownerId ?? teamOptions.find((t) => t.ownerId)?.ownerId ?? '';
    });
  }, [open, isPlatformAdmin, effectiveOwnerId, teamOptions]);

  const totalNum = total.trim() ? parseFloat(total) : NaN;
  const totalInstNum = totalInstallments.trim() ? parseInt(totalInstallments, 10) : 0;
  const feeNum = factoringFee.trim() ? parseFloat(factoringFee) : 0;
  const effectiveTotal = !isNaN(totalNum) ? totalNum + (providerType === 'Other' ? feeNum : 0) : 0;
  const installmentAmount = totalInstNum > 0 && effectiveTotal > 0 ? effectiveTotal / totalInstNum : 0;

  const inputClass = 'form-input font-sans text-xs py-1.5 px-2.5';
  const selectClass = 'select-field font-sans text-xs py-1.5 px-2.5';

  const resetForm = () => {
    setClient('');
    setRef('');
    setTotal('');
    setTotalInstallments('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setFreqDays(7);
    setProviderType('TruFunding');
    setProviderName('');
    setFactoringFee('');
    setTeamOwnerId('');
  };

  const handleSubmit = async () => {
    if (
      !client.trim() ||
      !totalNum ||
      totalNum <= 0 ||
      !totalInstNum ||
      totalInstNum <= 0 ||
      !startDate
    ) {
      window.alert('Fill all required fields (Client, Total, # Installments, Start date)');
      return;
    }
    if (isPlatformAdmin && !teamOwnerId) {
      window.alert('Select the team this loan belongs to');
      return;
    }
    if (providerType === 'Other' && !providerName.trim()) {
      window.alert('Enter Provider name when Other is selected');
      return;
    }
    const fee = providerType === 'Other' ? (isNaN(feeNum) ? 0 : feeNum) : 0;
    const effective = totalNum + fee;
    const installment = totalInstNum > 0 ? effective / totalInstNum : 0;
    const scheduleFreq = freqDays || 7;
    const normalizedStart =
      scheduleFreq === 1 ? toNextWeekdayOnOrAfter(startDate) : startDate;

    setSubmitting(true);
    try {
      await onAdd(
        {
          client: client.trim(),
          ref: ref.trim(),
          total: totalNum,
          installment,
          paidCount: 0,
          totalInstallments: totalInstNum,
          startDate: normalizedStart,
          freqDays: scheduleFreq,
          paymentDates: [],
          paymentNotes: [],
          note: '',
          providerType,
          providerName: providerType === 'Other' ? providerName.trim() : '',
          factoringFee: fee,
          hidden: false,
        },
        isPlatformAdmin ? teamOwnerId : undefined
      );
      resetForm();
      onClose();
    } catch (err) {
      window.alert('Failed to add loan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Loan">
      <div className="space-y-3">
        {isPlatformAdmin && (
          <div>
            <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">
              Team
            </label>
            <select
              value={teamOwnerId}
              onChange={(e) => setTeamOwnerId(e.target.value)}
              className={`${selectClass} w-full`}
              required
            >
              <option value="" disabled>
                Select team…
              </option>
              {teamChoices.map((t) => (
                <option key={t.ownerId} value={t.ownerId}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted2 mt-1">
              Loan will be created on this company&apos;s account.
            </p>
          </div>
        )}

        <div className="flex gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Client Name"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className={`${inputClass} flex-1 min-w-0`}
          />
          <input
            type="text"
            placeholder="Ref (e.g. L530)"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className={`${inputClass} w-[120px]`}
          />
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <label className="text-[11px] text-muted uppercase tracking-wider shrink-0">Provider</label>
          <select
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as LoanProviderType)}
            className={selectClass}
          >
            <option value="TruFunding">TruFunding</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {providerType === 'Other' && (
          <div className="space-y-2 pl-0 border-l-2 border-divider pl-3">
            <input
              type="text"
              placeholder="Provider (name)"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className={`${inputClass} w-full`}
            />
            <input
              type="number"
              placeholder="Factoring fee ($)"
              value={factoringFee}
              onChange={(e) => setFactoringFee(e.target.value)}
              min={0}
              step={0.01}
              className={`${inputClass} w-full`}
            />
            <p className="text-[11px] text-muted2">
              Factoring fee is added to the total; installment = (Total + Factoring fee) ÷ # installments.
            </p>
          </div>
        )}

        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="Total Amount"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            min={0}
            step={0.01}
            className={`${inputClass} flex-1 min-w-0`}
          />
          <input
            type="number"
            placeholder="# of Installments"
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(e.target.value)}
            min={1}
            className={`${inputClass} flex-1 min-w-0`}
          />
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <span className="text-[11px] text-muted uppercase tracking-wider shrink-0">Installment (read-only)</span>
          <input
            type="text"
            readOnly
            value={installmentAmount > 0 ? fmt(installmentAmount) : '—'}
            className={`${inputClass} flex-1 min-w-0 max-w-[140px] font-mono text-yellow opacity-90`}
          />
        </div>

        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="Every N days"
            value={freqDays}
            onChange={(e) => setFreqDays(parseInt(e.target.value, 10) || 7)}
            min={1}
            className={`${inputClass} w-[130px]`}
            title={isWeekdayOnlySchedule(freqDays) ? '1 = every weekday (Mon–Fri), weekends skipped' : undefined}
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`${inputClass} flex-1 min-w-0`}
          />
        </div>
        {isWeekdayOnlySchedule(freqDays) && (
          <p className="text-[11px] text-muted2">
            Every day = weekdays only (Mon–Fri). Saturday and Sunday are skipped on the schedule.
          </p>
        )}

        <div className="flex gap-2.5 justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            Add Loan
          </button>
        </div>
      </div>
    </Modal>
  );
}
