/**
 * job-queue.test.ts — motor da fila (ADR-056, Fase 2).
 *
 *   QUEUE-01  QUEUE_DRIVER: vazio/memory/bullmq aceitos; outro valor é erro
 *   QUEUE-02  factory: padrão memory, singleton
 *   QUEUE-03  factory: bullmq sem REDIS_URL falha alto
 *   QUEUE-04  worker só existe com bullmq
 *   QUEUE-05  Redis inalcançável: verificarConexao rejeita com a causa, não pendura
 *   QUEUE-06  WORKER_IN_PROCESS: só "false" tira o worker da API
 */

import { parseQueueDriver } from "../../src/services/queue/job-queue";
import { MemoryJobQueue } from "../../src/services/queue/memory-job-queue";
import { BullmqJobQueue, conexaoProdutor, conexaoWorker } from "../../src/services/queue/bullmq-job-queue";
import { iniciarWorkers } from "../../src/worker";

const ENV_ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

/** A factory é singleton: cada teste precisa de um módulo novo. */
function factoryNova(): typeof import("../../src/factories/job-queue.factory") {
  let mod!: typeof import("../../src/factories/job-queue.factory");
  jest.isolateModules(() => {
    mod = require("../../src/factories/job-queue.factory");
  });
  return mod;
}

describe("QUEUE_DRIVER", () => {
  it("QUEUE-01 — aceita vazio/memory/bullmq e recusa o resto", () => {
    expect(parseQueueDriver(undefined)).toBe("memory");
    expect(parseQueueDriver("")).toBe("memory");
    expect(parseQueueDriver(" Memory ")).toBe("memory");
    expect(parseQueueDriver("BULLMQ")).toBe("bullmq");
    expect(() => parseQueueDriver("rabbitmq")).toThrow(/QUEUE_DRIVER inválido/);
  });
});

describe("makeJobQueue", () => {
  it("QUEUE-02 — sem QUEUE_DRIVER usa memory e devolve sempre a mesma instância", () => {
    delete process.env.QUEUE_DRIVER;
    const { makeJobQueue } = factoryNova();
    const fila = makeJobQueue();
    // isolateModules carrega outra cópia da classe: compara pelo nome, não por instanceof.
    expect(fila.constructor.name).toBe("MemoryJobQueue");
    expect(fila.driver).toBe("memory");
    expect(makeJobQueue()).toBe(fila);
  });

  it("QUEUE-03 — bullmq sem REDIS_URL é erro de configuração", () => {
    process.env.QUEUE_DRIVER = "bullmq";
    delete process.env.REDIS_URL;
    const { makeJobQueue } = factoryNova();
    expect(() => makeJobQueue()).toThrow(/REDIS_URL/);
  });

  it("QUEUE-06 — só WORKER_IN_PROCESS=false tira o worker da API", () => {
    const { workerNoProcessoDaApi } = factoryNova();
    delete process.env.WORKER_IN_PROCESS;
    expect(workerNoProcessoDaApi()).toBe(true);
    process.env.WORKER_IN_PROCESS = "true";
    expect(workerNoProcessoDaApi()).toBe(true);
    process.env.WORKER_IN_PROCESS = "FALSE";
    expect(workerNoProcessoDaApi()).toBe(false);
  });
});

describe("worker", () => {
  it("QUEUE-04 — iniciarWorkers recusa o motor memory", async () => {
    await expect(iniciarWorkers(new MemoryJobQueue())).rejects.toThrow(/QUEUE_DRIVER=bullmq/);
  });
});

describe("BullmqJobQueue", () => {
  it("conexões: produtor falha rápido, worker espera o Redis voltar", () => {
    expect(conexaoProdutor("redis://:x@redis:6379")).toMatchObject({ url: "redis://:x@redis:6379", maxRetriesPerRequest: 3 });
    expect(conexaoWorker("redis://:x@redis:6379")).toMatchObject({ maxRetriesPerRequest: null });
  });

  it("QUEUE-05 — Redis inalcançável: verificarConexao rejeita em vez de pendurar", async () => {
    // Porta 1 no loopback: nada escuta ali, a conexão é recusada.
    const fila = new BullmqJobQueue("redis://:senha@127.0.0.1:1");
    try {
      const erro = await fila.verificarConexao().then(
        () => null,
        (e: Error) => e,
      );
      expect(erro).toBeInstanceOf(Error);
      // A causa tem de ser a conexão (recusada ou sem resposta) — não um pacote
      // ausente: foi assim que a falta do ioredis passou despercebida na Fase 2.
      expect(erro!.message).not.toMatch(/ioredis/i);
      expect(erro!.message).toMatch(/ECONNREFUSED|não respondeu|connect/i);
    } finally {
      await fila.close();
    }
    expect(() => fila.fila("dast-scan")).toThrow("JOB_QUEUE_CLOSED");
  }, 15_000);
});
