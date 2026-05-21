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
        /* Screenshot palette — warm near-black dashboard */
        page: '#0f0e0b',
        nav: '#111009',
        surface: '#151412',
        panel: '#1a1916',
        border: '#2a2620',
        ink: '#e8e4da',
        label: '#5a5248',
        muted: '#6b6456',
        muted2: '#6b6456',
        /* Accents */
        amber: '#d4842a',
        reserve: '#c87820',
        accent: '#4a7fd4',
        accent2: '#c87820',
        green: '#5a9a58',
        red: '#ff6060',
        yellow: '#d4842a',
        /* Alert banners */
        'alert-warn': '#3a2a08',
        'alert-warn-fg': '#d4842a',
        'alert-info': '#1a3a6b',
        'alert-info-fg': '#4a7fd4',
        /* Status tags */
        'tag-due': '#7a5010',
        'tag-due-fg': '#d4940a',
        'tag-overdue': '#8b2020',
        'tag-overdue-fg': '#ff6060',
        'tag-ok': '#3a4a2a',
        'tag-ok-fg': '#6a9a62',
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
