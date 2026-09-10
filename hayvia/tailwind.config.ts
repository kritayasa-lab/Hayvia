import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FBFAF6",
        surface: "#FFFFFF",
        ink: "#20241F",
        "ink-soft": "#4B5049",
        "ink-faint": "#7B8078",
        line: "#E4E2D8",
        "line-soft": "#EDEBE2",
        moss: {
          50: "#EEF3EF",
          100: "#D6E3D8",
          300: "#8FB097",
          500: "#3E7A5C",
          600: "#2F6650",
          700: "#265240",
          900: "#16302A",
        },
        clay: {
          100: "#F1E4D6",
          400: "#C88A5C",
          500: "#B97847",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(32, 36, 31, 0.04), 0 2px 12px rgba(32, 36, 31, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
