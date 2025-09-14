/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,html,css}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6C63FF",
          50: "#f5f5ff",
          100: "#ebebff",
          200: "#d6d4ff",
          300: "#c1bcff",
          400: "#9d95ff",
          500: "#6C63FF",
          600: "#5a52e6",
          700: "#4a43bf",
          800: "#3a3499",
          900: "#2b2773",
        },
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(17, 24, 39, 0.08)",
        glass: "0 4px 24px -2px rgba(0,0,0,0.25)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.95)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        'spin-slow': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in .4s ease-out',
        'scale-in': 'scale-in .35s cubic-bezier(.4,.2,.2,1)',
        'spin-slow': 'spin-slow 6s linear infinite',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          ...require('daisyui/src/theming/themes')['light'],
          primary: '#6366F1',
          secondary: '#A855F7',
          accent: '#0EA5E9',
          neutral: '#1E293B',
          'base-100': '#FFFFFF',
        },
      },
      {
        dark: {
          ...require('daisyui/src/theming/themes')['dark'],
          primary: '#818CF8',
          secondary: '#C084FC',
          accent: '#38BDF8',
          neutral: '#1E293B',
          'base-100': '#0F172A',
        },
      },
    ],
    darkTheme: 'dark',
    logs: false,
  },
};
