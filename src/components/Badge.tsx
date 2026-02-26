type BadgeVariant = 'due' | 'overdue' | 'ok' | 'closed';

const variantClass: Record<BadgeVariant, string> = {
  due: 'bg-yellow/10 text-yellow',
  overdue: 'bg-red/10 text-red',
  ok: 'bg-green/10 text-green',
  closed: 'bg-muted2/10 text-muted2',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center py-0.5 px-2 rounded-full text-[10px] font-semibold tracking-wide ${variantClass[variant]}`}
    >
      {children}
    </span>
  );
}
