/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          50: "var(--surface-50)",
          100: "var(--surface-100)",
          200: "var(--surface-200)",
          300: "var(--surface-300)",
          400: "var(--surface-400)",
        },
        card: "var(--card)",
        ink: {
          DEFAULT: "var(--ink)",
          light: "var(--ink-light)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
          dark: "var(--accent-dark)",
          glow: "var(--accent-glow)",
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "#fca5a5",
          bg: "var(--danger-bg)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fcd34d",
          bg: "var(--warning-bg)",
        },
        success: {
          DEFAULT: "#10b981",
          light: "#6ee7b7",
          bg: "var(--success-bg)",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        raised: "var(--shadow-raised)",
        inset: "var(--shadow-inset)",
        btn: "var(--shadow-btn)",
        "btn-hover": "var(--shadow-btn-hover)",
        "btn-active": "var(--shadow-btn-active)",
        glow: "0 0 20px var(--accent-glow), 0 0 40px var(--accent-glow)",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "'Avenir Next'", "'Segoe UI'", "sans-serif"],
        mono: ["'JetBrains Mono'", "'SFMono-Regular'", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};
