/**
 * sla-monitor-queue.test.ts — monitor de SLA na fila, sem Redis (FILA-FUT-02).
 *
 *   SLQ-01  scheduler de id fixo: cron das 08:00 em São Paulo, repetir não duplica, desligado remove
 *   SLQ-02  processor: falha transitória é retentável; erro definitivo não é
 *   SLQ-03  o nome da fila e o payload vazio do job
 */

import { UnrecoverableError } from "bullmq";
import {
  ID_SCHEDULER_SLA_MONITOR,
  OPCOES_JOB_SLA_MONITOR,
  processarJobSlaMonitor,
  reconciliarAgendamentoSlaMonitor,
} from "../../src/services/queue/workers/sla-monitor.worker";
import { QUEUE_NAMES } from "../../src/services/queue/job-queue";

describe("Monitor de SLA na fila", () => {
  it("SLQ-01 — scheduler diário de id fixo, sem duplicar, removido quando desligado", async () => {
    const fila = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined), removeJobScheduler: jest.fn().mockResolvedValue(true) };

    await expect(reconciliarAgendamentoSlaMonitor(fila as never, { habilitado: true })).resolves.toBe("agendado");
    await expect(reconciliarAgendamentoSlaMonitor(fila as never, { habilitado: true })).resolves.toBe("agendado");

    expect(fila.upsertJobScheduler).toHaveBeenCalledTimes(2);
    for (const chamada of fila.upsertJobScheduler.mock.calls) {
      expect(chamada[0]).toBe("sla-monitor-daily");
      expect(chamada[0]).toBe(ID_SCHEDULER_SLA_MONITOR);
      expect(chamada[1]).toEqual({ pattern: "0 8 * * *", tz: "America/Sao_Paulo" });
      expect(chamada[2]).toMatchObject({
        name: "monitor",
        data: {},
        opts: { attempts: 3, backoff: { type: "exponential", delay: 60_000 }, removeOnFail: { count: 50 } },
      });
    }
    expect(OPCOES_JOB_SLA_MONITOR).toMatchObject({ attempts: 3, removeOnFail: { count: 50 } });

    fila.upsertJobScheduler.mockClear();
    await expect(reconciliarAgendamentoSlaMonitor(fila as never, { habilitado: false })).resolves.toBe("removido");
    expect(fila.removeJobScheduler).toHaveBeenCalledWith("sla-monitor-daily");
    expect(fila.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it("SLQ-02 — falha transitória é retentável; erro definitivo vira UnrecoverableError", async () => {
    const resumo = { candidatas: 2, individuais: 6, resumos: 0 };
    await expect(processarJobSlaMonitor({ executar: jest.fn().mockResolvedValue(resumo) })).resolves.toEqual(resumo);

    const transitoria = Object.assign(new Error("Can't reach database server"), { code: "P1001" });
    await expect(processarJobSlaMonitor({ executar: jest.fn().mockRejectedValue(transitoria) })).rejects.toBe(transitoria);

    const definitiva = await processarJobSlaMonitor({ executar: jest.fn().mockRejectedValue(new TypeError("bug")) }).catch((e) => e);
    expect(definitiva).toBeInstanceOf(UnrecoverableError);
    expect(definitiva.message).toBe("bug");
  });

  it("SLQ-03 — fila própria e payload vazio", () => {
    expect(QUEUE_NAMES.slaMonitor).toBe("sla-monitor");
    expect(Object.values(QUEUE_NAMES)).toContain("sla-monitor");
  });
});
