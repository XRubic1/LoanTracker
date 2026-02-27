import { useState, useEffect, useCallback, useRef } from 'react';
import type { Loan, Reserve } from '@/types';
import { isConfigMissing, getSupabase } from '@/lib/supabase';
import {
  fetchLoans,
  fetchReserves,
  insertLoan,
  updateLoan,
  deleteLoanById,
  insertReserve,
  updateReserve,
  deleteReserveById,
} from '@/lib/supabase-db';

export interface UseDataResult {
  loans: Loan[];
  reserves: Reserve[];
  loading: boolean;
  error: string | null;
  configMissing: boolean;
  refetch: () => Promise<void>;
  addLoan: (payload: Omit<Loan, 'id'>) => Promise<Loan>;
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
}

export function useData(ownerId: string | null): UseDataResult {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configMissing = isConfigMissing();

  const refetch = useCallback(async () => {
    if (configMissing || ownerId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loansData, reservesData] = await Promise.all([fetchLoans(), fetchReserves()]);
      setLoans(loansData);
      setReserves(reservesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [configMissing, ownerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Realtime: refetch when loans or reserves change (any user/tab) so UI stays in sync
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    if (configMissing || ownerId == null) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel('loans-reserves-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => { refetchRef.current(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reserves' },
        () => { refetchRef.current(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configMissing, ownerId]);

  const addLoan = useCallback(async (payload: Omit<Loan, 'id'>) => {
    const added = await insertLoan(payload, ownerId);
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
    if (!loan || loan.paidCount >= loan.totalInstallments) return;
    const paymentDates = loan.paymentDates ?? [];
    const updated: Loan = {
      ...loan,
      paidCount: loan.paidCount + 1,
      paymentDates: [...paymentDates, new Date().toISOString().split('T')[0]],
    };
    await updateLoanById(id, updated);
  }, [loans, updateLoanById]);

  const reverseLoanPayment = useCallback(
    async (id: number) => {
      const loan = loans.find((l) => l.id === id);
      if (!loan || loan.paidCount === 0) return;
      const paymentDates = loan.paymentDates ?? [];
      const updated: Loan = {
        ...loan,
        paidCount: loan.paidCount - 1,
        paymentDates: paymentDates.slice(0, -1),
      };
      await updateLoanById(id, updated);
    },
    [loans, updateLoanById]
  );

  /** Mark loan as fully paid (fill remaining payment_dates with today). */
  const closeLoan = useCallback(
    async (id: number) => {
      const loan = loans.find((l) => l.id === id);
      if (!loan || loan.paidCount >= loan.totalInstallments) return;
      const today = new Date().toISOString().split('T')[0];
      const paymentDates = [...(loan.paymentDates ?? [])];
      while (paymentDates.length < loan.totalInstallments) paymentDates.push(today);
      const paymentNotes = [...(loan.paymentNotes ?? [])];
      while (paymentNotes.length < loan.totalInstallments) paymentNotes.push('');
      const updated: Loan = {
        ...loan,
        paidCount: loan.totalInstallments,
        paymentDates,
        paymentNotes,
      };
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

  return {
    loans,
    reserves,
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
  };
}
