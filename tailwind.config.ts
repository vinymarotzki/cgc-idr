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
      keyframes: {
        "signal-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.06)" },
        },
        "signal-wave": {
          "0%": { opacity: "0.25" },
          "20%": { opacity: "1" },
          "55%": { opacity: "0.25" },
          "100%": { opacity: "0.25" },
        },
      },
      animation: {
        "signal-dot": "signal-dot 1.8s ease-in-out infinite",
        "signal-wave": "signal-wave 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
