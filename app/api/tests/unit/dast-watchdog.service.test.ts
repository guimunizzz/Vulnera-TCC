/**
 * dast-watchdog.service.test.ts
 *
 * Testes de unidade do guarda-corpo de execução do DAST — sem Docker, sem
 * banco, sem HTTP. Cada caso constrói uma instância PRÓPRIA do watchdog (com
 * `autoStartMonitor: false`) em vez de usar o singleton: o singleton carrega o
 * limite do ambiente e mantém um interval vivo, o que faria um teste vazar
 * estado no outro.
 *
 *   DAST-WD-01  no máximo N scans em execução; o excedente espera na fila
 *   DAST-WD-02  vaga liberada puxa o próximo da fila, em ordem FIFO
 *   DAST-WD-03  cancelar um scan da FILA tira ele sem nunca executar
 *   DAST-WD-04  cancelar um scan em EXECUÇÃO dispara o AbortSignal do job
 *   DAST-WD-05  scan sem pulso é abortado e vira alerta de erro
 *   DAST-WD-06  pulso recente NÃO é abortado
 *   DAST-WD-07  submeter o mesmo scanId duas vezes não duplica
 */

import { DastWatchdog } from "../../src/services/dast-watchdog.service";

/** Job controlável: expõe uma função pra "terminar" quando o teste quiser. */
function jobControlavel(scanId: string) {
  let resolver: () => void = () => undefined;
  const iniciou = { valor: false };
  const sinais: AbortSignal[] = [];

  const job = {
    scanId,
    targetUrl: `https://${scanId}.example.com`,
    requestedById: "user-1",
    run: (ctx: { signal: AbortSignal; heartbeat: (fase: string, pct: number) => void }) => {
      iniciou.valor = true;
      sinais.push(ctx.signal);
      return new Promise<void>((resolve) => {
        resolver = resolve;
      });
    },
  };

  return { job, iniciou, sinais, terminar: () => resolver() };
}

/** O `.finally` que devolve a vaga é assíncrono — deixa a microtask rodar. */
const cederAoLoop = () => new Promise((resolve) => setImmediate(resolve));

describe("DastWatchdog — limite de concorrência", () => {
  it("DAST-WD-01 — com limite 2, o terceiro scan fica na fila em vez de executar", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, autoStartMonitor: false });
    const a = jobControlavel("scan-a");
    const b = jobControlavel("scan-b");
    const c = jobControlavel("scan-c");

    watchdog.submit(a.job);
    watchdog.submit(b.job);
    const posicaoC = watchdog.submit(c.job);

    expect(a.iniciou.valor).toBe(true);
    expect(b.iniciou.valor).toBe(true);
    expect(c.iniciou.valor).toBe(false);
    expect(posicaoC).toBe(1); // primeiro da fila

    const snapshot = watchdog.snapshot();
    expect(snapshot.runningCount).toBe(2);
    expect(snapshot.queuedCount).toBe(1);
    expect(snapshot.maxConcurrent).toBe(2);
    // Ter batido o teto é informação de produto, não só de log.
    expect(snapshot.queued[0].scanId).toBe("scan-c");

    a.terminar();
    b.terminar();
    c.terminar();
    await cederAoLoop();
  });

  it("DAST-WD-02 — vaga liberada puxa o próximo da fila (FIFO)", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 1, autoStartMonitor: false });
    const a = jobControlavel("scan-a");
    const b = jobControlavel("scan-b");
    const c = jobControlavel("scan-c");

    watchdog.submit(a.job);
    watchdog.submit(b.job);
    watchdog.submit(c.job);
    expect(watchdog.queuePositionOf("scan-b")).toBe(1);
    expect(watchdog.queuePositionOf("scan-c")).toBe(2);

    a.terminar();
    await cederAoLoop();

    expect(b.iniciou.valor).toBe(true);
    expect(c.iniciou.valor).toBe(false);
    expect(watchdog.queuePositionOf("scan-b")).toBe(0); // 0 = rodando
    expect(watchdog.queuePositionOf("scan-c")).toBe(1);

    b.terminar();
    await cederAoLoop();
    expect(c.iniciou.valor).toBe(true);

    c.terminar();
    await cederAoLoop();
  });

  it("DAST-WD-07 — submeter o mesmo scanId duas vezes não ocupa duas vagas", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, autoStartMonitor: false });
    const a = jobControlavel("scan-a");

    watchdog.submit(a.job);
    watchdog.submit(a.job);

    expect(watchdog.snapshot().runningCount).toBe(1);
    expect(watchdog.snapshot().queuedCount).toBe(0);

    a.terminar();
    await cederAoLoop();
  });
});

