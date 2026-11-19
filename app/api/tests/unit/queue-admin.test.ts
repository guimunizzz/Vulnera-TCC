/**
 * queue-admin.test.ts — painel de filas e reprocessamento do ADMIN (ADR-056).
 * Sem Redis: o motor bullmq recebe uma Queue fake (getJobCounts, getFailed,
 * getJob) pelo método público `fila`.
 *
 *   QADM-U01  motor bullmq: contagens por fila e as falhas viram o painel
 *   QADM-U02  data do job: serializado e cortado em 500 caracteres
 *   QADM-U03  reprocessar: JOB_NOT_FOUND, JOB_NOT_FAILED (sem retry) e retry("failed")
 *   QADM-U04  motor memory: painel vazio e reprocessar recusado com QUEUE_DRIVER_MEMORY
 *   QADM-U05  service: rótulos, INVALID_QUEUE e AuditLog só depois do sucesso
 */

import { BullmqJobQueue, LIMITE_DADOS_NO_PAINEL, resumirDadosDoJob } from "../../src/services/queue/bullmq-job-queue";
import { MemoryJobQueue } from "../../src/services/queue/memory-job-queue";
import { QUEUE_NAMES, type QueueName } from "../../src/services/queue/job-queue";
import { QueueAdminService, ROTULOS_DAS_FILAS } from "../../src/services/queue-admin.service";

interface JobFake {
  id: string;
  name: string;
  failedReason?: string;
  attemptsMade: number;
  finishedOn?: number;
  data: unknown;
  getState: jest.Mock;
  retry: jest.Mock;
}

