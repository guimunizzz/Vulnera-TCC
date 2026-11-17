/**
 * landing-poster.test.tsx
 *
 *   POS-01  um bloco ASCII do ato atual; na troca, o anterior fica só durante
 *           o crossfade e sai depois
 *   POS-02  decorativo (aria-hidden) e escondido quando a cena WebGL está pronta
 *   POS-03  o ato "Encontrar" tem a varredura em blocos e severidades coloridas;
 *           o "Corrigir" tem "✓" na cor de resolvido
 *   POS-04  o bloco do ato usa a mesma fonte e a mesma altura de célula da cena
 *           WebGL (13 px e 18 px), para a troca pôster → cena não mudar a grade
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { ALTURA_CELULA_LANDING_PX, FONTE_LANDING_PX } from "./config";
import { LandingPoster } from "./landing-poster";

afterEach(() => vi.useRealTimers());

describe("LandingPoster", () => {
  it("POS-01 — mostra o ato atual e faz crossfade ao trocar", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<LandingPoster ato={0} oculto={false} />);
    expect(container.querySelectorAll("[data-poster-ato]")).toHaveLength(1);
    expect(container.querySelector('[data-poster-ato="0"]')).not.toBeNull();

    rerender(<LandingPoster ato={2} oculto={false} />);
    expect(container.querySelector('[data-poster-ato="0"]')).toHaveClass("vx-poster-saindo");
    expect(container.querySelector('[data-poster-ato="2"]')).toHaveClass("vx-poster-entrando");

    act(() => { vi.runAllTimers(); });
    expect(container.querySelectorAll("[data-poster-ato]")).toHaveLength(1);
    expect(container.querySelector("[data-landing-poster]")).toHaveAttribute("data-ato-atual", "2");
  });

  it("POS-02 — decorativo e escondido quando a cena está pronta", () => {
    const { container, rerender } = render(<LandingPoster ato={0} oculto={false} />);
    const poster = container.querySelector<HTMLElement>("[data-landing-poster]")!;
    expect(poster).toHaveAttribute("aria-hidden", "true");
    expect(poster.style.opacity).toBe("1");
    rerender(<LandingPoster ato={0} oculto />);
    expect(poster.style.opacity).toBe("0");
  });

  it("POS-03 — varredura e severidades no ato 2; '✓' resolvido no ato 4", () => {
    const { container, rerender } = render(<LandingPoster ato={2} oculto={false} />);
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/[░▒▓█]/);
    const tons = new Set(Array.from(container.querySelectorAll<HTMLSpanElement>("span[data-tom]")).map((s) => s.dataset.tom));
    ["1", "2", "3", "4", "neon"].forEach((tom) => expect(tons).toContain(tom));

    rerender(<LandingPoster ato={4} oculto={false} />);
    const ok = Array.from(container.querySelectorAll<HTMLSpanElement>('[data-poster-ato="4"] span')).filter((s) => s.textContent === "✓");
    expect(ok.length).toBeGreaterThan(0);
    ok.forEach((s) => expect(s.dataset.tom).toBe("resolvido"));
  });

  it("POS-04 — fonte e altura de célula iguais às da cena WebGL", () => {
    const { container } = render(<LandingPoster ato={0} oculto={false} />);
    const bloco = container.querySelector<HTMLElement>('[data-poster-ato="0"]')!;
    expect(bloco.tagName).toBe("PRE");
    expect(bloco.style.fontSize).toBe(`${FONTE_LANDING_PX}px`);
    expect(bloco.style.lineHeight).toBe(`${ALTURA_CELULA_LANDING_PX}px`);
  });
});
