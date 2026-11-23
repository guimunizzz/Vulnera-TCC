/**
 * features/atmosfera-3d/risco.ts
 *
 * O QUE FAZ
 * Traduz dado real que a tela JÁ carregou num "risco" de 0 a 1 para a
 * atmosfera (mais relevo, mais magenta, mais ping de alerta) e o entrega à
 * cena do layout por um store mínimo.
 *
 * REGRAS
 *   - Nenhuma requisição nova: cada tela publica a partir do que já buscou.
 *   - Tela que não publica fica com o risco neutro (`RISCO_NEUTRO`).
 *   - É decoração: o número exato nunca aparece; só a direção importa
 *     (mais grave → mais intenso; corrigiu → acalma).
 *
 * QUEM PUBLICA
 *   Dashboard ... severidade dos findings do escopo, puxada pelos críticos abertos
 *   Remediação .. severidade do quadro pesada pelo estágio (corrigido pesa pouco)
 *   Threat Intel  CVEs em aberto por severidade, puxadas pelos KEV abertos
 */

import { useEffect, useId } from "react";
import { create } from "zustand";

/** Peso de cada severidade (o mesmo nome das facetas da API). */
const PESO: Record<string, number> = { CRITICAL: 1, HIGH: 0.6, MEDIUM: 0.25, LOW: 0.08 };

const limitar = (valor: number) => Math.min(1, Math.max(0, valor));

/** Peso médio → risco: espalha a faixa usual (0,1–0,5) para a cena reagir de verdade. */
const curva = (pesoMedio: number) => limitar(pesoMedio * 1.6);

/** Pressão de uma contagem que, sozinha, já é alarmante (críticos, KEV). */
const pressao = (quantidade: number, escala: number) => 1 - Math.exp(-quantidade / escala);

/** Peso médio das contagens por severidade; null sem nada contado. */
export function pesoMedio(contagens: Record<string, number> | null | undefined): number | null {
  let total = 0;
  let soma = 0;
  // Decoração não pode quebrar a tela: resposta incompleta vira "sem dado".
  for (const [severidade, quantidade] of Object.entries(contagens ?? {})) {
    total += quantidade;
    soma += (PESO[severidade] ?? 0) * quantidade;
  }
  return total > 0 ? soma / total : null;
}

export function riscoDoDashboard({ porSeveridade, criticosAbertos = 0 }: { porSeveridade?: Record<string, number>; criticosAbertos?: number }): number | null {
  const base = pesoMedio(porSeveridade);
  if (base === null && !criticosAbertos) return null;
  return Math.max(curva(base ?? 0), pressao(criticosAbertos, 6));
}

/** Quanto cada estágio do quadro ainda pesa: corrigido aguardando validação quase não. */
const FATOR_DO_ESTAGIO: Record<string, number> = { OPEN: 1, IN_PROGRESS: 0.6, FIXED: 0.2 };

export function riscoDaRemediacao(itens: Array<{ severityFinal: string; status: string }>): number | null {
  if (itens.length === 0) return null;
  const soma = itens.reduce((total, f) => total + (PESO[f.severityFinal] ?? 0) * (FATOR_DO_ESTAGIO[f.status] ?? 0), 0);
  return curva(soma / itens.length);
}

export function riscoDoThreatIntel({ abertosPorSeveridade, kevAbertos = 0 }: { abertosPorSeveridade?: Record<string, number>; kevAbertos?: number }): number | null {
  const base = pesoMedio(abertosPorSeveridade);
  if (base === null && !kevAbertos) return null;
  return Math.max(curva(base ?? 0), pressao(kevAbertos, 3));
}

interface EstadoDaAtmosfera {
  risco: number | null;
  /** Quem publicou o valor atual: só ele pode limpar. */
  dono: string | null;
  publicar: (dono: string, risco: number | null) => void;
  limpar: (dono: string) => void;
}

export const useAtmosferaStore = create<EstadoDaAtmosfera>((set) => ({
  risco: null,
  dono: null,
  publicar: (dono, risco) => set({ dono, risco }),
  // Na troca de rota a página que sai ainda está montada durante a transição:
  // a desmontagem dela não pode apagar o risco que a página nova já publicou.
  limpar: (dono) => set((estado) => (estado.dono === dono ? { dono: null, risco: null } : estado)),
}));

/** A tela entrega o seu risco enquanto estiver montada. */
export function usePublicarRisco(risco: number | null | undefined): void {
  const dono = useId();
  const publicar = useAtmosferaStore((s) => s.publicar);
  const limpar = useAtmosferaStore((s) => s.limpar);
  useEffect(() => {
    if (risco !== undefined) publicar(dono, risco);
  }, [dono, risco, publicar]);
  useEffect(() => () => limpar(dono), [dono, limpar]);
}
