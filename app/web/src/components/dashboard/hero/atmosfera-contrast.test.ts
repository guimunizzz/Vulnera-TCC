/**
 * atmosfera-contrast.test.ts
 *
 * Legibilidade do texto do produto sobre a atmosfera ASCII, com as cores
 * REAIS de `tokens.css` e a conversão OKLCH do verificador de contraste.
 *
 *   ATM-01  pior caso — um glifo no teto de opacidade, sobre a lavagem da
 *           aurora, em cada cor da atmosfera (tinta, apagada, ciano,
 *           magenta) — mantém texto primário e secundário ≥ 4,5:1, nos dois
 *           temas (o texto muted sobre o fundo tem o véu `.atmosfera-veu`)
 *   ATM-02  nenhum dígito nos glifos (no produto, número é dado)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gammaDecodifica, oklchParaSrgbNormalizado } from "../../../design/oklch.mjs";
import { GLIFOS_ATMOSFERA, LAVAGEM_AURORA, OPACIDADE_ATMOSFERA } from "./atmosfera-config";

const tokensCss = readFileSync(resolve(__dirname, "../../../styles/tokens.css"), "utf8");
type Rgb = [number, number, number];

function bloco(tema: "dark" | "light"): string {
  const seletor = tema === "light" ? '[data-theme="light"] {' : '[data-theme="dark"] {';
  const inicio = tokensCss.indexOf(seletor);
  return tokensCss.slice(inicio, tokensCss.indexOf("\n}", inicio));
}

function cor(tema: "dark" | "light", token: string): Rgb {
  const declaracao = new RegExp(`${token}:\\s*([^;]+);`).exec(bloco(tema))?.[1].trim();
  if (!declaracao) throw new Error(`${token} não encontrado no tema ${tema}`);
  const primitivo = /^var\(--([a-z]+-\d+)\)$/.exec(declaracao)?.[1];
  const triplo = primitivo
    ? new RegExp(`--${primitivo}:\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`).exec(tokensCss)
    : /^([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(declaracao);
  if (!triplo) throw new Error(`${token}: valor não reconhecido (${declaracao})`);
  return oklchParaSrgbNormalizado(Number(triplo[1]), Number(triplo[2]), Number(triplo[3])).rgb;
}

const luminancia = (c: Rgb) => 0.2126 * gammaDecodifica(c[0]) + 0.7152 * gammaDecodifica(c[1]) + 0.0722 * gammaDecodifica(c[2]);
const contraste = (a: Rgb, b: Rgb) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
};
const misturar = (fundo: Rgb, c: Rgb, alfa: number) => fundo.map((v, i) => v * (1 - alfa) + c[i] * alfa) as Rgb;

const ATMOSFERA = ["--color-ambient-ink", "--color-ambient-muted", "--color-ambient-cyan", "--color-ambient-magenta"];
const TEXTOS = ["--color-text-primary", "--color-text-secondary"];

describe("Atmosfera ASCII — contraste do texto do produto", () => {
  for (const tema of ["dark", "light"] as const) {
    it(`ATM-01 — pior caso continua AA no tema ${tema}`, () => {
      const teto = OPACIDADE_ATMOSFERA[tema];
      const fundo = cor(tema, "--color-bg-canvas");
      for (const corDaCena of ATMOSFERA.map((t) => cor(tema, t))) {
        // Lavagem por baixo, glifo no teto por cima, na mesma cor (pior caso).
        const lavado = misturar(fundo, corDaCena, LAVAGEM_AURORA * teto);
        const pixel = misturar(lavado, corDaCena, teto);
        for (const texto of TEXTOS) {
          expect(contraste(cor(tema, texto), pixel), `${texto} sobre ${tema}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it("ATM-02 — nenhum dígito nos glifos", () => {
    expect(GLIFOS_ATMOSFERA).not.toMatch(/\d/);
  });
});
