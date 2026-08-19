/**
 * use-hero-scene.ts
 *
 * O QUE FAZ
 * O hook pedido em `docs/BACKLOG.md` (task 8.12): monta a cena Three.js do
 * hero da landing — lâmina wireframe com "glow" aditivo, campo de partículas
 * (sakura/cyber-spark) e o passe ASCII + aberração cromática + scanlines de
 * `shaders.ts` — num `<canvas>` recebido por ref, e desfaz TUDO no unmount.
 *
 * CONTRATO DE DEGRADAÇÃO (ver ADR-026 §4)
 * A cena só monta se `enabled` for true (o chamador decide isso a partir de
 * `useMotion().reduzido` — nunca aqui) E o navegador anunciar suporte a
 * WebGL2 (`"WebGL2RenderingContext" in window`, uma checagem que NÃO toca o
 * canvas — ver a nota em `supportsWebGL2`). Qualquer exceção durante a
 * montagem é capturada: a função simplesmente não chama `onReady`, e quem
 * usa o hook (`cyber-canvas.tsx`) já deixa o gradiente CSS de fallback visível
 * por padrão. Nenhum estado de "não suportado" precisa ser propagado.
 *
 * POR QUE NÃO HÁ LUZ NA CENA
 * Todo material é `MeshBasicMaterial`/`LineBasicMaterial`/`ShaderMaterial`
 * não-iluminado. O passe ASCII reduz cada célula a UM glifo escolhido pelo
 * luma — sombreamento fino de uma `MeshStandardMaterial` seria computado e
 * depois descartado pela quantização, então calculá-lo é custo puro sem
 * efeito visível.
 *
 * LIMPEZA (a exigência literal do backlog)
 * `dispose()` em toda geometria/material/textura, `composer.dispose()` (que
 * derruba os render targets internos do EffectComposer),
 * `cancelAnimationFrame`, remoção de listeners, e
 * `renderer.forceContextLoss()` — sem isso, alternar landing → dashboard →
 * landing várias vezes vaza um contexto WebGL por visita (o teto por página é
 * baixo nos navegadores baseados em ANGLE/Chromium).
 *
 * QUEM USA
 * `cyber-canvas.tsx`.
 */

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { buildGlyphAtlas, ASCII_RAMP } from "./glyph-atlas";
import {
  ASCII_FRAGMENT_SHADER,
  ASCII_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  createAsciiUniforms,
} from "./shaders";
import { LANDING_ACCENT, LANDING_PARTICLE, LANDING_VOID } from "./landing-palette";

export interface UseHeroSceneOptions {
  /** `false` quando `prefers-reduced-motion` pede menos movimento — decidido
   * pelo chamador via `useMotion()`, nunca dentro deste hook. */
  enabled: boolean;
  /** Chamado uma única vez, depois que a primeira cena está pronta pra
   * renderizar — é o sinal para `cyber-canvas.tsx` cross-fade do canvas sobre
   * o gradiente CSS. Nunca chamado se a cena não montar. */
  onReady?: () => void;
  /** Chamado se o contexto WebGL morrer DEPOIS de `onReady` (driver de GPU
   * caindo, aba em segundo plano perdendo o contexto em mobile, ambiente com
   * software rendering degenerado — visto de verdade rodando este componente
   * em Chromium headless via Playwright: o contexto "morria" silenciosamente
   * bem depois de `new WebGLRenderer()` retornar sem erro). Sem isso,
   * `cyber-canvas.tsx` ficaria com um canvas opaco e QUEBRADO por cima do
   * gradiente de fallback — pior que nunca ter mostrado o canvas. */
  onLost?: () => void;
}

const MAX_PIXEL_RATIO = 1.75;
const PARTICLE_COUNT = 220;
const GLITCH_MIN_INTERVAL_S = 4.8;
const GLITCH_MAX_INTERVAL_S = 8.2;
const GLITCH_BURST_S = 0.18;

/** Só verifica se a API existe no `window` — NÃO chama `canvas.getContext`.
 * Chamar `getContext` aqui e de novo dentro do `WebGLRenderer` (com atributos
 * diferentes) faria o segundo pedido ser ignorado pela spec do Canvas
 * (o contexto já existe, os novos atributos não se aplicam) — silenciosamente
 * anulando `antialias:false`/`alpha:false`. */
