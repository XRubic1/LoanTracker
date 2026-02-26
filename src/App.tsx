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
import { AddLoanModal } from '@/components/modals/AddLoanModal';
import { AddReserveModal } from '@/components/modals/AddReserveModal';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/hooks/useData';

export default function App() {
  const { session, effectiveOwnerId, loading: authLoading, signOut } = useAuth();
  const [page, setPage] = useState<PageId>('overview');
  const [loanDetailId, setLoanDetailId] = useState<number | null>(null);
  const [reserveDetailId, setReserveDetailId] = useState<number | null>(null);
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
    removeLoan,
    markLoanPaid,
    reverseLoanPayment,
    addReserve,
    removeReserve,
    markReservePaid,
    reverseReserveDeduction,
  } = useData(effectiveOwnerId ?? null);

  const selectedLoan = loanDetailId != null ? loans.find((l) => l.id === loanDetailId) ?? null : null;
  const selectedReserve =
    reserveDetailId != null ? reserves.find((r) => r.id === reserveDetailId) ?? null : null;

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
            markLoanPaid={markLoanPaid}
            markReservePaid={markReservePaid}
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
        {page === 'closed' && <ClosedPage loans={loans} reserves={reserves} />}
        {page === 'users' && <UsersPage />}
      </main>

      <LoanDetailModal
        loan={selectedLoan}
        open={loanDetailId != null}
        onClose={() => setLoanDetailId(null)}
        onMarkPaid={handleLoanMarkPaid}
        onReverse={handleLoanReverse}
        onDelete={handleLoanDelete}
      />
      <ReserveDetailModal
        reserve={selectedReserve}
        open={reserveDetailId != null}
        onClose={() => setReserveDetailId(null)}
        onMarkDeducted={handleReserveMarkDeducted}
        onReverse={handleReserveReverse}
        onDelete={handleReserveDelete}
      />
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
