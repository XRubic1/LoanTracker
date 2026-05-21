import type { PageId } from '@/types';
import { BrandLogo, BrandWordmark } from '@/components/BrandLogo';
import { NotificationsToggle } from '@/components/NotificationsToggle';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SidebarProps {
  page: PageId;
  onPage: (page: PageId) => void;
  onSignOut?: () => void;
  weekRange?: string;
  showNotificationsToggle?: boolean;
  notificationsHidden?: boolean;
  onToggleNotificationsHidden?: () => void;
}

const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview',
    label: 'Overview',
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
    id: 'loans',
    label: 'Loans',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    id: 'reserves',
    label: 'Reserves',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" />
      </svg>
    ),
  },
  {
    id: 'closed',
    label: 'Closed',
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
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    id: 'clientInsurance',
    label: 'Client Insurance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

export function Sidebar({
  page,
  onPage,
  onSignOut,
  weekRange,
  showNotificationsToggle,
  notificationsHidden = false,
  onToggleNotificationsHidden,
}: SidebarProps) {
  return (
    <nav className="topbar flex-shrink-0 z-10 flex items-center h-12 px-6 overflow-x-auto gap-0">
      {/* Brand */}
      <div className="flex items-center gap-1.5 mr-8 flex-shrink-0">
        <BrandLogo size="xs" />
        <BrandWordmark className="hidden sm:inline text-[13px] font-medium text-ink" />
      </div>

      {/* Nav items — active item shows a bottom underline */}
      <div className="flex items-center flex-1 min-w-0 h-full">
        {navItems.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPage(id)}
            className={`h-full flex items-center gap-[5px] px-[14px] text-[12px] whitespace-nowrap transition-colors border-b-2 ${
              page === id
                ? 'text-ink font-medium border-ink'
                : 'text-muted font-normal border-transparent hover:text-ink'
            }`}
          >
            <span className="w-[14px] h-[14px] flex-shrink-0 [&>svg]:w-[14px] [&>svg]:h-[14px]">
              {icon}
            </span>
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Right side: theme, week range, sign out */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {showNotificationsToggle && onToggleNotificationsHidden && (
          <NotificationsToggle
            hidden={notificationsHidden}
            onToggle={onToggleNotificationsHidden}
          />
        )}
        <ThemeToggle />
        {weekRange && (
          <span className="date-badge">{weekRange}</span>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="flex-shrink-0 flex items-center gap-[5px] text-[12px] text-muted hover:text-red transition-colors"
          >
            <svg
              className="w-[14px] h-[14px] flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden md:inline">Sign out</span>
          </button>
        )}
      </div>
    </nav>
  );
}
