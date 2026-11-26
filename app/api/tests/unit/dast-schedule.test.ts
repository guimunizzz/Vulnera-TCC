/**
 * dast-schedule.test.ts (unidade) — regras puras e reconciliador (ADR-056, Fase 5), sem Redis.
 *
 *   SCHED-U-01  host normalizado (minúsculo, sem porta padrão)
 *   SCHED-U-02  autorização: ausente, vencida, host diferente, vigente
 *   SCHED-U-03  validação dos campos e cron gerado no servidor
 *   SCHED-U-04  reconciliador idempotente: duas rodadas não duplicam e removem só o que sobrou
 */

import {
  gerarPadraoCron,
  motivoSemAutorizacao,
  normalizarHost,
  validarCampos,
} from "../../src/utils/dast-schedule.util";
import { reconciliarAgendamentosDast, validarPayloadAgendamento } from "../../src/services/queue/workers/dast-schedule.worker";

describe("regras do agendamento", () => {
  it("SCHED-U-01 — host normalizado", () => {
    expect(normalizarHost("https://App.Example.com:443/x")).toBe("app.example.com");
    expect(normalizarHost("http://app.example.com:8080")).toBe("app.example.com:8080");
    expect(normalizarHost("ftp://x")).toBeNull();
    expect(normalizarHost("não é url")).toBeNull();
    expect(normalizarHost(null)).toBeNull();
  });

  it("SCHED-U-02 — autorização", () => {
    const agora = new Date("2026-11-18T12:00:00Z");
    const base = { url: "https://app.example.com", dastAuthorizedAt: new Date("2026-11-01"), dastAuthorizedUntil: new Date("2026-12-01"), dastAuthorizedHost: "app.example.com" };
    expect(motivoSemAutorizacao(base, agora)).toBeNull();
    expect(motivoSemAutorizacao({ ...base, dastAuthorizedAt: null }, agora)).toBe("AUTHORIZATION_MISSING");
    expect(motivoSemAutorizacao({ ...base, dastAuthorizedUntil: new Date("2026-11-18T12:00:00Z") }, agora)).toBe("AUTHORIZATION_EXPIRED");
    expect(motivoSemAutorizacao({ ...base, url: "https://outro.example.com" }, agora)).toBe("HOST_MISMATCH");
    expect(motivoSemAutorizacao({ ...base, url: null }, agora)).toBe("APPLICATION_WITHOUT_URL");
  });

  it("SCHED-U-03 — campos e cron", () => {
    expect(validarCampos({ frequency: "DAILY", hour: 3, minute: 5, dayOfWeek: null, timezone: "America/Sao_Paulo" })).toBeNull();
    expect(validarCampos({ frequency: "HOURLY" as never, hour: 3, minute: 0, timezone: "UTC" })).toBe("INVALID_FREQUENCY");
    expect(validarCampos({ frequency: "DAILY", hour: 3.5, minute: 0, timezone: "UTC" })).toBe("INVALID_HOUR");
    expect(validarCampos({ frequency: "DAILY", hour: 3, minute: 60, timezone: "UTC" })).toBe("INVALID_MINUTE");
    expect(validarCampos({ frequency: "WEEKLY", hour: 3, minute: 0, dayOfWeek: 7, timezone: "UTC" })).toBe("INVALID_DAY_OF_WEEK");
    expect(validarCampos({ frequency: "DAILY", hour: 3, minute: 0, timezone: "Nada/Isso" })).toBe("INVALID_TIMEZONE");
    expect(gerarPadraoCron({ frequency: "DAILY", hour: 3, minute: 5, dayOfWeek: null, timezone: "UTC" })).toBe("5 3 * * *");
    expect(gerarPadraoCron({ frequency: "WEEKLY", hour: 22, minute: 0, dayOfWeek: 1, timezone: "UTC" })).toBe("0 22 * * 1");
    expect(validarPayloadAgendamento({ scheduleId: "s1" })).toEqual({ scheduleId: "s1" });
    expect(() => validarPayloadAgendamento({ scheduleId: 1 })).toThrow(/payload inválido/);
  });

  it("SCHED-U-04 — reconciliador idempotente", async () => {
    // Fila fake que guarda os schedulers por id, como o Redis.
    const schedulers = new Map<string, { pattern: string; tz: string }>([
      ["dast-schedule:velho", { pattern: "0 1 * * *", tz: "UTC" }],
      ["threat-intel-sync", { pattern: "", tz: "" }], // de outro assunto: não pode ser tocado
    ]);
    const fila = {
      getJobSchedulers: jest.fn(async () => [...schedulers.keys()].map((key) => ({ key }))),
      upsertJobScheduler: jest.fn(async (id: string, opts: { pattern: string; tz: string }, _modelo?: unknown) => {
        schedulers.set(id, opts);
        return undefined;
      }),
      removeJobScheduler: jest.fn(async (id: string) => schedulers.delete(id)),
    };
    const desejados = [
      { scheduleId: "a", pattern: "0 3 * * *", timezone: "America/Sao_Paulo" },
      { scheduleId: "b", pattern: "0 22 * * 1", timezone: "UTC" },
    ];

    const r1 = await reconciliarAgendamentosDast(fila as never, desejados);
    const r2 = await reconciliarAgendamentosDast(fila as never, desejados);

    expect(r1).toEqual({ upserts: 2, removidos: 1 });
    expect(r2).toEqual({ upserts: 2, removidos: 0 });
    expect([...schedulers.keys()].sort()).toEqual(["dast-schedule:a", "dast-schedule:b", "threat-intel-sync"]);
    expect(schedulers.get("dast-schedule:a")).toEqual({ pattern: "0 3 * * *", tz: "America/Sao_Paulo" });
    expect(fila.upsertJobScheduler.mock.calls[0]![2]).toMatchObject({ data: { scheduleId: "a" }, opts: { attempts: 1 } });

    await reconciliarAgendamentosDast(fila as never, []);
    expect([...schedulers.keys()]).toEqual(["threat-intel-sync"]);
  });
});
