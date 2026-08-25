import { useState, useEffect, useCallback, useRef } from 'react';
import type { Loan, Reserve, Client, ClientInsurance, InsuranceVerification, AaaPayment, WorksheetEntry } from '@/types';
import { isConfigMissing, getSupabase } from '@/lib/supabase';
import {
  buildCloseLoanFully,
  buildPostInstallmentPayment,
} from '@/lib/loanPaymentActions';
import { getLoanOpenInstallmentRemaining } from '@/lib/utils';
import {
  fetchLoans,
  fetchReserves,
  insertLoan,
  updateLoan,
  deleteLoanById,
  insertReserve,
  updateReserve,
  deleteReserveById,
  fetchClientInsurance,
  insertClientInsurance,
  updateClientInsurance,
  deleteClientInsuranceById,
  fetchInsuranceVerification,
  upsertInsuranceVerification,
  fetchAaaPayments,
  insertAaaPayment,
  updateAaaPayment,
  deleteAaaPaymentById,
  fetchClients,
  fetchWorksheetClientRegistry,
  fetchWorksheetInsuranceLookup,
  insertClient,
  updateClient,
  deleteClientById,
  fetchWorksheetEntries,
  insertWorksheetEntry,
  updateWorksheetEntry,
  deleteWorksheetEntryById,
  deleteWorksheetEntriesInRange,
} from '@/lib/supabase-db';

export interface UseDataResult {
  loans: Loan[];
  reserves: Reserve[];
  aaaPayments: AaaPayment[];
  clients: Client[];
  /** Global client registry for worksheet (all provisioned teams). */
  worksheetClients: Client[];
  worksheetEntries: WorksheetEntry[];
  clientInsurance: ClientInsurance[];
  /** Insurance lookup for worksheet alerts across all provisioned teams. */
  worksheetClientInsurance: ClientInsurance[];
  insuranceVerification: InsuranceVerification | null;
  loading: boolean;
  error: string | null;
  configMissing: boolean;
  refetch: (opts?: { silent?: boolean }) => Promise<void>;
  /** Optional forOwnerId lets platform admins assign the loan to another team. */
  addLoan: (payload: Omit<Loan, 'id'>, forOwnerId?: string | null) => Promise<Loan>;
  updateLoanById: (id: number, loan: Loan) => Promise<Loan>;
  removeLoan: (id: number) => Promise<void>;
  markLoanPaid: (id: number) => Promise<void>;
  reverseLoanPayment: (id: number) => Promise<void>;
  closeLoan: (id: number) => Promise<void>;
  addReserve: (payload: Omit<Reserve, 'id'>) => Promise<Reserve>;
  updateReserveById: (id: number, reserve: Reserve) => Promise<Reserve>;
  removeReserve: (id: number) => Promise<void>;
  markReservePaid: (id: number) => Promise<void>;
  reverseReserveDeduction: (id: number) => Promise<void>;
  closeReserve: (id: number) => Promise<void>;
  addClientInsurance: (payload: Omit<ClientInsurance, 'id'>) => Promise<ClientInsurance>;
  updateClientInsuranceById: (id: number, record: ClientInsurance) => Promise<ClientInsurance>;
  removeClientInsurance: (id: number) => Promise<void>;
  updateInsuranceVerification: (
    payload: { last_checked_date: string; checked_by: string }
  ) => Promise<InsuranceVerification>;
  addAaaPayment: (payload: Omit<AaaPayment, 'id' | 'createdAt'>) => Promise<AaaPayment>;
  updateAaaPaymentById: (id: number, payment: AaaPayment) => Promise<AaaPayment>;
  removeAaaPayment: (id: number) => Promise<void>;
  addClient: (payload: Omit<Client, 'id'>) => Promise<Client>;
  updateClientById: (id: number, record: Client) => Promise<Client>;
  removeClient: (id: number) => Promise<void>;
  addWorksheetEntry: (
    payload: Omit<WorksheetEntry, 'id' | 'owner_id' | 'created_by'>
  ) => Promise<WorksheetEntry>;
  updateWorksheetEntryById: (id: number, entry: WorksheetEntry) => Promise<WorksheetEntry>;
  removeWorksheetEntry: (id: number) => Promise<void>;
  clearWorksheetActivityInRange: (
    dateFrom: string,
    dateTo: string,
    createdBy?: string
  ) => Promise<void>;
}

