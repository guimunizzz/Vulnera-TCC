/**
 * rotas.test.ts — qual atmosfera cada seção usa (D20.2, D21.1).
 *   ATR-01  Dashboard é a nebulosa (o todo)
 *   ATR-02  monitoramento é o relevo com radar, inclusive as rotas filhas e o Exposure Graph
 *   ATR-03  trabalho técnico é o ASCII animado — criar finding sob /projects também
 *   ATR-04  formulário e configuração: ASCII parado (pôster), nunca sem fundo
 *   ATR-05  rota não listada cai no ASCII animado (o fundo histórico)
 */

import { describe, expect, it } from "vitest";
import { atmosferaDaRota } from "./rotas";

describe("atmosferaDaRota", () => {
  it("ATR-01 — Dashboard é a nebulosa", () => {
    expect(atmosferaDaRota("/dashboard")).toEqual({ linguagem: "nebulosa", parada: false });
  });

  it("ATR-02 — monitoramento é o relevo", () => {
    for (const rota of ["/applications", "/applications/abc/dashboard", "/projects", "/projects/abc", "/threat-intel", "/remediation", "/exposure-graph", "/conformidade"]) {
      expect(atmosferaDaRota(rota), rota).toEqual({ linguagem: "relevo", parada: false });
    }
  });

  it("ATR-03 — trabalho técnico é o ASCII animado", () => {
    for (const rota of ["/findings", "/findings/abc", "/findings/abc/edit", "/projects/abc/findings/new", "/dast", "/dast/scans/1", "/sast-sca/imports/1", "/playbooks/x", "/agendamentos", "/new-analysis"]) {
      expect(atmosferaDaRota(rota), rota).toEqual({ linguagem: "ascii", parada: false });
    }
  });

  it("ATR-04 — formulário e configuração ficam com o ASCII parado", () => {
    for (const rota of ["/settings/sla", "/admin/subscriptions", "/admin/filas", "/companies/abc/maturity"]) {
      expect(atmosferaDaRota(rota), rota).toEqual({ linguagem: "ascii", parada: true });
    }
  });

  it("ATR-05 — rota não listada fica com o ASCII animado", () => {
    expect(atmosferaDaRota("/rota-nova")).toEqual({ linguagem: "ascii", parada: false });
    // Prefixo parecido não conta como a seção.
    expect(atmosferaDaRota("/dashboards")).toEqual({ linguagem: "ascii", parada: false });
  });
});
