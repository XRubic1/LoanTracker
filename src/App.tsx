import { useState, useCallback } from 'react';
import type { PageId } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { OverviewPage } from '@/pages/OverviewPage';
import { LoansPage } from '@/pages/LoansPage';
import { ReservesPage } from '@/pages/ReservesPage';
import { ClosedPage } from '@/pages/ClosedPage';
import { UsersPage } from '@/pages/UsersPage';
import { AuthPage } from '@/pages/AuthPage';
import { LoanDetailModal } from '@/components/modals/LoanDetailModal';
import { ReserveDetailModal } from '@/components/modals/ReserveDetailModal';
import { CloseInstallmentModal } from '@/components/modals/CloseInstallmentModal';
import { CloseDeductionModal } from '@/components/modals/CloseDeductionModal';
import { AddLoanModal } from '@/components/modals/AddLoanModal';
import { AddReserveModal } from '@/components/modals/AddReserveModal';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/hooks/useData';

export default function App() {
  const { session, effectiveOwnerId, loading: authLoading, signOut } = useAuth();
  const [page, setPage] = useState<PageId>('overview');
  const [loanDetailId, setLoanDetailId] = useState<number | null>(null);
  const [reserveDetailId, setReserveDetailId] = useState<number | null>(null);
  const [overviewCloseInstallmentLoanId, setOverviewCloseInstallmentLoanId] = useState<number | null>(null);
  const [overviewCloseDeductionReserveId, setOverviewCloseDeductionReserveId] = useState<number | null>(null);
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [addReserveOpen, setAddReserveOpen] = useState(false);

  const {
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
  } = useData(effectiveOwnerId ?? null);

  const selectedLoan = loanDetailId != null ? loans.find((l) => l.id === loanDetailId) ?? null : null;
  const selectedReserve =
    reserveDetailId != null ? reserves.find((r) => r.id === reserveDetailId) ?? null : null;
  const overviewCloseInstallmentLoan =
    overviewCloseInstallmentLoanId != null
      ? loans.find((l) => l.id === overviewCloseInstallmentLoanId) ?? null
      : null;
  const overviewCloseDeductionReserve =
    overviewCloseDeductionReserveId != null
      ? reserves.find((r) => r.id === overviewCloseDeductionReserveId) ?? null
      : null;

  const handleLoanMarkPaid = useCallback(async () => {
    if (loanDetailId == null) return;
    await markLoanPaid(loanDetailId);
  }, [loanDetailId, markLoanPaid]);

  const handleLoanReverse = useCallback(async () => {
    if (loanDetailId == null) return;
    await reverseLoanPayment(loanDetailId);
  }, [loanDetailId, reverseLoanPayment]);

  const handleLoanDelete = useCallback(async () => {
    if (loanDetailId == null) return;
    await removeLoan(loanDetailId);
    setLoanDetailId(null);
  }, [loanDetailId, removeLoan]);

  const handleReserveMarkDeducted = useCallback(async () => {
    if (reserveDetailId == null) return;
    await markReservePaid(reserveDetailId);
  }, [reserveDetailId, markReservePaid]);

  const handleReserveReverse = useCallback(async () => {
    if (reserveDetailId == null) return;
    await reverseReserveDeduction(reserveDetailId);
  }, [reserveDetailId, reverseReserveDeduction]);

  const handleReserveDelete = useCallback(async () => {
    if (reserveDetailId == null) return;
    await removeReserve(reserveDetailId);
    setReserveDetailId(null);
  }, [reserveDetailId, removeReserve]);

  const handleCloseLoan = useCallback(async () => {
    if (loanDetailId == null) return;
    await closeLoan(loanDetailId);
  }, [loanDetailId, closeLoan]);

  const handleCloseReserve = useCallback(async () => {
    if (reserveDetailId == null) return;
    await closeReserve(reserveDetailId);
  }, [reserveDetailId, closeReserve]);

  const handleLoanUpdateInstallmentNote = useCallback(
    async (index: number, note: string) => {
      if (selectedLoan == null) return;
      const notes = [...(selectedLoan.paymentNotes ?? [])];
      while (notes.length <= index) notes.push('');
      notes[index] = note;
      await updateLoanById(selectedLoan.id, { ...selectedLoan, paymentNotes: notes });
    },
    [selectedLoan, updateLoanById]
  );

  /** Single update when closing an installment from LoanDetailModal (saves note + marks paid). */
  const handleLoanCloseInstallmentWithNote = useCallback(
    async (index: number, note: string) => {
      if (selectedLoan == null || index !== selectedLoan.paidCount) return;
      const loan = selectedLoan;
      const paymentNotes = [...(loan.paymentNotes ?? [])];
      while (paymentNotes.length <= index) paymentNotes.push('');
      paymentNotes[index] = note;
      const paymentDates = [...(loan.paymentDates ?? [])];
      paymentDates.push(new Date().toISOString().split('T')[0]);
      await updateLoanById(loan.id, {
        ...loan,
        paidCount: loan.paidCount + 1,
        paymentDates,
        paymentNotes,
      });
    },
    [selectedLoan, updateLoanById]
  );

  const handleReserveUpdateDeductionNote = useCallback(
    async (index: number, note: string) => {
      if (selectedReserve == null) return;
      const notes = [...(selectedReserve.deductionNotes ?? [])];
      while (notes.length <= index) notes.push('');
      notes[index] = note;
      await updateReserveById(selectedReserve.id, {
        ...selectedReserve,
        deductionNotes: notes,
      });
    },
    [selectedReserve, updateReserveById]
  );

  /** Single update when closing a deduction from ReserveDetailModal (saves note + marks deducted). */
  const handleReserveCloseDeductionWithNote = useCallback(
    async (index: number, note: string) => {
      if (selectedReserve == null || index !== selectedReserve.paidCount) return;
      const reserve = selectedReserve;
      const deductionNotes = [...(reserve.deductionNotes ?? [])];
      while (deductionNotes.length <= index) deductionNotes.push('');
      deductionNotes[index] = note;
      const deductionDates = [...(reserve.deductionDates ?? [])];
      deductionDates.push(new Date().toISOString().split('T')[0]);
      await updateReserveById(reserve.id, {
        ...reserve,
        paidCount: reserve.paidCount + 1,
        deductionDates,
        deductionNotes,
      });
    },
    [selectedReserve, updateReserveById]
  );

  /** Single update: save note and mark next installment paid (avoids note being overwritten). */
  const handleOverviewCloseInstallment = useCallback(
    async (note: string) => {
      if (overviewCloseInstallmentLoan == null) return;
      const loan = overviewCloseInstallmentLoan;
      const index = loan.paidCount;
      const paymentNotes = [...(loan.paymentNotes ?? [])];
      while (paymentNotes.length <= index) paymentNotes.push('');
      paymentNotes[index] = note;
      const paymentDates = [...(loan.paymentDates ?? [])];
      const nextDate = new Date().toISOString().split('T')[0];
      paymentDates.push(nextDate);
      await updateLoanById(loan.id, {
        ...loan,
        paidCount: loan.paidCount + 1,
        paymentDates,
        paymentNotes,
      });
    },
    [overviewCloseInstallmentLoan, updateLoanById]
  );

  /** Single update: save note and mark next deduction (avoids note being overwritten). */
  const handleOverviewCloseDeduction = useCallback(
    async (note: string) => {
      if (overviewCloseDeductionReserve == null) return;
      const reserve = overviewCloseDeductionReserve;
      const index = reserve.paidCount;
      const deductionNotes = [...(reserve.deductionNotes ?? [])];
      while (deductionNotes.length <= index) deductionNotes.push('');
      deductionNotes[index] = note;
      const deductionDates = [...(reserve.deductionDates ?? [])];
      deductionDates.push(new Date().toISOString().split('T')[0]);
      await updateReserveById(reserve.id, {
        ...reserve,
        paidCount: reserve.paidCount + 1,
        deductionDates,
        deductionNotes,
      });
    },
    [overviewCloseDeductionReserve, updateReserveById]
  );

  // Wait for auth to be resolved before showing login or dashboard (avoids 401s and stuck state)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted2">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  // Don't render dashboard until we have effectiveOwnerId (set after claimInvite / resolveEffectiveOwner)
  if (effectiveOwnerId == null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted2">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar page={page} onPage={setPage} onSignOut={signOut} />
      <main className="flex-1 overflow-y-auto py-7 px-8">
        {configMissing && (
          <div className="mb-5 py-3 px-5 rounded-xl text-[13px] flex items-center justify-between gap-3 bg-yellow/10 border border-yellow/30 text-yellow">
            <span>
              Configure Supabase: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see
              .env.example).
            </span>
          </div>
        )}
        {error && (
          <div className="mb-5 py-3 px-5 rounded-xl text-[13px] flex items-center justify-between gap-3 bg-red/15 border border-red/30 text-red">
            <span>Failed to load data: {error}</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="py-1 px-2 rounded border border-red/30 hover:bg-red/10"
            >
              Retry
            </button>
          </div>
        )}
        {loading && !configMissing && (
          <div className="mb-5 py-3 px-5 rounded-xl text-[13px] bg-accent/10 border border-accent/25 text-accent">
            Loading…
          </div>
        )}

        {page === 'overview' && (
          <OverviewPage
            loans={loans}
            reserves={reserves}
            onOpenCloseInstallment={setOverviewCloseInstallmentLoanId}
            onOpenCloseDeduction={setOverviewCloseDeductionReserveId}
          />
        )}
        {page === 'loans' && (
          <LoansPage
            loans={loans}
            markLoanPaid={markLoanPaid}
            removeLoan={removeLoan}
            onOpenDetail={setLoanDetailId}
            onAddLoan={() => setAddLoanOpen(true)}
          />
        )}
        {page === 'reserves' && (
          <ReservesPage
            reserves={reserves}
            markReservePaid={markReservePaid}
            removeReserve={removeReserve}
            onOpenDetail={setReserveDetailId}
            onAddReserve={() => setAddReserveOpen(true)}
          />
        )}
        {page === 'closed' && (
          <ClosedPage
            loans={loans}
            reserves={reserves}
            onOpenLoan={setLoanDetailId}
            onOpenReserve={setReserveDetailId}
          />
        )}
        {page === 'users' && <UsersPage />}
      </main>

      <LoanDetailModal
        loan={selectedLoan}
        open={loanDetailId != null}
        onClose={() => setLoanDetailId(null)}
        onMarkPaid={handleLoanMarkPaid}
        onReverse={handleLoanReverse}
        onDelete={handleLoanDelete}
        onCloseLoan={handleCloseLoan}
        onUpdateInstallmentNote={handleLoanUpdateInstallmentNote}
        onCloseInstallmentWithNote={handleLoanCloseInstallmentWithNote}
      />
      <ReserveDetailModal
        reserve={selectedReserve}
        open={reserveDetailId != null}
        onClose={() => setReserveDetailId(null)}
        onMarkDeducted={handleReserveMarkDeducted}
        onReverse={handleReserveReverse}
        onDelete={handleReserveDelete}
        onCloseReserve={handleCloseReserve}
        onUpdateDeductionNote={handleReserveUpdateDeductionNote}
        onCloseDeductionWithNote={handleReserveCloseDeductionWithNote}
      />
      {page === 'overview' && (
        <>
          <CloseInstallmentModal
            loan={overviewCloseInstallmentLoan}
            open={overviewCloseInstallmentLoanId != null}
            onClose={() => setOverviewCloseInstallmentLoanId(null)}
            onCloseInstallment={handleOverviewCloseInstallment}
          />
          <CloseDeductionModal
            reserve={overviewCloseDeductionReserve}
            open={overviewCloseDeductionReserveId != null}
            onClose={() => setOverviewCloseDeductionReserveId(null)}
            onCloseDeduction={handleOverviewCloseDeduction}
          />
        </>
      )}
      <AddLoanModal
        open={addLoanOpen}
        onClose={() => setAddLoanOpen(false)}
        onAdd={addLoan}
      />
      <AddReserveModal
        open={addReserveOpen}
        onClose={() => setAddReserveOpen(false)}
        onAdd={addReserve}
      />
    </>
  );
}
