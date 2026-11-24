/**
 * calendario-de-prazos.test.ts — a grade do calendário de SLA (ADR-062).
 *   CAL-01  grade começa na segunda da semana atual, 7 dias por semana
 *   CAL-02  vencido vai para a pilha; depois da grade só conta
 *   CAL-03  peso pela severidade e nível relativo ao dia mais pesado
 */

import { describe, expect, it } from "vitest";
import { chaveLocal, montarCalendario, type PrazoAberto } from "./calendario-de-prazos";

// Quarta-feira, 18/11/2026, 10h local.
const HOJE = new Date(2026, 10, 18, 10, 0, 0);
const em = (dia: number, mes = 10, hora = 15) => new Date(2026, mes, dia, hora, 0, 0).toISOString();
let seq = 0;
const prazo = (slaDueAt: string, severityFinal = "HIGH"): PrazoAberto => ({ id: `v${++seq}`, title: `V${seq}`, severityFinal, applicationName: "Portal", slaDueAt });

describe("montarCalendario", () => {
  it("CAL-01 — começa na segunda da semana atual", () => {
    const cal = montarCalendario([], HOJE, 2);
    expect(cal.semanas).toHaveLength(2);
    expect(cal.semanas[0]).toHaveLength(7);
    expect(cal.semanas[0][0].data).toBe(chaveLocal(new Date(2026, 10, 16))); // segunda 16/11
    expect(cal.semanas[0][2]).toMatchObject({ hoje: true, passado: false });
    expect(cal.semanas[0][1].passado).toBe(true);
    expect(cal.semanas[1][6].data).toBe(chaveLocal(new Date(2026, 10, 29)));
  });

  it("CAL-02 — vencidos à parte, depois da grade só contado", () => {
    const vencido = prazo(em(10), "CRITICAL");
    const ontem = prazo(em(17));
    const fora = prazo(em(30, 11));
    const cal = montarCalendario([vencido, ontem, fora, prazo(em(20))], HOJE, 2);
    expect(cal.vencidos.map((v) => v.id)).toEqual([vencido.id, ontem.id]);
    expect(cal.depois).toBe(1);
    expect(cal.semanas[0][4].itens).toHaveLength(1); // sexta 20/11
  });

  it("CAL-03 — peso pela severidade e nível relativo", () => {
    const cal = montarCalendario(
      [prazo(em(19), "CRITICAL"), prazo(em(19), "LOW"), prazo(em(20), "LOW"), prazo(em(21), "MEDIUM")],
      HOJE,
      1,
    );
    const [, , , quinta, sexta, sabado] = cal.semanas[0];
    expect(quinta).toMatchObject({ peso: 5, nivel: 4 });
    expect(quinta.itens[0].severityFinal).toBe("CRITICAL"); // mais grave primeiro
    expect(sexta).toMatchObject({ peso: 1, nivel: 1 });
    expect(sabado).toMatchObject({ peso: 2, nivel: 2 });
    expect(cal.semanas[0][0]).toMatchObject({ peso: 0, nivel: 0 });
  });
});
