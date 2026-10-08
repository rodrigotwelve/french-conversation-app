import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          canvas: '#FFFFFF',
          surface: '#F8F9FA',
          border: '#e2e8f0',
          cta: '#18181B',
          textPrimary: '#09090B',
          textMuted: '#71717A',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#e11d48',
          tooltipBg: '#0f172a',
          tooltipText: '#f8fafc',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      }
    },
  },
  plugins: [],
}

export default config
