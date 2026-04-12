/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14281d',
        moss: '#2d6a4f',
        leaf: '#40916c',
        sand: '#f7f5ef',
        hay: '#f3efe3',
        sunrise: '#f59e0b',
      },
      boxShadow: {
        soft: '0 18px 40px rgba(20, 40, 29, 0.08)',
      },
    },
  },
  plugins: [],
}
