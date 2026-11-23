/**
 * risco.test.ts — o dado real que vira intensidade da atmosfera.
 *   ARS-01  peso médio por severidade; nada contado → null
 *   ARS-02  Dashboard: mais grave → mais risco; críticos abertos puxam para cima
 *   ARS-03  Remediação: o mesmo quadro acalma conforme anda para "corrigido"
 *   ARS-04  Threat Intel: KEV aberto pesa mesmo com poucas CVEs
 *   ARS-05  store: a página que sai não apaga o risco da que entrou
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { pesoMedio, riscoDaRemediacao, riscoDoDashboard, riscoDoThreatIntel, useAtmosferaStore, usePublicarRisco } from "./risco";

beforeEach(() => useAtmosferaStore.setState({ risco: null, dono: null }));

describe("funções de risco", () => {
  it("ARS-01 — peso médio por severidade", () => {
    expect(pesoMedio({})).toBeNull();
    expect(pesoMedio({ CRITICAL: 1, LOW: 0 })).toBe(1);
    expect(pesoMedio({ CRITICAL: 1, INFO: 1 })).toBe(0.5);
  });

  it("ARS-02 — Dashboard cresce com a gravidade e com os críticos abertos", () => {
    const leve = riscoDoDashboard({ porSeveridade: { LOW: 8, MEDIUM: 2 }, criticosAbertos: 0 })!;
    const grave = riscoDoDashboard({ porSeveridade: { HIGH: 5, CRITICAL: 3, LOW: 2 }, criticosAbertos: 0 })!;
    const comCriticos = riscoDoDashboard({ porSeveridade: { LOW: 8, MEDIUM: 2 }, criticosAbertos: 12 })!;
    expect(grave).toBeGreaterThan(leve);
    expect(comCriticos).toBeGreaterThan(0.8);
    expect(riscoDoDashboard({ porSeveridade: {}, criticosAbertos: 0 })).toBeNull();
    for (const valor of [leve, grave, comCriticos]) expect(valor).toBeLessThanOrEqual(1);
  });

  it("ARS-03 — Remediação acalma conforme o quadro anda", () => {
    const aberto = riscoDaRemediacao([{ severityFinal: "CRITICAL", status: "OPEN" }, { severityFinal: "HIGH", status: "OPEN" }])!;
    const andando = riscoDaRemediacao([{ severityFinal: "CRITICAL", status: "IN_PROGRESS" }, { severityFinal: "HIGH", status: "OPEN" }])!;
    const corrigido = riscoDaRemediacao([{ severityFinal: "CRITICAL", status: "FIXED" }, { severityFinal: "HIGH", status: "FIXED" }])!;
    expect(aberto).toBeGreaterThan(andando);
    expect(andando).toBeGreaterThan(corrigido);
    expect(riscoDaRemediacao([])).toBeNull();
  });

  it("ARS-04 — KEV aberto pesa no Threat Intel", () => {
    const semKev = riscoDoThreatIntel({ abertosPorSeveridade: { LOW: 3 }, kevAbertos: 0 })!;
    const comKev = riscoDoThreatIntel({ abertosPorSeveridade: { LOW: 3 }, kevAbertos: 4 })!;
    expect(comKev).toBeGreaterThan(semKev + 0.5);
  });
});

describe("usePublicarRisco", () => {
  it("ARS-05 — a desmontagem da página anterior não apaga o risco da nova", () => {
    const anterior = renderHook(() => usePublicarRisco(0.2));
    expect(useAtmosferaStore.getState().risco).toBe(0.2);
    // A nova entra enquanto a anterior ainda está na transição de saída.
    renderHook(() => usePublicarRisco(0.9));
    expect(useAtmosferaStore.getState().risco).toBe(0.9);
    act(() => anterior.unmount());
    expect(useAtmosferaStore.getState().risco).toBe(0.9);
  });

  it("ARS-05b — quem publicou limpa ao sair; undefined (carregando) não publica", () => {
    const carregando = renderHook(({ v }: { v: number | undefined }) => usePublicarRisco(v), { initialProps: { v: undefined as number | undefined } });
    expect(useAtmosferaStore.getState().risco).toBeNull();
    carregando.rerender({ v: 0.6 });
    expect(useAtmosferaStore.getState().risco).toBe(0.6);
    act(() => carregando.unmount());
    expect(useAtmosferaStore.getState().risco).toBeNull();
  });
});
