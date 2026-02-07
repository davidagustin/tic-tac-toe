/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Custom game theme colors
        bg: {
          primary: '#0a0a0a',
          secondary: '#141414',
          card: '#1a1a1a',
        },
        accent: {
          x: '#3b82f6',        // Blue for X
          o: '#f43f5e',        // Rose for O
          primary: '#8b5cf6',  // Purple for buttons/highlights
        },
        text: {
          primary: '#f5f5f5',
          secondary: '#a3a3a3',
          muted: '#525252',
        },
      },
    },
  },
  plugins: [],
};
