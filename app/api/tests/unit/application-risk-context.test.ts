/**
 * application-risk-context.test.ts (unit)
 *
 * A função pura que decide se uma mudança de contexto SOBE ou DESCE o risco
 * (`classificarMudancaDeContexto`) é o coração da regra D2 — quem pode
 * subir é mais amplo do que quem pode descer. Se ela errar a direção, um
 * CLIENT OWNER rebaixa criticidade sem ninguém perceber. Por isso cada
 * dimensão é testada em isolamento, nas duas direções, mais o caso neutro.
 *
 * Canários: CTX-U-01..CTX-U-08.
 */

import {
  classificarMudancaDeContexto,
  CRITICALITY_RANK,
  DATA_SENSITIVITY_RANK,
  ENVIRONMENT_RANK,
  type RiskContext,
} from "../../src/models/application.model";

const BASE: RiskContext = {
  environment: "HOMOL",
  criticality: "MEDIUM",
  internetFacing: false,
  dataSensitivity: "INTERNAL",
};

describe("classificarMudancaDeContexto — direção de cada dimensão (D2)", () => {
  it("CTX-U-01: sem mudança devolve lista vazia (mesmos valores, campos ausentes)", () => {
    expect(classificarMudancaDeContexto(BASE, {})).toEqual([]);
    expect(classificarMudancaDeContexto(BASE, { ...BASE })).toEqual([]);
  });

  it("CTX-U-02: criticality MEDIUM→HIGH é INCREASE; HIGH→MEDIUM é DECREASE", () => {
    expect(classificarMudancaDeContexto(BASE, { criticality: "HIGH" })).toEqual([
      { field: "criticality", from: "MEDIUM", to: "HIGH", direction: "INCREASE" },
    ]);
    expect(classificarMudancaDeContexto({ ...BASE, criticality: "HIGH" }, { criticality: "MEDIUM" })).toEqual([
      { field: "criticality", from: "HIGH", to: "MEDIUM", direction: "DECREASE" },
    ]);
  });

  it("CTX-U-03: environment HOMOL→PROD é INCREASE; PROD→DEV é DECREASE", () => {
    expect(classificarMudancaDeContexto(BASE, { environment: "PROD" })[0]!.direction).toBe("INCREASE");
    expect(classificarMudancaDeContexto({ ...BASE, environment: "PROD" }, { environment: "DEV" })[0]!.direction).toBe(
      "DECREASE",
    );
  });

  it("CTX-U-04: internetFacing false→true é INCREASE; true→false é DECREASE", () => {
    expect(classificarMudancaDeContexto(BASE, { internetFacing: true })).toEqual([
      { field: "internetFacing", from: false, to: true, direction: "INCREASE" },
    ]);
    expect(classificarMudancaDeContexto({ ...BASE, internetFacing: true }, { internetFacing: false })).toEqual([
      { field: "internetFacing", from: true, to: false, direction: "DECREASE" },
    ]);
  });

  it("CTX-U-05: dataSensitivity INTERNAL→RESTRICTED é INCREASE; RESTRICTED→PUBLIC é DECREASE", () => {
    expect(classificarMudancaDeContexto(BASE, { dataSensitivity: "RESTRICTED" })[0]!.direction).toBe("INCREASE");
    expect(
      classificarMudancaDeContexto({ ...BASE, dataSensitivity: "RESTRICTED" }, { dataSensitivity: "PUBLIC" })[0]!
        .direction,
    ).toBe("DECREASE");
  });

  it("CTX-U-06: várias dimensões ao mesmo tempo — cada uma classificada por si", () => {
    const mudancas = classificarMudancaDeContexto(
      { ...BASE, criticality: "CRITICAL" },
      { criticality: "LOW", internetFacing: true, environment: "PROD" },
    );
    const porCampo = Object.fromEntries(mudancas.map((m) => [m.field, m.direction]));
    expect(porCampo).toEqual({ criticality: "DECREASE", internetFacing: "INCREASE", environment: "INCREASE" });
  });

  it("CTX-U-07: as ordens são estritamente crescentes (LOW<MEDIUM<HIGH<CRITICAL etc.)", () => {
    const crescente = (rank: Record<string, number>, ordem: string[]) =>
      ordem.every((v, i) => i === 0 || rank[v]! > rank[ordem[i - 1]!]!);
    expect(crescente(CRITICALITY_RANK, ["LOW", "MEDIUM", "HIGH", "CRITICAL"])).toBe(true);
    expect(crescente(ENVIRONMENT_RANK, ["DEV", "HOMOL", "PROD"])).toBe(true);
    expect(crescente(DATA_SENSITIVITY_RANK, ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"])).toBe(true);
  });

  it("CTX-U-08: valor legado fora do vocabulário é 'menor que tudo' — sair dele é INCREASE, nunca DECREASE", () => {
    // Uma app antiga com environment inválido pode ser corrigida para qualquer
    // valor válido sem exigir ADMIN; nada pode ser rebaixado ATÉ um inválido.
    expect(classificarMudancaDeContexto({ ...BASE, environment: "STAGING" }, { environment: "DEV" })[0]!.direction).toBe(
      "INCREASE",
    );
    expect(classificarMudancaDeContexto(BASE, { environment: "STAGING" })[0]!.direction).toBe("DECREASE");
  });
});
