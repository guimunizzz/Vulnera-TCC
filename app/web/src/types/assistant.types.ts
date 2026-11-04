/**
 * Contratos do Assistente Vulnera consumidos pelo cliente HTTP e pelo painel.
 * Espelham os DTOs da API sem compartilhar persistência ou dependência entre workspaces.
 */
import type { UserRole } from "./auth.types";

export type AssistantScreen = "dashboard" | "projects" | "project-detail" | "applications" | "application-dashboard"
  | "new-analysis" | "findings" | "finding-detail" | "finding-editor" | "dast" | "dast-detail" | "dast-report"
  | "remediation" | "playbooks" | "playbook-detail" | "sla-settings" | "maturity" | "subscriptions" | "onboarding";

export type AssistantActionId = "dashboard" | "projects" | "applications" | "new-analysis" | "findings" | "dast"
  | "remediation" | "playbooks" | "sla-settings";

export interface AssistantHistoryMessage { role: "user" | "assistant"; content: string }
export interface AssistantChatInput { question: string; screen: AssistantScreen; history: AssistantHistoryMessage[] }
export interface AssistantAction { id: AssistantActionId; label: string }
export interface AssistantChatResponse { message: string; source: "gemini" | "local"; actions: AssistantAction[] }
export interface AssistantDestination { id: AssistantActionId; label: string; path: string; roles: readonly UserRole[] }
export interface AssistantMessage extends AssistantHistoryMessage {
  id: number;
  screen: AssistantScreen;
  source?: AssistantChatResponse["source"];
  actions?: AssistantAction[];
}
