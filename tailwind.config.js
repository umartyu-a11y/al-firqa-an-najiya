/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F2F6FA',
        card: '#FFFFFF',
        text: '#111820',
        muted: '#697481',
        accent: '#B8874A',
        darkbg: '#000000',
        darkcard: '#101010',
        darktext: '#F5F5F5',
        darkmuted: '#969696',
        darkaccent: '#E0821E'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Fraunces', 'serif'],
        arabic: ['Amiri', 'serif']
      }
    }
  },
  plugins: []
};
