/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        revit: {
          primary: '#0078d4',
          secondary: '#3E8E2A',
          dark: '#1e1e1e',
          darker: '#1e1e1e',
          panel: '#252526',
          border: '#3e3e42',
          text: '#cccccc',
          accent: '#569cd6',
          success: '#4ec9b0',
          warning: '#dcdcaa',
          error: '#f48771',
        }
      },
      fontFamily: {
        'segoe': ['"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

