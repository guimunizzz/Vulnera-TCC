/**
 * sla.util.test.ts (unit)
 *
 * As funções puras do SLA (CP-2). Cada regra da tabela de `slaState()` tem
 * um teste, mais as fronteiras que mais enganam: o instante exato do prazo,
 * o limiar de 20%, a pausa que empurra as datas, e o fuso — que aqui não
 * existe, porque tudo é milissegundo de época.
 *
 * Canários: SLA-U-01..SLA-U-15.
 */

import {
  computeSlaCycle,
  computeSlaDueAt,
  computeSlaDueSoonAt,
  DIA_MS,
  msToDays,
  shiftSlaCycle,
  slaDaysFor,
  slaRemainingMs,
  slaState,
  type SlaInput,
} from "../../src/utils/sla.util";

const POLICY = { criticalDays: 2, highDays: 7, mediumDays: 30, lowDays: 90 };

/** Um instante fixo, em UTC, longe de qualquer fronteira de dia/mês. */
const T0 = new Date("2026-09-01T12:00:00.000Z");
const dias = (n: number) => new Date(T0.getTime() + n * DIA_MS);

/** Um finding aberto com janela de 10 dias: vence no dia 10, avisa no dia 8. */
function aberto(over: Partial<SlaInput> = {}): SlaInput {
  return {
    status: "OPEN",
    slaDueAt: dias(10),
    slaDueSoonAt: dias(8),
    now: T0,
    ...over,
  };
}

describe("slaDaysFor / computeSla*", () => {
  it("SLA-U-01: cada severidade lê o prazo certo da política; NONE e desconhecida não têm SLA", () => {
    expect(slaDaysFor(POLICY, "CRITICAL")).toBe(2);
    expect(slaDaysFor(POLICY, "HIGH")).toBe(7);
    expect(slaDaysFor(POLICY, "MEDIUM")).toBe(30);
    expect(slaDaysFor(POLICY, "LOW")).toBe(90);
    expect(slaDaysFor(POLICY, "NONE")).toBeNull();
    expect(slaDaysFor(POLICY, "URGENTE")).toBeNull();
  });

  it("SLA-U-02: dueAt = início + N dias corridos, em UTC puro (sem fuso, sem calendário)", () => {
    expect(computeSlaDueAt(T0, 7).toISOString()).toBe("2026-09-08T12:00:00.000Z");
    // atravessa virada de mês e o horário de verão de qualquer fuso sem se mexer
    expect(computeSlaDueAt(new Date("2026-10-30T23:30:00.000Z"), 3).toISOString()).toBe("2026-11-02T23:30:00.000Z");
  });

  it("SLA-U-03: o cálculo não depende do TZ do processo", () => {
    const tzOriginal = process.env.TZ;
    try {
      process.env.TZ = "America/Sao_Paulo";
      const a = computeSlaDueAt(T0, 30).getTime();
      process.env.TZ = "Asia/Tokyo";
      const b = computeSlaDueAt(T0, 30).getTime();
      expect(a).toBe(b);
    } finally {
      process.env.TZ = tzOriginal;
    }
  });

  it("SLA-U-04: dueSoonAt é o instante dos 80% da janela; o ciclo inteiro sai de uma vez, ou null sem prazo", () => {
    expect(computeSlaDueSoonAt(T0, 10).toISOString()).toBe(dias(8).toISOString());
    expect(computeSlaCycle(T0, POLICY, "HIGH")).toEqual({
      slaStartedAt: T0,
      slaDueAt: dias(7),
      slaDueSoonAt: dias(5.6),
    });
    expect(computeSlaCycle(T0, POLICY, "NONE")).toBeNull();
  });
});

