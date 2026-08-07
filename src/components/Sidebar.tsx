import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PageId } from '@/types';
import { canAccessPage } from '@/lib/tabPermissions';
import { BrandLogo, BrandWordmark } from '@/components/BrandLogo';
import { NotificationsToggle } from '@/components/NotificationsToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ReplayTourButton } from '@/components/OnboardingTutorial';
import { ONBOARDING_TUTORIAL_ENABLED } from '@/lib/onboardingTutorial';
import {
  getSuperAdminNavTabs,
  type SuperAdminTab,
} from '@/lib/superAdminTabs';

/** localStorage key used to remember the sidebar collapsed state across sessions. */
const SIDEBAR_COLLAPSED_KEY = 'sidebar:collapsed';

/**
 * Read the persisted collapsed preference.
 * @returns true when the sidebar should start collapsed.
 */
function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

interface SidebarProps {
  page: PageId;
  onPage: (page: PageId) => void;
  onSignOut?: () => void;
  onReplayTour?: () => void;
  weekRange?: string;
  showNotificationsToggle?: boolean;
  notificationsHidden?: boolean;
  onToggleNotificationsHidden?: () => void;
  isOwner?: boolean;
  showAdmin?: boolean;
  /** null when account owner (all tabs except admin gating). */
  memberAllowedPages?: PageId[] | null;
  /** Active Super Admin section (platform admin sidebar). */
  adminTab?: SuperAdminTab;
  /** Switch Super Admin section and open the admin page. */
  onAdminTab?: (tab: SuperAdminTab) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  ownerOnly?: boolean;
  adminOnly?: boolean;
  section: 'platform' | 'workspace' | 'account';
}

