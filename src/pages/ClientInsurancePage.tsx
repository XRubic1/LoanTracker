import { useMemo, useState } from 'react';
import { Section } from '@/components/Section';
import { Modal } from '@/components/Modal';
import {
  buildClientInsuranceList,
  getInsuranceListItemName,
  getInsuranceListItemOwnerId,
  type ClientInsuranceListItem,
} from '@/lib/clientInsuranceList';
import { TeamScopeFilter } from '@/components/TeamScopeFilter';
import { useLinkedTeams } from '@/hooks/useLinkedTeams';
import {
  matchesTeamScope,
  teamLabelForOwner,
  type TeamScopeFilterValue,
  type TeamScopeOption,
} from '@/lib/linkedTeams';
import {
  getClientInsuranceStatusLabel,
  isClientInsuranceCancellationSoon,
  isClientInsuranceWarning,
  isClientInsuranceOut,
} from '@/lib/clientInsuranceUtils';
import { printCancellationReport } from '@/lib/printClientInsurance';
import type { UseDataResult } from '@/hooks/useData';
import type { Client } from '@/types';

interface ClientInsurancePageProps extends Pick<
  UseDataResult,
  | 'clientInsurance'
  | 'insuranceVerification'
  | 'updateInsuranceVerification'
> {
  effectiveOwnerId: string;
  clients: Client[];
  onAddInsurance: () => void;
  onAddInsuranceForClient: (clientName: string) => void;
  onViewInsurance: (id: number) => void;
}

