/**
 * code-graph-model.ts
 *
 * O QUE FAZ
 * Monta o Security Graph de UMA importação SAST/SCA (ADR-052, decisão de
 * 2026-11-13): onde estão os problemas.
 *
 *   Aplicação ─┬─ Código (SAST) ── pasta ── arquivo ── achados
 *              └─ Dependências (SCA) ── pacote@versão ── CVEs
 *
 * Cada nó estrutural leva a pior severidade abaixo dele e o total, e pode ser
 * recolhido. Falsos-positivos ficam fora por padrão (o grafo mostra o que
 * importa; a tela tem um interruptor para trazê-los de volta).
 *
 * POR QUE É PURO
 * Igual ao `exposure-graph-model.ts`: a topologia é testável em jsdom, e o
 * desenho (CyberGraph2D, layouts, PNG) é o mesmo do DAST e do Exposure Graph.
 */

import type { CodeFinding, CodeSeverity } from "../../types/code-import.types";
import { CODE_SEVERITY_LABELS } from "../../types/code-import.types";
import { COLUNA_X, RISK_ORDER, type No2D, type Visao2D } from "./graph-2d-layout";
import { MAX_GRAPH_NODES, type GraphEdge } from "./graph-model";

export const ID_RAIZ = "code:raiz";
export const ID_SAST = "code:sast";
export const ID_SCA = "code:sca";
export const idPasta = (p: string) => `dir:${p}`;
export const idArquivo = (p: string) => `file:${p}`;
export const idPacote = (k: string) => `pkg:${k}`;
export const idAchado = (id: string) => `finding:${id}`;

const LINHA = 64;
/** A aplicação é a raiz aqui (no Exposure Graph ela é a 2ª coluna, abaixo da empresa). */
const COLUNA = (kind: No2D["kind"]) => (kind === "APPLICATION" ? COLUNA_X.COMPANY : COLUNA_X[kind]);
const MARGEM = 56;
const RAIZ_ROTULO = "(raiz)";

export interface FiltroGrafoCodigo {
  severidades: ReadonlySet<CodeSeverity>;
  mostrarFalsosPositivos: boolean;
}

/** Nó da árvore completa (todos abertos), antes de decidir o que aparece. */
interface NoArvore {
  no: Omit<No2D, "x" | "y">;
  filhos: NoArvore[];
}

export interface ArvoreCodigo {
  raiz: NoArvore;
  /** Pai de cada nó: para abrir o caminho até um nó achado pela busca. */
  pai: ReadonlyMap<string, string>;
  /** Todos os nós (para busca), já com a pior severidade calculada. */
  todos: Omit<No2D, "x" | "y">[];
  achados: ReadonlyMap<string, CodeFinding>;
}

const pior = (a: CodeSeverity | undefined, b: CodeSeverity | undefined): CodeSeverity | undefined =>
  !a ? b : !b ? a : RISK_ORDER[a] <= RISK_ORDER[b] ? a : b;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Diretório comum a todos os caminhos ("/src/app/a.js", "/src/b.js" → "/src/"). Some do rótulo das pastas. */
export function prefixoComum(caminhos: string[]): string {
  if (caminhos.length === 0) return "";
  const partes = caminhos.map((c) => c.split("/").slice(0, -1));
  const primeiro = partes[0];
  let n = 0;
  while (n < primeiro.length && partes.every((p) => p[n] === primeiro[n])) n++;
  return n === 0 ? "" : `${primeiro.slice(0, n).join("/")}/`;
}

function separar(caminho: string, prefixo: string): { pasta: string; arquivo: string } {
  const relativo = caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) : caminho;
  const i = relativo.lastIndexOf("/");
  return i < 0 ? { pasta: RAIZ_ROTULO, arquivo: relativo } : { pasta: relativo.slice(0, i), arquivo: relativo.slice(i + 1) };
}

/** Pior severidade primeiro, depois mais achados, depois nome. */
function ordenar(a: NoArvore, b: NoArvore): number {
  return (
    RISK_ORDER[a.no.risk ?? "INFO"] - RISK_ORDER[b.no.risk ?? "INFO"] || (b.no.total ?? 0) - (a.no.total ?? 0) || a.no.label.localeCompare(b.no.label)
  );
}

