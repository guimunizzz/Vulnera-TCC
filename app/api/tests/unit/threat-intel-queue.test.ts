/**
 * threat-intel-queue.test.ts — Threat Intel na fila (ADR-056, Fase 3), sem Redis.
 *
 *   TIQ-01  falha transitória × definitiva
 *   TIQ-02  payload do Redis é validado (só gatilho conhecido e ids em texto)
 *   TIQ-03  processor: OK devolve o resumo; null vira "pulada"
 *   TIQ-04  processor: todas as fontes fora (FAILED) → erro comum (há retry)
 *   TIQ-05  processor: erro definitivo → UnrecoverableError (sem retry)
 *   TIQ-06  scheduler de id fixo: piso de 15 min, upsert repetido, removido quando desligado
 *   TIQ-07  motor memory dispara no próprio processo, com o gatilho e os ids
 *   TIQ-08  exceção no meio da execução fecha o ThreatSyncRun como FAILED e relança
 */

import { UnrecoverableError } from "bullmq";
import {
  ID_SCHEDULER_THREAT_INTEL,
  ehFalhaTransitoria,
  processarJobThreatIntel,
  reconciliarAgendamentoThreatIntel,
  validarPayload,
} from "../../src/services/queue/workers/threat-intel.worker";
import { MemoryJobQueue } from "../../src/services/queue/memory-job-queue";
import { FonteIndisponivel } from "../../src/services/threat-intel/fontes";
import { ThreatIntelSyncService, type ResumoExecucao } from "../../src/services/threat-intel/threat-intel-sync.service";

const resumo = (status: string): ResumoExecucao => ({ id: "run-1", status, newAdvisories: 0, newMatches: 0, notifications: 0, sources: {} });

