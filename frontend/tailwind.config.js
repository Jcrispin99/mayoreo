/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF4D4D',
          pressed: '#E63E3E',
          dark: '#B4232D',
          soft: '#FFE5E5',
        },
        accent: {
          DEFAULT: '#2DD4BF',
          pressed: '#22B8A6',
          dark: '#0F766E',
          soft: '#D9F8F3',
        },
        smoke: '#F3F6F5',
        ink: '#172423',
      },
    },
  },
  plugins: [],
};
