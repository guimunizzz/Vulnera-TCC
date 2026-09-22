/**
 * Atmosfera Three.js do dashboard: ondas lentas no fundo e pequenas órbitas
 * nos KPIs. Um renderer e um RAF servem todos os recortes (viewport/scissor).
 * Consumido somente pelo canvas lazy; não atualiza estado React por frame.
 * Observers acompanham KPIs que chegam após as queries e mudanças de layout.
 */
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { ThemeResolvido } from "../../../design/theme";
import { DASHBOARD_SCENE_PALETTE } from "./dashboard-scene-palette";

interface Options {
  theme: ThemeResolvido;
  onReady?: () => void;
  onLost?: () => void;
}

const CURVAS = 18;
const AMOSTRAS = 72;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 1.5;

export function useDashboardScene(canvasRef: RefObject<HTMLCanvasElement | null>, options: Options): void {
  const callbacks = useRef(options);
  callbacks.current = options;
  const aplicarTema = useRef<((theme: ThemeResolvido) => void) | null>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element || !("WebGL2RenderingContext" in window)) return;
    const canvas: HTMLCanvasElement = element;
    const root = canvas.parentElement;
    if (!root) return;
    const host: HTMLElement = root;
    let renderer: THREE.WebGLRenderer | undefined;
    let raf = 0;
    let stopped = false;
    let lost = false;
    let visible = true;
    let width = 1;
    let height = 1;
    let previous = 0;
    let time = 0;
    let layoutDirty = true;
    let cards: { x: number; y: number; w: number; h: number }[] = [];
    let resize: ResizeObserver | undefined;
    let mutations: MutationObserver | undefined;
    let intersection: IntersectionObserver | undefined;
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
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

    const geometry = <T extends THREE.BufferGeometry>(value: T): T => {
      geometries.push(value);
      return value;
    };
    const material = <T extends THREE.Material>(value: T): T => {
      materials.push(value);
      return value;
    };

    function cleanup(): void {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      resize?.disconnect();
      mutations?.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      aplicarTema.current = null;
      delete host.dataset.sceneReady;
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      renderer?.dispose();
      renderer?.forceContextLoss();
    }

    function move(event: PointerEvent): void {
      if (event.pointerType !== "mouse") return;
      // Coordenadas da janela evitam leitura de layout em cada pointermove.
      pointer.set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
    }
    function leave(): void { pointer.set(0, 0); }
    function contextLost(event: Event): void {
      event.preventDefault();
      lost = true;
      callbacks.current.onLost?.();
      cleanup();
    }
    function visibility(): void {
      cancelAnimationFrame(raf);
      raf = 0;
      previous = 0;
      if (!stopped && !lost && visible && !document.hidden) raf = requestAnimationFrame(draw);
    }

    function measure(): void {
      if (!renderer) return;
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      cards = Array.from(host.querySelectorAll<HTMLElement>("[data-dashboard-kpi]")).map((card) => {
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
      });
      layoutDirty = false;
    }

    // Posições persistentes: apenas Y muda; nenhum objeto é criado por vértice.
    const positions = new Float32Array(CURVAS * AMOSTRAS * 3);
    let wave: THREE.BufferGeometry;
    const waveGroup = new THREE.Group();
    scene.add(waveGroup);

    function draw(now: number): void {
      if (stopped || lost || !renderer || document.hidden || !visible) return;
      raf = requestAnimationFrame(draw);
      if (previous && now - previous < FRAME_MS) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.06) : 0;
      previous = now;
      time += delta;
      if (layoutDirty) measure();
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
        renderer!.setViewport(card.x, card.y, card.w, card.h);
        renderer!.setScissor(card.x, card.y, card.w, card.h);
        renderer!.clearDepth();
        orbitalCamera.aspect = card.w / card.h;
        orbitalCamera.updateProjectionMatrix();
        orbital.rotation.set(0.45 + Math.sin(time * 0.16 + index) * 0.12, time * 0.12 + index * 0.7, -0.3);
        renderer!.render(orbitalScene, orbitalCamera);
      });
      renderer.setScissorTest(false);
      if (host.dataset.sceneReady !== "true") {
        host.dataset.sceneReady = "true";
        callbacks.current.onReady?.();
      }
    }

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      if (renderer.getContext().isContextLost()) throw new Error("Contexto WebGL indisponível");
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
      renderer.setClearAlpha(0);
      renderer.autoClear = false;

      const indices: number[] = [];
      for (let row = 0; row < CURVAS; row += 1) {
        for (let column = 0; column < AMOSTRAS; column += 1) {
          positions[(row * AMOSTRAS + column) * 3] = column / (AMOSTRAS - 1) * 2.4 - 1.2;
          if (column < AMOSTRAS - 1) indices.push(row * AMOSTRAS + column, row * AMOSTRAS + column + 1);
        }
      }
      wave = geometry(new THREE.BufferGeometry());
      wave.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      wave.setIndex(indices);
      const waveInk = material(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false }));
      const waves = new THREE.LineSegments(wave, waveInk);
      waves.frustumCulled = false;
      waveGroup.add(waves);

      const orbitInk = material(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false }));
      for (let ring = 0; ring < 3; ring += 1) {
        const points = Array.from({ length: 80 }, (_, index) => {
          const angle = index / 80 * Math.PI * 2;
          return new THREE.Vector3(Math.cos(angle) * (0.85 + ring * 0.09), Math.sin(angle) * (0.85 + ring * 0.09), 0);
        });
        const line = new THREE.LineLoop(geometry(new THREE.BufferGeometry().setFromPoints(points)), orbitInk);
        line.rotation.set(ring * 0.95, ring * 0.6, 0);
        orbital.add(line);
      }
      const core = geometry(new THREE.IcosahedronGeometry(0.3, 0));
      const coreInk = material(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.8 }));
      orbital.add(new THREE.LineSegments(geometry(new THREE.EdgesGeometry(core)), coreInk));

      aplicarTema.current = (theme) => {
        const palette = DASHBOARD_SCENE_PALETTE[theme];
        waveInk.color.set(palette.accent);
        waveInk.opacity = theme === "dark" ? 0.3 : 0.2;
        orbitInk.color.set(palette.accent);
        coreInk.color.set(palette.neutral);
      };
      aplicarTema.current(callbacks.current.theme);
      resize = new ResizeObserver(() => { layoutDirty = true; });
      resize.observe(host);
      const observeCards = () => {
        host.querySelectorAll("[data-dashboard-kpi]").forEach((card) => resize?.observe(card));
        layoutDirty = true;
      };
      mutations = new MutationObserver(observeCards);
      mutations.observe(host, { childList: true, subtree: true });
      observeCards();
      if (typeof IntersectionObserver !== "undefined") {
        intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
        intersection.observe(host);
      }
      host.addEventListener("pointermove", move, { passive: true });
      host.addEventListener("pointerleave", leave);
      canvas.addEventListener("webglcontextlost", contextLost);
      document.addEventListener("visibilitychange", visibility);
      visibility();
    } catch {
      // O fallback já está pintado: falha da GPU nunca afeta queries ou rotas.
      callbacks.current.onLost?.();
      cleanup();
    }
    return cleanup;
  }, [canvasRef]);

  useEffect(() => { aplicarTema.current?.(options.theme); }, [options.theme]);
}
