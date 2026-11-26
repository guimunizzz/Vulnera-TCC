/** agendamento.test.ts — textos da página /agendamentos: nunca cron, sempre português. */
import { describe, expect, it } from "vitest";
import { dataDaquiA, descreverDesfecho, descreverQuando, descreverQuandoCompleto, emQuantoTempo, fimDoDia, horario, rotuloFuso } from "./agendamento";

describe("agendamento — textos", () => {
  it("descreve a frequência sem cron, com gênero certo para o dia", () => {
    expect(descreverQuando({ frequency: "DAILY", hour: 3, minute: 0, dayOfWeek: null })).toBe("Todo dia às 03:00");
    expect(descreverQuando({ frequency: "WEEKLY", hour: 22, minute: 5, dayOfWeek: 1 })).toBe("Toda segunda às 22:05");
    expect(descreverQuando({ frequency: "WEEKLY", hour: 9, minute: 30, dayOfWeek: 6 })).toBe("Todo sábado às 09:30");
    expect(descreverQuando({ frequency: "WEEKLY", hour: 9, minute: 30, dayOfWeek: 0 })).toBe("Todo domingo às 09:30");
  });

  it("frase completa inclui o fuso em linguagem comum", () => {
    expect(descreverQuandoCompleto({ frequency: "WEEKLY", hour: 3, minute: 0, dayOfWeek: 3, timezone: "America/Sao_Paulo" })).toBe(
      "Toda quarta às 03:00 (horário de Brasília)",
    );
    expect(rotuloFuso("America/Manaus")).toBe("horário do Amazonas");
    expect(rotuloFuso("UTC")).toBe("UTC");
    expect(rotuloFuso("Europe/Lisbon")).toBe("Europe/Lisbon");
  });

  it("traduz o desfecho da última execução, inclusive um código desconhecido", () => {
    expect(descreverDesfecho(null)).toBeNull();
    expect(descreverDesfecho("STARTED")).toEqual({ texto: "Scan iniciado", tom: "sucesso" });
    expect(descreverDesfecho("AUTHORIZATION_EXPIRED")?.texto).toBe("Não rodou: a autorização venceu");
    expect(descreverDesfecho("ALGO_NOVO")).toEqual({ texto: "Não rodou (ALGO_NOVO)", tom: "atencao" });
  });

  it("tempo até o próximo disparo e datas do formulário", () => {
    const agora = new Date("2026-11-19T12:00:00Z");
    expect(emQuantoTempo("2026-11-19T12:20:00Z", agora)).toBe("em 20 min");
    expect(emQuantoTempo("2026-11-19T17:00:00Z", agora)).toBe("em 5 h");
    expect(emQuantoTempo("2026-11-20T12:00:00Z", agora)).toBe("em 1 dia");
    expect(emQuantoTempo("2026-11-19T11:00:00Z", agora)).toBe("agora");
    expect(horario(7, 5)).toBe("07:05");
    expect(dataDaquiA(30, new Date(2026, 10, 19))).toBe("2026-12-19");
    const fim = new Date(fimDoDia("2026-12-19"));
    expect([fim.getFullYear(), fim.getMonth(), fim.getDate(), fim.getHours(), fim.getMinutes()]).toEqual([2026, 11, 19, 23, 59]);
  });
});
