/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        headline: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#5048e5',
          50: '#eef0fd',
          100: '#d9dcfa',
          200: '#b6baf5',
          300: '#8e91ed',
          400: '#6b6ce3',
          500: '#5048e5',
          600: '#4338ca',
          700: '#3730a3',
          800: '#312e81',
          900: '#2e2a5c',
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 2s infinite',
        'bounce-delay-1': 'bounce 1s infinite 0.2s',
        'bounce-delay-2': 'bounce 1s infinite 0.4s',
      },
      keyframes: {
        'pulse-slow': {
          '0%': { boxShadow: '0 0 0 0 rgba(80, 72, 229, 0.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(80, 72, 229, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(80, 72, 229, 0)' },
        },
      },
    },
  },
  plugins: [],
}
