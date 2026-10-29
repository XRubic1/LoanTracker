import { useCallback, useEffect, useState } from 'react';
import { fetchMotusAutoCheck, type MotusAutoCheckData } from '@/lib/motusAutoCheck';

const EMPTY: MotusAutoCheckData = { runs: [], suggestions: [], inactive: [], goodIds: [] };
const REFRESH_MS = 5 * 60 * 1000;

/** Latest automatic MOTUS check results; refreshes every few minutes and on demand. */
export function useMotusAutoCheck(ownerId: string | null) {
  const [data, setData] = useState<MotusAutoCheckData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!ownerId) return;
    try {
      setData(await fetchMotusAutoCheck(ownerId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  return { data, loading, error, reload };
}
