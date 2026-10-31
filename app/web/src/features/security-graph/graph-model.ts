/**
 * graph-model.ts
 *
 * O QUE FAZ
 * Monta o caminho Internet → alvo → endpoint → finding a partir do scan e dos
 * findings que a página de detalhe já carregou, e calcula o contexto de um nó
 * (ancestrais até a Internet + descendentes) para o destaque de caminho.
 *
 * POR QUE EXISTE
 * Separa a topologia (testável em jsdom) da cena Three.js (só no chunk lazy).
 * Além dos findings, recebe os ativos dos sensores de descoberta: IP (com
 * portas e tecnologias da InternetDB), tecnologias da página (fingerprint) e
 * subdomínios (crt.sh, num nó agregado). As CVEs potenciais se ligam ao IP —
 * é por ele que a exposição acontece, não por um endpoint.
 * Quando `GET /dast/scans/:id/graph` existir, ele substitui `buildSecurityGraph`
 * mantendo o mesmo formato `SecurityGraph`.
 *
 * QUEM USA
 * `security-graph-3d.tsx` e `scene/graph-scene.ts`.
 */

import type { DastFinding, DastObservedAsset, DastRisk } from "../../types/dast.types";

export type GraphNodeKind = "INTERNET" | "ASSET" | "ENDPOINT" | "FINDING" | "IP" | "PORT" | "TECH" | "SUBDOMAIN";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  risk?: DastRisk;
  /** Só em FINDING: o sensor que gerou ("zap", "headers"). */
  sensorKey?: string;
  /** Ativo de descoberta de onde o nó veio (IP, porta, tecnologia, subdomínio). */
  asset?: DastObservedAsset;
  /** Nó agregado (subdomínios): quantos itens ele junta. */
  total?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface SecurityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}

/** Mesmo teto de nós da spec do Security Graph; acima disso a cena perde leitura. */
export const MAX_GRAPH_NODES = 300;

