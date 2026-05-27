import { useEffect, useState } from 'react';
import type { Client } from '@/types';
import { searchWorksheetClients } from '@/lib/supabase-db';

/**
 * Debounced server search for worksheet client autocomplete (all teams).
 * Falls back to filtering localClients when the RPC is unavailable.
 */
export function useWorksheetClientSuggestions(
  query: string,
  localClients: Client[],
  debounceMs = 200
): { suggestions: Client[]; searching: boolean } {
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions(localClients.slice(0, 12));
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchWorksheetClients(q, 20);
          setSuggestions(results);
        } catch (err) {
          console.warn('search_worksheet_clients failed, using local list:', err);
          const lower = q.toLowerCase();
          setSuggestions(
            localClients.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 20)
          );
        } finally {
          setSearching(false);
        }
      })();
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [query, localClients, debounceMs]);

  return { suggestions, searching };
}

/** Resolve exact registry match via server search (cross-team names). */
export async function resolveWorksheetClientByName(name: string): Promise<Client | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  try {
    const results = await searchWorksheetClients(trimmed, 10);
    const key = trimmed.toLowerCase();
    return results.find((c) => c.name.trim().toLowerCase() === key) ?? null;
  } catch {
    return null;
  }
}
