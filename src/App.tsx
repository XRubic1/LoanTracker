import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { PageId } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { AppNotifications } from '@/components/AppNotifications';
import { getWeekRange } from '@/lib/utils';
import { OverviewPage } from '@/pages/OverviewPage';
import { LoansPage } from '@/pages/LoansPage';
import { ReservesPage } from '@/pages/ReservesPage';
import { ClosedPage } from '@/pages/ClosedPage';
import { AaaPaymentsPage } from '@/pages/AaaPaymentsPage';
import { ClientInsurancePage } from '@/pages/ClientInsurancePage';
import { ClientsPage } from '@/pages/ClientsPage';
import { WorksheetPage } from '@/pages/WorksheetPage';
import { UserActivityPage } from '@/pages/UserActivityPage';
import { ApiMonitoringPage } from '@/pages/ApiMonitoringPage';
import { SuperAdminDashboard } from '@/pages/SuperAdminDashboard';
import { CompanySuspendedBanner } from '@/components/CompanySuspendedBanner';
import { TeamAdminWelcome } from '@/components/TeamAdminWelcome';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { UsersPage } from '@/pages/UsersPage';
import { AddClientModal } from '@/components/modals/AddClientModal';
import { EditClientModal } from '@/components/modals/EditClientModal';
import { ClientDetailModal } from '@/components/modals/ClientDetailModal';
import { WorksheetEntryModal } from '@/components/modals/WorksheetEntryModal';
import { ImportClientsModal } from '@/components/modals/ImportClientsModal';
import { normalizeClientName } from '@/lib/importClients';
import { AuthPage } from '@/pages/AuthPage';
import { LoanDetailModal } from '@/components/modals/LoanDetailModal';
import { ReserveDetailModal } from '@/components/modals/ReserveDetailModal';
import { CloseInstallmentModal } from '@/components/modals/CloseInstallmentModal';
import { CloseDeductionModal } from '@/components/modals/CloseDeductionModal';
import { AddLoanModal } from '@/components/modals/AddLoanModal';
import { AddReserveModal } from '@/components/modals/AddReserveModal';
import { AddClientInsuranceModal } from '@/components/modals/AddClientInsuranceModal';
import { ClientInsuranceDetailModal } from '@/components/modals/ClientInsuranceDetailModal';
import { EditClientInsuranceModal } from '@/components/modals/EditClientInsuranceModal';
import { EditAaaPaymentModal } from '@/components/modals/EditAaaPaymentModal';
import type { Client, Loan } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/hooks/useData';
import {
  getNotificationsHidden,
  hasActiveNotifications,
  setNotificationsHidden,
} from '@/lib/notificationsBanner';
import { canAccessPage, getDefaultPageForUser } from '@/lib/tabPermissions';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import type { SuperAdminTab } from '@/lib/superAdminTabs';

