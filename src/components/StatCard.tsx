interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub: string;
  accent?: boolean;
  valueClassName?: string;
}

export function StatCard({ label, value, sub, accent, valueClassName }: StatCardProps) {
  return (
    <div
      className={`panel-surface px-4 py-[14px] ${accent ? 'border-accent/30' : ''}`}
    >
      <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-[5px]">{label}</div>
      <div className={`text-[20px] font-medium leading-none ${valueClassName ?? 'text-ink'}`}>{value}</div>
      <div className="text-[10px] text-muted mt-1">{sub}</div>
    </div>
  );
}
