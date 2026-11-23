/**
 * features/atmosfera-3d/risco.ts
 *
 * O QUE FAZ
 * Traduz dado real que a tela JÁ carregou num "risco" de 0 a 1 para a
 * atmosfera (mais relevo, mais magenta, mais ping de alerta). A entrega à
 * cena é pelo store (`atmosfera.store.ts`, `usePublicarRisco`).
 *
 * REGRAS
 *   - Nenhuma requisição nova: cada tela publica a partir do que já buscou.
 *   - Tela que não publica fica com o risco neutro (`RISCO_NEUTRO`).
 *   - É decoração: o número exato nunca aparece; só a direção importa
 *     (mais grave → mais intenso; corrigiu → acalma).
 *   - Resposta incompleta vira "sem dado" (null), nunca exceção.
 *
 * QUEM PUBLICA
 *   Dashboard ....... severidade dos findings do escopo, puxada pelos críticos abertos
 *   Remediação ...... severidade do quadro pesada pelo estágio (corrigido pesa pouco)
 *   Threat Intel .... CVEs em aberto por severidade, puxadas pelos KEV abertos
 *   Exposure Graph .. vulnerabilidades abertas das aplicações por severidade
 *   Aplicações ...... superfície de exposição: criticidade, Internet, dados, produção
 *   (Projetos fica neutro: status de projeto não é risco — D21.4.)
 */

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
  for (const [severidade, quantidade] of Object.entries(contagens ?? {})) {
    total += quantidade;
    soma += (PESO[severidade] ?? 0) * quantidade;
  }
  return total > 0 ? soma / total : null;
}

/** Risco de um conjunto de contagens por severidade (todas abertas). */
export function riscoPorSeveridade(contagens: Record<string, number> | null | undefined): number | null {
  const base = pesoMedio(contagens);
  return base === null ? null : curva(base);
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

/** Soma as abertas por severidade de todas as aplicações do Exposure Graph. */
export function riscoDoExposureGraph(aplicacoes: Array<{ abertas: Record<string, number> }>): number | null {
  const soma: Record<string, number> = {};
  for (const app of aplicacoes) {
    for (const [severidade, n] of Object.entries(app.abertas ?? {})) soma[severidade] = (soma[severidade] ?? 0) + n;
  }
  return riscoPorSeveridade(soma);
}

const PESO_CRITICIDADE: Record<string, number> = { LOW: 0.1, MEDIUM: 0.35, HIGH: 0.7, CRITICAL: 1 };
const PESO_SENSIBILIDADE: Record<string, number> = { PUBLIC: 0, INTERNAL: 0.3, CONFIDENTIAL: 0.7, RESTRICTED: 1 };

/**
 * Superfície de exposição das aplicações, só com o contexto de negócio (a
 * lista não traz vulnerabilidades): criticidade pesa mais, depois estar na
 * Internet, a sensibilidade dos dados e estar em produção.
 */
export function riscoDasAplicacoes(
  apps: Array<{ criticality?: string; internetFacing?: boolean; dataSensitivity?: string; environment?: string }>,
): number | null {
  if (apps.length === 0) return null;
  const soma = apps.reduce((total, app) => total
    + 0.45 * (PESO_CRITICIDADE[app.criticality ?? ""] ?? 0.35)
    + 0.3 * (app.internetFacing ? 1 : 0)
    + 0.15 * (PESO_SENSIBILIDADE[app.dataSensitivity ?? ""] ?? 0.3)
    + 0.1 * (app.environment === "PROD" ? 1 : 0), 0);
  return limitar((soma / apps.length) * 1.2);
}
