import { describe, expect, it } from "vitest";
import { buscarTodosFindings } from "./remediation-board";
import type { FindingSearchResponse } from "../types/vulnerability.types";

function resposta(page: number, total: number, quantidade: number): FindingSearchResponse {
  return {
    data: Array.from({ length: quantidade }, (_, i) => ({
      id: `v-${(page - 1) * 100 + i}`,
      title: `Finding ${(page - 1) * 100 + i}`,
      severityFinal: "HIGH",
      severityCalculated: "HIGH",
      cvssScore: 8,
      status: "OPEN",
      owaspCategory: "A01",
      createdAt: "2026-01-01T00:00:00.000Z",
      projectId: "p",
      projectName: "Projeto",
      applicationId: "a",
      applicationName: "Aplicação",
      companyId: "c",
      companyName: "Empresa",
      slaState: "ON_TRACK",
      slaDueAt: null,
      slaRemainingMs: null,
      vrsScore: null,
      vrsBand: null,
      hasActiveRiskAcceptance: false,
      assignedTo: null,
      assigneeName: null,
    })),
    pagination: { page, pageSize: 100, total, totalPages: Math.ceil(total / 100) },
    facets: { severity: {}, status: {}, owasp: {}, company: {} },
  };
}

describe("agregação do quadro de remediação", () => {
  it("busca e conta todas as páginas quando há mais de 100 findings", async () => {
    const chamadas: number[] = [];
    const resultado = await buscarTodosFindings(async (params) => {
      const page = Number(params.get("page"));
      chamadas.push(page);
      return resposta(page, 205, page === 1 ? 100 : page === 2 ? 100 : 5);
    }, new URLSearchParams("status=OPEN"));

    expect(chamadas).toEqual([1, 2, 3]);
    expect(resultado.data).toHaveLength(205);
    expect(resultado.pagination.total).toBe(205);
    expect(resultado.pagination.totalPages).toBe(1);
  });
});
