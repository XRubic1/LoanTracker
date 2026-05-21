interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeStyles = {
  xs: { box: 'w-7 h-7', icon: 'w-6 h-6' },
  sm: { box: 'w-8 h-8', icon: 'w-7 h-7' },
  md: { box: 'w-10 h-10', icon: 'w-9 h-9' },
} as const;

/** Loan Tracker mark — minimal ascending trend (no node dots). */
export function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  const { box, icon } = sizeStyles[size];

  return (
    <div className={`${box} shrink-0 flex items-center justify-center ${className}`} aria-hidden>
      <svg className={icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4 19.5h16"
          className="text-muted2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M5.5 17.25 9.75 13.25 13.25 15.5 18.5 8.75"
          className="text-accent"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
