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
 *   - destaque de caminho: o que está fora do contexto do nó fica translúcido.
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
import { chaveDaAresta, contextoDoNo, type GraphNode, type GraphNodeKind, type SecurityGraph } from "../graph-model";
import { KitDeMalhas, type NoVisual } from "./node-meshes";
import type { GraphPalette } from "./palette";

export interface GraphSceneOptions {
  paleta: GraphPalette;
  reduzido: boolean;
  aoSelecionar(node: GraphNode | null): void;
  aoPerderContexto(): void;
}

const CAMADA_X: Record<GraphNodeKind, number> = { INTERNET: -4.2, ASSET: -1.7, ENDPOINT: 0.9, FINDING: 3.6 };
const MAX_DPR = 1.5;
const SEGMENTOS_ARESTA = 24;
const ESCALA_HOVER = 1.18;
const ESCALA_SELECIONADO = 1.28;

/** Ponto i de n numa esfera de Fibonacci: distribuição uniforme sem sobreposição. */
function fibonacci(i: number, n: number, raio: number): THREE.Vector3 {
  if (n === 1) return new THREE.Vector3();
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = i * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(theta) * r * raio * 0.6, y * raio, Math.sin(theta) * r * raio);
}

/**
 * Camadas da esquerda para a direita. Endpoints num anel vertical; os findings
 * de cada endpoint formam um aglomerado próprio à frente dele, para que 100
 * findings no mesmo endpoint não se empilhem.
 */
export function posicoesDoGrafo(grafo: SecurityGraph): Map<string, THREE.Vector3> {
  const saida = new Map<string, THREE.Vector3>();
  const pai = new Map(grafo.edges.map((edge) => [edge.target, edge.source]));
  const endpoints = grafo.nodes.filter((node) => node.kind === "ENDPOINT");
  const raioAnel = endpoints.length <= 1 ? 0 : THREE.MathUtils.clamp((endpoints.length * 1.1) / (Math.PI * 2), 1.3, 4.2);

  for (const node of grafo.nodes) {
    if (node.kind === "INTERNET" || node.kind === "ASSET") saida.set(node.id, new THREE.Vector3(CAMADA_X[node.kind], 0, 0));
  }
  endpoints.forEach((node, i) => {
    const angulo = (i / endpoints.length) * Math.PI * 2 + Math.PI / 2;
    saida.set(node.id, new THREE.Vector3(CAMADA_X.ENDPOINT, Math.sin(angulo) * raioAnel, Math.cos(angulo) * raioAnel));
  });

  const filhos = new Map<string, GraphNode[]>();
  for (const node of grafo.nodes) {
    if (node.kind !== "FINDING") continue;
    const origem = pai.get(node.id) ?? "asset";
    filhos.set(origem, [...(filhos.get(origem) ?? []), node]);
  }
  filhos.forEach((lista, origem) => {
    const base = saida.get(origem) ?? new THREE.Vector3();
    const centro = new THREE.Vector3(CAMADA_X.FINDING, base.y * 1.18, base.z * 1.18);
    const raio = lista.length === 1 ? 0 : 0.25 + Math.sqrt(lista.length) * 0.17;
    lista.forEach((node, i) => saida.set(node.id, centro.clone().add(fibonacci(i, lista.length, raio))));
  });
  return saida;
}

type ComMaterial = THREE.Mesh | THREE.LineSegments;

interface Aresta {
  chave: string;
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
  private readonly observadorTamanho: ResizeObserver;
  private readonly observadorVisivel: IntersectionObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly tooltip: HTMLElement,
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
    const posicoes = posicoesDoGrafo(grafo);
    this.montarNos(posicoes);
    this.coresArestas = this.montarArestas(posicoes);
    this.particulas = this.montarParticulas();
    // Margem do tamanho de um nó em volta das posições (os centros não bastam).
    this.caixa.setFromPoints([...posicoes.values()]).expandByScalar(0.8);
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
    canvas.addEventListener("pointerdown", this.aoApertar);
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
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
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

  private montarArestas(posicoes: Map<string, THREE.Vector3>): THREE.BufferAttribute {
    const pontos: THREE.Vector3[] = [];
    for (const edge of this.grafo.edges) {
      const a = posicoes.get(edge.source);
      const b = posicoes.get(edge.target);
      if (!a || !b) continue;
      // Arco suave para cima: lê melhor que reta e separa arestas paralelas.
      const meio = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, a.distanceTo(b) * 0.14, 0));
      const curva = new THREE.QuadraticBezierCurve3(a, meio, b);
      this.arestas.push({ chave: chaveDaAresta(edge), curva, inicio: pontos.length });
      const amostras = curva.getPoints(SEGMENTOS_ARESTA);
      for (let i = 0; i < SEGMENTOS_ARESTA; i += 1) pontos.push(amostras[i], amostras[i + 1]);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pontos);
    const cores = new THREE.BufferAttribute(new Float32Array(pontos.length * 3), 3);
    geo.setAttribute("color", cores);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    this.scene.add(new THREE.LineSegments(geo, mat));
    this.descartaveis.push(geo, mat);
    this.pintarArestas(cores);
    return cores;
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
    this.canvas.style.cursor = id ? "pointer" : "";
    const node = id ? this.nos.get(id)?.node : null;
    this.tooltip.textContent = node ? node.label : "";
    this.tooltip.hidden = !node;
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
  };
  private readonly aoSoltar = (e: PointerEvent): void => {
    const inicio = this.apertou;
    this.apertou = null;
    // Arrastar orbita; só um clique parado seleciona.
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

    if (this.hover) {
      const visual = this.nos.get(this.hover);
      if (visual) {
        visual.raiz.getWorldPosition(this.auxVetor).project(this.camera);
        const x = ((this.auxVetor.x + 1) / 2) * this.canvas.clientWidth;
        const y = ((1 - this.auxVetor.y) / 2) * this.canvas.clientHeight;
        this.tooltip.style.transform = `translate(${x}px, ${y - 22}px) translate(-50%, -100%)`;
      }
    }

    this.quadro += 1;
    if (this.quadro % 2 === 0 || reduzido) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
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
    this.canvas.removeEventListener("pointerdown", this.aoApertar);
    this.canvas.removeEventListener("pointerup", this.aoSoltar);
    this.canvas.removeEventListener("webglcontextlost", this.aoPerderContexto);
    this.canvas.removeEventListener("focus", this.aoFocar);
    this.canvas.removeEventListener("blur", this.aoDesfocar);
    document.removeEventListener("visibilitychange", this.retomar);
    this.observadorTamanho.disconnect();
    this.observadorVisivel.disconnect();
    this.canvas.style.cursor = "";
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
