/**
 * use-dashboard-scene.test.tsx
 *
 * Atmosfera ASCII da área autenticada sobre o kit `src/three/` (refactor
 * web-motion-3d, Fases 2 e 4). Hospedeiro e atlas são falsos: verifica-se o
 * que o hook faz com eles, não o WebGL.
 *   CENA-01  depois do atlas, monta com o orçamento do dashboard, lê as cores
 *            dos tokens de atmosfera e inicia
 *   CENA-02  unmount descarta cena, hospedeiro, tema e observer
 *   CENA-03  sem WebGL avisa onLost e não deixa observer
 *   CENA-04  contexto perdido avisa onLost e limpa o resto do hook
 *   CENA-05  desmontado antes do atlas: nada é montado e a textura é descartada
 *   CENA-06  nenhum dígito nos glifos: no produto, número é dado
 */

import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const falso = vi.hoisted(() => ({
  montar: vi.fn(),
  iniciar: vi.fn(),
  descartar: vi.fn(),
  descartarCena: vi.fn(),
  atlas: vi.fn(),
  tokens: [] as string[],
  pararTema: vi.fn(),
  aoPerderContexto: undefined as undefined | (() => void),
}));

vi.mock("../../../three/scene-host", () => ({
  montarCena: (opcoes: { aoPerderContexto?: () => void }) => {
    falso.aoPerderContexto = opcoes.aoPerderContexto;
    return falso.montar(opcoes);
  },
}));
vi.mock("../../../three/dispose", () => ({ descartarCena: falso.descartarCena }));
vi.mock("../../../three/palette", () => ({
  lerCorDoToken: (_el: Element, token: string) => { falso.tokens.push(token); },
  observarTema: () => falso.pararTema,
  temaAtual: () => "dark",
}));
vi.mock("../../../three/ascii", () => ({
  criarAtlasAscii: () => falso.atlas(),
  GLSL_ASCII: "",
}));

import { GLIFOS_ATMOSFERA, useDashboardScene } from "./use-dashboard-scene";

const observadores: { disconnect: ReturnType<typeof vi.fn> }[] = [];

function Cena({ onReady = vi.fn(), onLost = vi.fn() }: { onReady?: () => void; onLost?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useDashboardScene(ref, { onReady, onLost });
  return <div data-testid="host"><canvas ref={ref} /></div>;
}

beforeEach(() => {
  // Aqui e não no afterEach: a desmontagem do RTL roda depois e contaria no
  // teste seguinte.
  vi.clearAllMocks();
  falso.tokens = [];
  falso.atlas.mockImplementation(async () => ({ textura: { dispose: vi.fn() }, total: 8, proporcao: 0.5 }));
  falso.montar.mockReturnValue({ renderer: { getPixelRatio: () => 1 }, iniciar: falso.iniciar, descartar: falso.descartar });
  observadores.length = 0;
  vi.stubGlobal("ResizeObserver", class { disconnect = vi.fn(); constructor() { observadores.push(this); } observe() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDashboardScene (atmosfera ASCII) sobre o kit", () => {
  it("CENA-01 — monta com orçamento do dashboard, lê os tokens de atmosfera e inicia", async () => {
    render(<Cena />);
    await waitFor(() => expect(falso.iniciar).toHaveBeenCalledTimes(1));
    expect(falso.montar).toHaveBeenCalledWith(expect.objectContaining({ fps: 30, maxDpr: 1.5 }));
    expect(new Set(falso.tokens)).toEqual(new Set(["--color-ambient-ink", "--color-ambient-muted"]));
  });

  it("CENA-02 — unmount descarta cena, hospedeiro, tema e observer", async () => {
    const { unmount } = render(<Cena />);
    await waitFor(() => expect(falso.iniciar).toHaveBeenCalled());
    unmount();
    expect(falso.descartarCena).toHaveBeenCalledTimes(1);
    expect(falso.descartar).toHaveBeenCalledTimes(1);
    expect(falso.pararTema).toHaveBeenCalledTimes(1);
    expect(observadores).toHaveLength(1);
    expect(observadores[0].disconnect).toHaveBeenCalled();
  });

  it("CENA-03 — sem WebGL avisa onLost e não cria observer", async () => {
    falso.montar.mockReturnValue(null);
    const onLost = vi.fn();
    render(<Cena onLost={onLost} />);
    await waitFor(() => expect(onLost).toHaveBeenCalledTimes(1));
    expect(falso.iniciar).not.toHaveBeenCalled();
    expect(observadores).toHaveLength(0);
  });

  it("CENA-04 — contexto perdido avisa onLost e limpa o restante do hook", async () => {
    const onLost = vi.fn();
    render(<Cena onLost={onLost} />);
    await waitFor(() => expect(falso.iniciar).toHaveBeenCalled());
    falso.aoPerderContexto?.();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(falso.pararTema).toHaveBeenCalledTimes(1);
    expect(observadores[0].disconnect).toHaveBeenCalled();
  });

  it("CENA-05 — desmontado antes do atlas: nada monta e a textura é descartada", async () => {
    let liberar!: (atlas: unknown) => void;
    const textura = { dispose: vi.fn() };
    falso.atlas.mockImplementation(() => new Promise((resolve) => { liberar = resolve; }));
    const { unmount } = render(<Cena />);
    unmount();
    liberar({ textura, total: 8, proporcao: 0.5 });
    await waitFor(() => expect(textura.dispose).toHaveBeenCalled());
    expect(falso.montar).not.toHaveBeenCalled();
  });

  it("CENA-06 — nenhum dígito nos glifos da atmosfera", () => {
    expect(GLIFOS_ATMOSFERA).not.toMatch(/\d/);
  });
});