describe("Threat Intel na fila", () => {
  it("TIQ-01 — classifica a falha", () => {
    expect(ehFalhaTransitoria(new FonteIndisponivel("NVD", "503"))).toBe(true);
    expect(ehFalhaTransitoria(Object.assign(new Error("db"), { code: "P1001" }))).toBe(true);
    expect(ehFalhaTransitoria(Object.assign(new Error("rede"), { code: "ECONNRESET" }))).toBe(true);
    expect(ehFalhaTransitoria(new TypeError("x is undefined"))).toBe(false);
    expect(ehFalhaTransitoria(Object.assign(new Error("unique"), { code: "P2002" }))).toBe(false);
    expect(ehFalhaTransitoria(null)).toBe(false);
  });

  it("TIQ-02 — payload inválido não chega ao sync", () => {
    expect(validarPayload({ trigger: "MANUAL" })).toEqual({ trigger: "MANUAL" });
    expect(validarPayload({ trigger: "ASSET", assetIds: ["a", "b"] })).toEqual({ trigger: "ASSET", assetIds: ["a", "b"] });
    expect(() => validarPayload({ trigger: "DROP" })).toThrow(UnrecoverableError);
    expect(() => validarPayload(null)).toThrow(UnrecoverableError);
    expect(() => validarPayload({ trigger: "ASSET", assetIds: [1] })).toThrow(UnrecoverableError);
    expect(() => validarPayload({ trigger: "ASSET", assetIds: Array(501).fill("a") })).toThrow(UnrecoverableError);
  });

  it("TIQ-03 — OK devolve o resumo com o gatilho repassado; null vira pulada", async () => {
    const executar = jest.fn().mockResolvedValueOnce(resumo("OK")).mockResolvedValueOnce(null);
    await expect(processarJobThreatIntel({ executar }, { trigger: "ASSET", assetIds: ["t1"] })).resolves.toMatchObject({ status: "OK" });
    expect(executar).toHaveBeenCalledWith("ASSET", ["t1"]);
    await expect(processarJobThreatIntel({ executar }, { trigger: "SCHEDULED" })).resolves.toEqual({ pulada: true });
    // PARTIAL não é falha do job: a próxima janela cobre a fonte que caiu.
    await expect(processarJobThreatIntel({ executar: jest.fn().mockResolvedValue(resumo("PARTIAL")) }, { trigger: "MANUAL" })).resolves.toMatchObject({ status: "PARTIAL" });
  });

  it("TIQ-04 — todas as fontes fora vira erro retentável (não Unrecoverable)", async () => {
    const err = await processarJobThreatIntel({ executar: jest.fn().mockResolvedValue(resumo("FAILED")) }, { trigger: "SCHEDULED" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(UnrecoverableError);
    expect(err.message).toMatch(/todas as fontes falharam/);

    const transitoria = Object.assign(new Error("db fora"), { code: "P1001" });
    await expect(processarJobThreatIntel({ executar: jest.fn().mockRejectedValue(transitoria) }, { trigger: "MANUAL" })).rejects.toBe(transitoria);
  });

  it("TIQ-05 — erro definitivo não é retentado", async () => {
    const err = await processarJobThreatIntel({ executar: jest.fn().mockRejectedValue(new TypeError("bug")) }, { trigger: "MANUAL" }).catch((e) => e);
    expect(err).toBeInstanceOf(UnrecoverableError);
    expect(err.message).toBe("bug");
  });

  it("TIQ-06 — scheduler de id fixo, com piso de 15 min, e removido quando desligado", async () => {
    const fila = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined), removeJobScheduler: jest.fn().mockResolvedValue(true) };
    await reconciliarAgendamentoThreatIntel(fila as never, { habilitado: true, intervaloMin: 5 });
    await reconciliarAgendamentoThreatIntel(fila as never, { habilitado: true, intervaloMin: 5 });
    expect(fila.upsertJobScheduler).toHaveBeenCalledTimes(2);
    for (const chamada of fila.upsertJobScheduler.mock.calls) {
      expect(chamada[0]).toBe(ID_SCHEDULER_THREAT_INTEL);
      expect(chamada[1]).toEqual({ every: 15 * 60_000 });
      expect(chamada[2]).toMatchObject({ data: { trigger: "SCHEDULED" }, opts: { attempts: 3, removeOnFail: { count: 50 } } });
    }
    await reconciliarAgendamentoThreatIntel(fila as never, { habilitado: true, intervaloMin: 360 });
    expect(fila.upsertJobScheduler.mock.calls[2]![1]).toEqual({ every: 360 * 60_000 });

    await expect(reconciliarAgendamentoThreatIntel(fila as never, { habilitado: false, intervaloMin: 360 })).resolves.toBe("removido");
    expect(fila.removeJobScheduler).toHaveBeenCalledWith(ID_SCHEDULER_THREAT_INTEL);
  });

  it("TIQ-07 — motor memory dispara o sync no próprio processo", async () => {
    const sync = { executar: jest.fn().mockResolvedValue(resumo("OK")), emAndamento: jest.fn().mockReturnValue(true) };
    const fila = new MemoryJobQueue({ threatIntel: () => sync, watchdogDast: () => ({}) as never });
    await fila.enfileirarThreatIntel({ trigger: "ASSET", assetIds: ["t1"] });
    await fila.enfileirarThreatIntel({ trigger: "MANUAL" });
    expect(sync.executar).toHaveBeenNthCalledWith(1, "ASSET", ["t1"]);
    expect(sync.executar).toHaveBeenNthCalledWith(2, "MANUAL", undefined);
    await expect(fila.threatIntelEmAndamento()).resolves.toBe(true);
  });

  it("TIQ-08 — exceção no meio da execução fecha a linha RUNNING como FAILED", async () => {
    const concluir = jest.fn().mockResolvedValue({});
    const repository = {
      encerrarOrfas: jest.fn().mockResolvedValue(0),
      execucaoEmAndamento: jest.fn().mockResolvedValue(null),
      ultimaExecucaoComFeedNvd: jest.fn().mockResolvedValue(null),
      iniciarExecucao: jest.fn().mockResolvedValue({ id: "run-9" }),
      concluirExecucao: concluir,
    };
    const falhaDoBanco = Object.assign(new Error("Can't reach database server"), { code: "P1001" });
    const assets = { confirmados: jest.fn().mockRejectedValue(falhaDoBanco) };
    const sync = new ThreatIntelSyncService({} as never, repository as never, assets as never, {} as never);

    await expect(sync.executar("ASSET", ["t1"])).rejects.toBe(falhaDoBanco);
    expect(concluir).toHaveBeenCalledWith("run-9", expect.objectContaining({ status: "FAILED", errorMessage: expect.stringContaining("Can't reach database server") }));
    expect(sync.emAndamento()).toBe(false);
  });
});
