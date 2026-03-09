/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans KR', 'system-ui', 'sans-serif'],
      },
      colors: {
        notion: {
          yellow:  { col: '#fef9ec', pill: '#fef3c7', text: '#92400e', dot: '#d97706' },
          pink:    { col: '#fdf2f0', pill: '#fce7e4', text: '#9b2c2c', dot: '#e05252' },
          green:   { col: '#f0faf5', pill: '#d1fae5', text: '#166534', dot: '#22c55e' },
          blue:    { col: '#eff6ff', pill: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
          purple:  { col: '#f5f3ff', pill: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
          orange:  { col: '#fff7ed', pill: '#fed7aa', text: '#9a3412', dot: '#f97316' },
          teal:    { col: '#f0fdfa', pill: '#ccfbf1', text: '#134e4a', dot: '#14b8a6' },
          red:     { col: '#fff5f5', pill: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
        }
      }
    }
  },
  plugins: [],
}
