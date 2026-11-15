/**
 * lib/tour.ts
 *
 * Quem já viu (ou pulou) cada tour guiado (decisão de 2026-11-13): no
 * navegador, por usuário, sem mudar o banco — o mesmo lugar onde já vivem o
 * tema e o menu de acessibilidade. Em outro navegador o tour aparece de novo,
 * uma vez.
 *
 * Se o armazenamento falha (modo privado, cota), guarda em memória: o tour
 * não pode voltar a cada navegação dentro da mesma sessão.
 */

export type ResultadoTour = "concluido" | "pulado";

const emMemoria = new Map<string, ResultadoTour>();

export const chaveDoTour = (tourId: string, userId: string | null | undefined): string => `vulnera:tour:${tourId}:${userId ?? "anonimo"}`;

export function tourJaVisto(tourId: string, userId: string | null | undefined): boolean {
  const chave = chaveDoTour(tourId, userId);
  if (emMemoria.has(chave)) return true;
  try {
    return window.localStorage.getItem(chave) !== null;
  } catch {
    return false;
  }
}

export function marcarTourVisto(tourId: string, userId: string | null | undefined, resultado: ResultadoTour): void {
  const chave = chaveDoTour(tourId, userId);
  emMemoria.set(chave, resultado);
  try {
    window.localStorage.setItem(chave, resultado);
  } catch {
    // fica só em memória nesta sessão
  }
}

/** Só para testes: zera o que ficou em memória entre casos. */
export function limparToursEmMemoria(): void {
  emMemoria.clear();
}
