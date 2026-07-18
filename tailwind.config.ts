import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef3f8",
          100: "#d9e5f0",
          200: "#b3c9df",
          300: "#89abc9",
          400: "#5c86ac",
          500: "#2c5679",
          600: "#204768",
          700: "#183a56",
          800: "#122c42",
          900: "#0c1e2d"
        },
        accent: {
          50: "#eafbf3",
          100: "#c9f3de",
          200: "#94e6bd",
          300: "#5cd39c",
          400: "#2fbd82",
          500: "#1fa971",
          600: "#178a5c",
          700: "#116d48"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "var(--font-inter)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
