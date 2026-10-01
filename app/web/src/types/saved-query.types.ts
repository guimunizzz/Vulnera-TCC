/**
 * saved-query.types.ts
 *
 * Contrato das buscas salvas / watchlists (CP-6).
 * Espelha `app/api/src/models/saved-query.model.ts`.
 *
 * 🎯 `queryString` É A PERGUNTA, NÃO A RESPOSTA. Ela é a query canônica da API
 * — a mesma que a barra de endereço da listagem carrega. Abrir um atalho é
 * navegar para `/findings?<queryString>`, e a lista é buscada na hora, com o
 * escopo de quem abriu. Nenhum resultado é guardado.
 */

export type SavedQueryScope = "PRIVATE" | "COMPANY";

export interface SavedQuery {
  id: string;
  name: string;
  description: string | null;
  /** Query canônica da API (ex.: "severity=CRITICAL&status=OPEN"). */
  queryString: string;
  scope: SavedQueryScope;
  ownerId: string;
  companyId: string | null;
  pinned: boolean;
  /** true quando quem pediu é o dono — decide se a tela mostra editar/remover. */
  isOwner: boolean;
  filtros: Array<{ campo: string; valores: string[] }>;
  createdAt: string;
  updatedAt: string;
  /**
   * Parâmetros removidos na canonização (só nas respostas de criar/editar).
   * Aparecem na tela na hora: descobrir depois, ao clicar no atalho e ver
   * resultados demais, seria tarde.
   */
  descartados?: Array<{ param: string; motivo: string }>;
}

export interface SavedQueryInput {
  name: string;
  description?: string | null;
  queryString: string;
  scope?: SavedQueryScope;
  pinned?: boolean;
}

/** Espelha SAVED_QUERY_LIMITS da API — a tela avisa antes de o servidor recusar. */
export const SAVED_QUERY_LIMITS = {
  name: 120,
  description: 400,
  maxPinned: 8,
} as const;

/** Rótulos dos campos de filtro, para descrever o atalho sem reparsear. */
export const ROTULO_CAMPO: Record<string, string> = {
  companyId: "empresa",
  applicationId: "aplicação",
  projectId: "projeto",
  createdBy: "autor",
  severity: "severidade",
  status: "status",
  owaspCategory: "OWASP",
  slaState: "SLA",
  riskAcceptance: "aceite",
  vrsMin: "VRS mín.",
  vrsMax: "VRS máx.",
  createdFrom: "de",
  createdTo: "até",
  search: "texto",
  sortBy: "ordenar por",
  sortOrder: "ordem",
};
