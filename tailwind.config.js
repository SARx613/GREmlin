/** @type {import('tailwindcss').Config} */
// Les couleurs « thémées » lisent des variables CSS (voir src/index.css) : clair, sombre ou automatique.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'] },
      colors: {
        green: { DEFAULT: '#58CC02', dark: '#58A700', light: 'var(--green-light)', ink: 'var(--green-ink)' },
        red: { DEFAULT: '#FF4B4B', dark: '#EA2B2B', light: 'var(--red-light)', ink: 'var(--red-ink)' },
        blue: { DEFAULT: '#1CB0F6', dark: '#1899D6', light: 'var(--blue-light)', ink: 'var(--blue-ink)' },
        orange: { DEFAULT: '#FF9600', dark: '#E08600', ink: 'var(--orange-ink)' },
        deep: '#12260A', // texte foncé sur les boutons aux couleurs vives (contraste ≥ 5:1)
        surface: 'var(--surface)',
        soft: 'var(--soft)',
        tip: 'var(--tip)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        dborder: 'var(--dborder)',
        dtext: 'var(--dtext)',
      },
      borderRadius: { xl2: '16px' },
    },
  },
  plugins: [],
};
