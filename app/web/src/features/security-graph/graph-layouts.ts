/**
 * graph-layouts.ts
 *
 * O QUE FAZ
 * Reposiciona uma visão 2D já montada (nós visíveis + arestas) em outro layout:
 *   - hierárquico: as colunas de `montarVisao2D` (Internet → … → findings);
 *   - radial: o centro no meio e um anel por distância a ele;
 *   - estrela: cada nó com filhos vira um hub, com os filhos em leque em volta;
 *   - orgânico: forças (molas nas arestas, repulsão entre nós), parte do radial;
 *   - clusters: ilhas por severidade, com a estrutura sem risco no meio.
 *
 * POR QUE EXISTE
 * O agrupamento (quais nós aparecem, grupos abertos) é um problema; onde cada
 * nó fica é outro. Separando, todo layout herda grupos, filtro, busca, seleção
 * e arrasto sem duplicar regra. Tudo aqui é puro e determinístico: o mesmo
 * grafo dá sempre o mesmo desenho (sem aleatoriedade), o que torna o layout
 * testável e evita o grafo "pular" a cada render.
 * Funciona também em grafos que não são árvore (o Exposure Graph, em que uma
 * categoria OWASP é compartilhada por várias aplicações): radial e estrela usam
 * a árvore geradora de uma busca em largura e desenham todas as arestas.
 *
 * QUEM USA
 * `cyber-graph.tsx` (scan) e `exposure-graph.tsx` (empresa).
 */

import type { GraphEdge } from "./graph-model";
import { RISK_ORDER, type No2D, type Risco, type Visao2D, type Zona } from "./graph-2d-layout";

export type LayoutId = "hierarquico" | "radial" | "estrela" | "organico" | "clusters";

export const LAYOUTS: { id: LayoutId; nome: string; descricao: string }[] = [
  { id: "hierarquico", nome: "Hierárquico", descricao: "Colunas, da origem até os achados" },
  { id: "radial", nome: "Radial", descricao: "O alvo no centro, um anel por nível" },
  { id: "estrela", nome: "Estrela", descricao: "Cada ramo vira um hub com os filhos em volta" },
  { id: "organico", nome: "Orgânico", descricao: "Forças agrupam o que está ligado" },
  { id: "clusters", nome: "Clusters", descricao: "Ilhas por severidade" },
];

export const ehLayout = (v: unknown): v is LayoutId => LAYOUTS.some((l) => l.id === v);

type Ponto = { x: number; y: number };
type Posicoes = Map<string, Ponto>;

/** Folga para nome e subtítulo, que ficam abaixo do círculo e são mais largos que ele. */
const MARGEM_X = 160;
const MARGEM_Y = 70;

interface Arvore {
  raiz: string;
  filhos: Map<string, string[]>;
  pai: Map<string, string>;
  profundidade: Map<string, number>;
  /** Ordem da busca em largura: pais sempre antes dos filhos. */
  ordem: string[];
}

/**
 * Árvore geradora a partir do centro, ignorando a direção das arestas. O centro
 * é o nó sem pai; se ele tiver um único filho (Internet → alvo), o filho vira o
 * centro e a Internet passa a ser um ramo dele: o alvo no meio lê melhor.
 */
export function arvoreDoCentro(nos: { id: string }[], arestas: GraphEdge[]): Arvore | null {
  if (!nos.length) return null;
  const ids = new Set(nos.map((n) => n.id));
  const vizinhos = new Map<string, string[]>(nos.map((n) => [n.id, []]));
  const temPai = new Set<string>();
  for (const a of arestas) {
    if (!ids.has(a.source) || !ids.has(a.target)) continue;
    vizinhos.get(a.source)!.push(a.target);
    vizinhos.get(a.target)!.push(a.source);
    temPai.add(a.target);
  }
  let raiz = nos.find((n) => !temPai.has(n.id))?.id ?? nos[0].id;
  const saidas = arestas.filter((a) => a.source === raiz && ids.has(a.target));
  if (saidas.length === 1) raiz = saidas[0].target;

  const filhos = new Map<string, string[]>(nos.map((n) => [n.id, []]));
  const pai = new Map<string, string>();
  const profundidade = new Map<string, number>([[raiz, 0]]);
  const ordem = [raiz];
  // Componentes soltos (não deveria haver) entram como filhos do centro, para nada sumir.
  const pendentes = nos.map((n) => n.id);
  for (let i = 0; i < ordem.length || pendentes.some((id) => !profundidade.has(id)); i++) {
    if (i >= ordem.length) {
      const solto = pendentes.find((id) => !profundidade.has(id))!;
      pai.set(solto, raiz);
      filhos.get(raiz)!.push(solto);
      profundidade.set(solto, 1);
      ordem.push(solto);
    }
    const atual = ordem[i];
    for (const v of vizinhos.get(atual)!) {
      if (profundidade.has(v)) continue;
      profundidade.set(v, profundidade.get(atual)! + 1);
      pai.set(v, atual);
      filhos.get(atual)!.push(v);
      ordem.push(v);
    }
  }
  return { raiz, filhos, pai, profundidade, ordem };
}

