/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Ajoutez des valeurs par défaut pour éviter les erreurs
      fontSize: {
        DEFAULT: '1rem',
      },
      letterSpacing: {
        DEFAULT: '0em',
      },
    },
  },
  plugins: [],
  // Ne désactivez pas preflight, c'est important pour Tailwind
  // corePlugins: {
  //   preflight: true,
  // },
};
