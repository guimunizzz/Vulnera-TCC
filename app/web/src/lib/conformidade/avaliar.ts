/**
 * conformidade/avaliar.ts
 *
 * O QUE FAZ
 * Cruza o catálogo (`catalogo.ts`) com as vulnerabilidades ABERTAS da empresa
 * por categoria OWASP — o que o Exposure Graph já entrega por aplicação — e
 * diz, para cada requisito de cada referência, se há vulnerabilidade aberta
 * relacionada, quantas, a pior severidade e em quais aplicações (ADR-063).
 *
 * VOCABULÁRIO
 * "Em risco" ou "sem vulnerabilidade aberta relacionada". Nunca "conforme":
 * a ausência de achado não prova conformidade, só que o Vulnera não tem
 * evidência contra aquele requisito hoje.
 *
 * QUEM USA
 * `pages/conformidade-page.tsx`. Testado em `conformidade.test.ts`.
 */

import type { AplicacaoExposta, SeveridadeVuln } from "../../types/exposure-graph.types";
import { REFERENCIAS, type CategoriaOwasp, type Referencia, type ReferenciaId, type Requisito } from "./catalogo";

const RANK: Record<SeveridadeVuln, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export interface CategoriaNoRequisito {
  owasp: CategoriaOwasp;
  abertas: number;
  pior: SeveridadeVuln;
}

export interface RequisitoAvaliado extends Requisito {
  emRisco: boolean;
  abertas: number;
  pior: SeveridadeVuln | null;
  /** As categorias do requisito que têm aberta, a mais grave primeiro. */
  porCategoria: CategoriaNoRequisito[];
  /** Aplicações com aberta em alguma categoria do requisito, a mais afetada primeiro. */
  aplicacoes: Array<{ id: string; name: string; abertas: number }>;
}

export interface ReferenciaAvaliada extends Omit<Referencia, "requisitos"> {
  requisitos: RequisitoAvaliado[];
  emRisco: number;
  /** Requisitos em risco por pior severidade (para o resumo). */
  porSeveridade: Record<SeveridadeVuln, number>;
}

/** Abertas por categoria na empresa, e por aplicação dentro de cada categoria. */
function abertasPorCategoria(aplicacoes: AplicacaoExposta[]) {
  const mapa = new Map<string, { abertas: number; pior: SeveridadeVuln; apps: Map<string, { id: string; name: string; abertas: number }> }>();
  for (const app of aplicacoes) {
    for (const c of app.categorias) {
      const atual = mapa.get(c.owaspCategory) ?? { abertas: 0, pior: c.piorSeveridade, apps: new Map() };
      atual.abertas += c.abertas;
      if (RANK[c.piorSeveridade] < RANK[atual.pior]) atual.pior = c.piorSeveridade;
      const naApp = atual.apps.get(app.id) ?? { id: app.id, name: app.name, abertas: 0 };
      naApp.abertas += c.abertas;
      atual.apps.set(app.id, naApp);
      mapa.set(c.owaspCategory, atual);
    }
  }
  return mapa;
}

export function avaliarReferencia(referencia: Referencia, aplicacoes: AplicacaoExposta[]): ReferenciaAvaliada {
  const porCategoria = abertasPorCategoria(aplicacoes);
  const requisitos = referencia.requisitos.map((r): RequisitoAvaliado => {
    const categorias: CategoriaNoRequisito[] = r.categorias
      .flatMap((owasp) => {
        const c = porCategoria.get(owasp);
        return c && c.abertas > 0 ? [{ owasp, abertas: c.abertas, pior: c.pior }] : [];
      })
      .sort((a, b) => RANK[a.pior] - RANK[b.pior] || b.abertas - a.abertas);
    const apps = new Map<string, { id: string; name: string; abertas: number }>();
    for (const c of categorias) {
      for (const a of porCategoria.get(c.owasp)!.apps.values()) {
        const atual = apps.get(a.id) ?? { ...a, abertas: 0 };
        atual.abertas += a.abertas;
        apps.set(a.id, atual);
      }
    }
    return {
      ...r,
      emRisco: categorias.length > 0,
      abertas: categorias.reduce((s, c) => s + c.abertas, 0),
      pior: categorias[0]?.pior ?? null,
      porCategoria: categorias,
      aplicacoes: [...apps.values()].sort((a, b) => b.abertas - a.abertas || a.name.localeCompare(b.name)),
    };
  });

  const porSeveridade: Record<SeveridadeVuln, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of requisitos) if (r.pior) porSeveridade[r.pior] += 1;

  return {
    id: referencia.id,
    nome: referencia.nome,
    versao: referencia.versao,
    descricao: referencia.descricao,
    requisitos,
    emRisco: requisitos.filter((r) => r.emRisco).length,
    porSeveridade,
  };
}

export function avaliarTudo(aplicacoes: AplicacaoExposta[]): Record<ReferenciaId, ReferenciaAvaliada> {
  return Object.fromEntries(REFERENCIAS.map((r) => [r.id, avaliarReferencia(r, aplicacoes)])) as Record<ReferenciaId, ReferenciaAvaliada>;
}
