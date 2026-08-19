import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // "brand" = negro carbón: estructura, header, texto de énfasis, links.
        brand: {
          50: "#f6f7f8",
          100: "#eaeced",
          200: "#d1d5d9",
          300: "#aab0b8",
          400: "#7c848f",
          500: "#565e68",
          600: "#3f454d",
          700: "#2c3138",
          800: "#1c1f24",
          900: "#121417"
        },
        // plateado: fondos y bordes sutiles, tono frío entre blanco y carbón.
        silver: {
          50: "#fbfbfc",
          100: "#f3f4f6",
          200: "#e6e8eb",
          300: "#d3d7db",
          400: "#b7bcc2",
          500: "#9aa0a8"
        },
        // "accent" = cobre: color de contraste para acciones principales.
        accent: {
          50: "#fef6ec",
          100: "#fce8cf",
          200: "#f8cd9b",
          300: "#f3ac66",
          400: "#ec8a3c",
          500: "#dd6f21",
          600: "#b85717",
          700: "#924313"
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
