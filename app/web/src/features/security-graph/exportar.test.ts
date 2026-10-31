import { describe, expect, it } from "vitest";
import { resolverVariaveis } from "./exportar";

describe("resolverVariaveis", () => {
  const estilo = { getPropertyValue: (nome: string) => ({ "--color-accent": " 0.59 0.2 292 " })[nome] ?? "" };

  it("troca o token pelo valor do tema, para o SVG funcionar fora da página", () => {
    expect(resolverVariaveis('stroke="oklch(var(--color-accent) / 0.5)"', estilo)).toBe('stroke="oklch(0.59 0.2 292 / 0.5)"');
  });

  it("mantém a referência quando o token não existe, em vez de apagar a cor", () => {
    expect(resolverVariaveis("oklch(var(--nao-existe))", estilo)).toBe("oklch(var(--nao-existe))");
  });
});
