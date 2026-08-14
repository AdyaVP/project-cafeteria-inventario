import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0C0C0F',
          surface: '#13131A',
          elevated: '#1C1C26',
          overlay: '#22222F',
        },
        border: {
          subtle: '#1E1E2A',
          DEFAULT: '#2A2A3A',
          default: '#2A2A3A',
          strong: '#3D3D52',
        },
        accent: { DEFAULT: '#C8733A', hover: '#B05E28', subtle: '#C8733A18' },
        text: { primary: '#EEEEF0', secondary: '#9090A0', disabled: '#4A4A5A' },
        state: {
          success: '#34C97A',
          warning: '#E8A020',
          error: '#E04545',
          info: '#4A90D9',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
