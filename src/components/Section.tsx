interface SectionProps {
  title?: string;
  count?: number | string;
  children: React.ReactNode;
}

export function Section({ title, count, children }: SectionProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-[22px]">
      {(title != null || count != null) && (
      <div className="flex items-center justify-between mb-4">
        {title != null && (
        <span className="text-[13px] font-semibold text-muted2 uppercase tracking-wider">
          {title}
        </span>
        )}
        {count !== undefined && (
          <span className="text-[11px] bg-border py-0.5 px-2.5 rounded-full text-muted2">
            {count}
          </span>
        )}
      </div>
      )}
      {children}
    </div>
  );
}
