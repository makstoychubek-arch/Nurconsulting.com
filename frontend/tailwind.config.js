/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: { DEFAULT: '#0a0a0c', cell: '#111114', border: '#2a2a30' },
        sand: { DEFAULT: '#c4a882', muted: '#8a8884' },
        cocoa: { DEFAULT: '#6b5344', soft: 'rgba(107,83,68,0.22)' },
      },
    },
  },
  plugins: [],
};
