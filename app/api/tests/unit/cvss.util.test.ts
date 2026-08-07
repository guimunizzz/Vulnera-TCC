/**
 * cvss.util.test.ts
 *
 * Teste unitário puro (sem banco) do parser CVSS 3.1. Os scores esperados
 * foram conferidos manualmente com as fórmulas oficiais do FIRST (ver
 * comentários em src/utils/cvss.util.ts) e, quando aplicável, batem com o
 * score publicado pelo NVD pra CVE real correspondente.
 */

import { calculateCvss } from "../../src/utils/cvss.util";

describe("calculateCvss", () => {
  // BIZ-03 — vetor canônico da spec do FIRST
  it("vetor canônico AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H = 9.8 CRITICAL", () => {
    const result = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
    expect(result.score).toBe(9.8);
    expect(result.severity).toBe("CRITICAL");
  });

  it("Log4Shell (CVE-2021-44228, Scope Changed) = 10.0 CRITICAL", () => {
    const result = calculateCvss("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H");
    expect(result.score).toBe(10.0);
    expect(result.severity).toBe("CRITICAL");
  });

  it("Heartbleed (CVE-2014-0160) = 7.5 HIGH", () => {
    const result = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N");
    expect(result.score).toBe(7.5);
    expect(result.severity).toBe("HIGH");
  });

  it("vetor de severidade média (AC alto, escopo local) = 5.1 MEDIUM", () => {
    const result = calculateCvss("AV:A/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:N");
    expect(result.score).toBe(5.1);
    expect(result.severity).toBe("MEDIUM");
  });

  it("vetor de baixa severidade (acesso físico, alta complexidade) = 1.8 LOW", () => {
    const result = calculateCvss("AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N");
    expect(result.score).toBe(1.8);
    expect(result.severity).toBe("LOW");
  });

  it("nenhum impacto (C/I/A todos None) = 0.0 NONE", () => {
    const result = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N");
    expect(result.score).toBe(0);
    expect(result.severity).toBe("NONE");
  });

  // BIZ-05 (indiretamente) — vetor inválido nunca deve gerar score
  it.each([
    ["string vazia", ""],
    ["métrica faltando (sem A)", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H"],
    ["valor fora do domínio", "AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["métrica duplicada", "AV:N/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["métrica desconhecida", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/XX:Y"],
    ["scope inválido", "AV:N/AC:L/PR:N/UI:N/S:X/C:H/I:H/A:H"],
    ["lixo qualquer", "isso nao e um vetor cvss"],
  ])("vetor inválido (%s) lança INVALID_CVSS_VECTOR", (_label, vector) => {
    expect(() => calculateCvss(vector)).toThrow("INVALID_CVSS_VECTOR");
  });
});
