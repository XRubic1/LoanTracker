import { useEffect, useState } from 'react';
import {
  fetchClientPoolTeamOptions,
  fetchLinkedGroupTeamOptions,
  type TeamScopeOption,
} from '@/lib/linkedTeams';

export type LinkedTeamsMode = 'client-pool' | 'linked-group';

/** Load team filter options for client pool or linked-group data. */
export function useLinkedTeams(
  effectiveOwnerId: string | null,
  mode: LinkedTeamsMode
): { options: TeamScopeOption[]; loading: boolean } {
  const [options, setOptions] = useState<TeamScopeOption[]>([
    { value: 'all', label: 'All teams' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveOwnerId) {
      setOptions([{ value: 'all', label: 'All teams' }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const load =
      mode === 'client-pool'
        ? fetchClientPoolTeamOptions(effectiveOwnerId)
        : fetchLinkedGroupTeamOptions(effectiveOwnerId);
    void load
      .then(setOptions)
      .catch(() =>
        setOptions([
          { value: 'all', label: 'All teams' },
          { value: effectiveOwnerId, label: 'My team', ownerId: effectiveOwnerId, isSelf: true },
        ])
      )
      .finally(() => setLoading(false));
  }, [effectiveOwnerId, mode]);

  return { options, loading };
}
