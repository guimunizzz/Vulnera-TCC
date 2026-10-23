/**
 * tema.ts
 *
 * Identidade visual da planilha: UMA fonte (Calibri — existe no Excel e tem
 * equivalente métrico, Carlito, no LibreOffice) e uma paleta curta. Cores em
 * ARGB do ExcelJS (`FF` + RGB) e em RGB puro para o XML dos gráficos.
 *
 * Severidade usa cores semânticas fixas (spec): Crítica = vermelho escuro,
 * Alta = laranja, Média = amarelo, Baixa = verde, Informativa = azul/cinza.
 */

export const FONTE = "Calibri";

export const COR = {
  marinho: "1F3A5F", // cabeçalhos, títulos
  marinhoClaro: "E8EEF6", // fundo de cards e rótulos
  texto: "1F2937",
  textoSuave: "6B7280",
  borda: "C9D3E0",
  zebra: "F4F7FB",
  entrada: "FFF9E1", // células EDITÁVEIS (Acompanhamento) — amarelo claro
  calculada: "EDF1F7", // células CALCULADAS (protegidas)
  branco: "FFFFFF",
} as const;

/** Fundo + texto de cada valor semântico, para a formatação condicional. */
export const COR_SEVERIDADE: Record<string, { fundo: string; texto: string }> = {
  Crítica: { fundo: "9B1C1C", texto: "FFFFFF" },
  Alta: { fundo: "F28C28", texto: "1F2937" },
  Média: { fundo: "FFE066", texto: "1F2937" },
  Baixa: { fundo: "7BC67B", texto: "1F2937" },
  Informativa: { fundo: "9DB4D0", texto: "1F2937" },
};

export const COR_STATUS: Record<string, { fundo: string; texto: string }> = {
  Aberto: { fundo: "FDE7E7", texto: "9B1C1C" },
  "Em andamento": { fundo: "FFF1CC", texto: "7A4F00" },
  Corrigido: { fundo: "DCEBFA", texto: "0D47A1" },
  Fechado: { fundo: "DDF1E3", texto: "1B5E20" },
};

export const COR_SLA: Record<string, { fundo: string; texto: string }> = {
  Vencido: { fundo: "FDE7E7", texto: "9B1C1C" },
  Vencendo: { fundo: "FFF1CC", texto: "7A4F00" },
  "No prazo": { fundo: "DDF1E3", texto: "1B5E20" },
  "Sem prazo": { fundo: "ECEFF3", texto: "4B5563" },
  "Sem SLA": { fundo: "ECEFF3", texto: "4B5563" },
  "Risco aceito": { fundo: "E9E3F7", texto: "4C2A85" },
  "Resolvido no prazo": { fundo: "DDF1E3", texto: "1B5E20" },
  "Resolvido fora do prazo": { fundo: "FDE7E7", texto: "9B1C1C" },
  "Resolvido s/ data": { fundo: "ECEFF3", texto: "4B5563" },
};

/** Cores de cada ponto do gráfico de severidade — as mesmas da formatação condicional. */
export const COR_GRAFICO_SEVERIDADE = ["9B1C1C", "F28C28", "FFE066", "7BC67B", "9DB4D0"] as const;
export const COR_GRAFICO_STATUS = ["D9534F", "F0AD4E", "4A90D9", "5CB85C"] as const;
export const COR_GRAFICO_PADRAO = COR.marinho;
