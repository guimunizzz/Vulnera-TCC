/** Limita o contexto e os destinos da Vuvu às telas móveis suportadas, sem enviar IDs de recursos. */
export type AssistantScreen = "dashboard" | "projects" | "project-detail" | "finding-detail" | "exposure-graph" | "threat-intel";
export type AssistantActionId = "dashboard" | "projects" | "exposure-graph" | "threat-intel";
export function assistantScreen(path: string): AssistantScreen {
  if (path.includes("/finding/")) return "finding-detail";
  if (path.includes("/project/") || /\/reports\/[^/]+/.test(path)) return "project-detail";
  if (path.includes("/security") || path.includes("/exposure")) return "exposure-graph";
  if (path.includes("/home") || path.includes("/reports")) return "projects";
  return "dashboard";
}
export const assistantActions: Record<AssistantActionId, { label: string; path: string }> = {
  dashboard: { label: "Abrir painel", path: "/(tabs)/dashboard" },
  projects: { label: "Abrir projetos", path: "/(tabs)/home" },
  "exposure-graph": { label: "Abrir exposição", path: "/(tabs)/security?section=exposure" },
  "threat-intel": { label: "Abrir Threat Intel", path: "/(tabs)/security?section=intel" },
};
