/** @type {import('tailwindcss').Config} */
export default {
  content: [
  "./index.html", // Looks in your main HTML file
  "./src/**/*.{js,ts,jsx,tsx}", // Looks in all JS/JSX files in your src folder
], // <--- THIS IS EMPTY!
  theme: {
    extend: {},
  },
  plugins: [],
}