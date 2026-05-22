import type { PageId } from '@/types';

/** Pages an owner can grant to team members (not Users, User Activity, or Admin). */
export const ASSIGNABLE_PAGE_IDS: PageId[] = [
  'overview',
  'worksheet',
  'loans',
  'reserves',
  'closed',
  'aaaPayments',
  'clients',
  'clientInsurance',
];

/** Human-readable labels for nav / permissions UI. */
export const PAGE_LABELS: Record<PageId, string> = {
  overview: 'Overview',
  loans: 'Loans',
  reserves: 'Reserves',
  closed: 'Closed',
  aaaPayments: 'AAA Payments',
  worksheet: 'Worksheet',
  clients: 'Clients',
  clientInsurance: 'Client Insurance',
  userActivity: 'User Activity',
  users: 'Users',
  admin: 'Admin',
};

/** Default tabs for newly invited members. */
export const DEFAULT_MEMBER_ALLOWED_PAGES: PageId[] = [...ASSIGNABLE_PAGE_IDS];

const ASSIGNABLE_SET = new Set<PageId>(ASSIGNABLE_PAGE_IDS);

/** Parse and validate stored allowed_pages from DB. */
export function normalizeAllowedPages(raw: unknown): PageId[] {
  if (raw == null) return [...DEFAULT_MEMBER_ALLOWED_PAGES];
  if (!Array.isArray(raw)) return [...DEFAULT_MEMBER_ALLOWED_PAGES];
  const pages = raw
    .filter((p): p is PageId => typeof p === 'string' && ASSIGNABLE_SET.has(p as PageId))
    .map((p) => p as PageId);
  return pages.length > 0 ? pages : [...DEFAULT_MEMBER_ALLOWED_PAGES];
}

/** Whether the current user may open this page. */
export function canAccessPage(
  page: PageId,
  options: {
    isOwner: boolean;
    showAdmin: boolean;
    allowedPages: PageId[] | null;
  }
): boolean {
  const { isOwner, showAdmin, allowedPages } = options;
  if (page === 'admin') return showAdmin;
  if (isOwner) return true;
  if (page === 'users' || page === 'userActivity') return false;
  if (!allowedPages) return false;
  return allowedPages.includes(page);
}

/** First page the user is allowed to open (fallback redirect). */
export function getDefaultPageForUser(options: {
  isOwner: boolean;
  showAdmin: boolean;
  allowedPages: PageId[] | null;
}): PageId {
  if (options.isOwner) return 'overview';
  const pages = options.allowedPages ?? [];
  return pages[0] ?? 'overview';
}

/** Filter assignable pages to a valid subset for saving. */
export function sanitizeAllowedPages(pages: PageId[]): PageId[] {
  const set = new Set(pages.filter((p) => ASSIGNABLE_SET.has(p)));
  return ASSIGNABLE_PAGE_IDS.filter((p) => set.has(p));
}
