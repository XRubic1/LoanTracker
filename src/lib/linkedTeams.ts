import { getSupabase } from '@/lib/supabase';

export type TeamScopeFilterValue = 'all' | string;

export interface TeamScopeOption {
  value: TeamScopeFilterValue;
  label: string;
  /** Tenant owner id when not "all". */
  ownerId?: string;
  isSelf?: boolean;
}

/**
 * All provisioned companies (for client list filtering — shared client pool).
 */
export async function fetchClientPoolTeamOptions(
  effectiveOwnerId: string
): Promise<TeamScopeOption[]> {
  const supabase = getSupabase();
  if (!supabase) return [{ value: 'all', label: 'All teams' }];

  const { data: companies, error } = await supabase
    .from('companies')
    .select('owner_id, name')
    .not('owner_id', 'is', null)
    .order('name');
  if (error) throw error;

  const options: TeamScopeOption[] = [{ value: 'all', label: 'All teams' }];
  for (const c of companies ?? []) {
    if (!c.owner_id) continue;
    const isSelf = c.owner_id === effectiveOwnerId;
    options.push({
      value: c.owner_id,
      label: c.name + (isSelf ? ' (you)' : ''),
      ownerId: c.owner_id,
      isSelf,
    });
  }
  if (options.length === 1) {
    options.push({
      value: effectiveOwnerId,
      label: 'My team',
      ownerId: effectiveOwnerId,
      isSelf: true,
    });
  }
  return options;
}

/**
 * Owners in the same client-share link group (for loans / insurance filtering).
 */
export async function fetchLinkedGroupTeamOptions(
  effectiveOwnerId: string
): Promise<TeamScopeOption[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [{ value: 'all', label: 'All teams' }, { value: effectiveOwnerId, label: 'My team', ownerId: effectiveOwnerId, isSelf: true }];
  }

  const { data: myCompany } = await supabase
    .from('companies')
    .select('client_share_group_id, name')
    .eq('owner_id', effectiveOwnerId)
    .maybeSingle();

  const groupId = myCompany?.client_share_group_id;
  if (!groupId) {
    return [
      { value: 'all', label: 'All teams' },
      {
        value: effectiveOwnerId,
        label: (myCompany?.name ?? 'My team') + ' (you)',
        ownerId: effectiveOwnerId,
        isSelf: true,
      },
    ];
  }

  const { data: members, error: memErr } = await supabase
    .from('owner_company_group_members')
    .select('owner_id')
    .eq('group_id', groupId);
  if (memErr) throw memErr;

  const ownerIds = [...new Set((members ?? []).map((m) => m.owner_id))];
  const { data: companies } = await supabase
    .from('companies')
    .select('owner_id, name')
    .in('owner_id', ownerIds);

  const nameByOwner = new Map<string, string>();
  for (const c of companies ?? []) {
    if (c.owner_id) nameByOwner.set(c.owner_id, c.name);
  }

  const options: TeamScopeOption[] = [{ value: 'all', label: 'All teams' }];
  for (const oid of ownerIds) {
    const isSelf = oid === effectiveOwnerId;
    const label = nameByOwner.get(oid) ?? 'Team ' + oid.slice(0, 8);
    options.push({
      value: oid,
      label: label + (isSelf ? ' (you)' : ''),
      ownerId: oid,
      isSelf,
    });
  }
  return options;
}

/** Filter rows that have owner_id by team scope. */
export function matchesTeamScope(
  ownerId: string | null | undefined,
  scope: TeamScopeFilterValue,
  effectiveOwnerId: string
): boolean {
  if (scope === 'all') return true;
  const oid = ownerId ?? effectiveOwnerId;
  return oid === scope;
}

/** Resolve display label for a row's owner_id. */
export function teamLabelForOwner(
  ownerId: string | null | undefined,
  effectiveOwnerId: string,
  options: TeamScopeOption[]
): string {
  const oid = ownerId ?? effectiveOwnerId;
  const match = options.find((o) => o.ownerId === oid);
  if (match) return match.label.replace(' (you)', '');
  if (oid === effectiveOwnerId) return 'My team';
  return 'Team ' + oid.slice(0, 8);
}
