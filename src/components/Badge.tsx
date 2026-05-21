type BadgeVariant = 'due' | 'overdue' | 'ok' | 'closed';

const variantClass: Record<BadgeVariant, string> = {
  due: 'tag-due',
  overdue: 'tag-overdue',
  ok: 'tag-ok',
  closed: 'tag-closed',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={variantClass[variant]}>{children}</span>;
}
