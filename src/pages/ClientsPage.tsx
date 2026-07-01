import { useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { TeamScopeFilter } from '@/components/TeamScopeFilter';
import { useLinkedTeams } from '@/hooks/useLinkedTeams';
import { matchesTeamScope, type TeamScopeFilterValue } from '@/lib/linkedTeams';
import { copyClientEmails } from '@/lib/clientEmails';
import {
  getNewClientsNeedingReview,
  getVerificationPeriodLabel,
  isClientVerificationAlways,
  isClientVerificationTracked,
  isNewClientInVerificationPeriod,
  isNewClientNeedsReview,
} from '@/lib/clientUtils';
import type { UseDataResult } from '@/hooks/useData';

interface ClientsPageProps extends Pick<UseDataResult, 'clients'> {
  effectiveOwnerId: string;
  onAddClient: () => void;
  onImportClients: () => void;
  onViewClient: (id: number) => void;
  onEditClient: (id: number) => void;
  onDeleteClient: (id: number) => Promise<void>;
}

export function ClientsPage({
  clients,
  effectiveOwnerId,
  onAddClient,
  onImportClients,
  onViewClient,
  onEditClient,
  onDeleteClient,
}: ClientsPageProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copyingEmails, setCopyingEmails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'needs_review' | 'new_client' | 'always_verified'
  >('all');
  const [teamScope, setTeamScope] = useState<TeamScopeFilterValue>(effectiveOwnerId);
  const { options: teamOptions } = useLinkedTeams(effectiveOwnerId, 'linked-group');

  useEffect(() => {
    if (!teamOptions.length) return;
    const hasSelection = teamOptions.some((o) => o.value === teamScope);
    if (hasSelection) return;
    const selfOption = teamOptions.find((o) => o.ownerId === effectiveOwnerId);
    setTeamScope(selfOption?.value ?? teamOptions[0].value);
  }, [teamOptions, teamScope, effectiveOwnerId]);

  const newClientsNeedingReview = getNewClientsNeedingReview(clients);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete client "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await onDeleteClient(id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

  const list = clients
    .filter((c) => matchesTeamScope(c.owner_id, teamScope, effectiveOwnerId))
    .filter((c) => {
      if (statusFilter === 'needs_review') return isNewClientNeedsReview(c);
      if (statusFilter === 'new_client') return isNewClientInVerificationPeriod(c);
      if (statusFilter === 'always_verified') return isClientVerificationAlways(c);
      return true;
    })
    .filter((c) => {
      if (!normalizedSearch) return true;
      const haystack = `${c.name} ${c.email ?? ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });

  const handleCopyEmails = async () => {
    setCopyingEmails(true);
    try {
      const { copied } = await copyClientEmails(list);
      if (copied === 0) {
        window.alert('No email addresses in the current list.');
        return;
      }
      window.alert(`Copied ${copied} email address${copied !== 1 ? 'es' : ''} to clipboard.`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setCopyingEmails(false);
    }
  };

  return (
    <>
      {newClientsNeedingReview.length > 0 && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-[13px] text-ink">
          <strong className="text-accent">{newClientsNeedingReview.length}</strong> new client
          {newClientsNeedingReview.length !== 1 ? 's' : ''} need verification review.
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopyEmails()}
            disabled={copyingEmails || list.length === 0}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border border-border text-xs font-medium text-muted2 bg-transparent transition-all hover:border-accent hover:text-accent hover:bg-accent/5 disabled:opacity-50"
          >
            {copyingEmails ? 'Copying…' : 'Copy all emails'}
          </button>
          <button
            type="button"
            onClick={onImportClients}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border border-border text-xs font-medium text-muted2 bg-transparent transition-all hover:border-accent hover:text-accent hover:bg-accent/5"
          >
            Import clients
          </button>
          <button type="button" onClick={onAddClient} className="btn-primary">
            Add client
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <TeamScopeFilter value={teamScope} options={teamOptions} onChange={setTeamScope} />
        <input
          type="search"
          placeholder="Search clients…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
        >
          <option value="all">All clients</option>
          <option value="new_client">In verification period</option>
          <option value="needs_review">Needs review</option>
          <option value="always_verified">Always verified</option>
        </select>
      </div>

      <Section title={`${list.length} client${list.length !== 1 ? 's' : ''}`}>
        <div className="overflow-x-auto -mx-1">
          <table className="data-table w-full min-w-[720px]">
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th className="text-center">Expenses</th>
                <th>Warning</th>
                <th className="text-center">Verification</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const needsReview = isNewClientNeedsReview(c);
                const periodLabel = getVerificationPeriodLabel(c);
                return (
                  <tr key={c.id} className={needsReview ? 'bg-accent/5' : undefined}>
                    <td className="font-medium text-ink">{c.name}</td>
                    <td className="text-muted2 text-[12px] max-w-[220px] truncate">
                      {c.email?.trim() || '—'}
                    </td>
                    <td className="text-muted2 text-center">{c.expenses ?? '—'}</td>
                    <td className={c.warning_note?.trim() ? 'text-accent text-[12px] max-w-[200px] truncate' : 'text-muted2'}>
                      {c.warning_note?.trim() || '—'}
                    </td>
                    <td className="text-[12px] text-center">
                      {isClientVerificationTracked(c) ? (
                        needsReview ? (
                          <span className="text-accent font-medium">{periodLabel}</span>
                        ) : isClientVerificationAlways(c) || periodLabel === 'Reviewed' ? (
                          <span className="text-green">{periodLabel}</span>
                        ) : (
                          <span className="text-muted2">{periodLabel}</span>
                        )
                      ) : (
                        <span className="text-muted2">—</span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewClient(c.id)}
                        className="text-xs text-muted2 hover:text-accent mr-2"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditClient(c.id)}
                        className="text-xs text-muted2 hover:text-accent mr-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c.id, c.name)}
                        disabled={deletingId === c.id}
                        className="text-xs text-muted2 hover:text-red disabled:opacity-50"
                      >
                        {deletingId === c.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && (
            <p className="text-muted2 text-[13px] py-6 text-center">No clients match your filters.</p>
          )}
        </div>
      </Section>
    </>
  );
}
