import { useMemo } from 'react';
import {
  buildClientDirectoryFromInsurance,
  getClientInlineCompletion,
  pickBestClientMatch,
  resolveClientOnBlur,
  type ClientDirectoryEntry,
} from '@/lib/clientDirectory';
import type { ClientInsurance } from '@/types';

interface ClientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Insurance roster — used as the client pool. */
  clientInsurance: ClientInsurance[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Client name field with ghost autofill + one inline hint from insurance clients.
 * Tab / Enter accepts the hint; blur snaps to canonical name when recognized.
 */
export function ClientAutocomplete({
  value,
  onChange,
  clientInsurance,
  placeholder = 'Client name',
  className = '',
  disabled = false,
}: ClientAutocompleteProps) {
  const directory = useMemo(
    () => buildClientDirectoryFromInsurance(clientInsurance),
    [clientInsurance]
  );

  const suggestion = useMemo(
    () => (disabled ? null : pickBestClientMatch(directory, value)),
    [directory, value, disabled]
  );

  const inlineCompletion = useMemo(
    () => (disabled ? null : getClientInlineCompletion(directory, value)),
    [directory, value, disabled]
  );

  /** Best match Tab will apply (prefix ghost or full-name casing fix). */
  const tabSuggestion = useMemo(() => {
    if (disabled) return null;
    if (suggestion) return suggestion;
    if (inlineCompletion) return pickBestClientMatch(directory, value);
    return null;
  }, [disabled, suggestion, inlineCompletion, directory, value]);

  const applyClient = (name: string) => {
    onChange(name);
  };

  const applySuggestion = (entry: ClientDirectoryEntry) => {
    applyClient(entry.client);
  };

  const handleBlur = () => {
    const resolved = resolveClientOnBlur(directory, value);
    if (resolved && resolved !== value) {
      applyClient(resolved);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && tabSuggestion) {
      e.preventDefault();
      applySuggestion(tabSuggestion);
      return;
    }
    if (tabSuggestion && e.key === 'Enter') {
      e.preventDefault();
      applySuggestion(tabSuggestion);
    }
  };

  const showHintLine =
    tabSuggestion != null && tabSuggestion.client !== value.trim();

  return (
    <div className="min-w-0">
      <div className="relative">
        {inlineCompletion && (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre ${className}`}
            aria-hidden
          >
            <span className="text-transparent">{value}</span>
            <span className="text-muted opacity-45">{inlineCompletion}</span>
          </div>
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          className={`${className} relative z-[1] ${inlineCompletion ? 'bg-transparent' : ''}`}
          autoComplete="off"
          aria-describedby={showHintLine ? 'client-suggestion-hint' : undefined}
        />
      </div>
      {showHintLine && tabSuggestion && (
        <button
          type="button"
          id="client-suggestion-hint"
          onClick={() => applySuggestion(tabSuggestion)}
          className="mt-1 w-full text-left text-[10px] leading-snug text-muted hover:text-accent transition-colors truncate"
          title={`Use ${tabSuggestion.client}`}
        >
          <span className="text-accent font-medium">Tab</span>
          {' · '}
          {tabSuggestion.client}
          {tabSuggestion.mc ? ` · MC ${tabSuggestion.mc}` : ''}
        </button>
      )}
    </div>
  );
}