function supportsWebGL2(): boolean {
  return typeof window !== "undefined" && "WebGL2RenderingContext" in window;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Perfil 2D estilizado de lâmina — não é um katana realista (sem pipeline de
 * asset pra isso), é a "forma geométrica / wireframe" que o briefing autoriza
 * como alternativa. Poligonagem baixa de propósito. */
function buildBladeGeometry(): THREE.BufferGeometry {
  const length = 3.2;
  const width = 0.22;

  const shape = new THREE.Shape();
  shape.moveTo(0, -width * 0.5);
  shape.lineTo(length * 0.82, -width * 0.32);
  shape.quadraticCurveTo(length * 0.97, -width * 0.08, length, width * 0.02);
  shape.quadraticCurveTo(length * 0.97, width * 0.18, length * 0.82, width * 0.34);
  shape.lineTo(0, width * 0.5);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 24,
  });
  geometry.center();
  return geometry;
}

/** Wireframe (arestas) + "glow shell" aditivo — o fake-bloom barato descrito
 * no cabeçalho de `shaders.ts`. Devolve um grupo pronto pra rotacionar. */
function buildBladeGroup(): THREE.Group {
  const geometry = buildBladeGeometry();

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 12),
    new THREE.LineBasicMaterial({ color: LANDING_ACCENT.glow, transparent: true, opacity: 0.85 }),
  );

  const glow = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: LANDING_ACCENT.core,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.setScalar(1.09);

  const group = new THREE.Group();
  group.add(glow, edges);
  group.position.set(1.15, -0.15, -0.6);
  group.rotation.set(0.18, 0.55, -0.22);
  return group;
}

