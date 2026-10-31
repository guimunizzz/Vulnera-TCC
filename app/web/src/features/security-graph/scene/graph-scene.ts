/**
 * graph-scene.ts
 *
 * O QUE FAZ
 * Ciclo de vida completo da cena 3D do grafo, sem React:
 *   - renderer HDR (ACES) + ambiente PBR procedural (RoomEnvironment/PMREM);
 *   - luz de três pontos (key com sombra suave, fill frio, rim na cor de marca);
 *   - pós-processamento: MSAA → contorno de hover/seleção → bloom → saída;
 *   - arestas em arco com cor por vértice e partículas de fluxo instanciadas;
 *   - OrbitControls com amortecimento, giro automático e foco no selecionado;
 *   - destaque de caminho: o que está fora do contexto do nó fica translúcido;
 *   - nomes fixos abaixo de cada objeto (CSS2DRenderer, texto nítido em DOM);
 *   - nós arrastáveis num plano de frente para a câmera, com as arestas seguindo.
 *
 * POR QUE EXISTE
 * Manter o three fora do React deixa o componente só com estado de UI e garante
 * um único ponto de `dispose()` — nada de geometria/material/target vazando
 * quando a aba fecha ou o tema troca.
 *
 * QUEM USA
 * `security-graph-3d.tsx`, dentro do chunk lazy do grafo.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { DastRisk } from "../../../types/dast.types";
import { chaveDaAresta, contextoDoNo, type GraphNode, type GraphNodeKind, type SecurityGraph } from "../graph-model";
import { KitDeMalhas, type NoVisual } from "./node-meshes";
import { INTERVALO_IGNORADO_MS, JANELA_QUADROS, proximoNivel, type NivelQualidade } from "./qualidade";
import type { GraphPalette } from "./palette";

export type Posicao3D = { x: number; y: number; z: number };

export interface GraphSceneOptions {
  paleta: GraphPalette;
  reduzido: boolean;
  /** Nós que a pessoa já arrastou (sobrevivem à troca de tema e de modo). */
  posicoesSalvas: ReadonlyMap<string, Posicao3D>;
  aoSelecionar(node: GraphNode | null): void;
  /** Fim de um arrasto: posição nova do nó. */
  aoMoverNo(id: string, posicao: Posicao3D): void;
  aoPerderContexto(): void;
  /** Quantos nomes estão escondidos por colisão agora. */
  aoContarOcultos?(quantidade: number): void;
  /** A cena baixou a qualidade para manter a fluidez. */
  aoMudarQualidade?(nivel: NivelQualidade): void;
}

// Camadas e aglomerados espaçados para os nomes fixos não se sobreporem (findings são o grosso dos nós).
// Só INTERNET e ASSET usam o x do tipo; os demais vêm da pilha/grade (ver posicoesDoGrafo).
const CAMADA_X: Record<GraphNodeKind, number> = { INTERNET: -6.6, ASSET: -3.2, ENDPOINT: 0.6, FINDING: 5.2, IP: 0.6, SUBDOMAIN: 0.6, TECH: 0.6, PORT: 5.2 };
const MAX_DPR = 1.5;
const SEGMENTOS_ARESTA = 24;
const ESCALA_HOVER = 1.18;
const ESCALA_SELECIONADO = 1.28;

/** Espaço entre findings do mesmo endpoint: largura de um nome de ~20 caracteres e altura de objeto + nome. */
const GRADE_DX = 2.2;
const GRADE_DY = 0.9;

/**
 * Ponto i de n numa grade de frente para a câmera (plano x-y), centrada no aglomerado.
 * Grade em vez de esfera: na esfera os findings se sobrepõem em profundidade e os nomes encavalam.
 */
/** Grade mais larga que alta: com muitos findings, o grafo cresce para o lado, que é onde há tela. */
const colunasDe = (n: number): number => Math.max(1, Math.ceil(Math.sqrt(n * 2)));
const linhasDe = (n: number): number => Math.ceil(n / colunasDe(n));

function grade(i: number, n: number): THREE.Vector3 {
  const colunas = colunasDe(n);
  const linhas = linhasDe(n);
  const coluna = i % colunas;
  const linha = Math.floor(i / colunas);
  return new THREE.Vector3((coluna - (colunas - 1) / 2) * GRADE_DX, ((linhas - 1) / 2 - linha) * GRADE_DY, 0);
}

/** Folga vertical entre a grade de um endpoint e a do próximo. */
const FOLGA_ENDPOINT = 0.9;
/** Curvatura da pilha de endpoints em profundidade: dá volume sem esconder um atrás do outro. */
const CURVA_Z = 0.035;

