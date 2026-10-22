/**
 * rotulos.ts
 *
 * O vocabulário pt-BR da planilha. Segue o da tela (`ROTULO_SEVERIDADE`,
 * `OWASP_LABELS`, `fraseDoSla` no web) — a planilha não inventa nomes.
 *
 * ⚠️ Os rótulos de severidade e status são também as CHAVES dos COUNTIF do
 * Dashboard: a fórmula `COUNTIF(f_Sev,"Crítica")` só acerta se a aba Findings
 * gravar exatamente "Crítica". Mudar um aqui muda os dois lados juntos.
 */

/** Ordem de gravidade, da maior para a menor — a ordem dos cards e dos gráficos. */
export const SEVERIDADES_ROTULADAS = [
  { codigo: "CRITICAL", rotulo: "Crítica" },
  { codigo: "HIGH", rotulo: "Alta" },
  { codigo: "MEDIUM", rotulo: "Média" },
  { codigo: "LOW", rotulo: "Baixa" },
  { codigo: "NONE", rotulo: "Informativa" },
] as const;

export const ROTULO_SEVERIDADE: Record<string, string> = Object.fromEntries(
  SEVERIDADES_ROTULADAS.map((s) => [s.codigo, s.rotulo]),
);

export const STATUS_ROTULADOS = [
  { codigo: "OPEN", rotulo: "Aberto", grupo: "Aberto" },
  { codigo: "IN_PROGRESS", rotulo: "Em andamento", grupo: "Aberto" },
  { codigo: "FIXED", rotulo: "Corrigido", grupo: "Resolvido" },
  { codigo: "CLOSED", rotulo: "Fechado", grupo: "Resolvido" },
] as const;

export const ROTULO_STATUS: Record<string, string> = Object.fromEntries(STATUS_ROTULADOS.map((s) => [s.codigo, s.rotulo]));

/** Status que contam como "em aberto" no Dashboard (idade média, % abertos). */
export const ROTULOS_ABERTOS: readonly string[] = STATUS_ROTULADOS.filter((s) => s.grupo === "Aberto").map((s) => s.rotulo);
export const ROTULOS_RESOLVIDOS: readonly string[] = STATUS_ROTULADOS.filter((s) => s.grupo === "Resolvido").map((s) => s.rotulo);

export function ehAberto(codigoStatus: string): boolean {
  return STATUS_ROTULADOS.some((s) => s.codigo === codigoStatus && s.grupo === "Aberto");
}

export const ROTULO_SLA: Record<string, string> = {
  NO_SLA: "Sem SLA",
  ON_TRACK: "No prazo",
  DUE_SOON: "Vencendo",
  BREACHED: "Vencido",
  ACCEPTED: "Risco aceito",
  RESOLVED_IN_SLA: "Resolvido no prazo",
  RESOLVED_LATE: "Resolvido fora do prazo",
};

/** Faixa de VRS → prioridade da remediação (vocabulário do produto, CP-3). */
export const ROTULO_PRIORIDADE: Record<string, string> = {
  IMEDIATO: "Imediato",
  URGENTE: "Urgente",
  PLANEJADO: "Planejado",
  MONITORAR: "Monitorar",
};
export const PRIORIDADES = ["Imediato", "Urgente", "Planejado", "Monitorar"] as const;

export const ROTULO_ORIGEM: Record<string, string> = {
  MANUAL: "Manual",
  DAST_IMPORT: "DAST",
};

export const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: "Administrador",
  PENTESTER: "Pentester",
  CLIENT: "Cliente",
};

/** OWASP Top 10 2021 — os mesmos nomes de `OWASP_LABELS` no web. */
export const NOME_OWASP: Record<string, string> = {
  A01: "Broken Access Control",
  A02: "Cryptographic Failures",
  A03: "Injection",
  A04: "Insecure Design",
  A05: "Security Misconfiguration",
  A06: "Vulnerable and Outdated Components",
  A07: "Identification and Authentication Failures",
  A08: "Software and Data Integrity Failures",
  A09: "Security Logging and Monitoring Failures",
  A10: "Server-Side Request Forgery (SSRF)",
};

export function rotuloOwasp(categoria: string): string {
  const nome = NOME_OWASP[categoria];
  return nome ? `${categoria} · ${nome}` : categoria;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
export function mesCurto(indiceDe0a11: number): string {
  return MESES_CURTOS[indiceDe0a11] ?? "";
}
