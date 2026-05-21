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
        /* Neutral dark gray theme */
        page: '#121214',
        nav: '#0e0e10',
        surface: '#18181b',
        panel: '#1c1c1f',
        border: '#2e2e32',
        ink: '#e4e4e7',
        label: '#71717a',
        muted: '#a1a1aa',
        muted2: '#a1a1aa',
        /* Warm highlights for installment / payment amounts */
        amber: '#d4842a',
        reserve: '#c87820',
        accent: '#60a5fa',
        accent2: '#a78bfa',
        green: '#4ade80',
        red: '#f87171',
        yellow: '#d4940a',
        /* Alert banners */
        'alert-warn': '#27272a',
        'alert-warn-fg': '#fca5a5',
        'alert-info': '#1e293b',
        'alert-info-fg': '#93c5fd',
        /* Status tags */
        'tag-due': 'rgba(96, 165, 250, 0.2)',
        'tag-due-fg': '#93c5fd',
        'tag-overdue': 'rgba(248, 113, 113, 0.18)',
        'tag-overdue-fg': '#fca5a5',
        'tag-ok': 'rgba(74, 222, 128, 0.15)',
        'tag-ok-fg': '#86efac',
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