/** Folhas abaixo de cada nó (o próprio nó, se for folha): o peso do setor dele no radial. */
function folhas(arv: Arvore): Map<string, number> {
  const peso = new Map<string, number>();
  for (const id of [...arv.ordem].reverse()) {
    const f = arv.filhos.get(id)!;
    peso.set(id, f.length ? f.reduce((soma, c) => soma + peso.get(c)!, 0) : 1);
  }
  return peso;
}

/** Distância mínima entre nós vizinhos no mesmo anel: o nome embaixo do círculo precisa de espaço. */
const ARCO_MIN = 150;
const PASSO_ANEL = 170;

export function layoutRadial(nos: No2D[], arestas: GraphEdge[]): Posicoes {
  const arv = arvoreDoCentro(nos, arestas);
  const pos: Posicoes = new Map();
  if (!arv) return pos;
  const peso = folhas(arv);
  const porNivel = new Map<number, number>();
  for (const d of arv.profundidade.values()) porNivel.set(d, (porNivel.get(d) ?? 0) + 1);
  const raios: number[] = [0];
  for (let d = 1; d <= Math.max(...porNivel.keys()); d++) {
    raios[d] = Math.max(raios[d - 1] + PASSO_ANEL, ((porNivel.get(d) ?? 0) * ARCO_MIN) / (2 * Math.PI));
  }
  // Cada nó recebe um setor proporcional às folhas abaixo dele e fica no meio do setor.
  const setor = new Map<string, [number, number]>([[arv.raiz, [-Math.PI, Math.PI]]]);
  for (const id of arv.ordem) {
    const [ini, fim] = setor.get(id)!;
    const d = arv.profundidade.get(id)!;
    const meio = (ini + fim) / 2;
    pos.set(id, { x: raios[d] * Math.cos(meio), y: raios[d] * Math.sin(meio) });
    let cursor = ini;
    const total = peso.get(id)!;
    for (const c of arv.filhos.get(id)!) {
      const largura = ((fim - ini) * peso.get(c)!) / total;
      setor.set(c, [cursor, cursor + largura]);
      cursor += largura;
    }
  }
  return pos;
}

/** Espaço que um nó sem filhos ocupa no leque do pai (círculo + nome). */
const RAIO_FOLHA = 62;
const DIST_MIN = 150;

export function layoutEstrela(nos: No2D[], arestas: GraphEdge[]): Posicoes {
  const arv = arvoreDoCentro(nos, arestas);
  const pos: Posicoes = new Map();
  if (!arv) return pos;
  // De baixo para cima: o raio que cada sub-árvore ocupa e a distância dos filhos ao hub.
  const raio = new Map<string, number>();
  const dist = new Map<string, number>();
  for (const id of [...arv.ordem].reverse()) {
    const f = arv.filhos.get(id)!;
    if (!f.length) {
      raio.set(id, RAIO_FOLHA);
      continue;
    }
    const arco = id === arv.raiz ? 2 * Math.PI : 1.5 * Math.PI;
    const circunferencia = f.reduce((s, c) => s + 2 * raio.get(c)!, 0);
    const d = Math.max(DIST_MIN, circunferencia / arco);
    dist.set(id, d);
    raio.set(id, d + Math.max(...f.map((c) => raio.get(c)!)));
  }
  // De cima para baixo: os filhos em leque voltado para fora (longe do pai).
  const direcao = new Map<string, number>([[arv.raiz, -Math.PI / 2]]);
  pos.set(arv.raiz, { x: 0, y: 0 });
  for (const id of arv.ordem) {
    const f = arv.filhos.get(id)!;
    if (!f.length) continue;
    const d = dist.get(id)!;
    const p = pos.get(id)!;
    const arco = id === arv.raiz ? 2 * Math.PI : 1.5 * Math.PI;
    const larguras = f.map((c) => (2 * raio.get(c)!) / d);
    const usado = Math.min(arco, larguras.reduce((s, l) => s + l, 0));
    // Na raiz o círculo é fechado e não há "para fora": começa no topo.
    let angulo = id === arv.raiz ? direcao.get(id)! - Math.PI + (arco - usado) / 2 : direcao.get(id)! - usado / 2;
    f.forEach((c, i) => {
      const meio = angulo + larguras[i] / 2;
      pos.set(c, { x: p.x + d * Math.cos(meio), y: p.y + d * Math.sin(meio) });
      direcao.set(c, meio);
      angulo += larguras[i];
    });
  }
  return pos;
}

