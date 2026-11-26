import { describe, expect, it } from "vitest";
import { resolverVariaveis, serializarSemDecoracao } from "./exportar";

describe("resolverVariaveis", () => {
  const estilo = { getPropertyValue: (nome: string) => ({ "--color-accent": " 0.59 0.2 292 " })[nome] ?? "" };

  it("troca o token pelo valor do tema, para o SVG funcionar fora da página", () => {
    expect(resolverVariaveis('stroke="oklch(var(--color-accent) / 0.5)"', estilo)).toBe('stroke="oklch(0.59 0.2 292 / 0.5)"');
  });

  it("mantém a referência quando o token não existe, em vez de apagar a cor", () => {
    expect(resolverVariaveis("oklch(var(--nao-existe))", estilo)).toBe("oklch(var(--nao-existe))");
  });
});

describe("serializarSemDecoracao", () => {
  it("tira pacotes e ping do PNG sem mexer no SVG da tela", () => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg") as SVGSVGElement;
    const no = document.createElementNS(ns, "circle");
    no.setAttribute("id", "no");
    const pacote = document.createElementNS(ns, "circle");
    pacote.setAttribute("data-decoracao", "");
    svg.append(no, pacote);

    const texto = serializarSemDecoracao(svg);
    expect(texto).toContain('id="no"');
    expect(texto).not.toContain("data-decoracao");
    expect(svg.querySelectorAll("[data-decoracao]")).toHaveLength(1);
  });
});
