import { useState, useEffect, useMemo } from 'react';
import { WorksheetClientAlerts } from '@/components/WorksheetClientAlerts';
import { WorksheetUnknownClientNotice } from '@/components/WorksheetUnknownClientNotice';
import {
  findInsuranceForClient,
  findInsuranceForClientName,
  findRegistryClientByName,
  getWorksheetClientAlerts,
  resolveWorksheetClientInput,
  WORKSHEET_UNKNOWN_CLIENT_MESSAGE,
} from '@/lib/worksheetUtils';
import type { Client, ClientInsurance, WorksheetEntry } from '@/types';

export type WorksheetEntryPayload = Omit<WorksheetEntry, 'id' | 'owner_id' | 'created_by'>;

interface WorksheetEntryFormProps {
  clients: Client[];
  clientInsurance?: ClientInsurance[];
  /** When set, form is in edit mode. */
  entry?: WorksheetEntry | null;
  onSubmit: (payload: WorksheetEntryPayload | WorksheetEntry) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  /** Compact row layout for inline add on the worksheet page. */
  variant?: 'inline' | 'stacked';
}

/** Shared fields for adding or editing a worksheet batch. */
export function WorksheetEntryForm({
  clients,
  clientInsurance = [],
  entry = null,
  onSubmit,
  onCancel,
  submitLabel,
  variant = 'stacked',
}: WorksheetEntryFormProps) {
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [clientId, setClientId] = useState<number | ''>('');
  const [clientSearch, setClientSearch] = useState('');
  const [invoiceCount, setInvoiceCount] = useState('');
  const [groupWork, setGroupWork] = useState(false);
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (entry) {
      setWorkDate(entry.work_date);
      setClientId(entry.client_id ?? '');
      setInvoiceCount(String(entry.invoice_count));
      setGroupWork(entry.group_work);
      setVerified(entry.verified);
      setNote(entry.note ?? '');
      if (entry.client_id != null) {
        const c = clients.find((x) => x.id === entry.client_id);
        setClientSearch(c?.name ?? entry.client_name ?? '');
      } else {
        setClientSearch(entry.client_name ?? '');
      }
    } else {
      setWorkDate(new Date().toISOString().split('T')[0]);
      setClientId('');
      setClientSearch('');
      setInvoiceCount('');
      setGroupWork(false);
      setVerified(false);
      setNote('');
    }
  }, [entry, clients]);

  /** Resolve client from dropdown id or exact name match (so alerts show when name is fully typed). */
  const selectedClient = useMemo(() => {
    if (clientId !== '') {
      return clients.find((c) => c.id === clientId) ?? null;
    }
    return findRegistryClientByName(clientSearch, clients);
  }, [clients, clientId, clientSearch]);

  const selectedInsurance = useMemo(() => {
    if (selectedClient) {
      return (
        findInsuranceForClient(selectedClient, clientInsurance) ??
        findInsuranceForClientName(clientSearch, clientInsurance)
      );
    }
    return findInsuranceForClientName(clientSearch, clientInsurance);
  }, [selectedClient, clientSearch, clientInsurance]);

  const alertClient = useMemo((): Client | null => {
    if (selectedClient) return selectedClient;
    if (!selectedInsurance) return null;
    return {
      id: 0,
      name: selectedInsurance.client,
      expenses: null,
      warning_note: null,
      is_new_client: false,
      started_date: null,
      new_client_reviewed: false,
      verification_days: 30,
      verification_always: false,
    };
  }, [selectedClient, selectedInsurance]);

  const clientAlerts = useMemo(
    () => (alertClient ? getWorksheetClientAlerts(alertClient, selectedInsurance) : null),
    [alertClient, selectedInsurance]
  );

  const suggestions = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 12);
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 12);
  }, [clients, clientSearch]);

  const registryMatch = useMemo(
    () => findRegistryClientByName(clientSearch, clients),
    [clientSearch, clients]
  );

  // Keep client_id in sync when the full registry name is entered (not only on pick/Tab).
  useEffect(() => {
    if (entry) return;
    if (registryMatch && clientId !== registryMatch.id) {
      setClientId(registryMatch.id);
    }
    if (!registryMatch && clientId !== '') {
      const stillMatches = clients.some((c) => c.id === clientId);
      if (!stillMatches) setClientId('');
    }
  }, [entry, registryMatch, clientId, clients]);

  const showUnknownNotice = Boolean(clientSearch.trim()) && !registryMatch;

  const pickClient = (c: Client) => {
    setClientId(c.id);
    setClientSearch(c.name);
  };

  const showSuggestions = Boolean(clientSearch.trim()) && suggestions.length > 0;

  /** Tab selects the first matching registry client (or exact name match). */
  const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    if (!clientSearch.trim()) return;
    const top = registryMatch ?? suggestions[0];
    if (!top) return;
    e.preventDefault();
    pickClient(top);
  };

  const resetAddForm = () => {
    setWorkDate(new Date().toISOString().split('T')[0]);
    setClientId('');
    setClientSearch('');
    setInvoiceCount('');
    setGroupWork(false);
    setVerified(false);
    setNote('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = resolveWorksheetClientInput(clientSearch, clients);
    if (!resolved.client_id && !resolved.client_name) {
      window.alert('Enter a client name.');
      return;
    }
    if (resolved.isUnknown) {
      const proceed = window.confirm(
        `${WORKSHEET_UNKNOWN_CLIENT_MESSAGE}\n\nSave this worksheet entry for "${resolved.client_name}"?`
      );
      if (!proceed) return;
    }
    const trimmed = invoiceCount.trim();
    if (trimmed === '') {
      window.alert('Enter the number of invoices.');
      return;
    }
    const count = parseInt(trimmed, 10);
    if (isNaN(count) || count < 0) {
      window.alert('Enter a valid number of invoices.');
      return;
    }
    if (clientAlerts?.requiresWorksheetVerified && !verified) {
      const proceed = window.confirm(
        `${clientAlerts.fullVerificationMessage ?? clientAlerts.alwaysVerifyMessage ?? 'This batch should be marked Verified.'}\n\nContinue without marking Verified?`
      );
      if (!proceed) return;
    }
    setSubmitting(true);
    try {
      const payload: WorksheetEntryPayload = {
        work_date: workDate,
        client_id: resolved.client_id,
        client_name: resolved.client_name,
        invoice_count: count,
        group_work: groupWork,
        verified,
        note: note.trim() || null,
      };
      if (entry) {
        await onSubmit({ ...entry, ...payload });
      } else {
        await onSubmit(payload);
        resetAddForm();
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = 'block text-[10px] uppercase tracking-wider text-muted mb-1';
  const inputClass =
    'w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-accent';

  const saveLabel = submitLabel ?? (entry ? 'Save' : 'Add');

  if (variant === 'inline') {
    return (
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mb-4 rounded-xl border border-border bg-panel p-4 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="relative sm:col-span-2 lg:col-span-2">
            <label className={labelClass}>Client</label>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientId('');
              }}
              onKeyDown={handleClientKeyDown}
              placeholder="Registry client or new name…"
              className={inputClass}
              autoComplete="off"
            />
            {showSuggestions && !registryMatch && (
              <ul className="absolute z-10 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-border bg-panel shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickClient(c)}
                      className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-accent/10"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className={labelClass}>Invoices</label>
            <input
              type="number"
              min={0}
              value={invoiceCount}
              onChange={(e) => setInvoiceCount(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 pb-2">
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={groupWork} onChange={(e) => setGroupWork(e.target.checked)} />
              Group
            </label>
            <label
              className={`flex items-center gap-2 text-[13px] ${
                clientAlerts?.requiresWorksheetVerified && !verified
                  ? 'text-red font-semibold'
                  : 'text-ink'
              }`}
            >
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              Verified
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary py-2 px-4 rounded-lg text-sm w-full sm:w-auto disabled:opacity-50"
            >
              {submitting ? 'Adding…' : saveLabel}
            </button>
          </div>
        </div>
        {showUnknownNotice && <WorksheetUnknownClientNotice />}
        {alertClient && (
          <WorksheetClientAlerts
            client={alertClient}
            insurance={selectedInsurance}
            alerts={clientAlerts ?? undefined}
          />
        )}
        <div>
          <label className={labelClass}>Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        {selectedClient && (
          <p className="text-[12px] text-muted2">
            <span className="text-muted">Expenses: </span>
            <span className="text-ink font-medium">{selectedClient.expenses ?? '—'}</span>
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <label className={labelClass}>Date</label>
        <input
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="relative">
        <label className={labelClass}>Client name</label>
        <input
          type="text"
          value={clientSearch}
          onChange={(e) => {
            setClientSearch(e.target.value);
            setClientId('');
          }}
          onKeyDown={handleClientKeyDown}
          className={inputClass}
          autoComplete="off"
        />
        {showSuggestions && !registryMatch && (
          <ul className="absolute z-10 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-border bg-panel shadow-lg">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pickClient(c)}
                  className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-accent/10"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {showUnknownNotice && <WorksheetUnknownClientNotice />}
      {alertClient && (
        <WorksheetClientAlerts
          client={alertClient}
          insurance={selectedInsurance}
          alerts={clientAlerts ?? undefined}
        />
      )}
      {selectedClient && (
        <p className="text-[12px] text-muted2">
          <span className="text-muted">Expenses: </span>
          <span className="text-ink font-medium">{selectedClient.expenses ?? '—'}</span>
        </p>
      )}
      <div>
        <label className={labelClass}>Number of invoices</label>
        <input
          type="number"
          min={0}
          value={invoiceCount}
          onChange={(e) => setInvoiceCount(e.target.value)}
          placeholder="0"
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={groupWork} onChange={(e) => setGroupWork(e.target.checked)} />
          Group work
        </label>
        <label
          className={`flex items-center gap-2 text-[13px] ${
            clientAlerts?.requiresWorksheetVerified && !verified ? 'text-red font-semibold' : ''
          }`}
        >
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Verified
        </label>
      </div>
      <div>
        <label className={labelClass}>Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="py-2 px-4 rounded-lg border border-border text-sm"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="py-2 px-4 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Saving…' : saveLabel}
        </button>
      </div>
    </form>
  );
}
