/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Public Sans"', 'system-ui', 'Segoe UI', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#17212b', soft: '#4a5663', faint: '#7b8794' },
        board: '#20344f', // dark blue of the sidebar, like a school blackboard
        paper: '#f3f5f8',
        safe: { DEFAULT: '#1c7a4b', bg: '#e1f3e8' },
        warn: { DEFAULT: '#9a5b00', bg: '#fdefd0' },
        crit: { DEFAULT: '#b3261e', bg: '#fde6e3' },
      },
    },
  },
  plugins: [],
};
