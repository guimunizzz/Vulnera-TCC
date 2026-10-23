/**
 * use-dashboard-scene.test.tsx
 *
 * Migração da atmosfera do dashboard para o kit `src/three/` (Fase 2 do
 * refactor web-motion-3d). O hospedeiro é falso: aqui se verifica o que o hook
 * faz com ele, não o WebGL.
 *   CENA-01  monta, lê as cores dos tokens de atmosfera e inicia o loop
 *   CENA-02  unmount descarta cena, observers, tema e listeners
 *   CENA-03  sem WebGL avisa onLost e não deixa nada pendurado
 *   CENA-04  contexto perdido avisa onLost e limpa o resto do hook
 */

import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const falso = vi.hoisted(() => ({
  montar: vi.fn(),
  iniciar: vi.fn(),
  descartar: vi.fn(),
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
vi.mock("../../../three/palette", () => ({
  lerCorDoToken: (_el: Element, token: string) => { falso.tokens.push(token); },
  observarTema: () => falso.pararTema,
  temaAtual: () => "dark",
}));

import { useDashboardScene } from "./use-dashboard-scene";

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
  falso.montar.mockReturnValue({ renderer: { autoClear: true }, iniciar: falso.iniciar, descartar: falso.descartar });
  observadores.length = 0;
  vi.stubGlobal("ResizeObserver", class { disconnect = vi.fn(); constructor() { observadores.push(this); } observe() {} });
  vi.stubGlobal("MutationObserver", class { disconnect = vi.fn(); constructor() { observadores.push(this); } observe() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDashboardScene sobre o kit", () => {
  it("CENA-01 — monta com orçamento do dashboard, lê os tokens de atmosfera e inicia", () => {
    render(<Cena />);
    expect(falso.montar).toHaveBeenCalledWith(expect.objectContaining({ fps: 30, maxDpr: 1.5 }));
    expect(new Set(falso.tokens)).toEqual(new Set(["--color-ambient-ink", "--color-ambient-muted"]));
    expect(falso.iniciar).toHaveBeenCalledTimes(1);
  });

  it("CENA-02 — unmount descarta hospedeiro, observers, tema e ponteiro", () => {
    const { getByTestId, unmount } = render(<Cena />);
    const host = getByTestId("host");
    const remover = vi.spyOn(host, "removeEventListener");

    unmount();

    expect(falso.descartar).toHaveBeenCalledTimes(1);
    expect(falso.pararTema).toHaveBeenCalledTimes(1);
    expect(observadores).toHaveLength(2);
    observadores.forEach((o) => expect(o.disconnect).toHaveBeenCalled());
    expect(remover).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(remover).toHaveBeenCalledWith("pointerleave", expect.any(Function));
  });

  it("CENA-03 — sem WebGL avisa onLost e não cria observers", () => {
    falso.montar.mockReturnValue(null);
    const onLost = vi.fn();
    render(<Cena onLost={onLost} />);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(falso.iniciar).not.toHaveBeenCalled();
    expect(observadores).toHaveLength(0);
  });

  it("CENA-04 — contexto perdido avisa onLost e limpa o restante do hook", () => {
    const onLost = vi.fn();
    render(<Cena onLost={onLost} />);
    falso.aoPerderContexto?.();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(falso.pararTema).toHaveBeenCalledTimes(1);
    observadores.forEach((o) => expect(o.disconnect).toHaveBeenCalled());
  });
});
