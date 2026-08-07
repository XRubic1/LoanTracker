type BadgeVariant = 'due' | 'overdue' | 'ok' | 'closed' | 'hidden';

const variantClass: Record<BadgeVariant, string> = {
  due: 'tag-due',
  overdue: 'tag-overdue',
  ok: 'tag-ok',
  closed: 'tag-closed',
  hidden: 'tag-hidden',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={variantClass[variant]}>{children}</span>;
}
