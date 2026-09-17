/**
 * Prova a ponte entre filtros aplicados e a requisição da tabela.
 *
 * O hook mantém URL/chips/atalhos salvos no mesmo contrato; este teste chama a
 * montagem pura que o hook usa antes de `useFindings`, cobrindo os cruzamentos
 * CP-2 (SLA), CP-3 (VRS), CP-4 (aceite), CP-7 (responsável) e CP-6 (Saved Query).
 */

import { describe, expect, it } from "vitest";
import { montarParamsDaBusca } from "./use-findings-filters";
import { parseQuery, tokensToParams } from "../lib/finding-query";

const ASSIGNEE = "cmabcdefghijklmnopqrstuv";

describe("useFindingsFilters → paramsDaApi", () => {
  it("preserva os cinco parâmetros vindos dos chips e de um Saved Query", () => {
    const chips = tokensToParams(
      parseQuery(
        `sla = BREACHED vrsMin = 40 vrsMax = 84 aceite = NONE responsavel = ${ASSIGNEE}`,
      ),
    );

    // Saved Query reabre a mesma query canônica na URL; a origem muda, o
    // contrato de entrada da busca não.
    const paramsDoAtalho = new URLSearchParams(chips);
    const paramsDaBusca = montarParamsDaBusca(paramsDoAtalho, undefined, 1, 25, "vrsScore", "desc");

    expect(Object.fromEntries(paramsDaBusca)).toEqual({
      slaState: "BREACHED",
      vrsMin: "40",
      vrsMax: "84",
      riskAcceptance: "NONE",
      assignedTo: ASSIGNEE,
      page: "1",
      pageSize: "25",
      sortBy: "vrsScore",
      sortOrder: "desc",
    });
  });

  it("mantém os cinco filtros ao combinar um contexto travado com a query salva", () => {
    const querySalva = new URLSearchParams(
      `slaState=RESOLVED&vrsMin=65&vrsMax=100&riskAcceptance=ACTIVE&assignedTo=${ASSIGNEE}`,
    );
    const paramsDaBusca = montarParamsDaBusca(
      querySalva,
      { projectId: "cmabcdefghijklmnopqrstuw" },
      2,
      100,
      "createdAt",
      "asc",
    );

    expect(paramsDaBusca.get("slaState")).toBe("RESOLVED");
    expect(paramsDaBusca.get("vrsMin")).toBe("65");
    expect(paramsDaBusca.get("vrsMax")).toBe("100");
    expect(paramsDaBusca.get("riskAcceptance")).toBe("ACTIVE");
    expect(paramsDaBusca.get("assignedTo")).toBe(ASSIGNEE);
    expect(paramsDaBusca.get("projectId")).toBe("cmabcdefghijklmnopqrstuw");
    expect(paramsDaBusca.get("page")).toBe("2");
  });
});
