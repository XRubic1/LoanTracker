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
      className={`bg-card border rounded-2xl p-5 border-border ${accent ? 'border-accent/30' : ''}`}
    >
      <div className="text-[11px] text-muted uppercase tracking-widest mb-2.5">{label}</div>
      <div className={`text-[26px] font-semibold font-mono ${valueClassName ?? ''}`}>{value}</div>
      <div className="text-[11px] text-muted2 mt-1.5">{sub}</div>
    </div>
  );
}
