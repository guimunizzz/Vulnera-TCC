/**
 * three/scene-host.ts
 *
 * O QUE FAZ
 * Monta o "hospedeiro" de uma cena: `WebGLRenderer` com DPR limitado, loop com
 * orçamento de fps e pausas, e tratamento de perda de contexto. Devolve `null`
 * quando não há como desenhar — o fallback CSS já pintado continua sozinho.
 *
 * POR QUE EXISTE
 * Estas são as partes que toda cena decorativa precisa e que é fácil esquecer
 * (DPR, pausa, contexto perdido, `forceContextLoss`). O conteúdo da cena —
 * geometria, câmera, o que desenhar a cada quadro — fica no hook de cada uma.
 *
 * QUEM USA
 * `use-dashboard-scene.ts` e, a partir da Fase 4, a cena da landing.
 */

import * as THREE from "three";
import { criarLoop } from "./loop";

export interface OpcoesDaCena {
  canvas: HTMLCanvasElement;
  /** Elemento cuja visibilidade na viewport pausa o loop. */
  alvo: Element;
  fps: number;
  maxDpr: number;
  powerPreference?: WebGLPowerPreference;
  antialias?: boolean;
  aoQuadro: (renderer: THREE.WebGLRenderer, delta: number, agora: number) => void;
  /** Contexto perdido no meio da sessão; o hospedeiro já se descartou. */
  aoPerderContexto?: () => void;
}

export interface CenaMontada {
  renderer: THREE.WebGLRenderer;
  /** Começa a desenhar — chame depois de montar o conteúdo da cena. */
  iniciar: () => void;
  /** Para o loop, solta listeners e libera renderer e contexto. Idempotente. */
  descartar: () => void;
}

export function montarCena(opcoes: OpcoesDaCena): CenaMontada | null {
  const { canvas } = opcoes;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: opcoes.antialias ?? true,
      powerPreference: opcoes.powerPreference ?? "low-power",
    });
    // O construtor pode retornar com o contexto já morto (ADR-026): o canvas
    // ficaria opaco e quebrado por cima do fallback.
    if (renderer.getContext().isContextLost()) {
      renderer.dispose();
      return null;
    }
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opcoes.maxDpr));
  renderer.setClearAlpha(0);

  let descartado = false;
  const loop = criarLoop({
    fps: opcoes.fps,
    alvo: opcoes.alvo,
    aoQuadro: (delta, agora) => opcoes.aoQuadro(renderer, delta, agora),
  });

  function perdeuContexto(evento: Event): void {
    evento.preventDefault();
    descartar();
    opcoes.aoPerderContexto?.();
  }

  function descartar(): void {
    if (descartado) return;
    descartado = true;
    loop.parar();
    canvas.removeEventListener("webglcontextlost", perdeuContexto);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  canvas.addEventListener("webglcontextlost", perdeuContexto);
  return { renderer, iniciar: loop.iniciar, descartar };
}
