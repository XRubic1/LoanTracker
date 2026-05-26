import type { PageId, UserRole } from '@/types';
import { canAccessPage } from '@/lib/tabPermissions';

const STORAGE_VERSION = 'v1';

/** Set to true when first-login tour persistence is fixed. */
export const ONBOARDING_TUTORIAL_ENABLED = false;

export function tutorialStorageKey(userId: string): string {
  return 'opsdesk_onboarding_' + STORAGE_VERSION + '_' + userId;
}

export function hasCompletedTutorial(userId: string): boolean {
  try {
    return localStorage.getItem(tutorialStorageKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function markTutorialCompleted(userId: string): void {
  try {
    localStorage.setItem(tutorialStorageKey(userId), '1');
  } catch {
    /* ignore */
  }
}

export function clearTutorialCompleted(userId: string): void {
  try {
    localStorage.removeItem(tutorialStorageKey(userId));
  } catch {
    /* ignore */
  }
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  page?: PageId;
  tourTarget?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface BuildTutorialOptions {
  userRole: UserRole;
  isOwner: boolean;
  showAdmin: boolean;
  allowedPages: PageId[] | null;
  companyName?: string | null;
}

const NAV_STEP_COPY: Partial<Record<PageId, { title: string; body: string }>> = {
  overview: {
    title: 'Overview',
    body: 'See what is due this week: loans, reserves, and items that need attention.',
  },
  worksheet: {
    title: 'Worksheet',
    body: 'Log daily work in batches: pick a client, enter invoice counts, and mark verification.',
  },
  loans: {
    title: 'Loans',
    body: 'Track installment loans: add clients, schedules, mark payments, and print summaries.',
  },
  reserves: {
    title: 'Reserves',
    body: 'Manage reserve deductions and schedules alongside your loans.',
  },
  closed: {
    title: 'Closed',
    body: 'Review completed loans, reserves, and related AAA payments in one place.',
  },
  aaaPayments: {
    title: 'AAA Payments',
    body: 'Record payments to AAA entities and tie them to your client work.',
  },
  clients: {
    title: 'Clients',
    body: 'Your master client list, used on Worksheet and across the app. Import or add clients here.',
  },
  clientInsurance: {
    title: 'Client Insurance',
    body: 'Track MC numbers, status, and insurance verification for each client.',
  },
  users: {
    title: 'Users',
    body: 'Invite teammates by email and choose which tabs they can access.',
  },
  userActivity: {
    title: 'User Activity',
    body: 'Monitor team workload, worksheet batches, and pace flags for your company.',
  },
};

function welcomeStep(companyName?: string | null): TutorialStep {
  let body = 'This quick tour shows where to find the tools you need.';
  if (companyName) {
    body += ' You are set up for ' + companyName + '.';
  }
  body += ' You can skip anytime or replay later from Show tour in the top bar.';
  return {
    id: 'welcome',
    title: 'Welcome to OpsDesk',
    body,
    placement: 'center',
  };
}

function finishStep(): TutorialStep {
  return {
    id: 'finish',
    title: 'You are all set',
    body: 'Start working in any tab above. If you have questions, ask your team admin or use Show tour in the top bar.',
    placement: 'center',
  };
}

/** Build an ordered tour for the signed-in user role and tab permissions. */
export function buildTutorialSteps(options: BuildTutorialOptions): TutorialStep[] {
  const { userRole, isOwner, showAdmin, allowedPages, companyName } = options;

  if (userRole === 'platform_admin') {
    return [
      {
        id: 'welcome-admin',
        title: 'Super Admin',
        body: 'Use the Super Admin tab to create companies, link accounts for shared clients, and monitor all teams.',
        tourTarget: 'nav-admin',
        page: 'admin',
        placement: 'bottom',
      },
      finishStep(),
    ];
  }

  const access = { isOwner, showAdmin, allowedPages };
  const navPageCandidates: PageId[] = [
    'overview',
    'worksheet',
    'loans',
    'reserves',
    'clients',
    'clientInsurance',
    'closed',
    'aaaPayments',
    'users',
    'userActivity',
  ];
  const navPages = navPageCandidates.filter((p) => canAccessPage(p, access));

  const steps: TutorialStep[] = [welcomeStep(companyName)];

  const isLoansOnlyMember =
    userRole === 'team_member' &&
    navPages.length <= 2 &&
    navPages.includes('loans');

  if (isLoansOnlyMember) {
    steps.push({
      id: 'nav-loans',
      title: 'Your workspace',
      body: 'Loans is your main tab. Use it to add and track client loans your team manages.',
      tourTarget: 'nav-loans',
      page: 'loans',
      placement: 'bottom',
    });
    steps.push({
      id: 'main',
      title: 'Add your first loan',
      body: 'Use Add loan to create a record. Open a row anytime for details, payments, and notes.',
      tourTarget: 'main-content',
      page: 'loans',
      placement: 'top',
    });
    steps.push(finishStep());
    return steps;
  }

  for (const pageId of navPages) {
    const copy = NAV_STEP_COPY[pageId];
    if (!copy) continue;
    steps.push({
      id: 'nav-' + pageId,
      title: copy.title,
      body: copy.body,
      tourTarget: 'nav-' + pageId,
      page: pageId,
      placement: 'bottom',
    });
  }

  if (isOwner && canAccessPage('users', access)) {
    steps.push({
      id: 'tip-users',
      title: 'Growing the team?',
      body: 'New members get a short tour on first login. Start them on Loans only, then grant more tabs under Users.',
      tourTarget: 'nav-users',
      page: 'users',
      placement: 'bottom',
    });
  }

  steps.push({
    id: 'toolbar',
    title: 'Toolbar',
    body: 'Switch light/dark theme, see the week date range, and sign out when you are done.',
    tourTarget: 'topbar-tools',
    placement: 'bottom',
  });

  steps.push(finishStep());
  return steps;
}

export function getTutorialProgressLabel(index: number, total: number): string {
  return 'Step ' + (index + 1) + ' of ' + total;
}
