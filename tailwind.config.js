/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        planka: {
          bg: '#22252a',
          'bg-light': '#2a2e33',
          card: '#373b40',
          accent: '#2185d0',
          'accent-hover': '#1e70bf',
          text: '#e8e9ea',
          'text-muted': '#9ca3af',
          error: '#9f3a38',
          success: '#21ba45',
          warning: '#fbbd08',
          selected: '#216ba5',
        }
      },
      fontFamily: {
        sans: ['Nunito', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'planka': '3px',
        'planka-lg': '5px',
      },
    },
  },
  plugins: [],
}

