/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d0f14',
        surface: '#13161d',
        card: '#1a1e28',
        border: '#252a38',
        accent: '#4f8ef7',
        accent2: '#7c5cfc',
        green: '#2ecc8f',
        red: '#f75f5f',
        yellow: '#f7c34f',
        muted: '#5c6380',
        muted2: '#8890aa',
        text: '#e8eaf0',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
