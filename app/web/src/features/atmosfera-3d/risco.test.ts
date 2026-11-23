/**
 * risco.test.ts — o dado real que vira intensidade da atmosfera.
 *   ARS-01  peso médio por severidade; nada contado (ou resposta incompleta) → null
 *   ARS-02  Dashboard: mais grave → mais risco; críticos abertos puxam para cima
 *   ARS-03  Remediação: o mesmo quadro acalma conforme anda para "corrigido"
 *   ARS-04  Threat Intel: KEV aberto pesa mesmo com poucas CVEs
 *   ARS-05  Exposure Graph: soma as abertas de todas as aplicações
 *   ARS-06  Aplicações: crítica, exposta, dado restrito e produção pesam mais que o contrário
 */

import { describe, expect, it } from "vitest";
import {
  pesoMedio,
  riscoDasAplicacoes,
  riscoDaRemediacao,
  riscoDoDashboard,
  riscoDoExposureGraph,
  riscoDoThreatIntel,
} from "./risco";

describe("funções de risco", () => {
  it("ARS-01 — peso médio por severidade", () => {
    expect(pesoMedio({})).toBeNull();
    expect(pesoMedio(undefined)).toBeNull();
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
    // Mock parcial (como nos testes do Dashboard) não pode derrubar a tela.
    expect(riscoDoDashboard({})).toBeNull();
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

  it("ARS-05 — Exposure Graph soma as abertas das aplicações", () => {
    const leve = riscoDoExposureGraph([{ abertas: { CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 6 } }])!;
    const grave = riscoDoExposureGraph([
      { abertas: { CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 6 } },
      { abertas: { CRITICAL: 4, HIGH: 3, MEDIUM: 0, LOW: 0 } },
    ])!;
    expect(grave).toBeGreaterThan(leve);
    expect(riscoDoExposureGraph([{ abertas: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } }])).toBeNull();
  });

  it("ARS-06 — superfície de exposição das aplicações", () => {
    const exposta = riscoDasAplicacoes([{ criticality: "CRITICAL", internetFacing: true, dataSensitivity: "RESTRICTED", environment: "PROD" }])!;
    const recolhida = riscoDasAplicacoes([{ criticality: "LOW", internetFacing: false, dataSensitivity: "PUBLIC", environment: "DEV" }])!;
    expect(exposta).toBe(1);
    expect(recolhida).toBeLessThan(0.1);
    expect(riscoDasAplicacoes([])).toBeNull();
  });
});
