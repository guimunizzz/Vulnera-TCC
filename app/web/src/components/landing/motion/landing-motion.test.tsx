/**
 * landing-motion.test.tsx
 *
 * Setup central do GSAP na landing (Fase 3 do refactor web-motion-3d). O GSAP
 * é trocado por um falso que registra cada pedido: aqui se verifica O QUE cada
 * seção pede em cada condição, não a interpolação (responsabilidade da lib).
 *   MOT-02  useMovimentoLanding entrega as condições lidas das media queries,
 *           refaz quando uma muda e limpa no unmount (contagem real de
 *           ScrollTriggers em landing-motion-real.test.tsx)
 *   MOT-03  useRecalculoDoScroll chama refresh após as fontes e quando a altura
 *           muda, uma vez por quadro, e para no unmount
 *   SEC-01  Como funciona, normal/desktop: escalonamento e linha com scrub
 *   SEC-02  Como funciona, reduzido: só fade curto, sem linha
 *   SEC-03  Como funciona, mobile: sem linha
 *   SEC-04  Maturidade, reduzido: estado final de uma vez, sem timeline
 *   SEC-05  Maturidade, normal: timeline única com gatilho once
 *   SEC-06  Chamada final: escala só sem movimento reduzido; scrub no trecho
 *   SEC-07  Barra de progresso: suavizada no normal, colada no reduzido
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

type Pedido = { metodo: string; alvo: unknown; vars: Record<string, any>; de?: Record<string, any>; posicao?: unknown };

const falso = vi.hoisted(() => ({
  pedidos: [] as Pedido[],
  timelines: [] as { vars: Record<string, any>; pedidos: Pedido[] }[],
  refresh: vi.fn(),
}));

vi.mock("./gsap", async () => {
  const { useLayoutEffect } = await import("react");
  const registrar = (lista: Pedido[]) => ({
    from: (alvo: unknown, vars: Record<string, any>) => { lista.push({ metodo: "from", alvo, vars }); },
    to: (alvo: unknown, vars: Record<string, any>, posicao?: unknown) => { lista.push({ metodo: "to", alvo, vars, posicao }); },
    fromTo: (alvo: unknown, de: Record<string, any>, vars: Record<string, any>, posicao?: unknown) => {
      lista.push({ metodo: "fromTo", alvo, de, vars, posicao });
    },
    set: (alvo: unknown, vars: Record<string, any>) => { lista.push({ metodo: "set", alvo, vars }); },
  });
  const gsap = {
    ...registrar(falso.pedidos),
    timeline: (vars: Record<string, any>) => {
      const tl = { vars, pedidos: [] as Pedido[] };
      const metodos = registrar(tl.pedidos);
      const encadeavel = Object.fromEntries(
        Object.entries(metodos).map(([nome, fn]) => [nome, (...args: unknown[]) => { (fn as (...a: unknown[]) => void)(...args); return encadeavel; }]),
      );
      falso.timelines.push(tl);
      return encadeavel;
    },
  };
  return {
    gsap,
    ScrollTrigger: { refresh: falso.refresh, getAll: () => [] },
    // useGSAP falso: roda no layout effect, refaz quando as dependências
    // mudam e usa o retorno como cleanup — o contrato do real.
    useGSAP: (fn: () => void | (() => void), config?: { dependencies?: unknown[] }) => {
      useLayoutEffect(() => {
        const limpar = fn();
        return typeof limpar === "function" ? limpar : undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, config?.dependencies ?? []);
    },
  };
});

import { useMovimentoLanding, useRecalculoDoScroll } from "./use-landing-motion";
import { DESLOCAMENTO_LANDING, DURACAO_LANDING, ESCALONAMENTO_LANDING, SCRUB_LANDING } from "./tokens";
import { DURACAO } from "../../../motion/tokens";
import HowItWorks from "../sections/how-it-works";
import Maturity from "../sections/maturity";
import FinalCTA from "../sections/final-cta";
import { ScrollProgress } from "../ui";

/** Media queries controláveis: o teste muda e avisa como o navegador. */
const midia = { reduzido: false, desktop: true, ouvintes: new Set<() => void>() };
function instalarMidia(): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      if (query.includes("prefers-reduced-motion: reduce")) return midia.reduzido;
      if (query.includes("min-width")) return midia.desktop;
      return false;
    },
    media: query,
    addEventListener: (_: string, ouvinte: () => void) => midia.ouvintes.add(ouvinte),
    removeEventListener: (_: string, ouvinte: () => void) => midia.ouvintes.delete(ouvinte),
  }));
}
function condicoes(c: { reduzido?: boolean; desktop?: boolean }) {
  midia.reduzido = c.reduzido ?? false;
  midia.desktop = c.desktop ?? true;
}
function avisarMudanca(): void {
  act(() => midia.ouvintes.forEach((ouvinte) => ouvinte()));
}

