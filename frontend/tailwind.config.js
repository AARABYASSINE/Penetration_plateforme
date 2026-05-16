/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        surface: '#111827',
        'surface-2': '#1a2234',
        border: '#1f2d3d',
        primary: '#00ff9d',
        'primary-dim': '#00cc7d',
        accent: '#0066ff',
        danger: '#ff3366',
        warn: '#ffaa00',
        info: '#00aaff',
        muted: '#4a5568',
        text: '#c8d6e5',
        'text-dim': '#6b7a8d',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(0,255,157,0.2)',
        'glow-danger': '0 0 20px rgba(255,51,102,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan-line': 'scanline 2s linear infinite',
        'blink': 'blink 1.2s step-end infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        blink: {
          '0%,100%': { opacity: 1 },
          '50%': { opacity: 0 },
        }
      }
    }
  },
  plugins: []
}
