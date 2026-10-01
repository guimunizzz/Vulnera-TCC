/**
 * vrs.util.test.ts (unit)
 *
 * A fórmula do Vulnera Risk Score (CP-3, D3): cada fator isolado, mínimo,
 * máximo, clamp, determinismo, explicabilidade, CVSS nulo — e as três
 * exclusões que a decisão fixou (SLA fora, sourceType fora, severityFinal
 * não substitui CVSS). Canários VRS-U-01..VRS-U-12.
 */

import { calcularVrs, vrsBand, VRS_BANDS, type VrsInput } from "../../src/utils/vrs.util";

/** Contexto NEUTRO: todos os fatores em 0. Só o CVSS conta. */
const NEUTRO: Omit<VrsInput, "cvssScore"> = {
  criticality: "LOW",
  environment: "DEV",
  internetFacing: false,
  dataSensitivity: "PUBLIC",
};

/** Contexto MÁXIMO: todos os fatores no teto. */
const MAXIMO: Omit<VrsInput, "cvssScore"> = {
  criticality: "CRITICAL",
  environment: "PROD",
  internetFacing: true,
  dataSensitivity: "RESTRICTED",
};

const T = new Date("2026-09-15T12:00:00.000Z");

describe("calcularVrs — base CVSS", () => {
  it("VRS-U-01: em contexto neutro o VRS é round(cvss × 6) — o CVSS é o maior componente", () => {
    expect(calcularVrs({ cvssScore: 10, ...NEUTRO }, T)!.score).toBe(60);
    expect(calcularVrs({ cvssScore: 9.8, ...NEUTRO }, T)!.score).toBe(59);
    expect(calcularVrs({ cvssScore: 5.4, ...NEUTRO }, T)!.score).toBe(32);
    expect(calcularVrs({ cvssScore: 0.1, ...NEUTRO }, T)!.score).toBe(1);
    expect(calcularVrs({ cvssScore: 0, ...NEUTRO }, T)!.score).toBe(0);
  });

  it("VRS-U-02: CVSS nulo → VRS null (não zero): sem vetor não há como priorizar", () => {
    expect(calcularVrs({ cvssScore: null, ...MAXIMO }, T)).toBeNull();
    expect(calcularVrs({ cvssScore: Number.NaN, ...MAXIMO }, T)).toBeNull();
  });
});

describe("calcularVrs — cada fator isolado", () => {
  const base = calcularVrs({ cvssScore: 5, ...NEUTRO }, T)!.score; // 30

  it("VRS-U-03: criticidade LOW 0 · MEDIUM 5 · HIGH 10 · CRITICAL 15", () => {
    for (const [v, p] of [["LOW", 0], ["MEDIUM", 5], ["HIGH", 10], ["CRITICAL", 15]] as const) {
      expect(calcularVrs({ cvssScore: 5, ...NEUTRO, criticality: v }, T)!.score).toBe(base + p);
    }
  });

  it("VRS-U-04: ambiente DEV 0 · HOMOL 3 · PROD 7", () => {
    for (const [v, p] of [["DEV", 0], ["HOMOL", 3], ["PROD", 7]] as const) {
      expect(calcularVrs({ cvssScore: 5, ...NEUTRO, environment: v }, T)!.score).toBe(base + p);
    }
  });

  it("VRS-U-05: exposição à internet false 0 · true 8", () => {
    expect(calcularVrs({ cvssScore: 5, ...NEUTRO, internetFacing: true }, T)!.score).toBe(base + 8);
  });

  it("VRS-U-06: sensibilidade PUBLIC 0 · INTERNAL 3 · CONFIDENTIAL 7 · RESTRICTED 10", () => {
    for (const [v, p] of [["PUBLIC", 0], ["INTERNAL", 3], ["CONFIDENTIAL", 7], ["RESTRICTED", 10]] as const) {
      expect(calcularVrs({ cvssScore: 5, ...NEUTRO, dataSensitivity: v }, T)!.score).toBe(base + p);
    }
  });
});

