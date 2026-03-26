/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0A0E1A',
          surface: '#111827',
          raised: '#1C2333',
        },
        border: {
          subtle: '#1E2D45',
          visible: '#2A3F5F',
        },
        cyan: {
          aura: '#00D4FF',
        },
        alert: {
          red: '#FF4757',
          amber: '#FFA502',
          green: '#2ED573',
        },
        text: {
          primary: '#E8EAF0',
          muted: '#8892A4',
          disabled: '#4A5568',
        },
      },
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        badge: '6px',
        card: '10px',
        panel: '14px',
      },
    },
  },
  plugins: [],
}