/**
 * Camadas da esquerda para a direita. Endpoints empilhados na vertical, cada um
 * reservando a altura da grade dos seus findings, com leve curva em profundidade;
 * os findings de cada endpoint formam uma grade à frente dele. Pilha e não anel:
 * no anel, dois endpoints na mesma altura (um na frente, outro atrás) caem no
 * mesmo lugar da tela e os nomes se sobrepõem.
 * Ativos de descoberta seguem a mesma regra: os ramos do alvo (IP, tecnologia,
 * subdomínios) vão na pilha dos endpoints, e os filhos deles (portas, CVEs,
 * subdomínios) na grade.
 */
export function posicoesDoGrafo(grafo: SecurityGraph): Map<string, THREE.Vector3> {
  const saida = new Map<string, THREE.Vector3>();
  const pai = new Map(grafo.edges.map((edge) => [edge.target, edge.source]));
  const raiz = (node: GraphNode) => node.kind === "INTERNET" || node.kind === "ASSET";
  const filhos = new Map<string, GraphNode[]>();
  for (const node of grafo.nodes) {
    const origem = pai.get(node.id) ?? "asset";
    if (raiz(node) || origem === "asset") continue;
    filhos.set(origem, [...(filhos.get(origem) ?? []), node]);
  }

  for (const node of grafo.nodes) {
    if (raiz(node)) saida.set(node.id, new THREE.Vector3(CAMADA_X[node.kind], 0, 0));
  }

  const endpoints = grafo.nodes.filter((node) => !raiz(node) && pai.get(node.id) === "asset");
  const alturas = endpoints.map((node) => Math.max(linhasDe(filhos.get(node.id)?.length ?? 0), 1) * GRADE_DY + FOLGA_ENDPOINT);
  let topo = alturas.reduce((soma, h) => soma + h, 0) / 2;
  endpoints.forEach((node, i) => {
    const y = topo - alturas[i] / 2;
    topo -= alturas[i];
    saida.set(node.id, new THREE.Vector3(CAMADA_X.ENDPOINT, y, -CURVA_Z * y * y));
  });

  filhos.forEach((lista, origem) => {
    const base = saida.get(origem) ?? new THREE.Vector3();
    // A grade cresce para a direita: a primeira coluna fica na camada dos findings.
    const centro = new THREE.Vector3(CAMADA_X.FINDING + ((colunasDe(lista.length) - 1) / 2) * GRADE_DX, base.y, base.z);
    lista.forEach((node, i) => saida.set(node.id, centro.clone().add(grade(i, lista.length))));
  });
  return saida;
}

type ComMaterial = THREE.Mesh | THREE.LineSegments;

interface Rotulo3D {
  id: string;
  el: HTMLElement;
  obj: CSS2DObject;
  /** Menor ganha a disputa por espaço na tela. */
  prioridade: number;
  largura: number;
  altura: number;
  visivel: boolean;
}

const PRIORIDADE_TIPO: Record<GraphNodeKind, number> = {
  INTERNET: 0,
  ASSET: 1,
  IP: 2,
  ENDPOINT: 2,
  SUBDOMAIN: 2.5,
  TECH: 2.5,
  FINDING: 3,
  PORT: 3,
};
const PRIORIDADE_RISCO: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 0.1, LOW: 0.2, INFO: 0.3 };

interface Aresta {
  chave: string;
  de: string;
  para: string;
  curva: THREE.QuadraticBezierCurve3;
  inicio: number;
}

