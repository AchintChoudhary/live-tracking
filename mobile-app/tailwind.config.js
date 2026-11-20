/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0866E8',
          dark: '#064FB5',
          light: '#3B82F6'
        },
        success: '#16A34A',
        danger: '#DC2626',
        background: '#FFFFFF',
        card: '#F8FAFC',
        textPrimary: '#172033',
        textSecondary: '#64748B',
        borderColor: '#E2E8F0',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
};
