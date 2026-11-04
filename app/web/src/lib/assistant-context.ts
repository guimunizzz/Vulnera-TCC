/**
 * Catálogo fechado de telas e atalhos do assistente; usado pelo painel e pelos testes.
 * Remove parâmetros da navegação e nunca transforma texto do provedor em URL executável.
 */
import type { UserRole } from "../types/auth.types";
import type { AssistantActionId, AssistantDestination, AssistantHistoryMessage, AssistantScreen } from "../types/assistant.types";

const ALL = ["ADMIN", "CLIENT", "PENTESTER"] as const;
const ANALYSTS = ["ADMIN", "PENTESTER"] as const;
const CUSTOMERS = ["ADMIN", "CLIENT"] as const;

export const ASSISTANT_ACTIONS: Record<AssistantActionId, AssistantDestination> = {
  dashboard: { id: "dashboard", label: "Abrir dashboard", path: "/dashboard", roles: ALL },
  projects: { id: "projects", label: "Abrir projetos", path: "/projects", roles: ALL },
  applications: { id: "applications", label: "Abrir aplicações", path: "/applications", roles: CUSTOMERS },
  "new-analysis": { id: "new-analysis", label: "Solicitar análise", path: "/new-analysis", roles: CUSTOMERS },
  findings: { id: "findings", label: "Abrir findings", path: "/findings", roles: ANALYSTS },
  dast: { id: "dast", label: "Abrir DAST", path: "/dast", roles: ANALYSTS },
  remediation: { id: "remediation", label: "Abrir remediação", path: "/remediation", roles: ANALYSTS },
  playbooks: { id: "playbooks", label: "Abrir playbooks", path: "/playbooks", roles: ALL },
  "sla-settings": { id: "sla-settings", label: "Abrir configuração de SLA", path: "/settings/sla", roles: CUSTOMERS },
};

export const ASSISTANT_SCREEN_LABELS: Record<AssistantScreen, string> = {
  dashboard: "Dashboard", projects: "Projetos", "project-detail": "Detalhes do projeto", applications: "Aplicações",
  "application-dashboard": "Visão da aplicação", "new-analysis": "Solicitar análise", findings: "Findings",
  "finding-detail": "Detalhes do finding", "finding-editor": "Editor de finding", dast: "DAST", "dast-detail": "Detalhes do scan",
  "dast-report": "Relatório DAST", remediation: "Remediação", playbooks: "Playbooks", "playbook-detail": "Detalhes do playbook",
  "sla-settings": "Configuração de SLA", maturity: "Maturidade", subscriptions: "Assinaturas", onboarding: "Primeiros passos",
};

export function assistantDestination(id: unknown, role: UserRole): AssistantDestination | undefined {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(ASSISTANT_ACTIONS, id)) return;
  const action = ASSISTANT_ACTIONS[id as AssistantActionId];
  return action.roles.includes(role) ? action : undefined;
}

const SCREEN_ROUTES: readonly [RegExp, AssistantScreen][] = [
  [/^\/dashboard$/, "dashboard"], [/^\/projects$/, "projects"],
  [/^\/projects\/[^/]+\/findings\/new$/, "finding-editor"], [/^\/projects\/[^/]+$/, "project-detail"],
  [/^\/applications$/, "applications"], [/^\/applications\/[^/]+\/dashboard$/, "application-dashboard"],
  [/^\/new-analysis$/, "new-analysis"], [/^\/findings$/, "findings"],
  [/^\/findings\/[^/]+\/edit$/, "finding-editor"], [/^\/findings\/[^/]+$/, "finding-detail"],
  [/^\/dast$/, "dast"], [/^\/dast\/scans\/[^/]+\/report$/, "dast-report"], [/^\/dast\/scans\/[^/]+$/, "dast-detail"],
  [/^\/remediation$/, "remediation"], [/^\/playbooks$/, "playbooks"], [/^\/playbooks\/[^/]+$/, "playbook-detail"],
  [/^\/settings\/sla$/, "sla-settings"], [/^\/companies\/[^/]+\/maturity$/, "maturity"],
  [/^\/admin\/subscriptions$/, "subscriptions"], [/^\/onboarding$/, "onboarding"],
];

export function assistantScreen(pathname: string): AssistantScreen {
  const clean = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return SCREEN_ROUTES.find(([pattern]) => pattern.test(clean))?.[1] ?? "dashboard";
}

export function assistantSuggestions(screen: AssistantScreen, role: UserRole): string[] {
  const context = screen === "new-analysis" || screen === "applications"
    ? "Como solicito uma análise?"
    : screen.startsWith("dast") ? "Como funciona a triagem do DAST?"
    : screen === "sla-settings" ? "Como funciona o SLA?"
    : screen.startsWith("playbook") || screen === "remediation" ? "Como uso os playbooks?"
    : role === "PENTESTER" ? "Como acompanho meus projetos?" : "Como solicito uma análise?";
  return ["O que posso fazer nesta tela?", context, "Qual a diferença entre CVSS e VRS?"];
}

/** Mantém o trecho mais recente, sem estourar nenhum dos limites do contrato. */
export function assistantHistory(messages: readonly AssistantHistoryMessage[]): AssistantHistoryMessage[] {
  const limited = messages.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 1_000) }));
  while (limited.reduce((sum, message) => sum + message.content.length, 0) > 4_000) limited.shift();
  return limited;
}
