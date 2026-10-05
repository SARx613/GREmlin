/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'] },
      colors: {
        green: { DEFAULT: '#58CC02', dark: '#58A700', light: '#D7FFB8' },
        red: { DEFAULT: '#FF4B4B', dark: '#EA2B2B', light: '#FFDFE0' },
        blue: { DEFAULT: '#1CB0F6', dark: '#1899D6', light: '#DDF4FF' },
        orange: { DEFAULT: '#FF9600', dark: '#E08600' },
        ink: '#3C3C3C',
        muted: '#777777',
        line: '#E5E5E5',
      },
      borderRadius: { xl2: '16px' },
    },
  },
  plugins: [],
};
