/**
 * sla-text.test.ts
 *
 * As frases do SLA (CP-2): arredondamento, singular/plural, sinal e o
 * vocabulário dos estados que não têm "restante" (resolvido, aceito, sem SLA).
 * Canários SLA-TXT-01..05.
 */

import { describe, expect, it } from "vitest";
import { duracaoHumana, fraseDoSla } from "./sla-text";

const HORA = 3_600_000;
const DIA = 86_400_000;

describe("duracaoHumana", () => {
  it("SLA-TXT-01: dias inteiros com singular/plural, arredondando ao mais próximo", () => {
    expect(duracaoHumana(1 * DIA)).toBe("1 dia");
    expect(duracaoHumana(2 * DIA)).toBe("2 dias");
    expect(duracaoHumana(2.4 * DIA)).toBe("2 dias");
    expect(duracaoHumana(2.6 * DIA)).toBe("3 dias");
    expect(duracaoHumana(-4 * DIA)).toBe("4 dias"); // sempre positivo; o sinal é do chamador
  });

  it("SLA-TXT-02: abaixo de um dia fala em horas; abaixo de uma hora, 'menos de 1 hora'", () => {
    expect(duracaoHumana(5 * HORA)).toBe("5 horas");
    expect(duracaoHumana(1 * HORA)).toBe("1 hora");
    expect(duracaoHumana(30 * 60_000)).toBe("menos de 1 hora");
    expect(duracaoHumana(0)).toBe("menos de 1 hora");
  });
});

describe("fraseDoSla", () => {
  it("SLA-TXT-03: aberto no prazo / em breve → 'vence em …'", () => {
    expect(fraseDoSla("ON_TRACK", 2 * DIA)).toBe("vence em 2 dias");
    expect(fraseDoSla("DUE_SOON", 5 * HORA)).toBe("vence em 5 horas");
  });

  it("SLA-TXT-04: vencido → 'vencido há …' (restante negativo)", () => {
    expect(fraseDoSla("BREACHED", -4 * DIA)).toBe("vencido há 4 dias");
    expect(fraseDoSla("BREACHED", -1 * DIA)).toBe("vencido há 1 dia");
  });

  it("SLA-TXT-05: estados sem relógio usam o rótulo em minúsculas; sem restante, o rótulo do estado", () => {
    expect(fraseDoSla("RESOLVED_IN_SLA", -10 * DIA)).toBe("resolvido no prazo");
    expect(fraseDoSla("RESOLVED_LATE", -10 * DIA)).toBe("resolvido com atraso");
    expect(fraseDoSla("ACCEPTED", 3 * DIA)).toBe("risco aceito");
    expect(fraseDoSla("NO_SLA", null)).toBe("sem sla");
    expect(fraseDoSla("ON_TRACK", null)).toBe("No prazo");
    expect(fraseDoSla("BREACHED", null)).toBe("Vencido");
  });
});
