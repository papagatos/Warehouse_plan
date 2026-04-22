/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Статусы
        status: {
          waiting:     '#94a3b8',
          postponed:   '#f59e0b',
          accepted:    '#22c55e',
          in_progress: '#3b82f6',
          assembled:   '#8b5cf6',
          shipped:     '#10b981',
        }
      }
    },
  },
  plugins: [],
}
