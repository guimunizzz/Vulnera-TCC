/**
 * exposure-graph-model.ts
 *
 * O QUE FAZ
 * Converte a resposta de `GET /companies/me/exposure-graph` na visão 2D do
 * grafo da empresa: empresa → aplicações → categorias OWASP com algo aberto.
 * A categoria é um nó só, compartilhado: "A03 · Injection" ligado a quatro
 * aplicações mostra o raio de impacto da mesma classe de falha.
 *
 * POR QUE EXISTE
 * O desenho, os layouts, a seleção e o teclado são os do CyberGraph do scan;
 * só a montagem muda. As posições padrão aqui são as colunas do layout
 * hierárquico (categorias ordenadas pela média das aplicações ligadas a elas,
 * para as arestas cruzarem pouco); os outros layouts reposicionam depois.
 *
 * Nome do produto: Exposure Graph / Cadeias de Exposição. Nunca "Attack
 * Path": o Vulnera não tem dado de alcançabilidade (DECISIONS D8).
 *
 * QUEM USA
 * `exposure-graph.tsx` e `exposure-map-3d.tsx`.
 */

import { OWASP_LABELS, type OwaspCategory } from "../../types/vulnerability.types";
import type { AplicacaoExposta, ExposureGraph, SeveridadeVuln } from "../../types/exposure-graph.types";
import { COLUNA_X, RISK_ORDER, type No2D, type Visao2D } from "./graph-2d-layout";
import type { GraphEdge } from "./graph-model";

export const ID_EMPRESA = "empresa";
export const idDaAplicacao = (id: string) => `app:${id}`;
export const idDaCategoria = (owasp: string) => `cat:${owasp}`;

export const ROTULO_AMBIENTE: Record<string, string> = { PROD: "Produção", HOMOL: "Homologação", DEV: "Desenvolvimento" };
export const ROTULO_CRITICIDADE: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

const LINHA = 84;
const MARGEM = 64;

export const rotuloCategoria = (owasp: string): string => OWASP_LABELS[owasp as OwaspCategory] ?? owasp;

const pior = (a: SeveridadeVuln | undefined, b: SeveridadeVuln): SeveridadeVuln => (a && RISK_ORDER[a] <= RISK_ORDER[b] ? a : b);

export interface CategoriaDaEmpresa {
  owaspCategory: string;
  abertas: number;
  piorSeveridade: SeveridadeVuln;
  /** Aplicações com algo aberto nesta categoria, a mais afetada primeiro. */
  aplicacoes: { id: string; name: string; abertas: number }[];
}

/** As categorias vistas pela empresa toda: o nó compartilhado do grafo. */
export function categoriasDaEmpresa(aplicacoes: AplicacaoExposta[]): CategoriaDaEmpresa[] {
  const porCategoria = new Map<string, CategoriaDaEmpresa>();
  for (const app of aplicacoes) {
    for (const c of app.categorias) {
      const atual = porCategoria.get(c.owaspCategory) ?? { owaspCategory: c.owaspCategory, abertas: 0, piorSeveridade: c.piorSeveridade, aplicacoes: [] };
      atual.abertas += c.abertas;
      atual.piorSeveridade = pior(atual.piorSeveridade, c.piorSeveridade);
      atual.aplicacoes.push({ id: app.id, name: app.name, abertas: c.abertas });
      porCategoria.set(c.owaspCategory, atual);
    }
  }
  for (const c of porCategoria.values()) c.aplicacoes.sort((a, b) => b.abertas - a.abertas);
  return [...porCategoria.values()].sort(
    (a, b) => RISK_ORDER[a.piorSeveridade] - RISK_ORDER[b.piorSeveridade] || b.aplicacoes.length - a.aplicacoes.length || b.abertas - a.abertas,
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function montarVisaoEmpresa(dados: ExposureGraph, nomeEmpresa: string, apenasExpostas = false): Visao2D {
  const aplicacoes = apenasExpostas ? dados.aplicacoes.filter((a) => a.internetFacing) : dados.aplicacoes;
  const categorias = categoriasDaEmpresa(aplicacoes);
  const edges: GraphEdge[] = [];
  const linhas = Math.max(aplicacoes.length, categorias.length, 1);
  const altura = MARGEM * 2 + (linhas - 1) * LINHA;
  // Coluna com menos itens fica centrada e espaçada: sem um bloco colado no topo.
  const yNaColuna = (i: number, total: number) => (total <= 1 ? altura / 2 : MARGEM + (i * (altura - 2 * MARGEM)) / (total - 1));

  const nosApp: No2D[] = aplicacoes.map((app, i) => {
    edges.push({ source: ID_EMPRESA, target: idDaAplicacao(app.id) });
    const partes = [ROTULO_AMBIENTE[app.environment] ?? app.environment, plural(app.totalAbertas, "aberta", "abertas")];
    if (app.internetFacing) partes.push("exposta");
    return {
      id: idDaAplicacao(app.id),
      kind: "APPLICATION",
      label: app.name,
      risk: app.piorSeveridade ?? undefined,
      total: app.totalAbertas,
      subtitulo: partes.join(" · "),
      x: COLUNA_X.APPLICATION,
      y: yNaColuna(i, aplicacoes.length),
    };
  });
  const yDaApp = new Map(nosApp.map((n) => [n.id, n.y]));

  // Ordem das categorias pela altura média das aplicações ligadas a elas (menos cruzamentos).
  const media = (c: CategoriaDaEmpresa) => c.aplicacoes.reduce((s, a) => s + yDaApp.get(idDaAplicacao(a.id))!, 0) / c.aplicacoes.length;
  const nosCat: No2D[] = [...categorias]
    .sort((a, b) => media(a) - media(b))
    .map((c, i, todas) => {
      for (const a of c.aplicacoes) edges.push({ source: idDaAplicacao(a.id), target: idDaCategoria(c.owaspCategory) });
      return {
        id: idDaCategoria(c.owaspCategory),
        kind: "CATEGORY",
        label: rotuloCategoria(c.owaspCategory),
        risk: c.piorSeveridade,
        total: c.abertas,
        subtitulo: `${plural(c.aplicacoes.length, "aplicação", "aplicações")} · ${plural(c.abertas, "aberta", "abertas")}`,
        x: COLUNA_X.CATEGORY + 60,
        y: yNaColuna(i, todas.length),
      };
    });

  const piorDaEmpresa = aplicacoes.reduce<SeveridadeVuln | undefined>((p, a) => (a.piorSeveridade ? pior(p, a.piorSeveridade) : p), undefined);
  const empresa: No2D = {
    id: ID_EMPRESA,
    kind: "COMPANY",
    label: nomeEmpresa,
    risk: piorDaEmpresa,
    total: aplicacoes.length,
    subtitulo: `${plural(aplicacoes.length, "aplicação ativa", "aplicações ativas")}`,
    x: COLUNA_X.COMPANY,
    y: altura / 2,
  };
  const nodes = [empresa, ...nosApp, ...nosCat];
  return { nodes, edges, largura: (nosCat.length ? COLUNA_X.CATEGORY + 60 : COLUNA_X.APPLICATION) + 160, altura };
}
