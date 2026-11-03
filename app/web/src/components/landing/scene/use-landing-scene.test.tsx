/**
 * use-landing-scene.test.tsx
 *
 * A cena narrativa ASCII sobre o kit `src/three/` (Fase 4 do refactor
 * web-motion-3d). Hospedeiro WebGL, atlas e GSAP são falsos: verifica-se o que
 * o hook faz com eles.
 *   CENA-L01  cria um canvas decorativo; depois do atlas, monta com o orçamento
 *             da cena, lê as cores (paleta da landing + neon + severidades +
 *             resolvido) e inicia
 *   CENA-L02  um único ScrollTrigger alimenta o progresso
 *   CENA-L03  unmount mata o gatilho, descarta cena e hospedeiro e remove o canvas
 *   CENA-L04  sem WebGL avisa onLost e não deixa canvas nem gatilho
 *   CENA-L05  StrictMode: a montagem cancelada antes do atlas não monta nada;
 *             sobra exatamente um canvas e um hospedeiro
 *   CENA-L06  atlas que falha (sem canvas 2D) cai no pôster via onLost
 */

import { StrictMode, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const falso = vi.hoisted(() => ({
  montar: vi.fn(),
  iniciar: vi.fn(),
  descartar: vi.fn(),
  descartarCena: vi.fn(),
  atlas: vi.fn(),
  tokens: [] as string[],
  pararTema: vi.fn(),
  gatilhos: [] as { kill: ReturnType<typeof vi.fn> }[],
}));

vi.mock("../../../three/scene-host", () => ({ montarCena: (opcoes: unknown) => falso.montar(opcoes) }));
vi.mock("../../../three/dispose", () => ({ descartarCena: falso.descartarCena }));
vi.mock("../../../three/palette", () => ({
  lerCorDoToken: (_el: Element, token: string) => { falso.tokens.push(token); },
  observarTema: () => falso.pararTema,
}));
vi.mock("../../../three/ascii", () => ({
  criarAtlasAscii: () => falso.atlas(),
  GLSL_ASCII: "",
}));
vi.mock("../motion/gsap", () => ({
  gsap: { quickTo: () => vi.fn(), killTweensOf: vi.fn() },
  ScrollTrigger: {
    create: () => {
      const gatilho = { kill: vi.fn() };
      falso.gatilhos.push(gatilho);
      return gatilho;
    },
  },
}));

import { useLandingScene } from "./use-landing-scene";

function Cena({ onLost = vi.fn() }: { onLost?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useLandingScene(host, { onLost });
  return <div data-testid="host" ref={host} />;
}

const textura = () => ({ dispose: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  falso.tokens = [];
  falso.gatilhos = [];
  falso.atlas.mockImplementation(async () => ({ textura: textura(), total: 19, proporcao: 0.5 }));
  falso.montar.mockReturnValue({
    renderer: { getPixelRatio: () => 1 },
    iniciar: falso.iniciar,
    descartar: falso.descartar,
  });
});

describe("useLandingScene", () => {
  it("CENA-L01 — canvas decorativo, orçamento da cena, cores dos tokens", async () => {
    const { getByTestId } = render(<Cena />);
    const canvas = getByTestId("host").querySelector("canvas")!;
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("pointer-events-none");
    await waitFor(() => expect(falso.iniciar).toHaveBeenCalledTimes(1));
    expect(falso.montar).toHaveBeenCalledWith(expect.objectContaining({ canvas, fps: 60, maxDpr: 1.5 }));
    expect(new Set(falso.tokens)).toEqual(new Set([
      "--vx-accent", "--vx-cyan", "--vx-magenta",
      "--color-severity-low", "--color-severity-medium", "--color-severity-high", "--color-severity-critical",
      "--color-success",
    ]));
  });

  it("CENA-L02 — um único ScrollTrigger alimenta o progresso", async () => {
    render(<Cena />);
    await waitFor(() => expect(falso.gatilhos).toHaveLength(1));
  });

  it("CENA-L03 — unmount limpa tudo e remove o canvas", async () => {
    const { getByTestId, unmount } = render(<Cena />);
    const host = getByTestId("host");
    await waitFor(() => expect(falso.iniciar).toHaveBeenCalled());
    unmount();
    expect(falso.gatilhos[0].kill).toHaveBeenCalled();
    expect(falso.pararTema).toHaveBeenCalledTimes(1);
    expect(falso.descartarCena).toHaveBeenCalledTimes(1);
    expect(falso.descartar).toHaveBeenCalledTimes(1);
    expect(host.querySelector("canvas")).toBeNull();
  });

  it("CENA-L04 — sem WebGL avisa onLost e não deixa canvas nem gatilho", async () => {
    falso.montar.mockReturnValue(null);
    const onLost = vi.fn();
    const { getByTestId } = render(<Cena onLost={onLost} />);
    await waitFor(() => expect(onLost).toHaveBeenCalledTimes(1));
    expect(falso.gatilhos).toHaveLength(0);
    expect(getByTestId("host").querySelector("canvas")).toBeNull();
  });

  it("CENA-L05 — StrictMode: um canvas e um hospedeiro no fim", async () => {
    const texturas: { dispose: ReturnType<typeof vi.fn> }[] = [];
    falso.atlas.mockImplementation(async () => {
      const t = textura();
      texturas.push(t);
      return { textura: t, total: 19, proporcao: 0.5 };
    });
    const { getByTestId } = render(<StrictMode><Cena /></StrictMode>);
    await waitFor(() => expect(falso.iniciar).toHaveBeenCalledTimes(1));
    expect(getByTestId("host").querySelectorAll("canvas")).toHaveLength(1);
    expect(falso.montar).toHaveBeenCalledTimes(1);
    // O atlas da montagem cancelada foi descartado, não vazou.
    expect(texturas[0].dispose).toHaveBeenCalled();
    expect(falso.montar.mock.calls[0][0].canvas).toBe(getByTestId("host").querySelector("canvas"));
  });

  it("CENA-L06 — atlas que falha cai no pôster via onLost", async () => {
    falso.atlas.mockRejectedValue(new Error("Canvas 2D indisponível"));
    const onLost = vi.fn();
    const { getByTestId } = render(<Cena onLost={onLost} />);
    await waitFor(() => expect(onLost).toHaveBeenCalledTimes(1));
    expect(falso.montar).not.toHaveBeenCalled();
    expect(getByTestId("host").querySelector("canvas")).toBeNull();
  });
});