beforeEach(async () => {
  // Um recálculo agendado pelo teste anterior (quadro ainda pendente no jsdom)
  // seguraria o agendador, que roda no máximo um refresh por quadro.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  // Esvazia no lugar: o GSAP falso guarda a referência deste array.
  falso.pedidos.length = 0;
  falso.timelines = [];
  falso.refresh.mockClear();
  midia.ouvintes.clear();
  instalarMidia();
  condicoes({});
  // jsdom não implementa medida de SVG.
  (SVGElement.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 120;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMovimentoLanding", () => {
  it("MOT-02 — entrega as condições, refaz quando uma muda e limpa no unmount", () => {
    const limpar = vi.fn();
    const animar = vi.fn(() => limpar);
    function Sonda() {
      const ref = { current: document.createElement("section") };
      useMovimentoLanding(ref, animar);
      return null;
    }
    const { unmount } = render(<Sonda />);
    expect(animar).toHaveBeenLastCalledWith({ reduzido: false, normal: true, desktop: true });

    condicoes({ reduzido: true });
    avisarMudanca();
    expect(limpar).toHaveBeenCalledTimes(1);
    expect(animar).toHaveBeenLastCalledWith({ reduzido: true, normal: false, desktop: true });

    unmount();
    expect(limpar).toHaveBeenCalledTimes(2);
  });
});

describe("useRecalculoDoScroll", () => {
  it("MOT-03 — recalcula após as fontes e quando a altura muda, e para no unmount", async () => {
    let avisarTamanho: () => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class { constructor(cb: () => void) { avisarTamanho = cb; } observe() {} disconnect = disconnect; });
    let liberarFontes!: () => void;
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>((r) => { liberarFontes = r; }) } });
    const quadros: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => quadros.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const rodarQuadros = () => quadros.splice(0).forEach((cb) => cb(0));

    let altura = 1000;
    function Sonda() {
      const ref = { current: Object.defineProperty(document.createElement("div"), "offsetHeight", { get: () => altura }) };
      useRecalculoDoScroll(ref);
      return null;
    }
    const { unmount } = render(<Sonda />);

    await act(async () => { liberarFontes(); await Promise.resolve(); });
    rodarQuadros();
    expect(falso.refresh).toHaveBeenCalledTimes(1);

    avisarTamanho(); // mesma altura: nada
    rodarQuadros();
    expect(falso.refresh).toHaveBeenCalledTimes(1);

    altura = 1400;
    avisarTamanho();
    avisarTamanho(); // duas notificações no mesmo quadro viram um refresh
    rodarQuadros();
    expect(falso.refresh).toHaveBeenCalledTimes(2);

    unmount();
    expect(disconnect).toHaveBeenCalled();
    altura = 1800;
    avisarTamanho();
    rodarQuadros();
    expect(falso.refresh).toHaveBeenCalledTimes(2);
  });
});

