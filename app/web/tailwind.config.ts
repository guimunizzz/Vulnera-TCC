import type { Config } from "tailwindcss";

// Paleta dark do Vulnera. Severidade fica pronta aqui desde já porque as
// telas de Vulnerability (Fase 4+) vão precisar, e é mais barato definir o
// token agora do que caçar todo mundo depois.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#141414",
        border: "#262626",
        foreground: "#fafafa",
        muted: "#a3a3a3",
        accent: {
          DEFAULT: "#10b981",
          foreground: "#052e1f",
        },
        severity: {
          critical: "#dc2626",
          high: "#f97316",
          medium: "#eab308",
          low: "#3b82f6",
          info: "#6b7280",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
