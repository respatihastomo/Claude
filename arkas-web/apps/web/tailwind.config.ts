import type { Config } from 'tailwindcss';

// 10.2 Design token "Nusantara Formal-Elegance": nilai warna sebagai variabel CSS (terang/gelap) di globals.css.
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        primary: v('primary'), 'primary-ink': v('primary-ink'), banper: v('accent-banper'), success: v('success'),
        danger: v('danger'), warning: v('warning'), ink: v('text'), muted: v('text-muted'), line: v('border'),
        surface: v('surface'), canvas: v('surface-muted'),
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: { xs: ['12px', '16px'], sm: ['14px', '20px'], base: ['16px', '24px'], lg: ['20px', '28px'], xl: ['24px', '32px'], '2xl': ['30px', '38px'] },
      borderRadius: { ctl: '8px', card: '12px' },
      boxShadow: { sm: '0 1px 2px rgba(15,23,42,0.06)', lg: '0 12px 32px -4px rgba(15,23,42,0.12)' },
      transitionTimingFunction: { quint: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
export default config;