function agregado(id: string, kind: No2D["kind"], label: string, filhos: NoArvore[], subtitulo: (total: number) => string): NoArvore {
  filhos.sort(ordenar);
  const total = filhos.reduce((s, f) => s + (f.no.kind === "FINDING" ? 1 : (f.no.total ?? 0)), 0);
  const risk = filhos.reduce<CodeSeverity | undefined>((p, f) => pior(p, f.no.risk as CodeSeverity | undefined), undefined);
  return { no: { id, kind, label, total, risk, expandivel: true, subtitulo: subtitulo(total) }, filhos };
}

function noDoAchado(f: CodeFinding): NoArvore {
  const severidade = CODE_SEVERITY_LABELS[f.severity].toLowerCase();
  const label = f.category === "SCA" ? (f.advisoryId ?? f.ruleId) : f.title;
  const subtitulo =
    f.category === "SCA"
      ? `${severidade}${f.fixedVersion ? ` · corrige em ${f.fixedVersion}` : ""}`
      : `${f.startLine ? `linha ${f.startLine} · ` : ""}${severidade}`;
  return { no: { id: idAchado(f.id), kind: "FINDING", label, risk: f.severity, subtitulo }, filhos: [] };
}

/** Árvore completa dos achados que passam no filtro. */
export function montarArvoreCodigo(nomeAplicacao: string, findings: CodeFinding[], filtro: FiltroGrafoCodigo): ArvoreCodigo {
  const visiveis = findings.filter(
    (f) => filtro.severidades.has(f.severity) && (filtro.mostrarFalsosPositivos || f.triageStatus !== "FALSE_POSITIVE"),
  );
  const sast = visiveis.filter((f) => f.category === "SAST");
  const sca = visiveis.filter((f) => f.category === "SCA");

  // SAST: pasta → arquivo → achados
  const prefixo = prefixoComum(sast.map((f) => f.filePath).filter((p): p is string => !!p));
  const porPasta = new Map<string, Map<string, CodeFinding[]>>();
  for (const f of sast) {
    const { pasta, arquivo } = f.filePath ? separar(f.filePath, prefixo) : { pasta: RAIZ_ROTULO, arquivo: "(sem arquivo)" };
    const arquivos = porPasta.get(pasta) ?? new Map<string, CodeFinding[]>();
    arquivos.set(arquivo, [...(arquivos.get(arquivo) ?? []), f]);
    porPasta.set(pasta, arquivos);
  }
  const pastas = [...porPasta].map(([pasta, arquivos]) =>
    agregado(
      idPasta(pasta),
      "FOLDER",
      pasta,
      [...arquivos].map(([arquivo, lista]) =>
        agregado(idArquivo(`${pasta}/${arquivo}`), "FILE", arquivo, lista.map(noDoAchado), (t) => plural(t, "achado", "achados")),
      ),
      (t) => `${plural(arquivos.size, "arquivo", "arquivos")} · ${plural(t, "achado", "achados")}`,
    ),
  );

  // SCA: pacote@versão → CVEs
  const porPacote = new Map<string, CodeFinding[]>();
  for (const f of sca) {
    const chave = f.packageName ? `${f.packageName}${f.packageVersion ? `@${f.packageVersion}` : ""}` : f.ruleId;
    porPacote.set(chave, [...(porPacote.get(chave) ?? []), f]);
  }
  const pacotes = [...porPacote].map(([chave, lista]) => {
    const correcao = lista.find((f) => f.fixedVersion)?.fixedVersion;
    return agregado(idPacote(chave), "PACKAGE", chave, lista.map(noDoAchado), (t) =>
      `${plural(t, "CVE", "CVEs")}${correcao ? ` · corrige em ${correcao}` : ""}`,
    );
  });

  const ramos: NoArvore[] = [];
  if (pastas.length) ramos.push(agregado(ID_SAST, "CODE", "Código (SAST)", pastas, (t) => `${plural(pastas.length, "pasta", "pastas")} · ${plural(t, "achado", "achados")}`));
  if (pacotes.length) ramos.push(agregado(ID_SCA, "CODE", "Dependências (SCA)", pacotes, (t) => `${plural(pacotes.length, "pacote", "pacotes")} · ${plural(t, "CVE", "CVEs")}`));
  const raiz = agregado(ID_RAIZ, "APPLICATION", nomeAplicacao, ramos, (t) => plural(t, "achado", "achados"));
  raiz.no.expandivel = false;

  const pai = new Map<string, string>();
  const todos: Omit<No2D, "x" | "y">[] = [];
  const visitar = (n: NoArvore) => {
    todos.push(n.no);
    for (const f of n.filhos) {
      pai.set(f.no.id, n.no.id);
      visitar(f);
    }
  };
  visitar(raiz);
  return { raiz, pai, todos, achados: new Map(visiveis.map((f) => [idAchado(f.id), f])) };
}

