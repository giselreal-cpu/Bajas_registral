import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // "brand" = paleta "Classical" (Claude Design), rampa neutra
        // sepia: estructura, header, texto de énfasis, links. Los mismos
        // valores que ya usan las vistas mobile (--mv-neutral-*).
        brand: {
          50: "#f8f4f4",
          100: "#eae7e7",
          200: "#d7d3d3",
          300: "#bab6b6",
          400: "#9b9797",
          500: "#7d7979",
          600: "#605d5d",
          700: "#444141",
          800: "#2d2b2b",
          900: "#201f1d"
        },
        // "silver": fondos y bordes sutiles — Classical no distingue una
        // familia fría aparte, comparte la misma rampa neutra que brand,
        // tomando los pasos más claros.
        silver: {
          50: "#f8f4f4",
          100: "#eae7e7",
          200: "#d7d3d3",
          300: "#bab6b6",
          400: "#9b9797",
          500: "#7d7979"
        },
        // "accent" = cobre de Classical: color de contraste para acciones
        // principales. accent-600 es el acento "plano" (#b68235), el
        // mismo que ya usa --mv-accent en mobile — es la clase que arma
        // todos los botones primarios (.btn-primary → bg-accent-600).
        accent: {
          50: "#fff3e4",
          100: "#ffe3bf",
          200: "#facb8d",
          300: "#e1ad66",
          400: "#c28d41",
          500: "#c28d41",
          600: "#b68235",
          700: "#7d5411"
        }
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-body)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
