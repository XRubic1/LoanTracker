import type { Client, ClientInsurance, Loan } from '@/types';
import { isNewLoan } from '@/lib/utils';
import { getNewClientsNeedingReview } from '@/lib/clientUtils';
import { isClientInsuranceCancellationWithDate } from '@/lib/clientInsuranceUtils';

export const NOTIFICATIONS_HIDDEN_STORAGE_KEY = 'loan-tracker-notifications-hidden';

/** Whether the user has dismissed the top notification strip. */
export function getNotificationsHidden(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_HIDDEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setNotificationsHidden(hidden: boolean): void {
  try {
    localStorage.setItem(NOTIFICATIONS_HIDDEN_STORAGE_KEY, hidden ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/** True when insurance cancellation and/or new-loan alerts would be shown. */
export function hasActiveNotifications(
  loans: Loan[],
  clientInsurance: ClientInsurance[],
  clients: Client[] = []
): boolean {
  const visibleLoans = loans.filter((l) => !l.hidden);
  const activeLoans = visibleLoans.filter((l) => l.paidCount < l.totalInstallments);
  const newLoans = activeLoans.filter(isNewLoan);
  const cancellationWithDate = clientInsurance.filter(isClientInsuranceCancellationWithDate);
  const newClientsNeedReview = getNewClientsNeedingReview(clients);
  return (
    cancellationWithDate.length > 0 ||
    newLoans.length > 0 ||
    newClientsNeedReview.length > 0
  );
}