function jobFake(over: Partial<JobFake> = {}): JobFake {
  return {
    id: "1",
    name: "scan",
    failedReason: "boom",
    attemptsMade: 1,
    finishedOn: Date.UTC(2026, 10, 18, 12),
    data: { scanId: "s1" },
    getState: jest.fn().mockResolvedValue("failed"),
    retry: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function filaFake(over: { counts?: Record<string, number>; failed?: JobFake[]; job?: JobFake | null } = {}) {
  return {
    getJobCounts: jest.fn().mockResolvedValue(over.counts ?? {}),
    getFailed: jest.fn().mockResolvedValue(over.failed ?? []),
    getJob: jest.fn().mockResolvedValue(over.job ?? null),
  };
}

/** Motor bullmq cujo `fila(nome)` devolve as filas fake; o construtor não abre conexão. */
function motorComFilas(filas: Record<string, ReturnType<typeof filaFake>>): BullmqJobQueue {
  const motor = new BullmqJobQueue("redis://:senha@127.0.0.1:1");
  jest.spyOn(motor, "fila").mockImplementation((nome: QueueName) => filas[nome] as never);
  return motor;
}

function filasVazias(): Record<string, ReturnType<typeof filaFake>> {
  const filas: Record<string, ReturnType<typeof filaFake>> = {};
  for (const nome of Object.values(QUEUE_NAMES)) filas[nome] = filaFake();
  return filas;
}

describe("BullmqJobQueue.painelDeFilas", () => {
  it("QADM-U01 — contagens de cada fila e as falhas (até 10) viram o painel", async () => {
    const filas = filasVazias();
    filas["dast-scan"] = filaFake({
      counts: { waiting: 2, active: 1, delayed: 0, completed: 5, failed: 3 },
      failed: [jobFake({ id: "a" }), jobFake({ id: "b", finishedOn: undefined, failedReason: undefined })],
    });
    const motor = motorComFilas(filas);

    const painel = await motor.painelDeFilas();

    expect(painel.driver).toBe("bullmq");
    expect(painel.queues.map((q) => q.name)).toEqual(Object.values(QUEUE_NAMES));
    const dast = painel.queues.find((q) => q.name === "dast-scan")!;
    expect(dast.counts).toEqual({ waiting: 2, active: 1, delayed: 0, completed: 5, failed: 3 });
    expect(dast.failed).toEqual([
      { id: "a", name: "scan", failedReason: "boom", attemptsMade: 1, finishedOn: "2026-11-18T12:00:00.000Z", data: '{"scanId":"s1"}' },
      { id: "b", name: "scan", failedReason: "", attemptsMade: 1, finishedOn: null, data: '{"scanId":"s1"}' },
    ]);
    expect(filas["dast-scan"].getFailed).toHaveBeenCalledWith(0, 9);
  });

  it("QADM-U01b — contagem que o Redis não devolve vira zero (fila vazia não quebra o painel)", async () => {
    const motor = motorComFilas(filasVazias());
    const painel = await motor.painelDeFilas();
    const threat = painel.queues.find((q) => q.name === "threat-intel")!;
    expect(threat.counts).toEqual({ waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 });
    expect(threat.failed).toEqual([]);
  });
});

describe("resumirDadosDoJob", () => {
  it("QADM-U02 — serializa o payload e corta em 500 caracteres", () => {
    expect(resumirDadosDoJob({ scanId: "s1" })).toBe('{"scanId":"s1"}');
    expect(resumirDadosDoJob(undefined)).toBe("null");

    // Exatamente no limite: intacto, sem reticências.
    const noLimite = resumirDadosDoJob({ s: "a".repeat(LIMITE_DADOS_NO_PAINEL - 8) });
    expect(noLimite).toHaveLength(LIMITE_DADOS_NO_PAINEL);
    expect(noLimite.endsWith("…")).toBe(false);

    // Um caractere acima: corta e marca com reticências, total de 500.
    const acima = resumirDadosDoJob({ s: "a".repeat(LIMITE_DADOS_NO_PAINEL) });
    expect(acima).toHaveLength(LIMITE_DADOS_NO_PAINEL);
    expect(acima.endsWith("…")).toBe(true);
  });

  it("QADM-U02b — payload que não serializa vira marcador, não erro", () => {
    const ciclo: Record<string, unknown> = {};
    ciclo.self = ciclo;
    expect(resumirDadosDoJob(ciclo)).toBe("[não serializável]");
  });

  it("QADM-U02c — o painel aplica o corte a cada job com falha", async () => {
    const filas = filasVazias();
    filas["dast-scan"] = filaFake({ failed: [jobFake({ data: { s: "x".repeat(2000) } })] });
    const painel = await motorComFilas(filas).painelDeFilas();
    const falha = painel.queues.find((q) => q.name === "dast-scan")!.failed[0];
    expect(falha.data).toHaveLength(LIMITE_DADOS_NO_PAINEL);
  });
});

describe("BullmqJobQueue.reprocessarJob", () => {
  it("QADM-U03 — job inexistente: JOB_NOT_FOUND", async () => {
    const filas = filasVazias();
    filas["dast-scan"] = filaFake({ job: null });
    await expect(motorComFilas(filas).reprocessarJob("dast-scan", "9")).rejects.toThrow("JOB_NOT_FOUND");
  });

  it("QADM-U03b — job que não está em failed: JOB_NOT_FAILED e nenhum retry", async () => {
    const concluido = jobFake({ getState: jest.fn().mockResolvedValue("completed") });
    const filas = filasVazias();
    filas["dast-scan"] = filaFake({ job: concluido });
    await expect(motorComFilas(filas).reprocessarJob("dast-scan", "1")).rejects.toThrow("JOB_NOT_FAILED");
    expect(concluido.retry).not.toHaveBeenCalled();
  });

  it("QADM-U03c — job com falha: reprocessa em failed", async () => {
    const falho = jobFake();
    const filas = filasVazias();
    filas["threat-intel"] = filaFake({ job: falho });
    await expect(motorComFilas(filas).reprocessarJob("threat-intel", "1")).resolves.toBeUndefined();
    expect(falho.retry).toHaveBeenCalledWith("failed");
  });
});

describe("MemoryJobQueue (painel e reprocessamento)", () => {
  it("QADM-U04 — painel vazio e reprocessar recusado com QUEUE_DRIVER_MEMORY", async () => {
    const memoria = new MemoryJobQueue({
      threatIntel: () => ({ executar: async () => null, emAndamento: () => false }),
      watchdogDast: () => ({}) as never,
    });
    await expect(memoria.painelDeFilas()).resolves.toEqual({ driver: "memory", queues: [] });
    await expect(memoria.reprocessarJob("dast-scan", "1")).rejects.toThrow("QUEUE_DRIVER_MEMORY");
  });
});

describe("QueueAdminService", () => {
  function servico() {
    const fila = {
      painelDeFilas: jest.fn().mockResolvedValue({
        driver: "bullmq",
        queues: [{ name: "threat-intel", counts: { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 }, failed: [] }],
      }),
      reprocessarJob: jest.fn().mockResolvedValue(undefined),
    };
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    return { fila, auditLog, service: new QueueAdminService(fila as never, auditLog as never) };
  }

  it("QADM-U05 — o painel traz o rótulo em português de cada fila", async () => {
    const { service } = servico();
    const painel = await service.painel();
    expect(painel.queues[0].label).toBe("Threat Intel");
    expect(ROTULOS_DAS_FILAS).toEqual({ "dast-scan": "Scans DAST", "threat-intel": "Threat Intel", "dast-schedule": "Agendamentos DAST" });
  });

  it("QADM-U05b — fila fora de QUEUE_NAMES: INVALID_QUEUE, sem tocar o motor", async () => {
    const { service, fila, auditLog } = servico();
    await expect(service.reprocessar("u1", "nao-existe", "1")).rejects.toThrow("INVALID_QUEUE");
    expect(fila.reprocessarJob).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it("QADM-U05c — AuditLog RETRY só depois do sucesso; falha do motor não grava nada", async () => {
    const { service, fila, auditLog } = servico();

    await service.reprocessar("u1", "dast-scan", "job-7");
    expect(fila.reprocessarJob).toHaveBeenCalledWith("dast-scan", "job-7");
    expect(auditLog.create).toHaveBeenCalledWith({
      actorId: "u1",
      companyId: null,
      entityType: "QueueJob",
      entityId: "job-7",
      action: "RETRY",
      diffJson: '{"fila":"dast-scan"}',
    });

    fila.reprocessarJob.mockRejectedValueOnce(new Error("JOB_NOT_FAILED"));
    await expect(service.reprocessar("u1", "dast-scan", "job-8")).rejects.toThrow("JOB_NOT_FAILED");
    expect(auditLog.create).toHaveBeenCalledTimes(1);
  });
});