const navItems: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'worksheet',
    label: 'Worksheet',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'loans',
    label: 'Loans',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    id: 'reserves',
    label: 'Reserves',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" />
      </svg>
    ),
  },
  {
    id: 'closed',
    label: 'Closed',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: 'aaaPayments',
    label: 'AAA Payments',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    id: 'clients',
    label: 'Clients',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'clientInsurance',
    label: 'Client Insurance',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'api',
    label: 'API',
    section: 'workspace',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    id: 'userActivity',
    label: 'User Activity',
    ownerOnly: true,
    section: 'account',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    ownerOnly: true,
    section: 'account',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

const SECTION_LABELS: Record<NavItem['section'], string> = {
  platform: 'Platform',
  workspace: 'Workspace',
  account: 'Account',
};

const SECTION_ORDER: NavItem['section'][] = ['platform', 'workspace', 'account'];

export function Sidebar({
  page,
  onPage,
  onSignOut,
  onReplayTour,
  weekRange,
  showNotificationsToggle,
  notificationsHidden = false,
  onToggleNotificationsHidden,
  isOwner = false,
  showAdmin = false,
  memberAllowedPages = null,
  adminTab = 'dashboard',
  onAdminTab,
}: SidebarProps) {
  const accessOptions = { isOwner, showAdmin, allowedPages: memberAllowedPages };
  const visibleNav = navItems.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.adminOnly && !showAdmin) return false;
    return canAccessPage(item.id, accessOptions);
  });

  const sections = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      section,
      label: SECTION_LABELS[section],
      items: visibleNav.filter((item) => item.section === section),
    })).filter((s) => s.items.length > 0);
  }, [visibleNav]);

  const superAdminTabs = useMemo(() => getSuperAdminNavTabs(), []);

  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore storage failures (e.g. private mode) */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);

  const handleAdminTab = useCallback(
    (tab: SuperAdminTab) => {
      onAdminTab?.(tab);
      onPage('admin');
    },
    [onAdminTab, onPage]
  );

  /** Platform admins use Super Admin sections as the primary navbar. */
  const useSuperAdminNav = showAdmin && onAdminTab != null;

  return (
    <nav
      className={`sidebar flex-shrink-0 z-10 flex flex-col h-full py-3 transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-[60px] px-2' : 'w-[220px] px-3'
      }`}
      data-tour={useSuperAdminNav ? 'nav-admin' : undefined}
    >
      <div
        className={`flex items-center h-9 mb-3 flex-shrink-0 ${
          collapsed ? 'justify-center' : 'justify-between px-1'
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5 min-w-0">
            <BrandLogo size="xs" />
            <BrandWordmark className="text-[13px] font-medium text-ink truncate" />
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-[var(--color-row-hover)] transition-colors flex-shrink-0"
        >
          <svg
            className={`w-[16px] h-[16px] transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto scrollable">
        {useSuperAdminNav ? (
          <>
            {!collapsed && (
              <div className="px-2.5 pt-1 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-label">
                Super Admin
              </div>
            )}
            {superAdminTabs.map(({ id, label }) => {
              const active = page === 'admin' && adminTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-tour={`nav-admin-${id}`}
                  onClick={() => handleAdminTab(id)}
                  title={collapsed ? label : undefined}
                  className={`relative flex items-center gap-2.5 rounded-md h-9 text-[12px] whitespace-nowrap transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-2.5'
                  } ${
                    active
                      ? 'text-ink font-medium bg-[var(--color-row-hover)]'
                      : 'text-muted font-normal hover:text-ink hover:bg-[var(--color-row-hover)]'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-ink" />
                  )}
                  {!collapsed && <span className="truncate">{label}</span>}
                  {collapsed && (
                    <span className="text-[10px] font-medium uppercase">
                      {label.slice(0, 1)}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          sections.map(({ section, label, items }) => (
            <div key={section} className="flex flex-col gap-0.5">
              {!collapsed && sections.length > 1 && (
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-label">
                  {label}
                </div>
              )}
              {collapsed && sections.length > 1 && section !== sections[0]?.section && (
                <div className="mx-auto w-4 h-px bg-divider my-1" aria-hidden />
              )}
              {items.map(({ id, label: itemLabel, icon }) => (
                <button
                  key={id}
                  type="button"
                  data-tour={`nav-${id}`}
                  onClick={() => onPage(id)}
                  title={collapsed ? itemLabel : undefined}
                  className={`relative flex items-center gap-2.5 rounded-md h-9 text-[12px] whitespace-nowrap transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-2.5'
                  } ${
                    page === id
                      ? 'text-ink font-medium bg-[var(--color-row-hover)]'
                      : 'text-muted font-normal hover:text-ink hover:bg-[var(--color-row-hover)]'
                  }`}
                >
                  {page === id && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-ink" />
                  )}
                  <span className="w-[16px] h-[16px] flex-shrink-0 [&>svg]:w-[16px] [&>svg]:h-[16px]">
                    {icon}
                  </span>
                  {!collapsed && <span className="truncate">{itemLabel}</span>}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div
        className={`flex flex-col gap-2 mt-3 pt-3 flex-shrink-0 border-t border-divider ${
          collapsed ? 'items-center' : ''
        }`}
        data-tour="topbar-tools"
      >
        {ONBOARDING_TUTORIAL_ENABLED && onReplayTour && (
          <ReplayTourButton onReplay={onReplayTour} />
        )}
        {showNotificationsToggle && onToggleNotificationsHidden && !useSuperAdminNav && (
          <NotificationsToggle
            hidden={notificationsHidden}
            onToggle={onToggleNotificationsHidden}
          />
        )}
        <ThemeToggle />
        {weekRange && !collapsed && !useSuperAdminNav && (
          <span className="date-badge">{weekRange}</span>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            title={collapsed ? 'Sign out' : undefined}
            className={`flex items-center gap-2.5 rounded-md h-9 text-[12px] text-muted hover:text-red hover:bg-[var(--color-row-hover)] transition-colors ${
              collapsed ? 'justify-center w-9 px-0' : 'px-2.5'
            }`}
          >
            <svg
              className="w-[16px] h-[16px] flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Sign out</span>}
          </button>
        )}
      </div>
    </nav>
  );
}
