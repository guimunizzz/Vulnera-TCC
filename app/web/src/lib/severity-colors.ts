/**
 * severity-colors.ts
 *
 * Hex literais da paleta de severidade (tailwind.config.ts). O Tailwind só
 * resolve `bg-severity-critical` etc. dentro de className — bibliotecas que
 * pintam via SVG/canvas (Recharts, aqui; pdf-lib em lib/pdf/base.ts) exigem
 * a cor em hex/rgb direto, então este arquivo é a fonte única pra não
 * duplicar (e divergir) o mesmo valor em três lugares.
 */

export const SEVERITY_HEX: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  NONE: "#6b7280",
};

export const ACCENT_HEX = "#10b981";
