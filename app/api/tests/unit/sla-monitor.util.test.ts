/**
 * sla-monitor.util.test.ts — regras puras do monitor de SLA (sem banco).
 *
 *   SLU-01  janela de 3 dias: a fronteira é inclusiva; vencida é prazo estritamente no passado
 *   SLU-02  a chave do lote não depende da ordem e muda quando o conjunto muda
 *   SLU-03  textos: singular/plural, data curta e teto de 191 caracteres
 */

import {
  CATEGORIA_SLA,
  JANELA_AVISO_DIAS,
  MAX_AVISOS_INDIVIDUAIS_SLA,
  chaveDoLote,
  classificarPrazo,
  linkDoResumo,
  textoAvisoIndividual,
  textoResumo,
} from "../../src/utils/sla-monitor.util";
import { DIA_MS } from "../../src/utils/sla.util";

const AGORA = new Date("2026-11-19T11:00:00.000Z");

describe("Regras do monitor de SLA", () => {
  it("SLU-01 — janela de 3 dias e vencida", () => {
    expect(JANELA_AVISO_DIAS).toBe(3);
    expect(MAX_AVISOS_INDIVIDUAIS_SLA).toBe(3);
    expect(classificarPrazo(new Date(AGORA.getTime() + 3 * DIA_MS), AGORA)).toBe("VENCE_EM_BREVE");
    expect(classificarPrazo(new Date(AGORA.getTime() + 3 * DIA_MS + 1), AGORA)).toBeNull();
    expect(classificarPrazo(AGORA, AGORA)).toBe("VENCE_EM_BREVE");
    expect(classificarPrazo(new Date(AGORA.getTime() - 1), AGORA)).toBe("VENCIDA");
    expect(classificarPrazo(new Date(AGORA.getTime() - 10 * DIA_MS), AGORA)).toBe("VENCIDA");
  });

  it("SLU-02 — chave do lote estável na ordem e sensível ao conjunto", () => {
    const a = chaveDoLote(["SLA_DUE_SOON|/findings/1", "SLA_OVERDUE|/findings/2"]);
    const b = chaveDoLote(["SLA_OVERDUE|/findings/2", "SLA_DUE_SOON|/findings/1"]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(chaveDoLote(["SLA_DUE_SOON|/findings/1", "SLA_OVERDUE|/findings/2", "SLA_DUE_SOON|/findings/3"])).not.toBe(a);
    expect(linkDoResumo("v1", a)).toBe(`/findings/v1?lote=${a}`);
  });

  it("SLU-03 — textos com singular, plural e data curta", () => {
    const achado = { title: "XSS no carrinho", severityFinal: "HIGH", slaDueAt: new Date(AGORA.getTime() + 1 * DIA_MS) };
    expect(textoAvisoIndividual("VENCE_EM_BREVE", achado, AGORA)).toEqual({
      title: "Prazo de remediação vence em 1 dia",
      message: "XSS no carrinho (HIGH). Prazo: 20/11/2026.",
    });

    const vencida = { title: "IDOR", severityFinal: "CRITICAL", slaDueAt: new Date(AGORA.getTime() - 3 * DIA_MS) };
    expect(textoAvisoIndividual("VENCIDA", vencida, AGORA).title).toBe("Prazo de remediação vencido há 3 dias");

    expect(textoResumo(0, 1)).toEqual({ title: "1 vulnerabilidade pede atenção no prazo de remediação", message: "1 vencendo em até 3 dias." });
    expect(textoResumo(2, 0).message).toBe("2 com prazo vencido.");
    expect(textoResumo(1, 4).title).toBe("5 vulnerabilidades pedem atenção no prazo de remediação");

    expect(CATEGORIA_SLA).toEqual({ VENCE_EM_BREVE: "SLA_DUE_SOON", VENCIDA: "SLA_OVERDUE", RESUMO: "SLA_RESUMO" });
  });
});
