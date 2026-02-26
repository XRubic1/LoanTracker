import type { PageId } from '@/types';

interface SidebarProps {
  page: PageId;
  onPage: (page: PageId) => void;
  onSignOut?: () => void;
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

export function Sidebar({ page, onPage, onSignOut }: SidebarProps) {
  return (
    <nav className="group w-16 hover:w-[200px] bg-surface border-r border-border flex flex-col items-center py-5 gap-1.5 overflow-hidden flex-shrink-0 transition-[width] duration-200 ease-out z-10">
      <div className="w-9 h-9 bg-accent rounded-[10px] flex items-center justify-center mb-4 flex-shrink-0">
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      {navItems.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onPage(id)}
          className={`w-[calc(100%-16px)] flex items-center gap-3 py-2.5 px-3.5 rounded-[10px] transition-colors whitespace-nowrap font-medium text-muted2 hover:bg-card hover:text-text ${
            page === id ? 'bg-accent/10 text-accent' : ''
          }`}
        >
          <span className="w-5 h-5 flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
          <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity">
            {label}
          </span>
        </button>
      ))}
      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="mt-auto w-[calc(100%-16px)] flex items-center gap-3 py-2.5 px-3.5 rounded-[10px] transition-colors whitespace-nowrap font-medium text-muted2 hover:bg-card hover:text-red"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity">
            Sign out
          </span>
        </button>
      )}
    </nav>
  );
}
