/**
 * Testa o contrato de navegação/contexto: URLs conhecidas não vazam IDs e ações respeitam os perfis.
 * Consumido pelo Vitest, sem navegador externo, credenciais ou chamadas de IA.
 */
import { describe, expect, it } from "vitest";
import { assistantDestination, assistantHistory, assistantScreen, ASSISTANT_ACTIONS } from "./assistant-context";
import type { AssistantHistoryMessage } from "../types/assistant.types";

describe("Contexto fechado do assistente", () => {
  it.each([
    ["/projects/private-project?token=secret", "project-detail"],
    ["/projects/private-project/findings/new", "finding-editor"],
    ["/findings/private-finding/edit#evidence", "finding-editor"],
    ["/applications/private-app/dashboard", "application-dashboard"],
    ["/dast/scans/private-scan/report", "dast-report"],
    ["/companies/private-company/maturity", "maturity"],
    ["/onboarding", "onboarding"], ["/settings/sla/", "sla-settings"],
  ])("normaliza %s em %s", (route, expected) => expect(assistantScreen(route)).toBe(expected));

  it("não transforma nomes de propriedades ou URLs em atalhos", () => {
    for (const forged of ["__proto__", "constructor", "https://outside.test", "/admin/subscriptions", "delete-all"]) {
      expect(assistantDestination(forged, "ADMIN")).toBeUndefined();
    }
    expect(assistantDestination("dast", "CLIENT")).toBeUndefined();
    expect(assistantDestination("applications", "PENTESTER")).toBeUndefined();
    expect(assistantDestination("projects", "CLIENT")?.path).toBe("/projects");
    expect(Object.keys(ASSISTANT_ACTIONS)).toHaveLength(9);
  });

  it("envia até seis mensagens, mil caracteres por mensagem e quatro mil no total", () => {
    const messages: AssistantHistoryMessage[] = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user", content: `${index}${"x".repeat(1_400)}`,
    }));
    const result = assistantHistory(messages);
    expect(result).toHaveLength(4);
    expect(result[0].content.startsWith("6")).toBe(true);
    expect(result.every((message) => message.content.length <= 1_000)).toBe(true);
    expect(result.reduce((sum, message) => sum + message.content.length, 0)).toBe(4_000);
    expect(messages[0].content).toHaveLength(1_401);
    expect(assistantHistory(Array.from({ length: 9 }, () => ({ role: "user", content: "curta" })))).toHaveLength(6);
  });
});
