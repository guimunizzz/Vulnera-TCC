/**
 * scene-contrast.test.ts
 *
 * Legibilidade do texto da landing sobre a cena narrativa, com as cores REAIS
 * de `landing.css` e `tokens.css` (nada copiado à mão) e a mesma conversão
 * OKLCH do verificador de contraste (`design/oklch.mjs`).
 *
 *   CTR-01  todo texto da landing passa AA (4,5:1) sobre o fundo puro
 *   CTR-02  pior caso atrás do texto — dois glifos em destaque + a varredura
 *           empilhados (a cena desenha um glifo por célula; a pilha é margem),
 *           atenuados pela superfície — continua ≥ 4,5:1, para cada cor de
 *           texto × cada cor da cena (paleta, neon, severidades, resolvido),
 *           nos dois temas
 *   CTR-03  a opacidade da superfície em `landing.css` é a de `config.ts`
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gammaDecodifica, oklchParaSrgbNormalizado } from "../../../design/oklch.mjs";
import { OPACIDADE_CENA, OPACIDADE_SUPERFICIE } from "./config";

const RAIZ = resolve(__dirname, "../../../");
const landingCss = readFileSync(resolve(RAIZ, "components/landing/landing.css"), "utf8");
const tokensCss = readFileSync(resolve(RAIZ, "styles/tokens.css"), "utf8");

type Rgb = [number, number, number];

function bloco(css: string, seletor: string): string {
  const inicio = css.indexOf(seletor);
  return css.slice(inicio, css.indexOf("}", inicio));
}

function hexDaLanding(tema: "dark" | "light", nome: string): Rgb {
  const fonte = tema === "light" ? bloco(landingCss, ":root[data-theme='light'] .vx-landing {") : bloco(landingCss, ".vx-landing {");
  const valor = new RegExp(`${nome}:\\s*(#[0-9a-f]{6})`, "i").exec(fonte)?.[1];
  if (!valor) throw new Error(`${nome} não encontrado no tema ${tema}`);
  return [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16) / 255) as Rgb;
}

function tokenDoProduto(tema: "dark" | "light", nome: string): Rgb {
  const fonte = bloco(tokensCss, tema === "light" ? '[data-theme="light"] {' : '[data-theme="dark"] {');
  const primitivo = new RegExp(`${nome}:\\s*var\\(--([a-z]+-\\d+)\\)`).exec(fonte)?.[1];
  const valor = primitivo && new RegExp(`--${primitivo}:\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`).exec(tokensCss);
  if (!valor) throw new Error(`${nome} não encontrado no tema ${tema}`);
  return oklchParaSrgbNormalizado(Number(valor[1]), Number(valor[2]), Number(valor[3])).rgb;
}

const luminancia = (c: Rgb) => 0.2126 * gammaDecodifica(c[0]) + 0.7152 * gammaDecodifica(c[1]) + 0.0722 * gammaDecodifica(c[2]);
function contraste(a: Rgb, b: Rgb): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}
const misturar = (fundo: Rgb, cor: Rgb, alfa: number) => fundo.map((v, i) => v * (1 - alfa) + cor[i] * alfa) as Rgb;

const TEXTOS = ["--vx-text", "--vx-text-2", "--vx-text-3", "--vx-accent", "--vx-accent-soft"];

for (const tema of ["dark", "light"] as const) {
  const fundo = hexDaLanding(tema, "--vx-bg");
  const cena: Record<string, Rgb> = {
    campoCalmo: hexDaLanding(tema, "--vx-accent"),
    varreduraNeon: hexDaLanding(tema, "--vx-cyan"),
    glitch: hexDaLanding(tema, "--vx-magenta"),
    baixa: tokenDoProduto(tema, "--color-severity-low"),
    media: tokenDoProduto(tema, "--color-severity-medium"),
    alta: tokenDoProduto(tema, "--color-severity-high"),
    critica: tokenDoProduto(tema, "--color-severity-critical"),
    resolvido: tokenDoProduto(tema, "--color-success"),
  };

  describe(`Contraste do texto sobre a cena — tema ${tema}`, () => {
    it("CTR-01 — todo texto passa AA sobre o fundo puro", () => {
      for (const texto of TEXTOS) {
        expect(contraste(hexDaLanding(tema, texto), fundo), texto).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("CTR-02 — pior caso atrás da superfície continua AA", () => {
      // Dois glifos em destaque e a varredura na mesma posição, todos na cor
      // mais desfavorável; a superfície deixa passar só (1 - opacidade).
      const pilha = 1 - (1 - OPACIDADE_CENA.destaque) ** 2 * (1 - OPACIDADE_CENA.feixe);
      const efetivo = pilha * (1 - OPACIDADE_SUPERFICIE);
      for (const texto of TEXTOS) {
        const corDoTexto = hexDaLanding(tema, texto);
        for (const [nome, corDaCena] of Object.entries(cena)) {
          expect(contraste(corDoTexto, misturar(fundo, corDaCena, efetivo)), `${texto} sobre ${nome}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
}

describe("Superfície", () => {
  it("CTR-03 — a opacidade em landing.css é a de config.ts", () => {
    const regra = bloco(landingCss, ".vx-superficie::before {");
    const porcentagem = Number(/color-mix\(in srgb, var\(--vx-bg\) (\d+)%/.exec(regra)?.[1]);
    expect(porcentagem / 100).toBe(OPACIDADE_SUPERFICIE);
  });
});
