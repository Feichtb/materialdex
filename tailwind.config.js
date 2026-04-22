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
          primary:   '#8B5830',  // amber — CTAs, labels (was blue)
          secondary: '#3A6B28',  // eco green
          dark:      '#F0EDE7',  // alt parchment bg (was #1e1e1e)
          darker:    '#F7F5F0',  // main parchment bg (was #1e1e1e)
          panel:     '#FDFCFA',  // card / panel bg (was #252526)
          border:    '#DDD8CF',  // warm rule (was #3e3e42)
          text:      '#1A1814',  // dark ink (was #cccccc)
          accent:    '#D4915E',  // warm terracotta — decorative (was #569cd6)
          success:   '#3A6B28',  // eco green — saved/verified (was #4ec9b0)
          warning:   '#D4915E',  // amber warning (was #dcdcaa)
          error:     '#B83020',  // warm red (was #f48771)
        }
      },
      fontFamily: {
        serif: ['Georgia', '"Times New Roman"', 'serif'],
        mono:  ['"Courier New"', 'Courier', 'monospace'],
        segoe: ['"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

