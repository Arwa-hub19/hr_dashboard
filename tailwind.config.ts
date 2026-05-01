import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#1a1210",
          900: "#2c1f1a",
          800: "#4a332a",
          700: "#6b4a3d",
          600: "#8b6352",
          500: "#a47e6b",
          400: "#bd9a87",
          300: "#d4b8a8",
          200: "#e8d5c9",
          100: "#f3ebe4",
          50: "#faf6f3",
        },
        accent: {
          gold: "#b8973a",
          "gold-light": "#d4b95c",
          "gold-muted": "#b8973a20",
        },
        surface: {
          primary: "#faf8f5",
          secondary: "#f5f0eb",
          card: "#ffffff",
          dark: "#1a1210",
        },
        quadrant: {
          star: "#2d7a4f",
          "star-bg": "#2d7a4f12",
          growth: "#3565a8",
          "growth-bg": "#3565a812",
          underutil: "#b8860b",
          "underutil-bg": "#b8860b12",
          risk: "#b33a3a",
          "risk-bg": "#b33a3a12",
        },
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