export function useData(ownerId: string | null, userId: string | null = null): UseDataResult {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [aaaPayments, setAaaPayments] = useState<AaaPayment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [worksheetClients, setWorksheetClients] = useState<Client[]>([]);
  const [worksheetEntries, setWorksheetEntries] = useState<WorksheetEntry[]>([]);
  const [clientInsurance, setClientInsurance] = useState<ClientInsurance[]>([]);
  const [worksheetClientInsurance, setWorksheetClientInsurance] = useState<ClientInsurance[]>([]);
  const [insuranceVerification, setInsuranceVerification] = useState<InsuranceVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configMissing = isConfigMissing();
  /** Skip full-page "Loading…" when we already have data (realtime / soft sync). */
  const hasLoadedOnceRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async (opts?: { silent?: boolean }) => {
    if (configMissing || ownerId == null) {
      setLoading(false);
      return;
    }
    const silent = opts?.silent === true && hasLoadedOnceRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [loansData, reservesData] = await Promise.all([fetchLoans(), fetchReserves()]);
      setLoans(loansData);
      setReserves(reservesData);
      // Client insurance and insurance_verification may not exist yet; avoid failing the whole load.
      try {
        const clientInsuranceData = await fetchClientInsurance();
        setClientInsurance(clientInsuranceData);
      } catch {
        setClientInsurance([]);
      }
      try {
        const verification = await fetchInsuranceVerification();
        setInsuranceVerification(verification);
      } catch {
        setInsuranceVerification(null);
      }
      try {
        const aaaData = await fetchAaaPayments();
        setAaaPayments(aaaData);
      } catch {
        setAaaPayments([]);
      }
      try {
        const clientsData = await fetchClients();
        setClients(clientsData);
      } catch {
        setClients([]);
      }
      try {
        const worksheetClientsData = await fetchWorksheetClientRegistry();
        setWorksheetClients(worksheetClientsData);
      } catch (err) {
        console.warn('fetch_worksheet_client_registry failed:', err);
        setWorksheetClients([]);
      }
      try {
        const worksheetInsuranceData = await fetchWorksheetInsuranceLookup();
        setWorksheetClientInsurance(worksheetInsuranceData);
      } catch (err) {
        console.warn('fetch_worksheet_insurance_lookup failed:', err);
        setWorksheetClientInsurance([]);
      }
      try {
        const worksheetData = await fetchWorksheetEntries();
        setWorksheetEntries(worksheetData);
      } catch {
        setWorksheetEntries([]);
      }
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : String(err));
      } else {
        console.warn('Silent data refresh failed:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [configMissing, ownerId]);

  /** Debounced background sync used by Realtime — avoids loading flash and refetch storms. */
  const scheduleSilentRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      void refetch({ silent: true });
    }, 250);
  }, [refetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Realtime: sync when loans/reserves/etc. change (other tabs/users) without a full page refresh
  const scheduleSilentRefetchRef = useRef(scheduleSilentRefetch);
  scheduleSilentRefetchRef.current = scheduleSilentRefetch;
  useEffect(() => {
    if (configMissing || ownerId == null) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const onChange = () => {
      scheduleSilentRefetchRef.current();
    };

    const channel = supabase
      .channel(`workspace-data-${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reserves' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_insurance' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'insurance_verification' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aaa_payments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worksheet_entries' }, onChange)
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime subscription issue:', status, err);
        }
      });

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [configMissing, ownerId]);

  const addLoan = useCallback(async (payload: Omit<Loan, 'id'>, forOwnerId?: string | null) => {
    const added = await insertLoan(payload, forOwnerId ?? ownerId);
    setLoans((prev) => [...prev, added]);
    return added;
  }, [ownerId]);

  const updateLoanById = useCallback(async (id: number, loan: Loan) => {
    const updated = await updateLoan(id, loan);
    setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const removeLoan = useCallback(async (id: number) => {
    await deleteLoanById(id);
    setLoans((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const markLoanPaid = useCallback(async (id: number) => {
    const loan = loans.find((l) => l.id === id);
    if (!loan) return;
    const result = buildPostInstallmentPayment(
      loan,
      getLoanOpenInstallmentRemaining(loan) || loan.installment
    );
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    await updateLoanById(id, result.loan);
    if (result.message) window.alert(result.message);
  }, [loans, updateLoanById]);

  const reverseLoanPayment = useCallback(
    async (id: number) => {
      const loan = loans.find((l) => l.id === id);
      if (!loan) return;
      // Undo partial on open installment first, then undo last full payment.
      if ((Number(loan.partialPaidAmount ?? 0) || 0) > 0) {
        await updateLoanById(id, { ...loan, partialPaidAmount: 0 });
        return;
      }
      if (loan.paidCount === 0) return;
      const paymentDates = loan.paymentDates ?? [];
      const updated: Loan = {
        ...loan,
        paidCount: loan.paidCount - 1,
        paymentDates: paymentDates.slice(0, -1),
        partialPaidAmount: 0,
      };
      await updateLoanById(id, updated);
    },
    [loans, updateLoanById]
  );

  /** Mark loan as fully paid (fill remaining payment_dates with today). */
  const closeLoan = useCallback(
    async (id: number) => {
      const loan = loans.find((l) => l.id === id);
      if (!loan) return;
      const updated = buildCloseLoanFully(loan);
      if (!updated) return;
      await updateLoanById(id, updated);
    },
    [loans, updateLoanById]
  );

  const addReserve = useCallback(async (payload: Omit<Reserve, 'id'>) => {
    const added = await insertReserve(payload, ownerId);
    setReserves((prev) => [...prev, added]);
    return added;
  }, [ownerId]);

  const updateReserveById = useCallback(async (id: number, reserve: Reserve) => {
    const updated = await updateReserve(id, reserve);
    setReserves((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const removeReserve = useCallback(async (id: number) => {
    await deleteReserveById(id);
    setReserves((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const markReservePaid = useCallback(async (id: number) => {
    const reserve = reserves.find((r) => r.id === id);
    if (!reserve || reserve.paidCount >= reserve.installments) return;
    const deductionDates = reserve.deductionDates ?? [];
    const updated: Reserve = {
      ...reserve,
      paidCount: reserve.paidCount + 1,
      deductionDates: [...deductionDates, new Date().toISOString().split('T')[0]],
    };
    await updateReserveById(id, updated);
  }, [reserves, updateReserveById]);

  const reverseReserveDeduction = useCallback(
    async (id: number) => {
      const reserve = reserves.find((r) => r.id === id);
      if (!reserve || reserve.paidCount === 0) return;
      const deductionDates = reserve.deductionDates ?? [];
      const updated: Reserve = {
        ...reserve,
        paidCount: reserve.paidCount - 1,
        deductionDates: deductionDates.slice(0, -1),
      };
      await updateReserveById(id, updated);
    },
    [reserves, updateReserveById]
  );

  /** Mark reserve as fully deducted (fill remaining deduction_dates with today). */
  const closeReserve = useCallback(
    async (id: number) => {
      const reserve = reserves.find((r) => r.id === id);
      if (!reserve || reserve.paidCount >= reserve.installments) return;
      const today = new Date().toISOString().split('T')[0];
      const deductionDates = [...(reserve.deductionDates ?? [])];
      while (deductionDates.length < reserve.installments) deductionDates.push(today);
      const deductionNotes = [...(reserve.deductionNotes ?? [])];
      while (deductionNotes.length < reserve.installments) deductionNotes.push('');
      const updated: Reserve = {
        ...reserve,
        paidCount: reserve.installments,
        deductionDates,
        deductionNotes,
      };
      await updateReserveById(id, updated);
    },
    [reserves, updateReserveById]
  );

  const addClientInsurance = useCallback(async (payload: Omit<ClientInsurance, 'id'>) => {
    const added = await insertClientInsurance(payload, ownerId);
    setClientInsurance((prev) => [...prev, added].sort((a, b) => a.client.localeCompare(b.client)));
    return added;
  }, [ownerId]);

  const updateClientInsuranceById = useCallback(async (id: number, record: ClientInsurance) => {
    const updated = await updateClientInsurance(id, record);
    setClientInsurance((prev) =>
      prev.map((r) => (r.id === id ? updated : r)).sort((a, b) => a.client.localeCompare(b.client))
    );
    return updated;
  }, []);

  const removeClientInsurance = useCallback(async (id: number) => {
    await deleteClientInsuranceById(id);
    setClientInsurance((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateInsuranceVerification = useCallback(
    async (payload: { last_checked_date: string; checked_by: string }) => {
      if (!ownerId) throw new Error('Must be signed in to record insurance verification');
      const updated = await upsertInsuranceVerification(ownerId, payload);
      setInsuranceVerification(updated);
      return updated;
    },
    [ownerId]
  );

  const addAaaPayment = useCallback(
    async (payload: Omit<AaaPayment, 'id' | 'createdAt'>) => {
      const added = await insertAaaPayment(payload, ownerId);
      setAaaPayments((prev) => [added, ...prev]);
      return added;
    },
    [ownerId]
  );

  const updateAaaPaymentById = useCallback(async (id: number, payment: AaaPayment) => {
    const updated = await updateAaaPayment(id, payment);
    setAaaPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const removeAaaPayment = useCallback(async (id: number) => {
    await deleteAaaPaymentById(id);
    setAaaPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addClientRecord = useCallback(
    async (payload: Omit<Client, 'id'>) => {
      const added = await insertClient(payload, ownerId);
      setClients((prev) => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      return added;
    },
    [ownerId]
  );

  const updateClientById = useCallback(async (id: number, record: Client) => {
    const updated = await updateClient(id, record);
    setClients((prev) =>
      prev.map((r) => (r.id === id ? updated : r)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return updated;
  }, []);

  const removeClient = useCallback(async (id: number) => {
    await deleteClientById(id);
    setClients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addWorksheetEntry = useCallback(
    async (payload: Omit<WorksheetEntry, 'id' | 'owner_id' | 'created_by'>) => {
      if (!ownerId || !userId) throw new Error('Must be signed in');
      const added = await insertWorksheetEntry(payload, ownerId, userId);
      setWorksheetEntries((prev) => [added, ...prev]);
      return added;
    },
    [ownerId, userId]
  );

  const updateWorksheetEntryById = useCallback(async (id: number, entry: WorksheetEntry) => {
    const updated = await updateWorksheetEntry(id, entry);
    setWorksheetEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const removeWorksheetEntry = useCallback(async (id: number) => {
    await deleteWorksheetEntryById(id);
    setWorksheetEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearWorksheetActivityInRange = useCallback(
    async (dateFrom: string, dateTo: string, createdBy?: string) => {
      await deleteWorksheetEntriesInRange(dateFrom, dateTo, createdBy);
      setWorksheetEntries((prev) =>
        prev.filter((e) => {
          if (e.work_date < dateFrom || e.work_date > dateTo) return true;
          if (createdBy && e.created_by !== createdBy) return true;
          return false;
        })
      );
    },
    []
  );

  return {
    loans,
    reserves,
    aaaPayments,
    clients,
    worksheetClients,
    worksheetEntries,
    clientInsurance,
    worksheetClientInsurance,
    insuranceVerification,
    loading,
    error,
    configMissing,
    refetch,
    addLoan,
    updateLoanById,
    removeLoan,
    markLoanPaid,
    reverseLoanPayment,
    closeLoan,
    addReserve,
    updateReserveById,
    removeReserve,
    markReservePaid,
    reverseReserveDeduction,
    closeReserve,
    addClientInsurance,
    updateClientInsuranceById,
    removeClientInsurance,
    updateInsuranceVerification,
    addAaaPayment,
    updateAaaPaymentById,
    removeAaaPayment,
    addClient: addClientRecord,
    updateClientById,
    removeClient,
    addWorksheetEntry,
    updateWorksheetEntryById,
    removeWorksheetEntry,
    clearWorksheetActivityInRange,
  };
}
