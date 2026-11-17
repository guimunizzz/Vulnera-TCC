/**
 * landing-motion-real.test.tsx
 *
 * O mesmo hook com GSAP, ScrollTrigger e useGSAP REAIS (nada mockado no GSAP):
 * a contagem de `ScrollTrigger.getAll()` prova que não sobram triggers.
 *   MOT-04  monta 1 trigger, troca de condição continua com 1 (o anterior foi
 *           revertido) e o unmount volta a 0 — sair da landing e voltar não
 *           acumula triggers órfãos
 */

import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { gsap, ScrollTrigger } from "./gsap";
import { useMovimentoLanding } from "./use-landing-motion";

describe("useMovimentoLanding com GSAP real", () => {
  it("MOT-04 — troca de condição não duplica e o unmount não deixa trigger órfão", () => {
    let reduzido = false;
    const ouvintes = new Set<() => void>();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() { return query.includes("prefers-reduced-motion: reduce") ? reduzido : true; },
      media: query,
      addEventListener: (_: string, ouvinte: () => void) => ouvintes.add(ouvinte),
      removeEventListener: (_: string, ouvinte: () => void) => ouvintes.delete(ouvinte),
    }));
    const vistos: boolean[] = [];

    function Secao() {
      const ref = useRef<HTMLElement>(null);
      useMovimentoLanding(ref, ({ reduzido: r }) => {
        vistos.push(r);
        gsap.fromTo(".alvo", { opacity: 0 }, { opacity: 1, scrollTrigger: { trigger: ref.current, scrub: true } });
      });
      return <section ref={ref}><div className="alvo" /></section>;
    }

    const antes = ScrollTrigger.getAll().length;
    const { unmount } = render(<Secao />);
    expect(ScrollTrigger.getAll().length - antes).toBe(1);

    act(() => { reduzido = true; ouvintes.forEach((ouvinte) => ouvinte()); });
    expect(vistos).toEqual([false, true]);
    expect(ScrollTrigger.getAll().length - antes).toBe(1);

    unmount();
    expect(ScrollTrigger.getAll().length).toBe(antes);
  });
});
