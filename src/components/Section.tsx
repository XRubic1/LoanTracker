interface SectionProps {
  title?: string;
  count?: number | string;
  children: React.ReactNode;
  /** Remove default p-3.5 padding from content area (use when children manage their own padding). */
  noPadding?: boolean;
}

export function Section({ title, count, children, noPadding }: SectionProps) {
  return (
    <div className="panel-surface">
      {(title != null || count != null) && (
        <div className="flex items-center justify-between px-4 py-[11px] border-b border-border">
          {title != null && (
            <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
              {title}
            </span>
          )}
          {count !== undefined && (
            <span className="count-badge">{count}</span>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-3.5'}>
        {children}
      </div>
    </div>
  );
}