function buildParticles(pixelRatio: number): THREE.Points {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const kinds = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1.5;
    seeds[i] = Math.random();
    sizes[i] = 3 + Math.random() * 5; // ver o comentário do `gl_PointSize` em shaders.ts sobre a escala
    // ~72% cyber-spark violeta, ~28% pétala de sakura — a mistura fica
    // reconhecível como "as duas coisas" sem virar 50/50 (que lê como ruído).
    kinds[i] = Math.random() < 0.72 ? 0 : 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSparkColor: { value: new THREE.Color(LANDING_PARTICLE.spark) },
      uSakuraColor: { value: new THREE.Color(LANDING_PARTICLE.sakura) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

export function useHeroScene(canvasRef: RefObject<HTMLCanvasElement | null>, options: UseHeroSceneOptions): void {
  const { enabled, onReady, onLost } = options;
  // Refs porque os callbacks não precisam (e não devem) reexecutar o efeito.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled || !supportsWebGL2()) return;

    let rafId = 0;
    let disposed = false;

    // Os recursos que precisam de dispose explícito no cleanup. Declarados
    // fora do try pra o cleanup conseguir liberar o que chegou a ser criado
    // mesmo que uma etapa do meio lance.
    let renderer: THREE.WebGLRenderer | undefined;
    let composer: EffectComposer | undefined;
    let scene: THREE.Scene | undefined;
    let glyphTexture: THREE.CanvasTexture | undefined;

    try {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });

      // O construtor pode retornar SEM lançar mesmo com um contexto morto —
      // visto de verdade num Chromium headless com software rendering
      // degenerado (sem GPU real): `new WebGLRenderer()` completou, mas o
      // contexto já estava "lost", e a cena renderizava um quadro
      // quebrado/em branco por cima do fallback em vez de nunca ter montado.
      // Checar aqui garante que "montou sem lançar" e "está realmente
      // pronto pra desenhar" sejam a MESMA coisa — cai no catch como
      // qualquer outra falha de montagem.
      if (renderer.getContext().isContextLost()) {
        throw new Error("WebGL context já estava perdido logo após a criação do renderer.");
      }

      renderer.setPixelRatio(pixelRatio);
      renderer.setClearColor(new THREE.Color(LANDING_VOID.mid), 1);

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
      camera.position.set(0, 0, 5);

      scene = new THREE.Scene();
      const bladeGroup = buildBladeGroup();
      const particles = buildParticles(pixelRatio);
      scene.add(bladeGroup, particles);

      glyphTexture = buildGlyphAtlas();
      const asciiUniforms = createAsciiUniforms(glyphTexture, ASCII_RAMP.length);

      // `ShaderPass` CLONA o objeto de uniforms quando recebe um descritor
      // plano ({uniforms, vertexShader, fragmentShader}) — só copia o VALOR
      // inicial, não a referência. Atualizar `asciiUniforms.uTime.value =
      // ...` por frame estaria escrevendo num objeto que o material
      // renderizado nunca lê, e `uResolution` ficaria congelado no default
      // (1,1) pra sempre — foi exatamente o que aconteceu na primeira
      // versão: a grade de células inteira colapsava pra UM texel só
      // (fora do range [0,1], clampado na borda), e a tela inteira virava
      // uma cor sólida. Construir o `ShaderMaterial` à mão e passar a
      // INSTÂNCIA pro `ShaderPass` evita o clone: `asciiPass.uniforms` e
      // `asciiUniforms` passam a ser o MESMO objeto.
      const asciiMaterial = new THREE.ShaderMaterial({
        uniforms: asciiUniforms,
        vertexShader: ASCII_VERTEX_SHADER,
        fragmentShader: ASCII_FRAGMENT_SHADER,
      });

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const asciiPass = new ShaderPass(asciiMaterial);
      asciiPass.renderToScreen = true;
      composer.addPass(asciiPass);

      const resize = (): void => {
        if (!renderer || !composer) return;
        const parent = canvas.parentElement ?? canvas;
        const width = Math.max(1, parent.clientWidth || window.innerWidth);
        const height = Math.max(1, parent.clientHeight || window.innerHeight);

        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const currentPixelRatio = renderer.getPixelRatio();
        asciiUniforms.uResolution.value.set(width * currentPixelRatio, height * currentPixelRatio);
      };
      resize();

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement ?? canvas);

      // Parallax sutil: a câmera segue o ponteiro com lerp, nunca teleporta.
      const pointerTarget = { x: 0, y: 0 };
      const handlePointerMove = (event: PointerEvent): void => {
        const parent = canvas.parentElement ?? canvas;
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointerTarget.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      };
      window.addEventListener("pointermove", handlePointerMove, { passive: true });

      const clock = new THREE.Clock();
      let nextGlitchAt = randomBetween(GLITCH_MIN_INTERVAL_S, GLITCH_MAX_INTERVAL_S);
      let glitchActiveUntil = 0;

      const animate = (): void => {
        if (disposed || !renderer || !composer || !scene) return;
        const elapsed = clock.getElapsedTime();
        const delta = clock.getDelta();

        bladeGroup.rotation.y += delta * 0.12;
        bladeGroup.rotation.x = 0.18 + Math.sin(elapsed * 0.35) * 0.04;

        (particles.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;

        camera.position.x += (pointerTarget.x * 0.35 - camera.position.x) * Math.min(1, delta * 2.4);
        camera.position.y += (pointerTarget.y * 0.2 - camera.position.y) * Math.min(1, delta * 2.4);
        camera.lookAt(0, 0, 0);

        asciiUniforms.uTime.value = elapsed;
        if (elapsed >= nextGlitchAt && elapsed >= glitchActiveUntil) {
          glitchActiveUntil = elapsed + GLITCH_BURST_S;
          nextGlitchAt = elapsed + randomBetween(GLITCH_MIN_INTERVAL_S, GLITCH_MAX_INTERVAL_S);
          asciiUniforms.uGlitchBandY.value = Math.random();
        }
        asciiUniforms.uGlitchAmount.value = elapsed < glitchActiveUntil ? 1 : 0;

        composer.render(delta);
        rafId = requestAnimationFrame(animate);
      };

      if (!document.hidden) rafId = requestAnimationFrame(animate);

      const handleVisibility = (): void => {
        if (document.hidden) {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = 0;
        } else if (!rafId && !disposed) {
          clock.getDelta(); // descarta o intervalo parado — evita um "salto" de tempo
          rafId = requestAnimationFrame(animate);
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      // Proteção contínua: o contexto pode morrer DEPOIS de `onReady` (driver
      // de GPU, aba perdendo o contexto em segundo plano no mobile). Sem
      // isso o loop continuaria chamando `composer.render()` num contexto
      // morto — no melhor caso sem efeito, no pior desenhando lixo. Não
      // tenta recriar a cena na restauração (`webglcontextrestored`): pra um
      // fundo decorativo, um remount completo não vale a complexidade —
      // fica no fallback estático pelo resto da visita.
      const handleContextLost = (event: Event): void => {
        event.preventDefault();
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        onLostRef.current?.();
      };
      canvas.addEventListener("webglcontextlost", handleContextLost, false);

      onReadyRef.current?.();

      return () => {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        document.removeEventListener("visibilitychange", handleVisibility);
        canvas.removeEventListener("webglcontextlost", handleContextLost);
        window.removeEventListener("pointermove", handlePointerMove);
        resizeObserver.disconnect();

        scene?.traverse((obj) => {
          const disposable = obj as unknown as {
            geometry?: THREE.BufferGeometry;
            material?: THREE.Material | THREE.Material[];
          };
          disposable.geometry?.dispose();
          if (Array.isArray(disposable.material)) disposable.material.forEach((m) => m.dispose());
          else disposable.material?.dispose();
        });

        glyphTexture?.dispose();
        composer?.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss();
      };
    } catch (error) {
      // Qualquer falha de montagem (GPU bloqueada, extensão ausente, etc.)
      // vira fallback silencioso — o gradiente CSS já está visível por trás.
      console.warn("[cyber-canvas] cena 3D não pôde iniciar — usando fallback estático.", error);
      composer?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onReady` é lido via ref de propósito (ver comentário acima)
  }, [canvasRef, enabled]);
}