export function ClientInsurancePage({
  clientInsurance,
  effectiveOwnerId,
  clients,
  insuranceVerification,
  updateInsuranceVerification,
  onAddInsurance,
  onAddInsuranceForClient,
  onViewInsurance,
}: ClientInsurancePageProps) {
  const [hideInactive, setHideInactive] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'ok' | 'inactive' | 'out' | 'cancellation' | 'no_insurance'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recordVerificationOpen, setRecordVerificationOpen] = useState(false);
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordCheckedBy, setRecordCheckedBy] = useState('');
  const [savingVerification, setSavingVerification] = useState(false);
  const [teamScope, setTeamScope] = useState<TeamScopeFilterValue>('all');
  const { options: teamOptions } = useLinkedTeams(effectiveOwnerId, 'linked-group');
  const showTeamColumn = teamOptions.filter((o) => o.value !== 'all').length > 1;

  /** Maps record status to filter dropdown value. */
  type StatusFilterValue = 'all' | 'ok' | 'inactive' | 'out' | 'cancellation';

  const getFilterValueFromRecord = (status: string): StatusFilterValue => {
    const normalizedStatus = (status ?? '').trim().toLowerCase();
    if (normalizedStatus === 'ok') return 'ok';
    if (normalizedStatus === 'inactive') return 'inactive';
    if (normalizedStatus === 'out') return 'out';
    if (normalizedStatus.includes('cancellation')) return 'cancellation';
    return 'all';
  };

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

  const mergedList = useMemo(
    () => buildClientInsuranceList(clientInsurance, clients),
    [clientInsurance, clients]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const list = mergedList
    .filter((item) =>
      matchesTeamScope(getInsuranceListItemOwnerId(item), teamScope, effectiveOwnerId)
    )
    .filter((item) => {
      if (item.kind === 'registry') {
        if (statusFilter !== 'all' && statusFilter !== 'no_insurance') return false;
        return true;
      }
      const c = item.record;
      if (!hideInactive || !isClientInsuranceOut(c)) {
        const normalizedStatus = (c.status ?? '').trim().toLowerCase();
        if (statusFilter === 'all') return true;
        if (statusFilter === 'no_insurance') return false;
        if (statusFilter === 'ok') return normalizedStatus === 'ok';
        if (statusFilter === 'inactive') return normalizedStatus === 'inactive';
        if (statusFilter === 'out') return normalizedStatus === 'out';
        if (statusFilter === 'cancellation') return normalizedStatus.includes('cancellation');
      }
      return false;
    })
    .filter((item) => {
      if (!normalizedSearch) return true;
      const name = getInsuranceListItemName(item).toLowerCase();
      if (name.includes(normalizedSearch)) return true;
      if (item.kind === 'insurance') {
        return (
          item.record.mc.toLowerCase().includes(normalizedSearch) ||
          getClientInsuranceStatusLabel(item.record).toLowerCase().includes(normalizedSearch)
        );
      }
      return false;
    });

  return (
    <>
      {/* Last verified: date + name; button to record verification */}
      <div className="mb-4 rounded-xl border border-border bg-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted2">
          {insuranceVerification?.last_checked_date && insuranceVerification?.checked_by ? (
            <>
              Last verified:{' '}
              <span className="text-ink font-medium">
                {new Date(insuranceVerification.last_checked_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {' by '}
              <span className="text-ink font-medium">{insuranceVerification.checked_by}</span>
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

      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">Client Insurance</h1>
        <div className="flex flex-wrap gap-2 justify-start sm:justify-end items-center">
          <button
            type="button"
            onClick={() => setHideInactive((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              hideInactive
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted2 hover:text-ink'
            }`}
          >
            <span
              className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center text-[10px] ${
                hideInactive ? 'bg-accent border-accent text-white' : 'border-border'
              }`}
            >
              {hideInactive ? '✓' : ''}
            </span>
            <span>Hide OUT clients</span>
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
            onClick={onAddInsurance}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium transition-colors hover:opacity-90"
          >
            + Add insurance
          </button>
        </div>
      </div>

      <p className="text-[12px] text-muted2 mb-3 max-w-2xl">
        When accounts are linked on the Super Admin dashboard, insurance records from linked teams
        appear here. Filter by team to focus on one account.
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <TeamScopeFilter value={teamScope} options={teamOptions} onChange={setTeamScope} />
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client, MC, or status"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted2"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="select-field w-full sm:w-[220px] text-[13px] py-2 px-3"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="inactive">Inactive</option>
          <option value="out">OUT</option>
          <option value="cancellation">Cancellation</option>
          <option value="no_insurance">No insurance record</option>
        </select>
      </div>

      <Section title="Clients" count={list.length}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {showTeamColumn && (
                <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                  Team
                </th>
              )}
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Client
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                MC
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Status
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border w-16" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={showTeamColumn ? 5 : 4} className="text-center py-6 text-muted text-[13px]">
                  {mergedList.length === 0
                    ? 'No clients yet. Add clients on the Clients tab or add insurance here.'
                    : 'No clients to show. Turn off "Hide OUT clients" or change filters.'}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <InsuranceTableRow
                  key={item.kind === 'insurance' ? `ins-${item.record.id}` : `reg-${item.client.id}`}
                  item={item}
                  effectiveOwnerId={effectiveOwnerId}
                  teamOptions={teamOptions}
                  showTeamColumn={showTeamColumn}
                  searchQuery={searchQuery}
                  onSearchQuery={setSearchQuery}
                  onStatusFilter={setStatusFilter}
                  getFilterValueFromRecord={getFilterValueFromRecord}
                  onViewInsurance={onViewInsurance}
                  onAddInsuranceForClient={onAddInsuranceForClient}
                />
              ))
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
          Set the date and name of the person who reviewed client insurance. Verification is per week (Monday–Sunday); the Overview will show a warning each new week until you verify.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted2 mb-1.5">Date checked</label>
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted2 mb-1.5">Checked by</label>
            <input
              type="text"
              value={recordCheckedBy}
              onChange={(e) => setRecordCheckedBy(e.target.value)}
              placeholder="Name of reviewer"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted2"
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
            className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          >
            {savingVerification ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </>
  );
}

function TeamBadgeCell({
  ownerId,
  effectiveOwnerId,
  teamOptions,
}: {
  ownerId: string | null | undefined;
  effectiveOwnerId: string;
  teamOptions: TeamScopeOption[];
}) {
  const isOwnTeam = (ownerId ?? effectiveOwnerId) === effectiveOwnerId;
  return (
    <td className="py-1.5 pr-2 border-b border-divider align-middle">
      <span
        className={`text-[11px] px-2 py-0.5 rounded-full border ${
          isOwnTeam
            ? 'border-border text-muted2'
            : 'border-accent/30 bg-accent/10 text-accent'
        }`}
      >
        {teamLabelForOwner(ownerId, effectiveOwnerId, teamOptions)}
      </span>
    </td>
  );
}

function InsuranceTableRow({
  item,
  effectiveOwnerId,
  teamOptions,
  showTeamColumn,
  searchQuery,
  onSearchQuery,
  onStatusFilter,
  getFilterValueFromRecord,
  onViewInsurance,
  onAddInsuranceForClient,
}: {
  item: ClientInsuranceListItem;
  effectiveOwnerId: string;
  teamOptions: TeamScopeOption[];
  showTeamColumn: boolean;
  searchQuery: string;
  onSearchQuery: (q: string) => void;
  onStatusFilter: React.Dispatch<
    React.SetStateAction<'all' | 'ok' | 'inactive' | 'out' | 'cancellation' | 'no_insurance'>
  >;
  getFilterValueFromRecord: (status: string) => 'all' | 'ok' | 'inactive' | 'out' | 'cancellation';
  onViewInsurance: (id: number) => void;
  onAddInsuranceForClient: (clientName: string) => void;
}) {
  if (item.kind === 'registry') {
    const name = item.client.name;
    const applyClientFilter = () => {
      onSearchQuery(
        searchQuery.trim().toLowerCase() === name.toLowerCase() ? '' : name
      );
    };
    const ownerId = item.client.owner_id;
    return (
      <tr className="row-hover transition-colors bg-surface/30">
        {showTeamColumn && (
          <TeamBadgeCell
            ownerId={ownerId}
            effectiveOwnerId={effectiveOwnerId}
            teamOptions={teamOptions}
          />
        )}
        <td className="py-1.5 pr-2 border-b border-divider align-middle">
          <button
            type="button"
            onClick={applyClientFilter}
            className="font-medium text-ink hover:text-accent transition-colors"
          >
            {name}
          </button>
          <span className="ml-1.5 text-[10px] text-muted2 uppercase tracking-wide">Clients</span>
        </td>
        <td className="py-1.5 pr-2 border-b border-divider align-middle text-muted2 text-[13px]">—</td>
        <td className="py-1.5 pr-2 border-b border-divider align-middle text-muted2 text-[12px] italic">
          No insurance record
        </td>
        <td className="py-1.5 pr-2 border-b border-divider align-middle">
          <button
            type="button"
            onClick={() => onAddInsuranceForClient(name)}
            className="text-[11px] text-accent hover:underline"
          >
            Add insurance
          </button>
        </td>
      </tr>
    );
  }

  const c = item.record;
  const isOut = isClientInsuranceOut(c);
  const isWarning = isClientInsuranceWarning(c);
  const isCancellationSoon = isClientInsuranceCancellationSoon(c, 10);
  const statusLabel = getClientInsuranceStatusLabel(c);
  const statusFilterValue = getFilterValueFromRecord(c.status);
  const copyMc = () => {
    navigator.clipboard.writeText(c.mc).then(() => {}, () => {});
  };
  const applyClientFilter = () => {
    onSearchQuery(
      searchQuery.trim().toLowerCase() === c.client.toLowerCase() ? '' : c.client
    );
  };
  const applyStatusFilter = () => {
    if (statusFilterValue === 'all') return;
    onStatusFilter((prev) => (prev === statusFilterValue ? 'all' : statusFilterValue));
  };

  return (
    <tr className="row-hover transition-colors">
      {showTeamColumn && (
        <TeamBadgeCell
          ownerId={c.owner_id}
          effectiveOwnerId={effectiveOwnerId}
          teamOptions={teamOptions}
        />
      )}
      <td className="py-1.5 pr-2 border-b border-divider align-middle">
        <button
          type="button"
          onClick={applyClientFilter}
          className="font-medium text-ink hover:text-accent transition-colors"
          title="Filter by this client"
        >
          {c.client}
        </button>
      </td>
      <td className="py-1.5 pr-2 border-b border-divider align-middle">
        <div className="flex items-center gap-1.5 font-mono text-[13px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyMc();
            }}
            className="p-0.5 rounded text-muted2 hover:text-accent hover:bg-accent/10"
            title="Copy MC"
            aria-label="Copy"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          {c.mc}
        </div>
      </td>
      <td className="py-1.5 pr-2 border-b border-divider align-middle">
        <button
          type="button"
          onClick={applyStatusFilter}
          title={
            statusFilterValue === 'all'
              ? 'Status not available in quick filter'
              : 'Filter by this status'
          }
          className={
            isOut || isCancellationSoon
              ? 'text-red font-medium hover:opacity-80 transition-opacity'
              : isWarning
                ? 'text-accent font-medium hover:opacity-80 transition-opacity'
                : statusLabel.toLowerCase() === 'ok'
                  ? 'text-green hover:opacity-80 transition-opacity'
                  : 'hover:text-accent transition-colors'
          }
        >
          {statusLabel}
        </button>
      </td>
      <td className="py-1.5 pr-2 border-b border-divider align-middle">
        <button
          type="button"
          onClick={() => onViewInsurance(c.id)}
          className="text-[11px] text-accent hover:underline"
        >
          View
        </button>
      </td>
    </tr>
  );
}
