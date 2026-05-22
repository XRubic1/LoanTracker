import { BRAND_NAME } from '@/lib/brand';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeStyles = {
  xs: { wrap: 'w-7 h-7 rounded-lg', icon: 'w-5 h-5' },
  sm: { wrap: 'w-8 h-8 rounded-lg', icon: 'w-6 h-6' },
  md: { wrap: 'w-12 h-12 rounded-xl', icon: 'w-8 h-8' },
} as const;

/**
 * OpsDesk mark — stacked layers (operations desk).
 */
export function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  const { wrap, icon } = sizeStyles[size];
  const showPanel = size === 'md';

  return (
    <div
      className={`${wrap} shrink-0 flex items-center justify-center ${
        showPanel
          ? 'bg-accent/10 border border-accent/25 shadow-sm'
          : 'bg-accent/8 border border-border'
      } ${className}`}
      aria-hidden
    >
      <svg className={icon} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="19" width="20" height="4" rx="2" className="fill-accent opacity-30" />
        <rect x="6" y="13" width="15" height="4" rx="2" className="fill-accent opacity-55" />
        <rect x="6" y="7" width="10" height="4" rx="2" className="fill-accent" />
      </svg>
    </div>
  );
}

export function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display font-semibold tracking-tight whitespace-nowrap ${className}`}
    >
      <span className="text-ink">Ops</span>
      <span className="text-accent">Desk</span>
    </span>
  );
}

/** Full name for document title and accessibility. */
export function brandTitle(page?: string): string {
  return page ? `${page} · ${BRAND_NAME}` : BRAND_NAME;
}