const RISK_ORDER: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function caminhoDe(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export const ID_SUBDOMINIOS = "subdominios";

const KIND_DO_ATIVO: Record<DastObservedAsset["kind"], GraphNodeKind> = { IP: "IP", PORT: "PORT", TECHNOLOGY: "TECH", SUBDOMAIN: "SUBDOMAIN" };
const idDoAtivo = (a: { kind: DastObservedAsset["kind"]; value: string }): string => `${a.kind.toLowerCase()}:${a.value}`;

function rotuloDoAtivo(a: DastObservedAsset): string {
  if (a.kind === "PORT") return `porta ${a.value.split(":").pop()}`;
  return a.value;
}

export function buildSecurityGraph(targetUrl: string, findings: DastFinding[], assets: DastObservedAsset[] = []): SecurityGraph {
  const nodes: GraphNode[] = [
    { id: "internet", kind: "INTERNET", label: "Internet" },
    { id: "asset", kind: "ASSET", label: hostDe(targetUrl) },
  ];
  const edges: GraphEdge[] = [{ source: "internet", target: "asset" }];
  const endpoints = new Set<string>();
  let truncated = false;

  // Ativos primeiro: são poucos (subdomínios têm teto no sensor) e dão a forma do grafo.
  const ids = new Set(nodes.map((n) => n.id));
  const porValor = new Map(assets.map((a) => [a.value, a]));
  const subdominios = assets.filter((a) => a.kind === "SUBDOMAIN");
  if (subdominios.length) {
    nodes.push({ id: ID_SUBDOMINIOS, kind: "SUBDOMAIN", label: "Subdomínios", total: subdominios.length });
    edges.push({ source: "asset", target: ID_SUBDOMINIOS });
    ids.add(ID_SUBDOMINIOS);
  }
  // IP antes das portas/tecnologias que penduram nele.
  const ordemAtivo: Record<DastObservedAsset["kind"], number> = { IP: 0, SUBDOMAIN: 1, TECHNOLOGY: 2, PORT: 3 };
  for (const ativo of [...assets].sort((a, b) => ordemAtivo[a.kind] - ordemAtivo[b.kind])) {
    const id = idDoAtivo(ativo);
    if (ids.has(id)) continue;
    const pai = ativo.kind === "SUBDOMAIN" ? ID_SUBDOMINIOS : ativo.parentValue && porValor.has(ativo.parentValue) ? idDoAtivo(porValor.get(ativo.parentValue)!) : "asset";
    if (!ids.has(pai)) continue;
    nodes.push({ id, kind: KIND_DO_ATIVO[ativo.kind], label: rotuloDoAtivo(ativo), asset: ativo });
    edges.push({ source: pai, target: id });
    ids.add(id);
  }
  const noDoIp = nodes.find((n) => n.kind === "IP")?.id;

  // Ordena por risco para que o corte por tamanho descarte INFO antes de HIGH.
  const ordenados = [...findings].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  for (const finding of ordenados) {
    // CVE potencial expõe o IP, não um caminho da aplicação.
    if (finding.cveId && noDoIp) {
      if (nodes.length + 1 > MAX_GRAPH_NODES) {
        truncated = true;
        break;
      }
      nodes.push({ id: `finding:${finding.id}`, kind: "FINDING", label: finding.title, risk: finding.risk, sensorKey: finding.sensorKey });
      edges.push({ source: noDoIp, target: `finding:${finding.id}` });
      continue;
    }
    const endpointId = `endpoint:${finding.normalizedUrl}`;
    const novos = endpoints.has(endpointId) ? 1 : 2;
    if (nodes.length + novos > MAX_GRAPH_NODES) {
      truncated = true;
      break;
    }
    if (!endpoints.has(endpointId)) {
      endpoints.add(endpointId);
      nodes.push({ id: endpointId, kind: "ENDPOINT", label: caminhoDe(finding.normalizedUrl) });
      edges.push({ source: "asset", target: endpointId });
    }
    const findingId = `finding:${finding.id}`;
    nodes.push({ id: findingId, kind: "FINDING", label: finding.title, risk: finding.risk, sensorKey: finding.sensorKey });
    edges.push({ source: endpointId, target: findingId });
  }

  return { nodes, edges, truncated };
}

export const chaveDaAresta = (edge: GraphEdge): string => `${edge.source}->${edge.target}`;

/**
 * Contexto de um nó: o caminho dele até a Internet (ancestrais) e o que está
 * abaixo dele (descendentes). Selecionar um endpoint acende os findings dele;
 * selecionar um finding acende o caminho de exposição até a Internet.
 */
export function contextoDoNo(grafo: { edges: GraphEdge[] }, nodeId: string): { nos: Set<string>; arestas: Set<string> } {
  const nos = new Set<string>([nodeId]);
  const arestas = new Set<string>();
  const subir = (id: string) => {
    for (const edge of grafo.edges) {
      if (edge.target !== id || arestas.has(chaveDaAresta(edge))) continue;
      arestas.add(chaveDaAresta(edge));
      nos.add(edge.source);
      subir(edge.source);
    }
  };
  const descer = (id: string) => {
    for (const edge of grafo.edges) {
      if (edge.source !== id || arestas.has(chaveDaAresta(edge))) continue;
      arestas.add(chaveDaAresta(edge));
      nos.add(edge.target);
      descer(edge.target);
    }
  };
  subir(nodeId);
  descer(nodeId);
  return { nos, arestas };
}

/** Caminho de exposição em ordem: da Internet até o nó (inclusive). Cada nó tem um único pai. */
export function caminhoAte<N extends { id: string }>(grafo: { nodes: N[]; edges: GraphEdge[] }, nodeId: string): N[] {
  const porId = new Map(grafo.nodes.map((n) => [n.id, n]));
  const caminho: N[] = [];
  let atual = porId.get(nodeId);
  while (atual && !caminho.includes(atual)) {
    caminho.unshift(atual);
    const id: string = atual.id;
    const pai = grafo.edges.find((e) => e.target === id);
    atual = pai ? porId.get(pai.source) : undefined;
  }
  return caminho;
}
