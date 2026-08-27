import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        idr: {
          bg: "#0B0E17",
          card: "#141A29",
          border: "#232B41",
          text: "#FFFFFF",
          "text-muted": "#FFFFFF",
          estadual: "#22C55E",
          municipal: "#EF4444",
          particular: "#F5A623",
        },
      },
    },
  },
  plugins: [],
};

export default config;
