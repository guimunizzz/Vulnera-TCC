/**
 * Atmosfera Three.js do dashboard: ondas lentas no fundo e pequenas órbitas
 * nos KPIs. Um renderer e um RAF servem todos os recortes (viewport/scissor).
 * Consumido somente pelo canvas lazy; não atualiza estado React por frame.
 * Observers acompanham KPIs que chegam após as queries e mudanças de layout.
 * Renderer, loop, pausas, contexto perdido, descarte e cores vêm do kit
 * `src/three/`; aqui fica só o que é desta cena.
 */
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { montarCena, type CenaMontada } from "../../../three/scene-host";
import { descartarCena } from "../../../three/dispose";
import { lerCorDoToken, observarTema, temaAtual } from "../../../three/palette";

interface Options {
  onReady?: () => void;
  onLost?: () => void;
}

const CURVAS = 18;
const AMOSTRAS = 72;
const FPS = 30;
const MAX_DPR = 1.5;
// O mesmo canvas atende aos KPIs do dashboard e aos resumos de findings.
const CARD_SELECTOR = "[data-dashboard-kpi], [data-ambient-card]";

export function useDashboardScene(canvasRef: RefObject<HTMLCanvasElement | null>, options: Options): void {
  const callbacks = useRef(options);
  callbacks.current = options;

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const canvas: HTMLCanvasElement = element;
    const root = canvas.parentElement;
    if (!root) return;
    const host: HTMLElement = root;
    let cena: CenaMontada | null = null;
    let stopped = false;
    let width = 1;
    let height = 1;
    let time = 0;
    let layoutDirty = true;
    let cards: { x: number; y: number; w: number; h: number }[] = [];
    let resize: ResizeObserver | undefined;
    let mutations: MutationObserver | undefined;
    let pararDeObservarTema: (() => void) | undefined;
    const pointer = new THREE.Vector2();
    const smoothPointer = new THREE.Vector2();
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.z = 5;
    const orbitalScene = new THREE.Scene();
    const orbitalCamera = new THREE.PerspectiveCamera(35, 1.8, 0.1, 20);
    orbitalCamera.position.z = 5.2;
    const orbital = new THREE.Group();
    orbitalScene.add(orbital);

    function cleanup(): void {
      if (stopped) return;
      stopped = true;
      resize?.disconnect();
      mutations?.disconnect();
      pararDeObservarTema?.();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      delete host.dataset.sceneReady;
      descartarCena(scene, orbitalScene);
      cena?.descartar();
    }

    function move(event: PointerEvent): void {
      if (event.pointerType !== "mouse") return;
      // Coordenadas da janela evitam leitura de layout em cada pointermove.
      pointer.set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
    }
    function leave(): void { pointer.set(0, 0); }

    function measure(renderer: THREE.WebGLRenderer): void {
      // No layout global o conteúdo pode ter milhares de pixels de altura.
      // O buffer WebGL segue o tamanho visível do canvas, nunca a página toda.
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      cards = Array.from(host.querySelectorAll<HTMLElement>(CARD_SELECTOR)).map((card) => {
        // offset ignora o translateY temporário do stagger de entrada.
        let left = 0;
        let top = 0;
        let node: HTMLElement | null = card;
        while (node && node !== host) {
          left += node.offsetLeft;
          top += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        const w = Math.min(140, card.offsetWidth * 0.42);
        const h = Math.min(90, card.offsetHeight * 0.6);
        return { x: left + card.offsetWidth - w - 6, y: height - top - card.offsetHeight + 2, w, h };
      }).filter((card) => card.x + card.w > 0 && card.x < width && card.y + card.h > 0 && card.y < height);
      layoutDirty = false;
    }

    // Posições persistentes: apenas Y muda; nenhum objeto é criado por vértice.
    const positions = new Float32Array(CURVAS * AMOSTRAS * 3);
    const waveGroup = new THREE.Group();
    scene.add(waveGroup);

    const indices: number[] = [];
    for (let row = 0; row < CURVAS; row += 1) {
      for (let column = 0; column < AMOSTRAS; column += 1) {
        positions[(row * AMOSTRAS + column) * 3] = column / (AMOSTRAS - 1) * 2.4 - 1.2;
        if (column < AMOSTRAS - 1) indices.push(row * AMOSTRAS + column, row * AMOSTRAS + column + 1);
      }
    }
    const wave = new THREE.BufferGeometry();
    wave.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    wave.setIndex(indices);
    const waveInk = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false });
    const waves = new THREE.LineSegments(wave, waveInk);
    waves.frustumCulled = false;
    waveGroup.add(waves);

    const orbitInk = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
    for (let ring = 0; ring < 3; ring += 1) {
      const points = Array.from({ length: 80 }, (_, index) => {
        const angle = index / 80 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * (0.85 + ring * 0.09), Math.sin(angle) * (0.85 + ring * 0.09), 0);
      });
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), orbitInk);
      line.rotation.set(ring * 0.95, ring * 0.6, 0);
      orbital.add(line);
    }
    // A icosaédrica só serve de molde para as arestas e nunca entra na cena,
    // então `descartarCena` não a alcançaria.
    const core = new THREE.IcosahedronGeometry(0.3, 0);
    const coreInk = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.8 });
    orbital.add(new THREE.LineSegments(new THREE.EdgesGeometry(core), coreInk));
    core.dispose();

    function aplicarPaleta(): void {
      lerCorDoToken(canvas, "--color-ambient-ink", waveInk.color);
      lerCorDoToken(canvas, "--color-ambient-ink", orbitInk.color);
      lerCorDoToken(canvas, "--color-ambient-muted", coreInk.color);
      waveInk.opacity = temaAtual() === "dark" ? 0.3 : 0.2;
    }

    function draw(renderer: THREE.WebGLRenderer, delta: number): void {
      time += delta;
      if (layoutDirty) measure(renderer);
      smoothPointer.lerp(pointer, 0.035);
      for (let row = 0; row < CURVAS; row += 1) {
        for (let column = 0; column < AMOSTRAS; column += 1) {
          const index = (row * AMOSTRAS + column) * 3;
          const x = positions[index];
          positions[index + 1] = 0.42 - row * 0.037
            + Math.sin(x * 2.3 + time * 0.22 + row * 0.08) * 0.22
            + Math.cos(x * 4.1 - time * 0.13) * 0.09;
        }
      }
      wave.getAttribute("position").needsUpdate = true;
      waveGroup.position.set(smoothPointer.x * 0.025, smoothPointer.y * 0.018, 0);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setScissorTest(true);
      cards.forEach((card, index) => {
        renderer.setViewport(card.x, card.y, card.w, card.h);
        renderer.setScissor(card.x, card.y, card.w, card.h);
        renderer.clearDepth();
        orbitalCamera.aspect = card.w / card.h;
        orbitalCamera.updateProjectionMatrix();
        orbital.rotation.set(0.45 + Math.sin(time * 0.16 + index) * 0.12, time * 0.12 + index * 0.7, -0.3);
        renderer.render(orbitalScene, orbitalCamera);
      });
      renderer.setScissorTest(false);
      if (host.dataset.sceneReady !== "true") {
        host.dataset.sceneReady = "true";
        callbacks.current.onReady?.();
      }
    }

    try {
      cena = montarCena({
        canvas,
        alvo: host,
        fps: FPS,
        maxDpr: MAX_DPR,
        aoQuadro: draw,
        aoPerderContexto: () => {
          callbacks.current.onLost?.();
          cleanup();
        },
      });
      if (!cena) throw new Error("WebGL indisponível");
      // Ondas e órbitas dividem o mesmo buffer: a limpeza é manual por recorte.
      cena.renderer.autoClear = false;
      aplicarPaleta();
      pararDeObservarTema = observarTema(aplicarPaleta);
      resize = new ResizeObserver(() => { layoutDirty = true; });
      resize.observe(host);
      resize.observe(canvas);
      const observeCards = () => {
        host.querySelectorAll(CARD_SELECTOR).forEach((card) => resize?.observe(card));
        layoutDirty = true;
      };
      mutations = new MutationObserver(observeCards);
      mutations.observe(host, { childList: true, subtree: true });
      observeCards();
      host.addEventListener("pointermove", move, { passive: true });
      host.addEventListener("pointerleave", leave);
      cena.iniciar();
    } catch {
      // O fallback já está pintado: falha da GPU nunca afeta queries ou rotas.
      callbacks.current.onLost?.();
      cleanup();
    }
    return cleanup;
  }, [canvasRef]);
}
