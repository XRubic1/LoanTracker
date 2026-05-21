interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeStyles = {
  xs: { box: 'w-7 h-7', icon: 'w-6 h-6' },
  sm: { box: 'w-8 h-8', icon: 'w-7 h-7' },
  md: { box: 'w-10 h-10', icon: 'w-9 h-9' },
} as const;

/** Loan Tracker mark — chart line with installment points (transparent). */
export function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  const { box, icon } = sizeStyles[size];

  return (
    <div className={`${box} shrink-0 flex items-center justify-center ${className}`} aria-hidden>
      <svg className={icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="text-muted2" opacity="0.55">
          <path d="M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="text-accent">
          <path
            d="M5 16l3.5-3.5 3 2.5 5.5-7.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5" cy="16" r="2" fill="currentColor" />
          <circle cx="8.5" cy="12.5" r="2" fill="currentColor" />
          <circle cx="11.5" cy="15" r="2" fill="currentColor" />
          <circle cx="17" cy="7.5" r="2" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}

export function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display font-semibold tracking-tight text-ink whitespace-nowrap ${className}`}
    >
      Loan Tracker
    </span>
  );
}