describe("Seções sobre o setup", () => {
  it("SEC-01 — Como funciona, normal e desktop: escalonamento e linha com scrub", () => {
    render(<HowItWorks />);
    const passos = falso.pedidos.find((p) => p.metodo === "from" && p.alvo === ".vx-step")!;
    expect(passos.vars).toMatchObject({
      opacity: 0,
      y: DESLOCAMENTO_LANDING.entrada,
      duration: DURACAO_LANDING.entrada,
      stagger: ESCALONAMENTO_LANDING.passos,
    });
    const linha = falso.pedidos.find((p) => p.alvo === ".vx-flow-line")!;
    expect(linha.vars.scrollTrigger.scrub).toBe(SCRUB_LANDING.linha);
  });

  it("SEC-02 — Como funciona, reduzido: só fade curto e sem linha", () => {
    condicoes({ reduzido: true });
    render(<HowItWorks />);
    const passos = falso.pedidos.find((p) => p.alvo === ".vx-step")!;
    expect(passos.vars).toMatchObject({ opacity: 0, y: 0, duration: DURACAO.fast, stagger: 0 });
    expect(falso.pedidos.some((p) => p.alvo === ".vx-flow-line")).toBe(false);
  });

  it("SEC-03 — Como funciona, mobile: sem linha (ela nem é exibida)", () => {
    condicoes({ desktop: false });
    render(<HowItWorks />);
    expect(falso.pedidos.some((p) => p.alvo === ".vx-step")).toBe(true);
    expect(falso.pedidos.some((p) => p.alvo === ".vx-flow-line")).toBe(false);
  });

  it("SEC-04 — Maturidade, reduzido: estado final de uma vez, sem timeline", () => {
    condicoes({ reduzido: true });
    render(<Maturity />);
    expect(falso.timelines).toHaveLength(0);
    const sets = falso.pedidos.filter((p) => p.metodo === "set");
    expect(sets.find((p) => p.alvo === ".vx-mat-dot")!.vars).toEqual({ attr: { r: 4 } });
    expect(sets.some((p) => p.alvo === ".vx-mat-bar")).toBe(true);
    expect(sets.some((p) => "innerText" in p.vars)).toBe(true);
    expect(falso.pedidos.some((p) => p.metodo !== "set")).toBe(false);
  });

  it("SEC-05 — Maturidade, normal: uma timeline com gatilho once e o desenho do traço", () => {
    render(<Maturity />);
    expect(falso.timelines).toHaveLength(1);
    const [linha] = falso.timelines;
    expect(linha.vars.scrollTrigger).toMatchObject({ start: "top 60%", once: true });
    const traco = linha.pedidos.find((p) => p.metodo === "to" && "strokeDashoffset" in p.vars)!;
    expect(traco.vars.duration).toBe(DURACAO_LANDING.traco);
    expect(linha.pedidos.some((p) => p.alvo === ".vx-mat-dot")).toBe(true);
    expect(linha.pedidos.some((p) => p.alvo === ".vx-mat-bar")).toBe(true);
  });

  it("SEC-06 — Chamada final: escala só sem movimento reduzido", () => {
    render(<MemoryRouter><FinalCTA /></MemoryRouter>);
    let [linha] = falso.timelines;
    expect(linha.vars.scrollTrigger).toMatchObject({ start: "top bottom", end: "center center", scrub: true });
    expect(linha.pedidos.some((p) => p.de && "scale" in p.de && p.de.scale === DESLOCAMENTO_LANDING.escalaChamadaFinal)).toBe(true);
    expect(linha.pedidos.some((p) => p.de && "opacity" in p.de)).toBe(true);

    falso.timelines = [];
    condicoes({ reduzido: true });
    render(<MemoryRouter><FinalCTA /></MemoryRouter>);
    [linha] = falso.timelines;
    expect(linha.pedidos.some((p) => p.de && "scale" in p.de)).toBe(false);
    expect(linha.pedidos.some((p) => p.de && "opacity" in p.de)).toBe(true);
  });

  it("SEC-07 — Barra de progresso: suavizada no normal, colada no reduzido", () => {
    render(<ScrollProgress />);
    expect(falso.pedidos.at(-1)!.vars.scrollTrigger.scrub).toBe(SCRUB_LANDING.barra);
    condicoes({ reduzido: true });
    render(<ScrollProgress />);
    expect(falso.pedidos.at(-1)!.vars.scrollTrigger.scrub).toBe(true);
  });
});
