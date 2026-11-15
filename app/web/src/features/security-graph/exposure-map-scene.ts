/**
 * exposure-map-scene.ts
 *
 * O QUE FAZ
 * Monta, de forma imperativa, a cena three.js do mapa da superfície de
 * ataque: chão com grade, um bairro por ambiente, um prédio por aplicação
 * (altura = abertas, base = criticidade, cor = pior severidade) e antena nas
 * expostas à Internet. Nome fixo sobre cada prédio (CSS2D), órbita da câmera,
 * clique e hover por raycast, destaque da seleção.
 *
 * POR QUE EXISTE
 * O web não usa R3F (ADR-050): toda cena three passa pelo kit `src/three/`
 * (`montarCena` para renderer, DPR, pausa fora da tela e perda de contexto;
 * `descartarCena`; `lerCorDoToken` para as cores). Esta é a primeira cena
 * FUNCIONAL do kit — as outras são decoração —, então ela também cuida de
 * entrada (ponteiro) e de rótulos; o componente React só a liga e desliga.
 *
 * QUEM USA
 * `exposure-map-3d.tsx`.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { descartarCena } from "../../three/dispose";
import { lerCorDoToken, observarTema } from "../../three/palette";
import { montarCena, type CenaMontada } from "../../three/scene-host";
import type { SeveridadeVuln } from "../../types/exposure-graph.types";
import { idDaAplicacao } from "./exposure-graph-model";
import type { montarCidade, Predio } from "./exposure-map-layout";

export const TOKEN_DA_SEVERIDADE: Record<SeveridadeVuln, string> = {
  CRITICAL: "--color-severity-critical",
  HIGH: "--color-severity-high",
  MEDIUM: "--color-severity-medium",
  LOW: "--color-severity-low",
};
/** Prédio sem nada aberto: claro o bastante para não sumir no chão escuro. */
export const TOKEN_NEUTRO = "--color-text-muted";
const TOKEN_ACENTO = "--color-accent";

export interface MapaMontado {
  selecionar(id: string | null): void;
  recentralizar(): void;
  descartar(): void;
}

interface PredioNaCena {
  predio: Predio;
  id: string;
  corpo: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  contorno: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  anel?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  antena?: THREE.MeshStandardMaterial;
  rotulo: HTMLDivElement;
}

const tokenDoPredio = (p: Predio) => (p.app.piorSeveridade ? TOKEN_DA_SEVERIDADE[p.app.piorSeveridade] : TOKEN_NEUTRO);

function rotulo(classe: string, texto: string, extra?: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = classe;
  el.textContent = texto;
  if (extra !== undefined) {
    const n = document.createElement("span");
    n.className = "ml-1 font-mono font-normal text-fg-muted";
    n.textContent = extra;
    el.appendChild(n);
  }
  return el;
}

