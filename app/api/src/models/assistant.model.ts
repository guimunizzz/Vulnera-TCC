/**
 * Contratos fechados do assistente, sem persistência ou dados de negócio.
 * Existem para limitar o contexto externo e os atalhos; consumidos pelas
 * camadas de ajuda, serviço, controller e gateway.
 */
import type { UserRole } from "./user.model";

export const ASSISTANT_SCREENS = [
  "dashboard", "projects", "project-detail", "applications", "application-dashboard",
  "new-analysis", "findings", "finding-detail", "finding-editor", "dast", "dast-detail",
  "dast-report", "remediation", "playbooks", "playbook-detail", "sla-settings", "maturity",
  "subscriptions", "onboarding", "sast-sca", "code-import-detail", "threat-intel", "exposure-graph",
] as const;
export type AssistantScreen = (typeof ASSISTANT_SCREENS)[number];
export type AssistantActionId = "dashboard" | "projects" | "applications" | "new-analysis" |
  "findings" | "dast" | "remediation" | "playbooks" | "sla-settings" | "sast-sca" | "threat-intel" | "exposure-graph";
export interface AssistantHistoryMessage { role: "user" | "assistant"; content: string }
export interface AssistantChatDTO { question: string; screen: AssistantScreen; history: AssistantHistoryMessage[] }
export interface AssistantActionDTO { id: AssistantActionId; label: string }
export interface AssistantResponseDTO { message: string; source: "generated" | "local"; actions: AssistantActionDTO[]; providerRetryAfterSeconds?: number }
export interface AssistantBudgetResult { allowed: boolean; retryAfterSeconds: number }
export interface AssistantTopic {
  id: string;
  title: string;
  keywords: readonly string[];
  screens: readonly AssistantScreen[];
  guidance: string;
  restrictedGuidance?: string;
  byRole?: Partial<Record<UserRole, string>>;
  roles: readonly UserRole[];
  actions: readonly AssistantActionId[];
}
export interface AssistantGatewayInput {
  question: string;
  screen: AssistantScreen;
  role: UserRole;
  history: AssistantHistoryMessage[];
  help: string;
}
export const ASSISTANT_REPLY_KINDS = ["answer", "navigation", "clarification", "refusal", "off_topic"] as const;
export type AssistantReplyKind = (typeof ASSISTANT_REPLY_KINDS)[number];
export type AssistantGatewayFailure = "provider_not_configured" | "provider_quota" | "provider_timeout" |
  "provider_blocked" | "provider_invalid_response" | "provider_error";
export type AssistantGatewayResult =
  | { ok: true; kind: AssistantReplyKind; message: string }
  | { ok: false; reason: AssistantGatewayFailure };
export interface AssistantGateway { generate(input: AssistantGatewayInput): Promise<AssistantGatewayResult> }
