/**
 * scene-host.test.ts
 *
 * Contrato do hospedeiro de cena (kit three.js, Fase 2 do refactor web-motion-3d).
 * O jsdom não tem WebGL: `WebGLRenderer` é trocado por um falso com espiões, e
 * RAF/IntersectionObserver são controlados à mão.
 *   KIT-01  sem WebGL (construtor lança) → null, fallback CSS fica sozinho
 *   KIT-02  contexto já perdido na criação → null e renderer descartado
 *   KIT-03  DPR limitado ao máximo configurado
 *   KIT-04  orçamento de fps: 30 fps não desenha a cada quadro de 60 Hz
 *   KIT-05  aba oculta pausa (sem RAF agendado) e retoma ao voltar
 *   KIT-06  alvo fora da viewport pausa
 *   KIT-07  descartar libera RAF, observers, listeners, renderer e contexto
 *   KIT-08  webglcontextlost descarta e avisa
 *   KIT-09  jitter do relógio não derruba quadros (60 Hz real: 60 fps desenha
 *           todos, 30 fps desenha um sim, outro não)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ lancar: false, perdido: false, instancias: [] as unknown[] }));

vi.mock("three", async () => {
  const real = await vi.importActual<typeof import("three")>("three");
  class WebGLRendererFalso {
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    setPixelRatio = vi.fn();
    setClearAlpha = vi.fn();
    getContext = () => ({ isContextLost: () => estado.perdido });
    constructor() {
      if (estado.lancar) throw new Error("Error creating WebGL context.");
      estado.instancias.push(this);
    }
  }
  return { ...real, WebGLRenderer: WebGLRendererFalso };
});

import { montarCena, type CenaMontada, type OpcoesDaCena } from "./scene-host";

type Renderer = { dispose: ReturnType<typeof vi.fn>; forceContextLoss: ReturnType<typeof vi.fn>; setPixelRatio: ReturnType<typeof vi.fn> };

let fila: Map<number, FrameRequestCallback>;
let proximoId: number;
let observadores: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[];
let oculto: boolean;
let montadas: CenaMontada[];

// Cada teste descarta o que montou: um loop esquecido manteria o listener de
// visibilitychange no document e contaminaria o teste seguinte.
function montar(extra: Partial<OpcoesDaCena> = {}): CenaMontada {
  const cena = montarCena(opcoes(extra));
  if (!cena) throw new Error("esperava uma cena montada");
  montadas.push(cena);
  return cena;
}

function rodarQuadro(agora: number): void {
  const pendentes = [...fila.values()];
  fila.clear();
  pendentes.forEach((cb) => cb(agora));
}

function definirVisibilidadeDaAba(escondida: boolean): void {
  oculto = escondida;
  document.dispatchEvent(new Event("visibilitychange"));
}

function opcoes(extra: Partial<OpcoesDaCena> = {}): OpcoesDaCena {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  return { canvas, alvo: canvas, fps: 30, maxDpr: 1.5, aoQuadro: vi.fn(), ...extra };
}

beforeEach(() => {
  estado.lancar = false;
  estado.perdido = false;
  estado.instancias = [];
  fila = new Map();
  proximoId = 1;
  observadores = [];
  oculto = false;
  montadas = [];
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { const id = proximoId++; fila.set(id, cb); return id; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { fila.delete(id); }));
  vi.stubGlobal("IntersectionObserver", class {
    disconnect = vi.fn();
    constructor(public callback: IntersectionObserverCallback) { observadores.push(this); }
    observe() {}
    unobserve() {}
  });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => oculto });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
});

afterEach(() => {
  montadas.forEach((cena) => cena.descartar());
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("montarCena", () => {
  it("KIT-01 — sem WebGL devolve null sem lançar", () => {
    estado.lancar = true;
    expect(montarCena(opcoes())).toBeNull();
  });

  it("KIT-02 — contexto já perdido na criação devolve null e descarta o renderer", () => {
    estado.perdido = true;
    expect(montarCena(opcoes())).toBeNull();
    expect((estado.instancias[0] as Renderer).dispose).toHaveBeenCalledTimes(1);
  });

  it("KIT-03 — limita o DPR ao máximo configurado", () => {
    const cena = montar({ maxDpr: 1.5 });
    expect((cena.renderer as unknown as Renderer).setPixelRatio).toHaveBeenCalledWith(1.5);
  });

  it("KIT-04 — respeita o orçamento de fps", () => {
    const aoQuadro = vi.fn();
    montar({ aoQuadro, fps: 30 }).iniciar();
    // Quadros a cada 10 ms: o orçamento de 33,3 ms (com 15% de tolerância ao
    // jitter, 28,3 ms) deixa passar 1000, 1030, 1060 e 1090.
    for (let agora = 1000; agora <= 1100; agora += 10) rodarQuadro(agora);
    // Argumentos de aoQuadro: (renderer, delta, agora).
    expect(aoQuadro.mock.calls.map((chamada) => chamada[2])).toEqual([1000, 1030, 1060, 1090]);
    expect(aoQuadro.mock.calls[0][1]).toBe(0); // primeiro quadro sem salto de tempo
    expect(aoQuadro.mock.calls[1][1]).toBeCloseTo(0.03);
  });

  it("KIT-09 — jitter do relógio não derruba quadros", () => {
    // Monitor de 60 Hz real: intervalos de 16,5 a 16,8 ms.
    const tempos = [1000];
    for (let i = 0; i < 12; i += 1) tempos.push(tempos[tempos.length - 1] + (i % 2 ? 16.8 : 16.5));

    const a60 = vi.fn();
    montar({ aoQuadro: a60, fps: 60 }).iniciar();
    tempos.forEach(rodarQuadro);
    expect(a60).toHaveBeenCalledTimes(tempos.length);

    montadas.forEach((cena) => cena.descartar());
    const a30 = vi.fn();
    montar({ aoQuadro: a30, fps: 30 }).iniciar();
    tempos.forEach((t) => rodarQuadro(t + 1000));
    // Um sim, outro não: 13 quadros → 7 desenhos, cadência fixa de ~33 ms.
    expect(a30).toHaveBeenCalledTimes(7);
    const intervalos = a30.mock.calls.slice(1).map((c, i) => c[2] - a30.mock.calls[i][2]);
    intervalos.forEach((ms) => expect(ms).toBeCloseTo(33.3, 0));
  });

  it("KIT-05 — aba oculta pausa o loop e a volta retoma", () => {
    const aoQuadro = vi.fn();
    montar({ aoQuadro }).iniciar();
    rodarQuadro(1000);
    definirVisibilidadeDaAba(true);
    expect(fila.size).toBe(0);
    rodarQuadro(2000);
    expect(aoQuadro).toHaveBeenCalledTimes(1);

    definirVisibilidadeDaAba(false);
    expect(fila.size).toBe(1);
    rodarQuadro(3000);
    expect(aoQuadro).toHaveBeenCalledTimes(2);
  });

  it("KIT-06 — alvo fora da viewport pausa o loop", () => {
    const aoQuadro = vi.fn();
    montar({ aoQuadro }).iniciar();
    observadores[0].callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(fila.size).toBe(0);
    observadores[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(fila.size).toBe(1);
  });

  it("KIT-07 — descartar libera tudo e é idempotente", () => {
    const base = opcoes();
    const removerDoc = vi.spyOn(document, "removeEventListener");
    const removerCanvas = vi.spyOn(base.canvas, "removeEventListener");
    const cena = montarCena(base)!;
    cena.iniciar();
    const renderer = cena.renderer as unknown as Renderer;

    cena.descartar();
    cena.descartar();

    expect(fila.size).toBe(0);
    expect(observadores[0].disconnect).toHaveBeenCalled();
    expect(removerDoc).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(removerCanvas).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    // Sem listener: aba voltando não reagenda nada.
    definirVisibilidadeDaAba(false);
    expect(fila.size).toBe(0);
  });

  it("KIT-08 — contexto perdido no meio da sessão descarta e avisa", () => {
    const aoPerderContexto = vi.fn();
    const base = opcoes({ aoPerderContexto });
    const cena = montarCena(base)!;
    cena.iniciar();
    const evento = new Event("webglcontextlost", { cancelable: true });

    base.canvas.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(aoPerderContexto).toHaveBeenCalledTimes(1);
    expect((cena.renderer as unknown as Renderer).dispose).toHaveBeenCalledTimes(1);
    expect(fila.size).toBe(0);
  });
});