/**
 * O que começa aberto: os ramos sempre; as pastas se forem poucas; os
 * arquivos e pacotes se a importação for pequena. Num SARIF de centenas de
 * achados o grafo abre legível e a pessoa expande o que interessa.
 */
export function expandidosIniciais(arvore: ArvoreCodigo): Set<string> {
  const abertos = new Set<string>();
  for (const ramo of arvore.raiz.filhos) {
    abertos.add(ramo.no.id);
    const pequenos = ramo.filhos.length <= 8;
    for (const filho of ramo.filhos) {
      if (filho.no.kind === "FOLDER" && pequenos) {
        abertos.add(filho.no.id);
        if ((ramo.no.total ?? 0) <= 30) for (const arquivo of filho.filhos) abertos.add(arquivo.no.id);
      }
      if (filho.no.kind === "PACKAGE" && pequenos && (ramo.no.total ?? 0) <= 30) abertos.add(filho.no.id);
    }
  }
  return abertos;
}

/** Ids a abrir para que `id` apareça (ele mesmo não precisa estar aberto). */
export function caminhoParaMostrar(arvore: ArvoreCodigo, id: string): string[] {
  const ids: string[] = [];
  let atual = arvore.pai.get(id);
  while (atual) {
    ids.push(atual);
    atual = arvore.pai.get(atual);
  }
  return ids;
}

/**
 * Visão 2D em colunas (hierárquica): cada folha visível ganha uma linha e o
 * pai fica na média dos filhos. Os outros layouts (radial, estrela...)
 * reposicionam a partir daqui, como no DAST.
 */
export function montarVisaoCodigo(arvore: ArvoreCodigo, expandidos: ReadonlySet<string>): Visao2D & { truncado: boolean } {
  const nodes: No2D[] = [];
  const edges: GraphEdge[] = [];
  let linha = 0;
  let truncado = false;
  // Contado ao ENTRAR no nó: os nós vão para a lista depois dos filhos, e o teto tem de incluir os ancestrais.
  let contados = 0;

  const colocar = (n: NoArvore): number => {
    contados++;
    const aberto = n.no.id === ID_RAIZ || expandidos.has(n.no.id);
    const filhosVisiveis = aberto ? n.filhos : [];
    const ys: number[] = [];
    for (const f of filhosVisiveis) {
      // Teto do Security Graph: acima disso a cena perde leitura. Os achados que sobram ficam na lista.
      if (contados >= MAX_GRAPH_NODES) {
        truncado = true;
        break;
      }
      edges.push({ source: n.no.id, target: f.no.id });
      ys.push(colocar(f));
    }
    const y = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 : MARGEM + linha++ * LINHA;
    nodes.push({ ...n.no, expandido: n.no.expandivel ? aberto : undefined, x: COLUNA(n.no.kind), y });
    return y;
  };
  colocar(arvore.raiz);

  const altura = Math.max(MARGEM * 2 + (linha - 1) * LINHA, MARGEM * 2);
  const largura = Math.max(...nodes.map((n) => n.x)) + 200;
  // A raiz vai primeiro: o layout radial/estrela parte do primeiro nó sem pai.
  nodes.reverse();
  return { nodes, edges, largura, altura, truncado };
}