describe("calcularVrs — extremos, clamp e discriminação", () => {
  it("VRS-U-07: máximo teórico é exatamente 100 (CVSS 10 em contexto máximo); 9.8 dá 99, não satura", () => {
    expect(calcularVrs({ cvssScore: 10, ...MAXIMO }, T)!.score).toBe(100);
    expect(calcularVrs({ cvssScore: 9.8, ...MAXIMO }, T)!.score).toBe(99);
    expect(calcularVrs({ cvssScore: 9.8, ...MAXIMO }, T)!.breakdown.raw).toBe(99);
  });

  it("VRS-U-08: o mesmo CVSS em contextos diferentes produz scores diferentes — o modelo discrimina", () => {
    const critico = calcularVrs({ cvssScore: 9.8, ...MAXIMO }, T)!.score;
    const medio = calcularVrs(
      { cvssScore: 9.8, criticality: "MEDIUM", environment: "HOMOL", internetFacing: false, dataSensitivity: "INTERNAL" },
      T,
    )!.score;
    expect(critico).toBe(99);
    expect(medio).toBe(70);
    // e um CVSS menor em contexto pior pode passar um CVSS maior em contexto bom
    const altoEmDev = calcularVrs({ cvssScore: 8.0, ...NEUTRO }, T)!.score; // 48
    const medioEmProdExposta = calcularVrs({ cvssScore: 6.5, ...MAXIMO }, T)!.score; // 39 + 40 = 79
    expect(medioEmProdExposta).toBeGreaterThan(altoEmDev);
  });

  it("VRS-U-09: clamp — CVSS fora de 0..10 é contido antes de multiplicar", () => {
    expect(calcularVrs({ cvssScore: 12, ...MAXIMO }, T)!.score).toBe(100);
    expect(calcularVrs({ cvssScore: -3, ...NEUTRO }, T)!.score).toBe(0);
  });

  it("VRS-U-10: valor de contexto fora do vocabulário conta 0 e é marcado como desconhecido", () => {
    const r = calcularVrs({ cvssScore: 5, ...NEUTRO, criticality: "URGENTE", environment: "STAGING" }, T)!;
    expect(r.score).toBe(30);
    expect(r.breakdown.factors.find((f) => f.name === "criticality")).toMatchObject({ points: 0, unknown: true });
    expect(r.breakdown.factors.find((f) => f.name === "environment")).toMatchObject({ points: 0, unknown: true });
  });
});

describe("calcularVrs — determinismo e explicabilidade", () => {
  it("VRS-U-11: mesma entrada, mesma saída, sempre; e o breakdown soma exatamente o score", () => {
    const input: VrsInput = { cvssScore: 7.5, criticality: "HIGH", environment: "PROD", internetFacing: true, dataSensitivity: "CONFIDENTIAL" };
    const a = calcularVrs(input, T)!;
    for (let i = 0; i < 50; i++) expect(calcularVrs(input, T)).toEqual(a);

    const soma = a.breakdown.basePoints + a.breakdown.factors.reduce((s, f) => s + f.points, 0);
    expect(soma).toBe(a.score);
    expect(a.breakdown).toMatchObject({
      formula: "v1",
      cvss: 7.5,
      basePoints: 45,
      score: 77,
      band: "URGENTE",
      computedAt: T.toISOString(),
    });
    expect(a.breakdown.factors).toEqual([
      { name: "criticality", value: "HIGH", points: 10 },
      { name: "environment", value: "PROD", points: 7 },
      { name: "internetFacing", value: true, points: 8 },
      { name: "dataSensitivity", value: "CONFIDENTIAL", points: 7 },
    ]);
  });

  it("VRS-U-12: faixas — 0–39 MONITORAR · 40–64 PLANEJADO · 65–84 URGENTE · 85–100 IMEDIATO, fronteiras inclusas", () => {
    expect(vrsBand(0)).toBe("MONITORAR");
    expect(vrsBand(39)).toBe("MONITORAR");
    expect(vrsBand(40)).toBe("PLANEJADO");
    expect(vrsBand(64)).toBe("PLANEJADO");
    expect(vrsBand(65)).toBe("URGENTE");
    expect(vrsBand(84)).toBe("URGENTE");
    expect(vrsBand(85)).toBe("IMEDIATO");
    expect(vrsBand(100)).toBe("IMEDIATO");
    // as faixas cobrem 0..100 sem buraco nem sobreposição
    const ordenadas = [...VRS_BANDS].sort((a, b) => a.min - b.min);
    expect(ordenadas[0]!.min).toBe(0);
    expect(ordenadas[ordenadas.length - 1]!.max).toBe(100);
    for (let i = 1; i < ordenadas.length; i++) expect(ordenadas[i]!.min).toBe(ordenadas[i - 1]!.max + 1);
  });
});