/**
 * Forças com resfriamento, partindo do radial (início determinístico e já
 * desembaraçado: o orgânico só precisa "assentar"). Repulsão entre todos os
 * pares é O(n²) por passo; com o teto de 300 nós do grafo isso cabe folgado.
 */
export function layoutOrganico(nos: No2D[], arestas: GraphEdge[], passos = 260): Posicoes {
  const inicio = layoutRadial(nos, arestas);
  const ids = nos.map((n) => n.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const x = Float64Array.from(ids, (id) => inicio.get(id)?.x ?? 0);
  const y = Float64Array.from(ids, (id) => inicio.get(id)?.y ?? 0);
  // Folhas presas mais curto: o ramo vira um tufo em volta do pai, como no Lens.
  const grau = new Uint16Array(n);
  const molas = arestas.flatMap((a) => {
    const i = idx.get(a.source);
    const j = idx.get(a.target);
    if (i === undefined || j === undefined) return [];
    grau[i]++;
    grau[j]++;
    return [[i, j] as const];
  });
  const REPULSAO = 42000;
  // Nome e subtítulo ficam abaixo do círculo e são largos: a colisão olha para eles, não só para o círculo.
  const COLISAO = 150;
  let temperatura = 60;
  for (let passo = 0; passo < passos; passo++) {
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Dois nós no mesmo ponto: separa numa direção fixa pelo índice (sem aleatório).
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        let f = REPULSAO / d2;
        if (d < COLISAO) f += (COLISAO - d) * 0.6;
        fx[i] += (dx / d) * f;
        fy[i] += (dy / d) * f;
        fx[j] -= (dx / d) * f;
        fy[j] -= (dy / d) * f;
      }
    }
    for (const [i, j] of molas) {
      const dx = x[j] - x[i];
      const dy = y[j] - y[i];
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const ideal = grau[i] === 1 || grau[j] === 1 ? 140 : 200;
      const f = (d - ideal) * 0.09;
      fx[i] += (dx / d) * f;
      fy[i] += (dy / d) * f;
      fx[j] -= (dx / d) * f;
      fy[j] -= (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      // Gravidade fraca: componentes não se afastam para sempre.
      fx[i] -= x[i] * 0.012;
      fy[i] -= y[i] * 0.012;
      const f = Math.hypot(fx[i], fy[i]);
      if (f > 0) {
        const mover = Math.min(f, temperatura);
        x[i] += (fx[i] / f) * mover;
        y[i] += (fy[i] / f) * mover;
      }
    }
    temperatura = Math.max(1, temperatura * 0.985);
  }
  return new Map(ids.map((id, i) => [id, { x: x[i], y: y[i] }]));
}

