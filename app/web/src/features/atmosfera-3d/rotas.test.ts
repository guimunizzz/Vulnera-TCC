/**
 * rotas.test.ts — qual atmosfera cada seção usa (decisão de 2026-11-23).
 *   ATR-01  Dashboard é a nebulosa (o todo)
 *   ATR-02  monitoramento é o relevo com radar, inclusive as rotas filhas
 *   ATR-03  trabalho técnico é o ASCII — criar finding sob /projects também
 *   ATR-04  formulário/configuração e o Exposure Graph ficam sem cena
 *   ATR-05  rota não listada cai no ASCII (o fundo histórico)
 */

import { describe, expect, it } from "vitest";
import { linguagemDaRota } from "./rotas";

describe("linguagemDaRota", () => {
  it("ATR-01 — Dashboard é a nebulosa", () => {
    expect(linguagemDaRota("/dashboard")).toBe("nebulosa");
  });

  it("ATR-02 — monitoramento é o relevo", () => {
    for (const rota of ["/applications", "/applications/abc/dashboard", "/projects", "/projects/abc", "/threat-intel", "/remediation"]) {
      expect(linguagemDaRota(rota), rota).toBe("relevo");
    }
  });

  it("ATR-03 — trabalho técnico é o ASCII", () => {
    for (const rota of ["/findings", "/findings/abc", "/findings/abc/edit", "/projects/abc/findings/new", "/dast", "/dast/scans/1", "/sast-sca/imports/1", "/playbooks/x", "/agendamentos", "/new-analysis"]) {
      expect(linguagemDaRota(rota), rota).toBe("ascii");
    }
  });

  it("ATR-04 — formulário, configuração e Exposure Graph ficam sem cena", () => {
    for (const rota of ["/settings/sla", "/admin/subscriptions", "/admin/filas", "/exposure-graph", "/companies/abc/maturity"]) {
      expect(linguagemDaRota(rota), rota).toBeNull();
    }
  });

  it("ATR-05 — rota não listada fica com o ASCII", () => {
    expect(linguagemDaRota("/rota-nova")).toBe("ascii");
    // Prefixo parecido não conta como a seção.
    expect(linguagemDaRota("/dashboards")).toBe("ascii");
  });
});
