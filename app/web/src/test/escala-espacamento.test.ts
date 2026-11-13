/**
 * escala-espacamento.test.ts — guarda da escala de espaçamento (DESIGN_SYSTEM §2.6).
 *
 * A config substitui a escala inteira do Tailwind (0–6, 8, 10, 12, 16, 20,
 * 24, px, touch). Uma classe com outro número — `gap-1.5`, `h-9`, `w-64` —
 * NÃO gera CSS e não avisa: o espaço vira zero e os elementos colam. Foi o que
 * deixou o seletor de layout colado, o radar de maturidade e o donut de
 * severidade sem altura e o minimapa sobre a legenda (caça de 2026-11-13: 102
 * ocorrências em 29 arquivos).
 *
 * Este teste lê a escala da própria config e varre o código: qualquer
 * utilitário de espaçamento/tamanho com valor numérico fora dela falha, com o
 * arquivo e a linha. Dimensão de componente fora da escala (altura de
 * gráfico, largura de painel) usa valor explícito: `h-[20rem]`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

const SRC = resolve(__dirname, "..");
const ESCALA = new Set(Object.keys((config.theme as { spacing: Record<string, string> }).spacing));

// Utilitários cujo valor numérico vem da escala de espaçamento.
const PREFIXOS =
  "p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|w|h|min-w|min-h|max-w|max-h|size|inset|inset-x|inset-y|top|bottom|left|right|start|end|translate-x|translate-y|scroll-m|scroll-p|basis";
const CLASSE = new RegExp(`(?<=^|[\\s"'\`:])-?(?:${PREFIXOS})-(\\d+(?:\\.\\d+)?)(?=$|[\\s"'\`])`, "g");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(tsx?|jsx?)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("Escala de espaçamento (DESIGN_SYSTEM §2.6)", () => {
  it("a escala da config é a documentada", () => {
    expect([...ESCALA].sort()).toEqual(["0", "1", "10", "12", "16", "2", "20", "24", "3", "4", "5", "6", "8", "px", "touch"].sort());
  });

  it("nenhuma classe usa um valor fora da escala (ela não geraria CSS)", () => {
    const fora: string[] = [];
    for (const arq of arquivos(SRC)) {
      readFileSync(arq, "utf8")
        .split("\n")
        .forEach((linha, i) => {
          for (const m of linha.matchAll(CLASSE)) {
            if (!ESCALA.has(m[1])) fora.push(`${relative(SRC, arq).replace(/\\/g, "/")}:${i + 1}  ${m[0]}`);
          }
        });
    }
    expect(fora, `Classes fora da escala (use o passo mais próximo ou um valor explícito como h-[20rem]):\n${fora.join("\n")}`).toEqual([]);
  });
});
