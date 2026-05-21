/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'auth-switch': {
          '0%': { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'auth-switch': 'auth-switch 0.3s ease-out forwards',
      },
      colors: {
        page: 'var(--color-page)',
        nav: 'var(--color-nav)',
        surface: 'var(--color-surface)',
        panel: 'var(--color-panel)',
        border: 'var(--color-border)',
        ink: 'var(--color-ink)',
        label: 'var(--color-label)',
        muted: 'var(--color-muted)',
        muted2: 'var(--color-muted2)',
        amber: 'var(--color-amber)',
        reserve: 'var(--color-reserve)',
        accent: 'var(--color-accent)',
        accent2: 'var(--color-accent2)',
        green: 'var(--color-green)',
        red: 'var(--color-red)',
        yellow: 'var(--color-yellow)',
        'alert-warn': 'var(--color-alert-warn-bg)',
        'alert-warn-fg': 'var(--color-alert-warn-fg)',
        'alert-info': 'var(--color-alert-info-bg)',
        'alert-info-fg': 'var(--color-alert-info-fg)',
        'tag-due': 'var(--tag-due-bg)',
        'tag-due-fg': 'var(--tag-due-fg)',
        'tag-overdue': 'var(--tag-overdue-bg)',
        'tag-overdue-fg': 'var(--tag-overdue-fg)',
        'tag-ok': 'var(--tag-ok-bg)',
        'tag-ok-fg': 'var(--tag-ok-fg)',
      },
      fontSize: {
        xs: ['0.6875rem', { lineHeight: '1.25' }],
        sm: ['0.75rem', { lineHeight: '1.35' }],
        base: ['0.8125rem', { lineHeight: '1.45' }],
        lg: ['0.9375rem', { lineHeight: '1.4' }],
        xl: ['1.125rem', { lineHeight: '1.3' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