export class GraphScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly outline: OutlinePass;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly ambiente: THREE.Texture;
  private readonly kit: KitDeMalhas;
  private readonly descartaveis: { dispose(): void }[] = [];

  private readonly nos = new Map<string, NoVisual>();
  private readonly donoDoAlvo = new Map<THREE.Object3D, string>();
  private readonly alvos: THREE.Object3D[] = [];
  private readonly originais = new Map<ComMaterial, THREE.Material>();
  private readonly arestas: Aresta[] = [];
  private readonly coresArestas: THREE.BufferAttribute;
  private readonly pontosArestas: THREE.BufferAttribute;
  private readonly posicoesPadrao: Map<string, THREE.Vector3>;
  private readonly rotulos: CSS2DRenderer;
  private readonly rotulos3d: Rotulo3D[] = [];
  private readonly auxRotulo = new THREE.Vector3();
  private readonly planoArrasto = new THREE.Plane();
  private readonly auxNormal = new THREE.Vector3();
  private arrastando: { id: string; deslocamento: THREE.Vector3; moveu: boolean } | null = null;
  private readonly particulas: THREE.InstancedMesh;

  private readonly corBase: THREE.Color;
  private readonly corAcesa: THREE.Color;
  private readonly corApagada: THREE.Color;
  private readonly corParticula: THREE.Color;

  private readonly caixa = new THREE.Box3();
  private usuarioMexeu = false;
  private readonly focoAlvo = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ponteiro = new THREE.Vector2();
  private readonly auxMatriz = new THREE.Matrix4();
  private readonly auxVetor = new THREE.Vector3();
  private readonly auxEscala = new THREE.Vector3();
  private readonly quaternionNeutro = new THREE.Quaternion();

  private hover: string | null = null;
  private selecionado: string | null = null;
  private contexto: { nos: Set<string>; arestas: Set<string> } | null = null;
  private ponteiroSujo = false;
  private ponteiroDentro = false;
  private apertou: { x: number; y: number } | null = null;
  private raf = 0;
  private parado = false;
  private visivel = true;
  private quadro = 0;
  private readonly inicio = performance.now();
  private ocultos = 0;
  private nivelQualidade: NivelQualidade = 0;
  private ultimoQuadro = 0;
  private somaQuadros = 0;
  private qtdQuadros = 0;
  private readonly observadorTamanho: ResizeObserver;
  private readonly observadorVisivel: IntersectionObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camadaRotulos: HTMLElement,
    private readonly grafo: SecurityGraph,
    private readonly opcoes: GraphSceneOptions,
  ) {
    const { paleta } = opcoes;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    if (this.renderer.getContext().isContextLost()) throw new Error("Contexto WebGL indisponível");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Sombra recalculada a cada 2 quadros: metade do custo, diferença imperceptível.
    this.renderer.shadowMap.autoUpdate = false;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const sala = new RoomEnvironment();
    this.ambiente = this.pmrem.fromScene(sala, 0.04).texture;
    sala.dispose();
    this.scene.environment = this.ambiente;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color(paleta.fundo);

    this.corBase = new THREE.Color(paleta.neutral).multiplyScalar(0.9);
    this.corAcesa = new THREE.Color(paleta.accent).multiplyScalar(2.2);
    this.corApagada = new THREE.Color(paleta.neutral).lerp(new THREE.Color(paleta.fundo), 0.82);
    this.corParticula = new THREE.Color(paleta.accent).multiplyScalar(2.6);

    this.montarLuzes();
    this.kit = new KitDeMalhas(paleta);
    this.posicoesPadrao = posicoesDoGrafo(grafo);
    const posicoes = new Map(this.posicoesPadrao);
    opcoes.posicoesSalvas.forEach((p, id) => {
      if (posicoes.has(id)) posicoes.set(id, new THREE.Vector3(p.x, p.y, p.z));
    });
    this.rotulos = new CSS2DRenderer({ element: camadaRotulos });
    this.montarNos(posicoes);
    [this.coresArestas, this.pontosArestas] = this.montarArestas(posicoes);
    this.particulas = this.montarParticulas();
    // Margem do tamanho de um nó em volta das posições (os centros não bastam).
    // A caixa é a do layout padrão: arrastar um nó não muda o enquadramento.
    this.caixa.setFromPoints([...this.posicoesPadrao.values()]).expandByScalar(0.8);
    this.montarPiso();
    this.scene.fog = new THREE.Fog(paleta.fundo, 20, 60);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.58;
    this.controls.autoRotateSpeed = 0.45;
    // Depois que a pessoa mexe na câmera, redimensionar não reenquadra mais.
    this.controls.addEventListener("start", this.aoMexerNaCamera);
    // Roda do mouse só dá zoom com a cena em foco; sem isso, rolar a página "prende" no canvas.
    this.controls.enableZoom = false;

    const alvo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, alvo);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.outline = new OutlinePass(new THREE.Vector2(1, 1), this.scene, this.camera);
    this.outline.edgeStrength = 4;
    this.outline.edgeGlow = 0.6;
    this.outline.edgeThickness = 1.4;
    this.outline.visibleEdgeColor.set(paleta.accent);
    this.outline.hiddenEdgeColor.set(paleta.accentSoft);
    this.composer.addPass(this.outline);
    const { strength, radius, threshold } = paleta.bloom;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), strength, radius, threshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    canvas.addEventListener("pointermove", this.aoMover);
    canvas.addEventListener("pointerenter", this.aoEntrar);
    canvas.addEventListener("pointerleave", this.aoSair);
    // Captura: roda antes do OrbitControls, que assim não orbita quando o arrasto é de um nó.
    canvas.addEventListener("pointerdown", this.aoApertar, { capture: true });
    canvas.addEventListener("pointerup", this.aoSoltar);
    canvas.addEventListener("webglcontextlost", this.aoPerderContexto);
    canvas.addEventListener("focus", this.aoFocar);
    canvas.addEventListener("blur", this.aoDesfocar);
    document.addEventListener("visibilitychange", this.retomar);
    this.observadorTamanho = new ResizeObserver(() => this.redimensionar());
    this.observadorTamanho.observe(canvas);
    this.observadorVisivel = new IntersectionObserver(([entrada]) => {
      this.visivel = entrada?.isIntersecting ?? true;
      this.retomar();
    });
    this.observadorVisivel.observe(canvas);

    this.redimensionar();
    this.raf = requestAnimationFrame(this.desenhar);
  }

  /* ---------------------------------------------------------------- montagem */

  private montarLuzes(): void {
    const { paleta } = this.opcoes;
    this.scene.add(new THREE.HemisphereLight("#c3ccff", paleta.fundo, 0.5));
    const key = new THREE.DirectionalLight("#fff3e2", 2.6);
    key.position.set(6, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight("#9fb2ff", 0.7);
    fill.position.set(-8, 2, 6);
    const rim = new THREE.DirectionalLight(paleta.accent, 2.4);
    rim.position.set(-2, 6, -10);
    this.scene.add(key, fill, rim);
  }

  private montarNos(posicoes: Map<string, THREE.Vector3>): void {
    for (const node of this.grafo.nodes) {
      const visual = this.kit.criar(node);
      visual.raiz.position.copy(posicoes.get(node.id) ?? new THREE.Vector3());
      this.scene.add(visual.raiz);
      this.montarRotulo(visual);
      this.nos.set(node.id, visual);
      for (const alvo of visual.alvos) {
        this.alvos.push(alvo);
        this.donoDoAlvo.set(alvo, node.id);
      }
      visual.raiz.traverse((obj) => {
        if ((obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) && !Array.isArray(obj.material)) {
          this.originais.set(obj, obj.material);
        }
      });
    }
  }

  /** Nome sempre visível abaixo do objeto; DOM para o texto ficar nítido em qualquer zoom. */
  private montarRotulo(visual: NoVisual): void {
    const el = document.createElement("div");
    // Findings são muitos e próximos: rótulo menor e mais discreto que o da estrutura.
    el.className =
      visual.node.kind === "FINDING"
        ? "pointer-events-none max-w-[8.5rem] truncate whitespace-nowrap rounded bg-canvas/70 px-1 py-px text-[10px] leading-tight text-fg-secondary transition-opacity"
        : "pointer-events-none max-w-[11rem] truncate whitespace-nowrap rounded bg-canvas/70 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-fg transition-opacity";
    el.textContent = visual.node.label;
    const rotulo = new CSS2DObject(el);
    // Logo abaixo da base do objeto, medida antes de qualquer animação de escala.
    const caixa = new THREE.Box3().setFromObject(visual.raiz);
    rotulo.position.set(0, caixa.min.y - visual.raiz.position.y - 0.04, 0);
    rotulo.center.set(0.5, 0);
    visual.raiz.add(rotulo);
    const { kind, risk } = visual.node;
    this.rotulos3d.push({ id: visual.node.id, el, obj: rotulo, prioridade: PRIORIDADE_TIPO[kind] + (risk ? PRIORIDADE_RISCO[risk] : 0), largura: 0, altura: 0, visivel: true });
  }

  /**
   * Esconde o nome que colide na tela com um de prioridade maior (selecionado/hover,
   * depois estrutura, depois findings do mais grave ao mais leve, e o mais próximo
   * da câmera no empate). Com um caminho em destaque, só os nomes dele concorrem.
   * Roda a cada poucos quadros: 300 nomes são ~45 mil comparações de retângulos.
   */
  private resolverColisoes(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const candidatos: { r: Rotulo3D; x: number; y: number; z: number; chave: number }[] = [];
    for (const r of this.rotulos3d) {
      const ativo = !this.contexto || this.contexto.nos.has(r.id);
      r.obj.getWorldPosition(this.auxRotulo).project(this.camera);
      if (!ativo || this.auxRotulo.z > 1) {
        this.mostrarRotulo(r, false);
        continue;
      }
      // Largura medida uma vez: o rótulo é truncado, então não muda depois de montado.
      if (!r.largura) {
        r.largura = r.el.offsetWidth;
        r.altura = r.el.offsetHeight;
      }
      const foco = r.id === this.selecionado || r.id === this.hover;
      candidatos.push({
        r,
        x: ((this.auxRotulo.x + 1) / 2) * w,
        y: ((1 - this.auxRotulo.y) / 2) * h,
        z: this.auxRotulo.z,
        chave: foco ? -1 : r.prioridade,
      });
    }
    candidatos.sort((a, b) => a.chave - b.chave || a.z - b.z);
    const aceitos: { x0: number; y0: number; x1: number; y1: number }[] = [];
    let ocultos = 0;
    for (const c of candidatos) {
      const caixa = { x0: c.x - c.r.largura / 2 - 2, y0: c.y - 1, x1: c.x + c.r.largura / 2 + 2, y1: c.y + c.r.altura + 1 };
      const colide = aceitos.some((a) => caixa.x0 < a.x1 && caixa.x1 > a.x0 && caixa.y0 < a.y1 && caixa.y1 > a.y0);
      if (colide) ocultos += 1;
      else aceitos.push(caixa);
      this.mostrarRotulo(c.r, !colide);
    }
    // Só avisa quando muda: o componente re-renderiza com a contagem.
    if (ocultos !== this.ocultos) {
      this.ocultos = ocultos;
      this.opcoes.aoContarOcultos?.(ocultos);
    }
  }

  /* ---------------------------------------------------- zoom, captura, qualidade */

  /** Aproxima (fator < 1) ou afasta (> 1) a câmera do alvo, dentro dos limites do OrbitControls. */
  aproximar(fator: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distancia = THREE.MathUtils.clamp(offset.length() * fator, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distancia));
    this.usuarioMexeu = true;
  }

  /** Volta ao enquadramento do grafo inteiro, sem perder a seleção. */
  ajustarVista(): void {
    this.usuarioMexeu = false;
    this.enquadrar();
    const visual = this.selecionado ? this.nos.get(this.selecionado) : null;
    if (visual) this.focoAlvo.copy(visual.raiz.position);
  }

  /**
   * PNG do que está na tela, com os nomes visíveis desenhados por cima (eles são
   * DOM, não entram no canvas WebGL). O render e a cópia acontecem na mesma
   * tarefa: sem `preserveDrawingBuffer`, o buffer ainda está íntegro aqui.
   */
  capturar(): Promise<Blob | null> {
    this.composer.render();
    const origem = this.renderer.domElement;
    const tela = document.createElement("canvas");
    tela.width = origem.width;
    tela.height = origem.height;
    const ctx = tela.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(origem, 0, 0);
    const escala = origem.width / Math.max(1, this.canvas.clientWidth);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const r of this.rotulos3d) {
      if (!r.visivel || !r.largura) continue;
      r.obj.getWorldPosition(this.auxRotulo).project(this.camera);
      const x = ((this.auxRotulo.x + 1) / 2) * tela.width;
      const y = ((1 - this.auxRotulo.y) / 2) * tela.height;
      const estilo = getComputedStyle(r.el);
      ctx.font = `${estilo.fontWeight} ${parseFloat(estilo.fontSize) * escala}px ${estilo.fontFamily}`;
      // Só encurta o que também está truncado na tela; a métrica do canvas difere um pouco da do DOM.
      const folga = parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight);
      let texto = r.el.textContent ?? "";
      if (r.el.scrollWidth > r.el.clientWidth) {
        const maxLargura = (r.largura - folga) * escala;
        while (texto.length > 1 && ctx.measureText(texto).width > maxLargura) texto = texto.slice(0, -2) + "…";
      }
      const largura = ctx.measureText(texto).width + folga * escala;
      const altura = r.altura * escala;
      ctx.fillStyle = estilo.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(x - largura / 2, y, largura, altura, 4 * escala);
      ctx.fill();
      ctx.fillStyle = estilo.color;
      ctx.fillText(texto, x, y + 2 * escala);
    }
    return new Promise((resolver) => tela.toBlob(resolver, "image/png"));
  }

  /** Mede o tempo de quadro e, se a GPU não der conta, baixa a qualidade (ver qualidade.ts). */
  private medirQualidade(agora: number): void {
    const intervalo = agora - this.ultimoQuadro;
    this.ultimoQuadro = agora;
    if (intervalo <= 0 || intervalo > INTERVALO_IGNORADO_MS || this.nivelQualidade === 2) return;
    this.somaQuadros += intervalo;
    this.qtdQuadros += 1;
    if (this.qtdQuadros < JANELA_QUADROS) return;
    const nivel = proximoNivel(this.somaQuadros / this.qtdQuadros, this.nivelQualidade);
    this.somaQuadros = 0;
    this.qtdQuadros = 0;
    if (nivel === this.nivelQualidade) return;
    this.nivelQualidade = nivel;
    if (nivel === 1) {
      this.renderer.setPixelRatio(1);
      this.composer.setPixelRatio(1);
      this.redimensionar();
    } else {
      this.bloom.enabled = false;
      this.outline.edgeGlow = 0;
    }
    this.opcoes.aoMudarQualidade?.(nivel);
  }

  private mostrarRotulo(r: Rotulo3D, visivel: boolean): void {
    if (r.visivel === visivel) return;
    r.visivel = visivel;
    r.el.style.opacity = visivel ? "1" : "0";
  }

  /** Arco suave para cima entre dois nós: lê melhor que reta e separa arestas paralelas. */
  private static arco(curva: THREE.QuadraticBezierCurve3, a: THREE.Vector3, b: THREE.Vector3): void {
    curva.v0.copy(a);
    curva.v2.copy(b);
    curva.v1.copy(a).lerp(b, 0.5).y += a.distanceTo(b) * 0.14;
  }

  private montarArestas(posicoes: Map<string, THREE.Vector3>): [THREE.BufferAttribute, THREE.BufferAttribute] {
    const pontos: THREE.Vector3[] = [];
    for (const edge of this.grafo.edges) {
      const a = posicoes.get(edge.source);
      const b = posicoes.get(edge.target);
      if (!a || !b) continue;
      const curva = new THREE.QuadraticBezierCurve3();
      GraphScene.arco(curva, a, b);
      this.arestas.push({ chave: chaveDaAresta(edge), de: edge.source, para: edge.target, curva, inicio: pontos.length });
      const amostras = curva.getPoints(SEGMENTOS_ARESTA);
      for (let i = 0; i < SEGMENTOS_ARESTA; i += 1) pontos.push(amostras[i], amostras[i + 1]);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pontos);
    const posicaoAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    posicaoAttr.setUsage(THREE.DynamicDrawUsage);
    const cores = new THREE.BufferAttribute(new Float32Array(pontos.length * 3), 3);
    geo.setAttribute("color", cores);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    this.scene.add(new THREE.LineSegments(geo, mat));
    this.descartaveis.push(geo, mat);
    this.pintarArestas(cores);
    return [cores, posicaoAttr];
  }

  /** Refaz o arco das arestas ligadas aos nós informados (sem filtro: todas). */
  private atualizarArestas(ids?: Set<string>): void {
    const amostra = new THREE.Vector3();
    for (const aresta of this.arestas) {
      if (ids && !ids.has(aresta.de) && !ids.has(aresta.para)) continue;
      const a = this.nos.get(aresta.de)?.raiz.position;
      const b = this.nos.get(aresta.para)?.raiz.position;
      if (!a || !b) continue;
      GraphScene.arco(aresta.curva, a, b);
      for (let i = 0; i < SEGMENTOS_ARESTA; i += 1) {
        aresta.curva.getPoint(i / SEGMENTOS_ARESTA, amostra);
        this.pontosArestas.setXYZ(aresta.inicio + i * 2, amostra.x, amostra.y, amostra.z);
        aresta.curva.getPoint((i + 1) / SEGMENTOS_ARESTA, amostra);
        this.pontosArestas.setXYZ(aresta.inicio + i * 2 + 1, amostra.x, amostra.y, amostra.z);
      }
    }
    this.pontosArestas.needsUpdate = true;
  }

  /** Volta todos os nós para o layout calculado. */
  restaurarLayout(): void {
    this.nos.forEach((visual, id) => visual.raiz.position.copy(this.posicoesPadrao.get(id) ?? visual.raiz.position));
    this.atualizarArestas();
    const visual = this.selecionado ? this.nos.get(this.selecionado) : null;
    if (visual) this.focoAlvo.copy(visual.raiz.position);
  }

  private montarParticulas(): THREE.InstancedMesh {
    const geo = new THREE.SphereGeometry(0.035, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const malha = new THREE.InstancedMesh(geo, mat, Math.max(1, this.arestas.length));
    malha.count = this.arestas.length;
    malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.arestas.length; i += 1) malha.setColorAt(i, this.corParticula);
    malha.frustumCulled = false;
    // Partícula em movimento contradiz prefers-reduced-motion.
    malha.visible = !this.opcoes.reduzido;
    this.scene.add(malha);
    this.descartaveis.push(geo, mat, malha);
    return malha;
  }

  private montarPiso(): void {
    const { paleta } = this.opcoes;
    const centro = this.caixa.getCenter(new THREE.Vector3());
    const raio = this.caixa.getSize(new THREE.Vector3()).length() / 2;
    const y = this.caixa.min.y - 0.6;
    const sombraGeo = new THREE.PlaneGeometry(80, 80);
    const sombraMat = new THREE.ShadowMaterial({ opacity: paleta.sombra });
    const sombra = new THREE.Mesh(sombraGeo, sombraMat);
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = y;
    sombra.receiveShadow = true;
    const grade = new THREE.PolarGridHelper(raio + 4, 16, 8, 96, paleta.grade, paleta.grade);
    grade.position.set(centro.x, y + 0.01, centro.z);
    const gradeMat = grade.material as THREE.LineBasicMaterial;
    gradeMat.transparent = true;
    gradeMat.opacity = 0.35;
    this.scene.add(sombra, grade);
    this.descartaveis.push(sombraGeo, sombraMat, grade.geometry, gradeMat);
  }

  /* -------------------------------------------------------------- destaque */

  private pintarArestas(cores: THREE.BufferAttribute): void {
    for (let i = 0; i < this.arestas.length; i += 1) {
      const { chave, inicio } = this.arestas[i];
      const cor = !this.contexto ? this.corBase : this.contexto.arestas.has(chave) ? this.corAcesa : this.corApagada;
      for (let v = 0; v < SEGMENTOS_ARESTA * 2; v += 1) cores.setXYZ(inicio + v, cor.r, cor.g, cor.b);
    }
    cores.needsUpdate = true;
  }

  private aplicarDestaque(): void {
    this.contexto = this.selecionado ? contextoDoNo(this.grafo, this.selecionado) : null;
    this.nos.forEach((visual, id) => {
      const ativo = !this.contexto || this.contexto.nos.has(id);
      visual.raiz.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments)) return;
        const original = this.originais.get(obj);
        if (!original) return;
        obj.material = ativo ? original : this.kit.esmaecido(original);
        if (obj instanceof THREE.Mesh) obj.castShadow = ativo && visual.alvos.includes(obj);
      });
    });
    this.pintarArestas(this.coresArestas);
    this.atualizarContorno();
  }

  private atualizarContorno(): void {
    const ids = new Set([this.hover, this.selecionado].filter((id): id is string => !!id));
    this.outline.selectedObjects = [...ids].flatMap((id) => this.nos.get(id)?.alvos ?? []);
  }

  private definirHover(id: string | null): void {
    if (id === this.hover) return;
    this.hover = id;
    if (!this.arrastando) this.canvas.style.cursor = id ? "grab" : "";
    this.atualizarContorno();
  }

  /** Seleciona (ou limpa, com null) e avisa o componente. */
  selecionar(id: string | null): void {
    this.selecionado = id && this.nos.has(id) ? id : null;
    this.aplicarDestaque();
    const visual = this.selecionado ? this.nos.get(this.selecionado) : null;
    this.focoAlvo.copy(visual ? visual.raiz.position : this.controls.target0);
    this.opcoes.aoSelecionar(visual?.node ?? null);
  }

  recentralizar(): void {
    this.usuarioMexeu = false;
    this.enquadrar();
    this.selecionar(null);
  }

  /* -------------------------------------------------------------- eventos */

  private readonly aoMover = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.ponteiro.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ponteiroSujo = true;
    const arrasto = this.arrastando;
    const inicio = this.apertou;
    if (!arrasto || !inicio) return;
    if (!arrasto.moveu && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) <= 5) return;
    arrasto.moveu = true;
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.planoArrasto, this.auxVetor)) return;
    const visual = this.nos.get(arrasto.id);
    if (!visual) return;
    visual.raiz.position.copy(this.auxVetor).add(arrasto.deslocamento);
    if (arrasto.id === this.selecionado) this.focoAlvo.copy(visual.raiz.position);
    this.atualizarArestas(new Set([arrasto.id]));
  };
  private readonly aoFocar = (): void => {
    this.controls.enableZoom = true;
  };
  private readonly aoDesfocar = (): void => {
    this.controls.enableZoom = false;
  };
  private readonly aoEntrar = (): void => {
    this.ponteiroDentro = true;
  };
  private readonly aoSair = (): void => {
    this.ponteiroDentro = false;
    this.definirHover(null);
  };
  private readonly aoApertar = (e: PointerEvent): void => {
    this.apertou = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;
    this.aoMover(e);
    const id = this.pegar();
    const visual = id ? this.nos.get(id) : null;
    if (!id || !visual) return;
    // Nó sob o ponteiro: arrasta o nó num plano de frente para a câmera, sem orbitar.
    this.controls.enabled = false;
    this.camera.getWorldDirection(this.auxNormal);
    this.planoArrasto.setFromNormalAndCoplanarPoint(this.auxNormal, visual.raiz.position);
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const ponto = this.raycaster.ray.intersectPlane(this.planoArrasto, new THREE.Vector3()) ?? visual.raiz.position.clone();
    this.arrastando = { id, deslocamento: visual.raiz.position.clone().sub(ponto), moveu: false };
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = "grabbing";
  };
  private readonly aoSoltar = (e: PointerEvent): void => {
    const inicio = this.apertou;
    const arrasto = this.arrastando;
    this.apertou = null;
    this.arrastando = null;
    this.controls.enabled = true;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.canvas.style.cursor = this.hover ? "grab" : "";
    if (arrasto?.moveu) {
      const p = this.nos.get(arrasto.id)?.raiz.position;
      if (p) this.opcoes.aoMoverNo(arrasto.id, { x: p.x, y: p.y, z: p.z });
      return;
    }
    // Arrastar o fundo orbita; só um clique parado seleciona.
    if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 5) return;
    this.aoMover(e);
    this.selecionar(this.pegar());
  };
  private readonly aoPerderContexto = (e: Event): void => {
    e.preventDefault();
    this.parar();
    this.opcoes.aoPerderContexto();
  };
  private readonly retomar = (): void => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.parado && this.visivel && !document.hidden) this.raf = requestAnimationFrame(this.desenhar);
  };

  private pegar(): string | null {
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const hit = this.raycaster.intersectObjects(this.alvos, false)[0];
    return hit ? this.donoDoAlvo.get(hit.object) ?? null : null;
  }

  private redimensionar(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.rotulos.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.usuarioMexeu) this.enquadrar();
  }

  /** Distância que cabe a caixa do grafo na largura E na altura do canvas atual. */
  private enquadrar(): void {
    const centro = this.caixa.getCenter(new THREE.Vector3());
    const metade = this.caixa.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distancia = Math.max(metade.y / tan, metade.x / (tan * this.camera.aspect)) * 1.08 + metade.z;
    const direcao = new THREE.Vector3(0.1, 0.24, 1).normalize();
    this.camera.position.copy(centro).addScaledVector(direcao, distancia);
    this.controls.target.copy(centro);
    this.focoAlvo.copy(centro);
    this.controls.minDistance = distancia * 0.3;
    this.controls.maxDistance = distancia * 2;
    this.controls.update();
    this.controls.saveState();
    const fog = this.scene.fog as THREE.Fog;
    fog.near = distancia * 1.2;
    fog.far = distancia * 3;
  }

  private readonly aoMexerNaCamera = (): void => {
    this.usuarioMexeu = true;
  };

  /* ---------------------------------------------------------------- quadro */

  private readonly desenhar = (agora: number): void => {
    if (this.parado || !this.visivel || document.hidden) return;
    this.raf = requestAnimationFrame(this.desenhar);
    const t = (agora - this.inicio) / 1000;
    const { reduzido } = this.opcoes;

    if (this.ponteiroSujo && this.ponteiroDentro && !this.apertou) {
      this.ponteiroSujo = false;
      this.definirHover(this.pegar());
    }

    this.nos.forEach((visual, id) => {
      if (!reduzido) visual.animar(t);
      const alvo = id === this.selecionado ? ESCALA_SELECIONADO : id === this.hover ? ESCALA_HOVER : 1;
      this.auxEscala.setScalar(alvo);
      if (reduzido) visual.raiz.scale.copy(this.auxEscala);
      else visual.raiz.scale.lerp(this.auxEscala, 0.16);
    });

    if (!reduzido) {
      for (let i = 0; i < this.arestas.length; i += 1) {
        const { chave, curva } = this.arestas[i];
        const fora = this.contexto && !this.contexto.arestas.has(chave);
        curva.getPoint((t * 0.22 + i * 0.137) % 1, this.auxVetor);
        this.auxEscala.setScalar(fora ? 0 : this.contexto ? 1.6 : 1);
        this.particulas.setMatrixAt(i, this.auxMatriz.compose(this.auxVetor, this.quaternionNeutro, this.auxEscala));
      }
      this.particulas.instanceMatrix.needsUpdate = true;
    }

    // Giro de apresentação só quando ninguém está olhando de perto.
    this.controls.autoRotate = !reduzido && !this.ponteiroDentro && !this.selecionado;
    this.controls.target.lerp(this.focoAlvo, reduzido ? 1 : 0.06);
    this.controls.update();

    this.medirQualidade(agora);
    this.quadro += 1;
    // No nível 2 a sombra só se refaz a cada 8 quadros: acompanha o arraste sem pesar em GPU fraca.
    if (this.quadro % (this.nivelQualidade === 2 ? 8 : 2) === 0 || reduzido) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
    this.rotulos.render(this.scene, this.camera);
    // `=== 1`: já no primeiro quadro, para os nomes não nascerem encavalados.
    if (this.quadro % 4 === 1 || reduzido) this.resolverColisoes();
  };

  private parar(): void {
    this.parado = true;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.parar();
    this.canvas.removeEventListener("pointermove", this.aoMover);
    this.canvas.removeEventListener("pointerenter", this.aoEntrar);
    this.canvas.removeEventListener("pointerleave", this.aoSair);
    this.canvas.removeEventListener("pointerdown", this.aoApertar, { capture: true });
    this.canvas.removeEventListener("pointerup", this.aoSoltar);
    this.canvas.removeEventListener("webglcontextlost", this.aoPerderContexto);
    this.canvas.removeEventListener("focus", this.aoFocar);
    this.canvas.removeEventListener("blur", this.aoDesfocar);
    document.removeEventListener("visibilitychange", this.retomar);
    this.observadorTamanho.disconnect();
    this.observadorVisivel.disconnect();
    this.canvas.style.cursor = "";
    // Os rótulos são DOM na camada do componente: a próxima cena começa limpa.
    this.camadaRotulos.replaceChildren();
    this.controls.removeEventListener("start", this.aoMexerNaCamera);
    this.controls.dispose();
    this.kit.dispose();
    this.descartaveis.forEach((item) => item.dispose());
    this.outline.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.ambiente.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    // Sem isso o contexto só morre no GC: abrir a aba ~16 vezes estoura o limite do navegador.
    // Os listeners já saíram acima, então o "context lost" provocado aqui não vira erro na UI.
    this.renderer.forceContextLoss();
  }
}