export default function App() {
  const {
    session,
    user,
    effectiveOwnerId,
    isOwner,
    memberAllowedPages,
    userRole,
    isPlatformAdmin: showAdminNav,
    loading: authLoading,
    signOut,
  } = useAuth();
  const [page, setPage] = useState<PageId>('overview');
  const [adminTab, setAdminTab] = useState<SuperAdminTab>('dashboard');
  const [loanDetailId, setLoanDetailId] = useState<number | null>(null);
  const [reserveDetailId, setReserveDetailId] = useState<number | null>(null);
  const [overviewCloseInstallmentLoanId, setOverviewCloseInstallmentLoanId] = useState<number | null>(null);
  const [overviewCloseDeductionReserveId, setOverviewCloseDeductionReserveId] = useState<number | null>(null);
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [addReserveOpen, setAddReserveOpen] = useState(false);
  const [addClientInsuranceOpen, setAddClientInsuranceOpen] = useState(false);
  const [clientInsuranceDetailId, setClientInsuranceDetailId] = useState<number | null>(null);
  const [editClientInsuranceId, setEditClientInsuranceId] = useState<number | null>(null);
  const [editAaaPaymentId, setEditAaaPaymentId] = useState<number | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientDetailId, setClientDetailId] = useState<number | null>(null);
  const [editClientId, setEditClientId] = useState<number | null>(null);
  const [worksheetEntryId, setWorksheetEntryId] = useState<number | null>(null);
  const [importClientsOpen, setImportClientsOpen] = useState(false);
  const [addClientInsuranceInitialName, setAddClientInsuranceInitialName] = useState('');
  const [notificationsHidden, setNotificationsHiddenState] = useState(getNotificationsHidden);
  const [tutorialReplay, setTutorialReplay] = useState(0);

  /** Only the account owner (admin) may delete or reverse loans/reserves. */
  const runIfAccountAdmin = useCallback(
    (action: () => void) => {
      if (!isOwner) {
        window.alert('Only the account admin can delete or reverse payments.');
        return;
      }
      action();
    },
    [isOwner]
  );

  const toggleNotificationsHidden = useCallback(() => {
    setNotificationsHiddenState((prev) => {
      const next = !prev;
      setNotificationsHidden(next);
      return next;
    });
  }, []);

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
    clientInsurance,
    insuranceVerification,
    addClientInsurance,
    updateClientInsuranceById,
    removeClientInsurance,
    updateInsuranceVerification,
    aaaPayments,
    addAaaPayment,
    updateAaaPaymentById,
    removeAaaPayment,
    clients,
    worksheetClients,
    worksheetClientInsurance,
    worksheetEntries,
    addClient,
    updateClientById,
    removeClient,
    addWorksheetEntry,
    updateWorksheetEntryById,
    removeWorksheetEntry,
    clearWorksheetActivityInRange,
  } = useData(effectiveOwnerId ?? null, user?.id ?? null);

  const tabAccess = useMemo(
    () => ({
      isOwner,
      showAdmin: showAdminNav,
      allowedPages: memberAllowedPages,
      userRole,
    }),
    [isOwner, showAdminNav, memberAllowedPages, userRole]
  );

  const initialLandingSet = useRef(false);

  useEffect(() => {
    if (!user) {
      initialLandingSet.current = false;
      return;
    }
    if (authLoading || effectiveOwnerId == null) return;

    if (!initialLandingSet.current) {
      if (showAdminNav) {
        setPage('admin');
        setAdminTab('dashboard');
      } else {
        setPage(getDefaultPageForUser(tabAccess));
      }
      initialLandingSet.current = true;
      return;
    }

    if (!canAccessPage(page, tabAccess)) {
      setPage(getDefaultPageForUser(tabAccess));
    }
  }, [page, tabAccess, user, authLoading, effectiveOwnerId, showAdminNav]);

  const showMemberEmptyWorkspace =
    userRole === 'team_member' &&
    loans.length === 0 &&
    (memberAllowedPages?.length ?? 0) <= 2 &&
    (memberAllowedPages?.includes('loans') ?? false);

  const showNotificationsToggle = useMemo(
    () =>
      hasActiveNotifications(
        loans,
        clientInsurance,
        // New-client review is team-only — exclude for Super Admin portal users.
        showAdminNav ? [] : clients
      ),
    [loans, clientInsurance, clients, showAdminNav]
  );

  const selectedClientInsurance =
    clientInsuranceDetailId != null
      ? clientInsurance.find((c) => c.id === clientInsuranceDetailId) ?? null
      : null;
  const editingClientInsurance =
    editClientInsuranceId != null
      ? clientInsurance.find((c) => c.id === editClientInsuranceId) ?? null
      : null;
  const editingAaaPayment =
    editAaaPaymentId != null ? aaaPayments.find((p) => p.id === editAaaPaymentId) ?? null : null;
  const selectedClient =
    clientDetailId != null ? clients.find((c) => c.id === clientDetailId) ?? null : null;
  const editingClient = editClientId != null ? clients.find((c) => c.id === editClientId) ?? null : null;
  const editingWorksheetEntry =
    worksheetEntryId != null ? worksheetEntries.find((e) => e.id === worksheetEntryId) ?? null : null;

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

  const handleLoanToggleHidden = useCallback(async (hidden: boolean) => {
    if (selectedLoan == null) return;
    const updated: Loan = { ...selectedLoan, hidden };
    await updateLoanById(selectedLoan.id, updated);
  }, [selectedLoan, updateLoanById]);

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

  /** Single update when closing an installment from LoanDetailModal (saves note + marks paid). paidDate defaults to today. */
  const handleLoanCloseInstallmentWithNote = useCallback(
    async (index: number, note: string, paidDate?: string) => {
      if (selectedLoan == null || index !== selectedLoan.paidCount) return;
      const loan = selectedLoan;
      const paymentNotes = [...(loan.paymentNotes ?? [])];
      while (paymentNotes.length <= index) paymentNotes.push('');
      paymentNotes[index] = note;
      const paymentDates = [...(loan.paymentDates ?? [])];
      paymentDates.push(paidDate ?? new Date().toISOString().split('T')[0]);
      await updateLoanById(loan.id, {
        ...loan,
        paidCount: loan.paidCount + 1,
        paymentDates,
        paymentNotes,
      });
    },
    [selectedLoan, updateLoanById]
  );

  /** Update the paid date for an already-closed installment. */
  const handleLoanUpdatePaymentDate = useCallback(
    async (index: number, date: string) => {
      if (selectedLoan == null) return;
      const loan = selectedLoan;
      const paymentDates = [...(loan.paymentDates ?? [])];
      while (paymentDates.length <= index) paymentDates.push('');
      paymentDates[index] = date;
      await updateLoanById(loan.id, { ...loan, paymentDates });
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
    async (note: string, paidDate?: string) => {
      if (overviewCloseInstallmentLoan == null) return;
      const loan = overviewCloseInstallmentLoan;
      const index = loan.paidCount;
      const paymentNotes = [...(loan.paymentNotes ?? [])];
      while (paymentNotes.length <= index) paymentNotes.push('');
      paymentNotes[index] = note;
      const paymentDates = [...(loan.paymentDates ?? [])];
      paymentDates.push(paidDate ?? new Date().toISOString().split('T')[0]);
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
  const handleImportClients = useCallback(
    async (batch: {
      toAdd: Omit<Client, 'id'>[];
      toUpdate: Client[];
      toDelete: Client[];
      toAddInsurance: Array<{ client: string; mc: string; dot: string }>;
    }) => {
      const errors: string[] = [];
      for (const client of batch.toUpdate) {
        await updateClientById(client.id, client);
      }
      for (const payload of batch.toAdd) {
        await addClient(payload);
      }
      for (const ins of batch.toAddInsurance) {
        const exists = clientInsurance.some(
          (ci) => normalizeClientName(ci.client) === normalizeClientName(ins.client)
        );
        if (!exists) {
          await addClientInsurance({
            client: ins.client.trim(),
            mc: ins.mc.trim(),
            dot: ins.dot.trim(),
            status: 'OK',
            expiration_date: null,
            last_cancellation_date: null,
          });
        }
      }
      for (const client of batch.toDelete) {
        try {
          await removeClient(client.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${client.name}: ${msg}`);
        }
      }
      if (errors.length > 0) {
        throw new Error(
          `Some clients could not be deleted (worksheet entries may block removal):\n${errors.join('\n')}`
        );
      }
    },
    [addClient, updateClientById, removeClient, addClientInsurance, clientInsurance]
  );

  const handleAddClientInsurance = useCallback(
    async (payload: Parameters<typeof addClientInsurance>[0]) => {
      const added = await addClientInsurance(payload);
      const exists = clients.some(
        (c) => normalizeClientName(c.name) === normalizeClientName(payload.client)
      );
      if (!exists) {
        await addClient({
          name: payload.client.trim(),
          expenses: null,
          email: null,
          warning_note: null,
          is_new_client: false,
          started_date: null,
          new_client_reviewed: false,
          verification_days: 30,
          verification_always: false,
        });
      }
      return added;
    },
    [addClientInsurance, addClient, clients]
  );

  const openAddInsurance = useCallback((prefillName = '') => {
    setAddClientInsuranceInitialName(prefillName);
    setAddClientInsuranceOpen(true);
  }, []);

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
      <div className="min-h-screen w-full flex items-center justify-center bg-page text-muted2">
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
      <div className="min-h-screen w-full flex items-center justify-center bg-page text-muted2">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        page={page}
        onPage={setPage}
        onSignOut={signOut}
        weekRange={getWeekRange()}
        showNotificationsToggle={showNotificationsToggle}
        notificationsHidden={notificationsHidden}
        onToggleNotificationsHidden={toggleNotificationsHidden}
        isOwner={isOwner}
        showAdmin={showAdminNav}
        memberAllowedPages={memberAllowedPages}
        adminTab={adminTab}
        onAdminTab={showAdminNav ? setAdminTab : undefined}
        onReplayTour={() => setTutorialReplay((n) => n + 1)}
      />
      <OnboardingTutorial
        page={page}
        onNavigate={setPage}
        replayToken={tutorialReplay}
      />
      {/* Right-hand column: notifications banner stacked above the scrollable page content.
          Super Admin fills the viewport — skip banners so they don't push the layout down. */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {!notificationsHidden && !(page === 'admin' && showAdminNav) && (
          <AppNotifications loans={loans} clientInsurance={clientInsurance} clients={clients} />
        )}
        <main
          className={`main flex-1 min-h-0 px-5 ${
            page === 'admin' && showAdminNav
              ? 'overflow-hidden py-2 flex flex-col'
              : 'overflow-y-auto py-4'
          }`}
          data-tour="main-content"
        >
        {configMissing && (
          <div className="mb-3 py-2 px-3 rounded-lg text-xs flex items-center justify-between gap-2 bg-alert-warn border border-red/30 text-alert-warn-fg">
            <span>
              Configure Supabase: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see
              .env.example).
            </span>
          </div>
        )}
        {error && (
          <div className="mb-3 py-2 px-3 rounded-lg text-xs flex items-center justify-between gap-2 bg-tag-overdue border border-red/30 text-tag-overdue-fg">
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
          <div className="mb-3 py-2 px-3 rounded-lg text-xs bg-alert-info border border-accent/25 text-alert-info-fg">
            Loading…
          </div>
        )}

        <CompanySuspendedBanner />
        {isOwner && userRole === 'team_admin' && (
          <TeamAdminWelcome onGoToUsers={() => setPage('users')} />
        )}

        {page === 'overview' && (
          <OverviewPage
            loans={loans}
            reserves={reserves}
            clientInsurance={clientInsurance}
            insuranceVerification={insuranceVerification}
            addAaaPayment={addAaaPayment}
            onOpenCloseInstallment={setOverviewCloseInstallmentLoanId}
            onOpenCloseDeduction={setOverviewCloseDeductionReserveId}
          />
        )}
        {page === 'loans' &&
          (showMemberEmptyWorkspace ? (
            <EmptyWorkspace onAction={() => setAddLoanOpen(true)} />
          ) : (
            <LoansPage
              loans={loans}
              effectiveOwnerId={effectiveOwnerId}
              markLoanPaid={markLoanPaid}
              removeLoan={removeLoan}
              onOpenDetail={setLoanDetailId}
              onAddLoan={() => setAddLoanOpen(true)}
            />
          ))}
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
            aaaPayments={aaaPayments}
            addAaaPayment={addAaaPayment}
            clientInsurance={clientInsurance}
            onOpenLoan={setLoanDetailId}
            onOpenReserve={setReserveDetailId}
            onEditAaaPayment={setEditAaaPaymentId}
            onDeleteAaaPayment={isOwner ? removeAaaPayment : undefined}
          />
        )}
        {page === 'aaaPayments' && (
          <AaaPaymentsPage
            aaaPayments={aaaPayments}
            addAaaPayment={addAaaPayment}
            clientInsurance={clientInsurance}
            onEditPayment={setEditAaaPaymentId}
            onDeletePayment={isOwner ? removeAaaPayment : undefined}
          />
        )}
        {page === 'clientInsurance' && (
          <ClientInsurancePage
            clientInsurance={clientInsurance}
            effectiveOwnerId={effectiveOwnerId}
            clients={clients}
            insuranceVerification={insuranceVerification}
            updateInsuranceVerification={updateInsuranceVerification}
            onAddInsurance={() => openAddInsurance()}
            onAddInsuranceForClient={openAddInsurance}
            onViewInsurance={setClientInsuranceDetailId}
          />
        )}
        {page === 'api' && user && (
          <ApiMonitoringPage
            userId={user.id}
            effectiveOwnerId={effectiveOwnerId}
            clientInsurance={clientInsurance}
            onRefreshInsurance={() => void refetch()}
          />
        )}
        {page === 'worksheet' && user && (
          <WorksheetPage
            worksheetEntries={worksheetEntries}
            clients={worksheetClients}
            clientInsurance={worksheetClientInsurance}
            currentUserId={user.id}
            addWorksheetEntry={addWorksheetEntry}
            removeWorksheetEntry={removeWorksheetEntry}
            onEditEntry={setWorksheetEntryId}
          />
        )}
        {page === 'clients' && (
          <ClientsPage
            clients={clients}
            effectiveOwnerId={effectiveOwnerId}
            isAccountAdmin={isOwner}
            onAddClient={() => setAddClientOpen(true)}
            onImportClients={() => setImportClientsOpen(true)}
            onViewClient={setClientDetailId}
            onEditClient={setEditClientId}
            onDeleteClient={removeClient}
          />
        )}
        {page === 'userActivity' && isOwner && effectiveOwnerId && (
          <UserActivityPage
            worksheetEntries={worksheetEntries}
            clients={clients}
            clientInsurance={clientInsurance}
            ownerId={effectiveOwnerId}
            clearWorksheetActivityInRange={clearWorksheetActivityInRange}
          />
        )}
        {page === 'admin' && showAdminNav && (
          <div className="flex-1 min-h-0">
            <SuperAdminDashboard tab={adminTab} />
          </div>
        )}
        {page === 'users' && <UsersPage />}
        </main>
      </div>

      <LoanDetailModal
        loan={selectedLoan}
        open={loanDetailId != null}
        onClose={() => setLoanDetailId(null)}
        onMarkPaid={handleLoanMarkPaid}
        onReverse={handleLoanReverse}
        onDelete={handleLoanDelete}
        onToggleHidden={handleLoanToggleHidden}
        isAccountAdmin={isOwner}
        runIfAccountAdmin={runIfAccountAdmin}
        onCloseLoan={handleCloseLoan}
        onUpdateInstallmentNote={handleLoanUpdateInstallmentNote}
        onCloseInstallmentWithNote={handleLoanCloseInstallmentWithNote}
        onUpdatePaymentDate={handleLoanUpdatePaymentDate}
      />
      <ReserveDetailModal
        reserve={selectedReserve}
        open={reserveDetailId != null}
        onClose={() => setReserveDetailId(null)}
        onMarkDeducted={handleReserveMarkDeducted}
        onReverse={handleReserveReverse}
        onDelete={handleReserveDelete}
        isAccountAdmin={isOwner}
        runIfAccountAdmin={runIfAccountAdmin}
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
      <ImportClientsModal
        open={importClientsOpen}
        onClose={() => setImportClientsOpen(false)}
        clients={clients}
        clientInsurance={clientInsurance}
        onImport={handleImportClients}
      />
      <AddClientInsuranceModal
        open={addClientInsuranceOpen}
        initialClientName={addClientInsuranceInitialName}
        registryClients={clients}
        onClose={() => {
          setAddClientInsuranceOpen(false);
          setAddClientInsuranceInitialName('');
        }}
        onAdd={handleAddClientInsurance}
      />
      <ClientInsuranceDetailModal
        clientInsurance={selectedClientInsurance}
        open={clientInsuranceDetailId != null}
        onClose={() => setClientInsuranceDetailId(null)}
        onSave={updateClientInsuranceById}
        onEdit={(id) => {
          setClientInsuranceDetailId(null);
          setEditClientInsuranceId(id);
        }}
        onDelete={
          isOwner
            ? async (id) => {
                await removeClientInsurance(id);
                setClientInsuranceDetailId(null);
              }
            : undefined
        }
      />
      <EditClientInsuranceModal
        clientInsurance={editingClientInsurance}
        open={editClientInsuranceId != null}
        onClose={() => setEditClientInsuranceId(null)}
        onSave={async (id, record) => {
          const updated = await updateClientInsuranceById(id, record);
          setEditClientInsuranceId(null);
          return updated;
        }}
      />
      <EditAaaPaymentModal
        payment={editingAaaPayment}
        open={editAaaPaymentId != null}
        onClose={() => setEditAaaPaymentId(null)}
        clientInsurance={clientInsurance}
        onSave={async (id, record) => {
          const updated = await updateAaaPaymentById(id, record);
          setEditAaaPaymentId(null);
          return updated;
        }}
      />
      <AddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onAdd={addClient}
      />
      <ClientDetailModal
        open={clientDetailId != null}
        client={selectedClient}
        onClose={() => setClientDetailId(null)}
        onEdit={() => {
          if (clientDetailId != null) {
            setEditClientId(clientDetailId);
            setClientDetailId(null);
          }
        }}
        onSave={updateClientById}
      />
      <EditClientModal
        open={editClientId != null}
        client={editingClient}
        onClose={() => setEditClientId(null)}
        onSave={updateClientById}
      />
      <WorksheetEntryModal
        open={worksheetEntryId != null}
        entry={editingWorksheetEntry}
        clients={worksheetClients}
        clientInsurance={worksheetClientInsurance}
        onClose={() => setWorksheetEntryId(null)}
        onSave={async (payload) => {
          if ('id' in payload && typeof payload.id === 'number') {
            await updateWorksheetEntryById(payload.id, payload);
          }
        }}
      />
    </>
  );
}
