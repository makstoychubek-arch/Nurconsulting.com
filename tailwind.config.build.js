/** @type {import('tailwindcss').Config} */
// Билд-конфиг для статических страниц (dashboard.html/index.html/login.html).
// Раньше Tailwind подключался через cdn.tailwindcss.com и компилировался
// прямо в браузере пользователя при каждой загрузке страницы — теперь
// собирается один раз на этапе билда (см. scripts/build-assets.js).
// content включает и .js-файлы, потому что часть utility-классов
// генерируется динамически в шаблонных строках (wb-clusters.js и т.п.),
// а не только напрямую в HTML.
module.exports = {
  content: [
    './index.html',
    './login.html',
    './dashboard.html',
    './dashboard-charts.js',
    './rnp-module.js',
    './wb-formulas.js',
    './wb-clusters.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          dark: '#030303',
          navy: '#070B19',
          purple: '#6D28D9',
          accent: '#A78BFA',
        },
      },
    },
  },
  plugins: [],
};