export function montarMapa({
  canvas,
  camadaRotulos,
  cidade,
  reduzido,
  aoSelecionar,
  aoFalhar,
}: {
  canvas: HTMLCanvasElement;
  /** Elemento por cima do canvas onde os nomes (CSS2D) são desenhados. */
  camadaRotulos: HTMLElement;
  cidade: ReturnType<typeof montarCidade>;
  reduzido: boolean;
  aoSelecionar(id: string | null): void;
  aoFalhar(): void;
}): MapaMontado | null {
  const raio = Math.max(cidade.largura, cidade.profundidade, 8);
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, raio * 10);
  const posicaoInicial = new THREE.Vector3(raio * 0.5, raio * 0.58, raio * 0.85);
  camera.position.copy(posicaoInicial);

  // Luz: ambiente para nada ficar preto, uma direcional com sombra para dar volume.
  cena.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sol = new THREE.DirectionalLight(0xffffff, 1.2);
  sol.position.set(raio, raio * 1.4, raio * 0.6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -raio, right: raio, top: raio, bottom: -raio });
  cena.add(sol);

  const chao = new THREE.Mesh(new THREE.PlaneGeometry(raio * 4, raio * 4), new THREE.MeshStandardMaterial({ roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -0.02;
  chao.receiveShadow = true;
  cena.add(chao);
  // Grade de referência: dá escala sem competir com os prédios.
  const grade = new THREE.GridHelper(raio * 4, Math.round(raio * 4), 0xffffff, 0xffffff);
  const materialGrade = grade.material as THREE.LineBasicMaterial;
  materialGrade.transparent = true;
  materialGrade.opacity = 0.18;
  cena.add(grade);

  const bairros = cidade.bairros.map((b) => {
    const placa = new THREE.Mesh(new THREE.BoxGeometry(b.largura, 0.06, b.profundidade), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    placa.position.set(b.x, 0.03, b.z);
    placa.receiveShadow = true;
    const borda = new THREE.LineSegments(new THREE.EdgesGeometry(placa.geometry), new THREE.LineBasicMaterial());
    placa.add(borda);
    const nome = new CSS2DObject(rotulo("whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted", b.rotulo));
    nome.position.set(-b.largura / 2 + 0.4, 0.1, b.profundidade / 2 + 0.7);
    nome.center.set(0, 0.5);
    placa.add(nome);
    cena.add(placa);
    return { placa, borda };
  });

  const predios: PredioNaCena[] = cidade.bairros.flatMap((b) => b.predios).map((predio) => {
    const grupo = new THREE.Group();
    grupo.position.set(predio.x, 0, predio.z);
    const corpo = new THREE.Mesh(
      new THREE.BoxGeometry(predio.base, predio.altura, predio.base),
      new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.94 }),
    );
    corpo.position.y = predio.altura / 2;
    corpo.castShadow = true;
    const contorno = new THREE.LineSegments(new THREE.EdgesGeometry(corpo.geometry), new THREE.LineBasicMaterial({ linewidth: 2 }));
    contorno.visible = false;
    corpo.add(contorno);
    grupo.add(corpo);

    let anel: PredioNaCena["anel"];
    let antena: PredioNaCena["antena"];
    let topo = predio.altura + 0.35;
    if (predio.app.internetFacing) {
      const materialAntena = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.9 });
      antena = materialAntena;
      const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), materialAntena);
      haste.position.y = predio.altura + 0.45;
      const ponta = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), materialAntena);
      ponta.position.y = predio.altura + 0.95;
      anel = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      anel.rotation.x = -Math.PI / 2;
      anel.position.y = predio.altura + 0.95;
      grupo.add(haste, ponta, anel);
      topo = predio.altura + 1.35;
    }
    const el = rotulo(
      "whitespace-nowrap rounded-control border border-subtle bg-surface/90 px-2 py-1 text-[11px] font-semibold text-fg shadow-raised transition-opacity",
      predio.app.name,
      String(predio.app.totalAbertas),
    );
    const nome = new CSS2DObject(el);
    nome.position.y = topo;
    nome.center.set(0.5, 1);
    grupo.add(nome);
    cena.add(grupo);
    return { predio, id: idDaAplicacao(predio.app.id), corpo, contorno, anel, antena, rotulo: el };
  });

  let montada: CenaMontada | null = null;
  const rotulos = new CSS2DRenderer({ element: camadaRotulos });
  const controles = new OrbitControls(camera, canvas);
  controles.enableDamping = !reduzido;
  controles.maxPolarAngle = Math.PI / 2.15;
  controles.minDistance = 4;
  controles.maxDistance = raio * 3;

  let selecionadoId: string | null = null;
  let hoverId: string | null = null;
  let destino: THREE.Vector3 | null = null;
  let tempo = 0;
  let redimensionar = true;

  function aplicarPaleta(): void {
    const cor = (token: string, destino: THREE.Color) => lerCorDoToken(canvas, token, destino);
    cor("--color-bg-inset", (chao.material as THREE.MeshStandardMaterial).color);
    cor("--color-border-default", materialGrade.color);
    for (const { placa, borda } of bairros) {
      cor("--color-bg-surface", (placa.material as THREE.MeshStandardMaterial).color);
      cor("--color-border-default", borda.material.color);
    }
    for (const p of predios) {
      cor(tokenDoPredio(p.predio), p.corpo.material.color);
      p.corpo.material.emissive.copy(p.corpo.material.color);
      cor(TOKEN_ACENTO, p.contorno.material.color);
      if (p.anel) cor(TOKEN_ACENTO, p.anel.material.color);
      if (p.antena) {
        cor(TOKEN_ACENTO, p.antena.color);
        p.antena.emissive.copy(p.antena.color);
      }
    }
  }

  function aplicarDestaque(): void {
    for (const p of predios) {
      const sel = p.id === selecionadoId;
      const apagado = selecionadoId !== null && !sel;
      p.corpo.material.opacity = apagado ? 0.25 : 0.94;
      p.corpo.material.emissiveIntensity = sel ? 0.45 : p.id === hoverId ? 0.25 : 0.06;
      p.contorno.visible = sel || p.id === hoverId;
      p.rotulo.style.opacity = apagado ? "0.35" : "1";
    }
  }

  // Clique = soltar o botão sem ter arrastado (arrastar é girar a câmera).
  const raycaster = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let inicioClique: { x: number; y: number } | null = null;
  function predioSob(evento: PointerEvent): PredioNaCena | undefined {
    const caixa = canvas.getBoundingClientRect();
    ponteiro.set(((evento.clientX - caixa.left) / caixa.width) * 2 - 1, -((evento.clientY - caixa.top) / caixa.height) * 2 + 1);
    raycaster.setFromCamera(ponteiro, camera);
    const [acerto] = raycaster.intersectObjects(
      predios.map((p) => p.corpo),
      false,
    );
    return acerto ? predios.find((p) => p.corpo === acerto.object) : undefined;
  }
  function aoDescer(e: PointerEvent): void {
    inicioClique = { x: e.clientX, y: e.clientY };
  }
  function aoSubir(e: PointerEvent): void {
    if (!inicioClique || Math.hypot(e.clientX - inicioClique.x, e.clientY - inicioClique.y) > 4) return;
    inicioClique = null;
    aoSelecionar(predioSob(e)?.id ?? null);
  }
  function aoMover(e: PointerEvent): void {
    if (e.pointerType === "touch") return;
    const id = predioSob(e)?.id ?? null;
    if (id === hoverId) return;
    hoverId = id;
    canvas.style.cursor = id ? "pointer" : "";
    aplicarDestaque();
  }
  canvas.addEventListener("pointerdown", aoDescer);
  canvas.addEventListener("pointerup", aoSubir);
  canvas.addEventListener("pointermove", aoMover);

  const tamanho = new ResizeObserver(() => {
    redimensionar = true;
  });
  tamanho.observe(canvas);

  function desenhar(renderer: THREE.WebGLRenderer, delta: number): void {
    if (redimensionar) {
      const largura = Math.max(1, canvas.clientWidth);
      const altura = Math.max(1, canvas.clientHeight);
      renderer.setSize(largura, altura, false);
      rotulos.setSize(largura, altura);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
      redimensionar = false;
    }
    tempo += delta;
    if (destino) {
      controles.target.lerp(destino, 0.08);
      if (controles.target.distanceTo(destino) < 0.01) destino = null;
    }
    // Pulso da antena: some com movimento reduzido (o anel fica parado e visível).
    if (!reduzido) {
      const t = (tempo % 2) / 2;
      for (const p of predios) {
        if (!p.anel) continue;
        p.anel.scale.setScalar(1 + t * 1.6);
        p.anel.material.opacity = 0.7 * (1 - t);
      }
    }
    controles.update();
    renderer.render(cena, camera);
    rotulos.render(cena, camera);
  }

  let pararDeObservarTema: (() => void) | undefined;
  // O alto contraste troca os valores dos tokens sem trocar o tema.
  const contraste = new MutationObserver(aplicarPaleta);

  function descartar(): void {
    canvas.removeEventListener("pointerdown", aoDescer);
    canvas.removeEventListener("pointerup", aoSubir);
    canvas.removeEventListener("pointermove", aoMover);
    canvas.style.cursor = "";
    tamanho.disconnect();
    contraste.disconnect();
    pararDeObservarTema?.();
    controles.dispose();
    camadaRotulos.replaceChildren();
    descartarCena(cena);
    montada?.descartar();
  }

  try {
    montada = montarCena({
      canvas,
      alvo: canvas.parentElement ?? canvas,
      fps: 60,
      maxDpr: 1.5,
      aoQuadro: desenhar,
      aoPerderContexto: () => {
        descartar();
        aoFalhar();
      },
    });
    if (!montada) throw new Error("WebGL indisponível");
    montada.renderer.shadowMap.enabled = true;
    montada.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    aplicarPaleta();
    aplicarDestaque();
    pararDeObservarTema = observarTema(aplicarPaleta);
    contraste.observe(document.documentElement, { attributes: true, attributeFilter: ["data-alto-contraste"] });
    montada.iniciar();
  } catch {
    descartar();
    return null;
  }

  return {
    selecionar(id) {
      selecionadoId = id;
      aplicarDestaque();
      const p = predios.find((x) => x.id === id);
      if (!p) return;
      const alvo = new THREE.Vector3(p.predio.x, p.predio.altura / 2, p.predio.z);
      // Movimento reduzido: salta para o prédio em vez de voar até ele.
      if (reduzido) controles.target.copy(alvo);
      else destino = alvo;
    },
    recentralizar() {
      destino = null;
      controles.target.set(0, 0, 0);
      camera.position.copy(posicaoInicial);
    },
    descartar,
  };
}