export const ROTULO_ILHA: Record<Risco | "ESTRUTURA", string> = {
  CRITICAL: "Crítico",
  HIGH: "Alto",
  MEDIUM: "Médio",
  LOW: "Baixo",
  INFO: "Informativo",
  ESTRUTURA: "Estrutura",
};
const ORDEM_ILHAS: (Risco | "ESTRUTURA")[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
/** Distância entre nós dentro da ilha (espiral de girassol: denso e sem sobreposição). */
const PASSO_ILHA = 64;
const ANGULO_DOURADO = Math.PI * (3 - Math.sqrt(5));

/** Ilha de um nó: a severidade dele (ou do pior abaixo dele); Internet, alvo, empresa e o que não tem risco ficam no meio. */
const ilhaDe = (no: No2D): Risco | "ESTRUTURA" => (CENTRAIS.has(no.kind) ? "ESTRUTURA" : no.risk ?? "ESTRUTURA");
const CENTRAIS = new Set<No2D["kind"]>(["INTERNET", "ASSET", "COMPANY", "CODE"]);

export function layoutClusters(nos: No2D[]): { pos: Posicoes; zonas: Zona[] } {
  const grupos = new Map<Risco | "ESTRUTURA", No2D[]>();
  for (const no of nos) grupos.set(ilhaDe(no), [...(grupos.get(ilhaDe(no)) ?? []), no]);
  const raioDa = (qtd: number) => PASSO_ILHA * Math.sqrt(Math.max(qtd - 0.5, 0)) + 70;
  const estrutura = grupos.get("ESTRUTURA") ?? [];
  const riscos = ORDEM_ILHAS.filter((r) => grupos.has(r));
  const centro = estrutura.length ? raioDa(estrutura.length) : 0;
  const maior = Math.max(0, ...riscos.map((r) => raioDa(grupos.get(r)!.length)));
  // Anel das ilhas de risco: longe o bastante do centro e para ilhas vizinhas não se tocarem.
  const anel =
    riscos.length <= 1 && !estrutura.length
      ? 0
      : Math.max(centro + maior + 70, riscos.length > 1 ? (maior + 50) / Math.sin(Math.PI / riscos.length) : 0);
  const pos: Posicoes = new Map();
  const zonas: Zona[] = [];
  const montar = (chave: Risco | "ESTRUTURA", cx: number, cy: number) => {
    // Mesmo tipo junto (e mais perigoso no miolo): a ilha lê como um bloco, não como confete.
    const membros = [...grupos.get(chave)!].sort((a, b) => a.kind.localeCompare(b.kind) || RISK_ORDER[a.risk ?? "INFO"] - RISK_ORDER[b.risk ?? "INFO"]);
    membros.forEach((no, i) => {
      const r = PASSO_ILHA * Math.sqrt(i);
      pos.set(no.id, { x: cx + r * Math.cos(i * ANGULO_DOURADO), y: cy + r * Math.sin(i * ANGULO_DOURADO) });
    });
    zonas.push({ id: `zona:${chave}`, rotulo: `${ROTULO_ILHA[chave]} · ${membros.length}`, x: cx, y: cy, r: raioDa(membros.length), risk: chave === "ESTRUTURA" ? undefined : chave });
  };
  if (estrutura.length) montar("ESTRUTURA", 0, 0);
  // Mais grave em cima, seguindo no sentido horário.
  riscos.forEach((r, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / riscos.length;
    montar(r, anel * Math.cos(a), anel * Math.sin(a));
  });
  return { pos, zonas };
}

/** Desloca tudo para a caixa começar em (0, 0), com folga para os nomes; o enquadramento parte daí. */
function normalizar(visao: Visao2D, pos: Posicoes, zonas: Zona[] = []): Visao2D {
  const pontos = [...pos.values()];
  if (!pontos.length) return visao;
  // Zona: círculo mais o nome dela, escrito acima do círculo.
  const minX = Math.min(...pontos.map((p) => p.x - MARGEM_X), ...zonas.map((z) => z.x - z.r - 20));
  const minY = Math.min(...pontos.map((p) => p.y - MARGEM_Y), ...zonas.map((z) => z.y - z.r - 44));
  const maxX = Math.max(...pontos.map((p) => p.x + MARGEM_X), ...zonas.map((z) => z.x + z.r + 20));
  const maxY = Math.max(...pontos.map((p) => p.y + MARGEM_Y + 20), ...zonas.map((z) => z.y + z.r + 20));
  const nodes = visao.nodes.map((n) => {
    const p = pos.get(n.id);
    return p ? { ...n, x: p.x - minX, y: p.y - minY } : n;
  });
  return {
    ...visao,
    nodes,
    largura: maxX - minX,
    altura: maxY - minY,
    forma: "livre",
    zonas: zonas.map((z) => ({ ...z, x: z.x - minX, y: z.y - minY })),
  };
}

/**
 * A visão no layout pedido. `posicoes` (nós arrastados pela pessoa) vencem o
 * layout só para esses nós; largura e altura continuam as do layout, para
 * arrastar não reenquadrar a vista.
 */
export function aplicarLayout(visao: Visao2D, layout: LayoutId, posicoes: ReadonlyMap<string, Ponto> = new Map()): Visao2D {
  let saida: Visao2D;
  if (layout === "radial") saida = normalizar(visao, layoutRadial(visao.nodes, visao.edges));
  else if (layout === "estrela") saida = normalizar(visao, layoutEstrela(visao.nodes, visao.edges));
  else if (layout === "organico") saida = normalizar(visao, layoutOrganico(visao.nodes, visao.edges));
  else if (layout === "clusters") {
    const { pos, zonas } = layoutClusters(visao.nodes);
    saida = normalizar(visao, pos, zonas);
  } else saida = visao;
  if (!posicoes.size) return saida;
  return { ...saida, nodes: saida.nodes.map((n) => ({ ...n, ...posicoes.get(n.id) })) };
}
