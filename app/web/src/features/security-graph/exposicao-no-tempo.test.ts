/**
 * exposicao-no-tempo.test.ts — a máquina do tempo do Exposure Graph (ADR-061).
 *   EXT-01  status no instante: não existia; nasceu OPEN; último destino até ali
 *   EXT-02  sem trilha vale o status de hoje (limite do AuditLog)
 *   EXT-03  o grafo no instante recalcula contagens, categorias, pior severidade e resolvidas
 *   EXT-04  a linha do tempo conta abertas e críticas por amostra
 */

import { describe, expect, it } from "vitest";
import type { AplicacaoExposta, ExposureGraph, HistoricoDaExposicao, VulnerabilidadeNoHistorico } from "../../types/exposure-graph.types";
import { exposicaoNoInstante, linhaDoTempo, statusNoInstante } from "./exposicao-no-tempo";

const dia = (n: number) => Date.parse(`2026-10-${String(n).padStart(2, "0")}T12:00:00Z`);
const iso = (n: number) => new Date(dia(n)).toISOString();

function vuln(dados: Partial<VulnerabilidadeNoHistorico> & { id: string }): VulnerabilidadeNoHistorico {
  return {
    applicationId: "app-1",
    title: dados.id,
    owaspCategory: "A03",
    severityFinal: "HIGH",
    sourceType: "MANUAL",
    status: "OPEN",
    createdAt: iso(1),
    mudancas: [],
    ...dados,
  };
}

const APP: AplicacaoExposta = {
  id: "app-1",
  name: "Portal",
  url: null,
  environment: "PROD",
  criticality: "HIGH",
  internetFacing: true,
  dataSensitivity: "INTERNAL",
  abertas: { CRITICAL: 9, HIGH: 9, MEDIUM: 9, LOW: 9 },
  abertasPorOrigem: {},
  totalAbertas: 36,
  totalResolvidas: 0,
  piorSeveridade: "CRITICAL",
  categorias: [],
  principais: [],
};
const ATUAL: ExposureGraph = { companyId: "c", geradoEm: iso(30), aplicacoes: [APP] };

describe("statusNoInstante", () => {
  it("EXT-01 — não existia, nasceu OPEN, último destino até o instante", () => {
    const v = vuln({ id: "v", createdAt: iso(5), status: "CLOSED", mudancas: [{ em: iso(8), para: "IN_PROGRESS" }, { em: iso(12), para: "FIXED" }, { em: iso(20), para: "CLOSED" }] });
    expect(statusNoInstante(v, dia(4))).toBeNull();
    expect(statusNoInstante(v, dia(6))).toBe("OPEN");
    expect(statusNoInstante(v, dia(10))).toBe("IN_PROGRESS");
    expect(statusNoInstante(v, dia(15))).toBe("FIXED");
    expect(statusNoInstante(v, dia(25))).toBe("CLOSED");
  });

  it("EXT-02 — sem trilha, vale o status de hoje", () => {
    expect(statusNoInstante(vuln({ id: "v", status: "FIXED" }), dia(3))).toBe("FIXED");
  });
});

describe("exposicaoNoInstante", () => {
  it("EXT-03 — recalcula o grafo no instante", () => {
    const historico: HistoricoDaExposicao = {
      companyId: "c",
      geradoEm: iso(30),
      inicio: iso(1),
      vulnerabilidades: [
        vuln({ id: "sqli", severityFinal: "CRITICAL", createdAt: iso(1), status: "FIXED", mudancas: [{ em: iso(10), para: "FIXED" }] }),
        vuln({ id: "xss", severityFinal: "HIGH", owaspCategory: "A03", createdAt: iso(2) }),
        vuln({ id: "cabecalho", severityFinal: "MEDIUM", owaspCategory: "A05", createdAt: iso(3), sourceType: "DAST_IMPORT" }),
        vuln({ id: "futura", severityFinal: "CRITICAL", createdAt: iso(20) }),
        vuln({ id: "sem-nota", severityFinal: "NONE", createdAt: iso(1) }),
      ],
    };

    const antes = exposicaoNoInstante(ATUAL, historico, new Date(dia(5))).aplicacoes[0];
    expect(antes.abertas).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 0 });
    expect(antes.totalAbertas).toBe(3);
    expect(antes.totalResolvidas).toBe(0);
    expect(antes.piorSeveridade).toBe("CRITICAL");
    expect(antes.categorias.map((c) => `${c.owaspCategory}:${c.abertas}:${c.piorSeveridade}`)).toEqual(["A03:2:CRITICAL", "A05:1:MEDIUM"]);
    expect(antes.abertasPorOrigem).toEqual({ MANUAL: 2, DAST_IMPORT: 1 });
    expect(antes.principais.map((p) => p.id)).toEqual(["sqli", "xss", "cabecalho"]);
    // Contexto da aplicação é o de hoje.
    expect(antes.name).toBe("Portal");

    const depois = exposicaoNoInstante(ATUAL, historico, new Date(dia(12))).aplicacoes[0];
    expect(depois.abertas).toEqual({ CRITICAL: 0, HIGH: 1, MEDIUM: 1, LOW: 0 });
    expect(depois.totalResolvidas).toBe(1);
    expect(depois.piorSeveridade).toBe("HIGH");
  });

  it("EXT-04 — linha do tempo conta abertas e críticas", () => {
    const historico: HistoricoDaExposicao = {
      companyId: "c",
      geradoEm: iso(30),
      inicio: iso(1),
      vulnerabilidades: [
        vuln({ id: "a", severityFinal: "CRITICAL", createdAt: iso(1), status: "FIXED", mudancas: [{ em: iso(10), para: "FIXED" }] }),
        vuln({ id: "b", severityFinal: "LOW", createdAt: iso(5) }),
      ],
    };
    const pontos = linhaDoTempo(historico, dia(2), dia(12), 3); // dias 2, 7, 12
    expect(pontos.map((p) => [p.abertas, p.criticas])).toEqual([[1, 1], [2, 1], [1, 0]]);
  });
});
