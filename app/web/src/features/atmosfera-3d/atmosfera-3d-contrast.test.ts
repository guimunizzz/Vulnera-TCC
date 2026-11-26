/**
 * atmosfera-3d-contrast.test.ts
 *
 * Legibilidade do texto do produto sobre as atmosferas 3D (relevo e
 * nebulosa), com as cores REAIS de `tokens.css` e a conversão OKLCH do
 * verificador de contraste — o mesmo método de `atmosfera-contrast.test.ts`.
 *
 * Modelo: a cena desenha sobre o próprio fundo e a camada inteira tem a
 * opacidade-teto (`TETO_DA_CAMADA`). O pior pixel é a cor mais forte que a
 * cena consegue produzir, no teto:
 *   escuro — tinta, ciano, magenta e BRANCO (a soma aditiva satura)
 *   claro  — tinta, magenta e o miolo quase branco da nebulosa
 *
 *   AT3-01  plataforma: texto primário e secundário ≥ 4,5:1 nos dois temas
 *   AT3-02  apresentação: idem (o teto sobe, mas não passa de AA)
 *   AT3-03  a plataforma é mais calma que a apresentação (pedido do Rafael)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gammaDecodifica, oklchParaSrgbNormalizado } from "../../design/oklch.mjs";
import { TETO_DA_CAMADA } from "./config";

const tokensCss = readFileSync(resolve(__dirname, "../../styles/tokens.css"), "utf8");
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

/** O miolo da nebulosa (vec3(1.0, 0.9, 0.97) no shader). */
const MIOLO: Rgb = [1, 0.9, 0.97];
const CORES_DA_CENA = (tema: "dark" | "light"): Rgb[] => [
  cor(tema, "--color-ambient-ink"),
  cor(tema, "--color-ambient-cyan"),
  cor(tema, "--color-ambient-magenta"),
  tema === "dark" ? [1, 1, 1] : MIOLO,
];
const TEXTOS = ["--color-text-primary", "--color-text-secondary"];

function conferir(modo: "plataforma" | "apresentacao", tema: "dark" | "light"): void {
  const teto = TETO_DA_CAMADA[modo][tema];
  const fundo = cor(tema, "--color-bg-canvas");
  for (const corDaCena of CORES_DA_CENA(tema)) {
    const pixel = misturar(fundo, corDaCena, teto);
    for (const texto of TEXTOS) {
      expect(contraste(cor(tema, texto), pixel), `${texto} sobre ${modo}/${tema} (cor ${corDaCena.map((v) => v.toFixed(2))})`).toBeGreaterThanOrEqual(4.5);
    }
  }
}

describe("Atmosferas 3D — contraste do texto do produto", () => {
  for (const tema of ["dark", "light"] as const) {
    it(`AT3-01 — plataforma continua AA no tema ${tema}`, () => conferir("plataforma", tema));
    it(`AT3-02 — apresentação continua AA no tema ${tema}`, () => conferir("apresentacao", tema));
  }

  it("AT3-03 — a plataforma é mais calma que a apresentação", () => {
    for (const tema of ["dark", "light"] as const) {
      expect(TETO_DA_CAMADA.plataforma[tema]).toBeLessThan(TETO_DA_CAMADA.apresentacao[tema]);
    }
  });
});
