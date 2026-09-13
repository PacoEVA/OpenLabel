/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        workspace: {
          bg: '#18181b',
          canvas: '#27272a',
          grid: '#3f3f46',
        },
        panel: {
          bg: '#202023',
          border: '#2e2e32',
          header: '#1a1a1c',
        },
        accent: {
          blue: '#2563eb',
          hover: '#1d4ed8',
        },
      },
      fontSize: {
        '2xs': '0.65rem',
      },
    },
  },
  plugins: [],
};
