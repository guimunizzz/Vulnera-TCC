/**
 * exposicao-no-tempo.ts
 *
 * O QUE FAZ
 * A "máquina do tempo" do Exposure Graph (ADR-061): reconstrói o grafo da
 * empresa como ele era num instante passado, a partir do histórico
 * (`GET /companies/me/exposure-graph/history`): quando cada vulnerabilidade
 * nasceu e cada mudança de status registrada no AuditLog.
 *
 * REGRA DO ESTADO NUM INSTANTE
 *   - Criada depois do instante: ainda não existia.
 *   - Com mudança registrada até o instante: vale o destino da última.
 *   - Sem mudança até o instante, mas com mudanças depois: estava como nasceu
 *     (toda vulnerabilidade nasce OPEN).
 *   - Sem trilha nenhuma: vale o status de hoje. É o mesmo limite do burndown
 *     (`metrics.model.ts`): quem mudou antes da auditoria existir não tem
 *     passado reconstruível — entra pelo estado atual.
 *
 * O QUE NÃO RECONSTRÓI
 * O contexto da aplicação (exposição, ambiente, criticidade) é o de HOJE: o
 * histórico de `RISK_CONTEXT_CHANGED` não entra nesta versão. A severidade
 * também é a atual (overrides passados não são refeitos).
 *
 * QUEM USA
 * `maquina-do-tempo.tsx` e `exposure-graph-page.tsx`. Testado em
 * `exposicao-no-tempo.test.ts`.
 */

import type {
  AplicacaoExposta,
  CategoriaExposta,
  ExposureGraph,
  HistoricoDaExposicao,
  SeveridadeVuln,
  VulnerabilidadeNoHistorico,
  VulnPrincipal,
} from "../../types/exposure-graph.types";

const ABERTOS: ReadonlySet<string> = new Set(["OPEN", "IN_PROGRESS"]);
const RESOLVIDOS: ReadonlySet<string> = new Set(["FIXED", "CLOSED"]);
const SEVERIDADES: SeveridadeVuln[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const RANK: Record<SeveridadeVuln, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const LIMITE_PRINCIPAIS = 5;

const ehSeveridade = (s: string): s is SeveridadeVuln => (SEVERIDADES as string[]).includes(s);

/** O status de uma vulnerabilidade no instante, ou null se ela ainda não existia. */
export function statusNoInstante(v: VulnerabilidadeNoHistorico, instante: number): string | null {
  if (Date.parse(v.createdAt) > instante) return null;
  if (v.mudancas.length === 0) return v.status;
  let status = "OPEN";
  for (const m of v.mudancas) {
    if (Date.parse(m.em) > instante) break;
    status = m.para;
  }
  return status;
}

/**
 * O grafo da empresa no instante: as mesmas aplicações de hoje, com as
 * contagens, categorias e principais recalculadas a partir do histórico.
 */
export function exposicaoNoInstante(atual: ExposureGraph, historico: HistoricoDaExposicao, instante: Date): ExposureGraph {
  const t = instante.getTime();
  const porApp = new Map<string, Array<{ v: VulnerabilidadeNoHistorico; status: string }>>();
  for (const v of historico.vulnerabilidades) {
    const status = statusNoInstante(v, t);
    if (!status) continue;
    const lista = porApp.get(v.applicationId) ?? [];
    lista.push({ v, status });
    porApp.set(v.applicationId, lista);
  }

  const aplicacoes = atual.aplicacoes.map((app): AplicacaoExposta => {
    const linhas = porApp.get(app.id) ?? [];
    const abertas = linhas.filter((l) => ABERTOS.has(l.status) && ehSeveridade(l.v.severityFinal));
    const contagem = SEVERIDADES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<SeveridadeVuln, number>);
    const porOrigem: Record<string, number> = {};
    const categorias = new Map<string, CategoriaExposta>();
    for (const { v } of abertas) {
      const sev = v.severityFinal as SeveridadeVuln;
      contagem[sev] += 1;
      porOrigem[v.sourceType] = (porOrigem[v.sourceType] ?? 0) + 1;
      const c = categorias.get(v.owaspCategory) ?? { owaspCategory: v.owaspCategory, abertas: 0, piorSeveridade: sev };
      c.abertas += 1;
      if (RANK[sev] < RANK[c.piorSeveridade]) c.piorSeveridade = sev;
      categorias.set(v.owaspCategory, c);
    }
    const piorSeveridade = SEVERIDADES.find((s) => contagem[s] > 0) ?? null;
    const principais: VulnPrincipal[] = [...abertas]
      .sort((a, b) => RANK[a.v.severityFinal as SeveridadeVuln] - RANK[b.v.severityFinal as SeveridadeVuln] || Date.parse(a.v.createdAt) - Date.parse(b.v.createdAt))
      .slice(0, LIMITE_PRINCIPAIS)
      .map(({ v, status }) => ({ id: v.id, title: v.title, severityFinal: v.severityFinal, status, owaspCategory: v.owaspCategory, sourceType: v.sourceType }));

    return {
      ...app,
      abertas: contagem,
      abertasPorOrigem: porOrigem,
      totalAbertas: abertas.length,
      totalResolvidas: linhas.filter((l) => RESOLVIDOS.has(l.status)).length,
      piorSeveridade,
      categorias: [...categorias.values()].sort(
        (a, b) => RANK[a.piorSeveridade] - RANK[b.piorSeveridade] || b.abertas - a.abertas || a.owaspCategory.localeCompare(b.owaspCategory),
      ),
      principais,
    };
  });

  return { ...atual, geradoEm: instante.toISOString(), aplicacoes };
}

export interface PontoDaLinhaDoTempo {
  instante: number;
  abertas: number;
  criticas: number;
}

/**
 * Abertas (e críticas abertas) em `amostras` pontos igualmente espaçados entre
 * `inicio` e `fim` — o desenho atrás do controle deslizante.
 */
export function linhaDoTempo(historico: HistoricoDaExposicao, inicio: number, fim: number, amostras = 90): PontoDaLinhaDoTempo[] {
  const passo = amostras > 1 ? (fim - inicio) / (amostras - 1) : 0;
  return Array.from({ length: amostras }, (_, i) => {
    const instante = inicio + passo * i;
    let abertas = 0;
    let criticas = 0;
    for (const v of historico.vulnerabilidades) {
      if (!ehSeveridade(v.severityFinal)) continue;
      const status = statusNoInstante(v, instante);
      if (status && ABERTOS.has(status)) {
        abertas += 1;
        if (v.severityFinal === "CRITICAL") criticas += 1;
      }
    }
    return { instante, abertas, criticas };
  });
}

const DIA_MS = 86_400_000;

/** O intervalo da linha do tempo: do primeiro registro (à meia-noite local) até agora. */
export function intervaloDoHistorico(historico: HistoricoDaExposicao, agora = Date.now()): { inicio: number; fim: number } {
  const primeiro = historico.inicio ? Date.parse(historico.inicio) : agora - 30 * DIA_MS;
  const inicio = new Date(primeiro);
  inicio.setHours(0, 0, 0, 0);
  return { inicio: inicio.getTime(), fim: agora };
}
