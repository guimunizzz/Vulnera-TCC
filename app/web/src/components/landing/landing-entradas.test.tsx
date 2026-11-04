/**
 * landing-entradas.test.tsx
 *
 * Entradas e loops da landing (melhorias A–D, 2026-11-04).
 *   ENT-01  título decodificado: nome acessível inteiro, glifos aria-hidden
 *   ENT-02  decodifica uma vez ao entrar na tela e assenta no texto original
 *   ENT-03  movimento reduzido (menu): não decodifica
 *   ENT-04  loops param fora da tela: `data-fora-da-tela` segue a interseção
 *   ENT-05  escala da chamada final em CSS espelha ESCALA_LANDING
 *   ENT-06  glitch só no hero e na chamada final; seções usam o decodificado
 *   ENT-07  máscara: o recorte fica num filho, nunca no elemento observado
 *   ENT-08  moldura ASCII só no plano recomendado, decorativa
 *   ENT-09  varredura de transição no shader, com alfa do feixe e sentido
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { Reveal, TituloDecodificado } from "./ui";
import { MemoryRouter } from "react-router-dom";
import Pricing from "./sections/pricing";
import { FRAGMENT_CELULAS } from "./scene/shaders";
import { usePausarLoopsForaDaTela } from "./motion/use-landing-motion";
import { ESCALA_LANDING } from "./motion/tokens";
import { definirPreferencias, restaurarPreferencias } from "../../design/accessibility";

type Ouvinte = (entradas: Partial<IntersectionObserverEntry>[]) => void;
let observados: { alvo: Element; ouvinte: Ouvinte }[] = [];

class ObservadorControlavel {
  constructor(private readonly ouvinte: Ouvinte) {}
  observe(alvo: Element) { observados.push({ alvo, ouvinte: this.ouvinte }); }
  unobserve() {}
  disconnect() { observados = observados.filter((o) => o.ouvinte !== this.ouvinte); }
  takeRecords() { return []; }
}

function cruzar(alvo: Element, visivel: boolean) {
  act(() => {
    observados.filter((o) => o.alvo === alvo).forEach((o) => o.ouvinte([{ target: alvo, isIntersecting: visivel }]));
  });
}

let quadros: FrameRequestCallback[] = [];
function rodarQuadros(ate: number) {
  act(() => {
    for (let t = 0; t <= ate; t += 16) {
      const fila = quadros;
      quadros = [];
      fila.forEach((q) => q(t));
    }
  });
}

beforeEach(() => {
  observados = [];
  quadros = [];
  vi.stubGlobal("IntersectionObserver", ObservadorControlavel);
  vi.stubGlobal("requestAnimationFrame", (q: FrameRequestCallback) => { quadros.push(q); return quadros.length; });
  vi.stubGlobal("cancelAnimationFrame", () => { quadros = []; });
  vi.spyOn(performance, "now").mockReturnValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restaurarPreferencias();
});

describe("TituloDecodificado", () => {
  it("ENT-01 — nome acessível inteiro; os glifos são decoração", () => {
    render(<TituloDecodificado>Planos que cabem</TituloDecodificado>);
    const titulo = screen.getByRole("heading", { level: 2, name: "Planos que cabem" });
    expect(titulo.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("ENT-02 — decodifica uma vez ao entrar na tela e assenta no original", () => {
    render(<TituloDecodificado>Como funciona</TituloDecodificado>);
    const titulo = screen.getByRole("heading");
    cruzar(titulo, true);
    rodarQuadros(48);
    expect(titulo).toHaveAttribute("data-decodificando");

    rodarQuadros(2000);
    expect(titulo).not.toHaveAttribute("data-decodificando");
    const glifos = Array.from(titulo.querySelectorAll(".vx-decode-glifo"), (g) => g.textContent).join("");
    expect(glifos).toBe("Comofunciona");
    // Uma vez só: o observador foi desligado.
    expect(observados.some((o) => o.alvo === titulo)).toBe(false);
  });

  it("ENT-03 — com movimento reduzido pelo menu, não decodifica", () => {
    definirPreferencias({ reduzirMovimento: true });
    render(<TituloDecodificado>Equipe</TituloDecodificado>);
    const titulo = screen.getByRole("heading");
    cruzar(titulo, true);
    rodarQuadros(100);
    expect(titulo).not.toHaveAttribute("data-decodificando");
  });
});

function PaginaDeTeste() {
  const raiz = useRef<HTMLDivElement>(null);
  usePausarLoopsForaDaTela(raiz);
  return (
    <div ref={raiz}>
      <section data-testid="a" />
      <footer data-testid="b" />
    </div>
  );
}

describe("Loops fora da tela", () => {
  it("ENT-04 — `data-fora-da-tela` acompanha a interseção", () => {
    render(<PaginaDeTeste />);
    const secao = screen.getByTestId("a");
    cruzar(secao, false);
    expect(secao).toHaveAttribute("data-fora-da-tela");
    cruzar(secao, true);
    expect(secao).not.toHaveAttribute("data-fora-da-tela");
    expect(observados.some((o) => o.alvo === screen.getByTestId("b"))).toBe(true);
  });
});

describe("Regras de arquivo", () => {
  it("ENT-05 — escala da chamada final no CSS espelha ESCALA_LANDING", () => {
    const css = readFileSync(resolve(__dirname, "landing.css"), "utf8");
    expect(Number(/--vx-escala-hover:\s*([\d.]+)/.exec(css)?.[1])).toBe(ESCALA_LANDING.hover);
    expect(Number(/--vx-escala-toque:\s*([\d.]+)/.exec(css)?.[1])).toBe(ESCALA_LANDING.toque);
  });

  it("ENT-06 — glitch só no hero e na chamada final", () => {
    const pasta = resolve(__dirname, "sections");
    const comGlitch = readdirSync(pasta)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .filter((f) => readFileSync(resolve(pasta, f), "utf8").includes("<GlitchHeading"));
    expect(comGlitch.sort()).toEqual(["final-cta.tsx", "hero.tsx"]);
  });
});

describe("Reveal com máscara", () => {
  it("ENT-07 — o elemento observado não recebe clip-path (senão nunca entra na tela)", () => {
    render(<Reveal variante="mascara"><p>planilha</p></Reveal>);
    const conteudo = screen.getByText("planilha");
    const recortado = conteudo.parentElement as HTMLElement;
    const observado = recortado.parentElement as HTMLElement;
    expect(recortado.style.clipPath).toContain("inset");
    expect(observado.style.clipPath).toBe("");
  });
});

describe("Pricing e transição", () => {
  it("ENT-08 — moldura ASCII só no plano recomendado, aria-hidden", () => {
    const { container } = render(<MemoryRouter><Pricing /></MemoryRouter>);
    const molduras = container.querySelectorAll(".vx-borda-ascii");
    expect(molduras).toHaveLength(1);
    expect(molduras[0]).toHaveAttribute("aria-hidden", "true");
    expect(molduras[0].closest("div.relative")?.textContent).toContain("MAIS POPULAR");
  });

  it("ENT-09 — varredura de transição usa o alfa do feixe e o sentido da rolagem", () => {
    expect(FRAGMENT_CELULAS).toContain("uniform float uTransicaoInicio;");
    expect(FRAGMENT_CELULAS).toContain("uniform float uTransicaoSentido;");
    expect(FRAGMENT_CELULAS).toContain("banda * uAlfaFeixe");
  });
});
