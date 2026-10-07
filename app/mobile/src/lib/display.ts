/**
 * Formatação de datas e tamanhos recebidos da API nas telas do cliente.
 * Centraliza valores ausentes sem inventar datas ou métricas.
 * Consumidores: cartões, detalhes e carrossel de evidências do mobile.
 */
export function displayDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}) });
}
export function displayBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