describe("slaState — a tabela de regras", () => {
  it("SLA-U-05: sem prazo é NO_SLA, independentemente de status ou de aceite", () => {
    expect(slaState(aberto({ slaDueAt: null }))).toBe("NO_SLA");
    expect(slaState(aberto({ slaDueAt: null, status: "FIXED" }))).toBe("NO_SLA");
    expect(slaState(aberto({ slaDueAt: null, acceptedActive: true }))).toBe("NO_SLA");
  });

  it("SLA-U-06: com folga é ON_TRACK; no dia 7,9 de uma janela de 10 dias ainda é ON_TRACK", () => {
    expect(slaState(aberto({ now: dias(1) }))).toBe("ON_TRACK");
    expect(slaState(aberto({ now: dias(7.9) }))).toBe("ON_TRACK");
  });

  it("SLA-U-07: DUE_SOON a partir do instante dos 20% restantes (dia 8 de 10), inclusive", () => {
    expect(slaState(aberto({ now: dias(8) }))).toBe("DUE_SOON");
    expect(slaState(aberto({ now: dias(9.5) }))).toBe("DUE_SOON");
    // janela de 2 dias (CRITICAL): avisa nas últimas ~9,6 horas
    const critico = computeSlaCycle(T0, POLICY, "CRITICAL")!;
    expect(slaState({ status: "OPEN", ...critico, now: dias(1.5) })).toBe("ON_TRACK");
    expect(slaState({ status: "OPEN", ...critico, now: dias(1.6) })).toBe("DUE_SOON");
  });

  it("SLA-U-08: fronteira exata — no instante do prazo ainda NÃO estourou; 1 ms depois, BREACHED", () => {
    expect(slaState(aberto({ now: dias(10) }))).toBe("DUE_SOON");
    expect(slaState(aberto({ now: new Date(dias(10).getTime() + 1) }))).toBe("BREACHED");
    expect(slaState(aberto({ now: dias(40) }))).toBe("BREACHED");
  });

  it("SLA-U-09: sem dueSoonAt (legado) nunca avisa — vai de ON_TRACK direto a BREACHED", () => {
    expect(slaState(aberto({ slaDueSoonAt: null, now: dias(9.9) }))).toBe("ON_TRACK");
    expect(slaState(aberto({ slaDueSoonAt: null, now: dias(10.1) }))).toBe("BREACHED");
  });

  it("SLA-U-10: aceite vigente é ACCEPTED, mesmo que o prazo já tenha passado", () => {
    expect(slaState(aberto({ acceptedActive: true, now: dias(5) }))).toBe("ACCEPTED");
    expect(slaState(aberto({ acceptedActive: true, now: dias(50) }))).toBe("ACCEPTED");
  });

  it("SLA-U-11: FIXED/CLOSED com resolvedAt dentro do prazo é RESOLVED_IN_SLA; fora, RESOLVED_LATE", () => {
    expect(slaState(aberto({ status: "FIXED", resolvedAt: dias(9), now: dias(50) }))).toBe("RESOLVED_IN_SLA");
    expect(slaState(aberto({ status: "CLOSED", resolvedAt: dias(10), now: dias(50) }))).toBe("RESOLVED_IN_SLA");
    expect(slaState(aberto({ status: "FIXED", resolvedAt: dias(10.01), now: dias(50) }))).toBe("RESOLVED_LATE");
  });

  it("SLA-U-12: resolvido vence aceite — corrigido com aceite vigente continua RESOLVED_*", () => {
    expect(slaState(aberto({ status: "FIXED", resolvedAt: dias(3), acceptedActive: true, now: dias(9) }))).toBe(
      "RESOLVED_IN_SLA",
    );
  });

  it("SLA-U-13: resolvido SEM resolvedAt julga pelo agora — nunca inventa conformidade", () => {
    // prazo ainda não passou: necessariamente foi resolvido dentro dele
    expect(slaState(aberto({ status: "FIXED", resolvedAt: null, now: dias(5) }))).toBe("RESOLVED_IN_SLA");
    // prazo já passou e não sabemos quando resolveu: reporta atraso
    expect(slaState(aberto({ status: "FIXED", resolvedAt: null, now: dias(20) }))).toBe("RESOLVED_LATE");
  });
});

describe("pausa (shiftSlaCycle) e restante", () => {
  it("SLA-U-14: uma pausa de 3 dias empurra prazo e aviso em 3 dias — sem pausa venceria; com ela, ON_TRACK", () => {
    const ciclo = { slaDueAt: dias(10), slaDueSoonAt: dias(8) };
    const empurrado = shiftSlaCycle(ciclo, 3 * DIA_MS);
    expect(empurrado.slaDueAt.toISOString()).toBe(dias(13).toISOString());
    expect(empurrado.slaDueSoonAt!.toISOString()).toBe(dias(11).toISOString());

    expect(slaState({ status: "OPEN", ...ciclo, now: dias(10.5) })).toBe("BREACHED");
    expect(slaState({ status: "OPEN", ...empurrado, now: dias(10.5) })).toBe("ON_TRACK");
    expect(slaState({ status: "OPEN", ...empurrado, now: dias(11) })).toBe("DUE_SOON");
    expect(slaState({ status: "OPEN", ...empurrado, now: dias(13.5) })).toBe("BREACHED");
    // intervalo negativo não "desempurra" — pausa só anda para frente
    expect(shiftSlaCycle(ciclo, -DIA_MS).slaDueAt.toISOString()).toBe(dias(10).toISOString());
    // sem dueSoonAt, continua sem
    expect(shiftSlaCycle({ slaDueAt: dias(10), slaDueSoonAt: null }, DIA_MS).slaDueSoonAt).toBeNull();
  });

  it("SLA-U-15: restante é assinado (negativo = vencido) e null sem SLA; dias arredondam ao inteiro mais próximo", () => {
    expect(slaRemainingMs({ slaDueAt: dias(10), now: dias(8) })).toBe(2 * DIA_MS);
    expect(slaRemainingMs({ slaDueAt: dias(10), now: dias(14) })).toBe(-4 * DIA_MS);
    expect(slaRemainingMs({ slaDueAt: null, now: T0 })).toBeNull();
    expect(msToDays(2.4 * DIA_MS)).toBe(2);
    expect(msToDays(2.6 * DIA_MS)).toBe(3);
    expect(msToDays(-4 * DIA_MS)).toBe(-4);
  });
});