describe("DastWatchdog — cancelamento", () => {
  it("DAST-WD-03 — cancelar um scan da fila tira ele sem nunca executar", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 1, autoStartMonitor: false });
    const a = jobControlavel("scan-a");
    const b = jobControlavel("scan-b");

    watchdog.submit(a.job);
    watchdog.submit(b.job);

    expect(watchdog.abort("scan-b", "cancelado")).toBe("queued");
    expect(watchdog.snapshot().queuedCount).toBe(0);

    a.terminar();
    await cederAoLoop();
    expect(b.iniciou.valor).toBe(false); // a vaga abriu, mas ele já tinha saído
  });

  it("DAST-WD-04 — cancelar um scan em execução dispara o AbortSignal com o motivo", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, autoStartMonitor: false });
    const a = jobControlavel("scan-a");
    watchdog.submit(a.job);

    expect(watchdog.abort("scan-a", "Scan cancelado pelo usuário.")).toBe("running");
    expect(a.sinais[0].aborted).toBe(true);
    expect(a.sinais[0].reason).toBe("Scan cancelado pelo usuário.");

    a.terminar();
    await cederAoLoop();
  });

  it("abortar um scan desconhecido devolve null (não explode)", () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, autoStartMonitor: false });
    expect(watchdog.abort("scan-que-nao-existe", "seja o que for")).toBeNull();
  });
});

describe("DastWatchdog — detecção de travamento", () => {
  it("DAST-WD-05 — scan sem pulso é abortado e registra alerta de erro", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, heartbeatTimeoutMs: 5000, autoStartMonitor: false });
    const a = jobControlavel("scan-travado");
    watchdog.submit(a.job);

    // Volta o relógio do último pulso pra além do limite tolerado, em vez de
    // esperar de verdade — o teste não pode levar 5s pra provar isso.
    const slot = watchdog.snapshot().running[0];
    expect(slot.scanId).toBe("scan-travado");
    jest.spyOn(Date, "now").mockReturnValue(new Date(slot.lastHeartbeatAt).getTime() + 6000);

    watchdog.tick();

    expect(a.sinais[0].aborted).toBe(true);
    const alertas = watchdog.snapshot().alerts;
    expect(alertas[0].level).toBe("error");
    expect(alertas[0].scanId).toBe("scan-travado");
    expect(alertas[0].message).toContain("sem sinal de vida");

    jest.restoreAllMocks();
    a.terminar();
    await cederAoLoop();
  });

  it("DAST-WD-06 — scan que continua pulsando NÃO é abortado", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, heartbeatTimeoutMs: 5000, autoStartMonitor: false });
    const a = jobControlavel("scan-vivo");
    watchdog.submit(a.job);

    watchdog.tick();

    expect(a.sinais[0].aborted).toBe(false);
    expect(watchdog.snapshot().alerts).toHaveLength(0);

    a.terminar();
    await cederAoLoop();
  });
});

describe("DastWatchdog — alertas", () => {
  it("guarda os avisos mais recentes primeiro, com nível e scanId", () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 2, autoStartMonitor: false });
    watchdog.raise("warn", "scan-1", "primeiro");
    watchdog.raise("error", null, "segundo");

    const alertas = watchdog.snapshot().alerts;
    expect(alertas[0].message).toBe("segundo");
    expect(alertas[0].level).toBe("error");
    expect(alertas[0].scanId).toBeNull();
    expect(alertas[1].message).toBe("primeiro");
    expect(alertas[1].scanId).toBe("scan-1");
  });

  it("exceção não tratada dentro do job vira alerta e devolve a vaga", async () => {
    const watchdog = new DastWatchdog({ maxConcurrent: 1, autoStartMonitor: false });
    watchdog.submit({
      scanId: "scan-explode",
      targetUrl: "https://example.com",
      requestedById: "user-1",
      run: () => Promise.reject(new Error("boom")),
    });

    await cederAoLoop();

    expect(watchdog.snapshot().runningCount).toBe(0); // vaga devolvida
    expect(watchdog.snapshot().alerts[0].message).toContain("boom");
  });
});
