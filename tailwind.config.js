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
        /* Semantic surfaces — loan_tracker_redesign.html (hex for reliable Tailwind utilities) */
        page: '#F2F0EB',
        surface: '#EAE8E3',
        panel: '#FFFFFF',
        border: '#D8D3CC',
        ink: '#1A1C22',
        muted: '#6E6B63',
        muted2: '#9A9690',
        /* Accents */
        accent: '#185FA5',
        accent2: '#534AB7',
        green: '#3B6D11',
        red: '#A32D2D',
        yellow: '#BA7517',
        /* Alert banners */
        'alert-warn': '#FAEEDA',
        'alert-warn-fg': '#633806',
        'alert-info': '#E6F1FB',
        'alert-info-fg': '#042C53',
        /* Status tags */
        'tag-due': '#E6F1FB',
        'tag-due-fg': '#185FA5',
        'tag-overdue': '#FCEBEB',
        'tag-overdue-fg': '#A32D2D',
        'tag-ok': '#EAF3DE',
        'tag-ok-fg': '#3B6D11',
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
