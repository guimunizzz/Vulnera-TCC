/**
 * playbook.types.ts
 *
 * Contrato do catálogo de remediação (CP-5) visto pelo front.
 * Espelha `app/api/src/models/remediation-playbook.model.ts`.
 *
 * Duas origens, uma tabela:
 *   System (`isSystem: true`)  conteúdo OFICIAL da OWASP. Global e imutável.
 *   Custom (`isSystem: false`) escrito pela empresa. Só ela vê e edita.
 *
 * `provenance` não é decoração: a licença CC BY-SA 4.0 exige atribuição, e a
 * tela é onde ela precisa aparecer.
 */

export type PlaybookSource = "OWASP_TOP10" | "CUSTOM";

export interface PlaybookReference {
  title: string;
  url: string;
}

export interface PlaybookProvenance {
  source: PlaybookSource;
  sourceUrl: string | null;
  sourceVersion: string | null;
  /** "OWASP Foundation" quando o conteúdo tem origem oficial; null num custom do zero. */
  attribution: string | null;
  license: string | null;
  licenseUrl: string | null;
  clonedFromId: string | null;
}

/** A linha da listagem — sem o Markdown longo. */
export interface PlaybookListItem {
  id: string;
  title: string;
  summary: string | null;
  owaspCategory: string | null;
  isSystem: boolean;
  companyId: string | null;
  source: PlaybookSource;
  clonedFromId: string | null;
  updatedAt: string;
}

export interface Playbook extends Omit<PlaybookListItem, "source"> {
  cweIds: string[];
  rootCause: string | null;
  remediation: string | null;
  validationSteps: string | null;
  secureExample: string | null;
  compensatingControls: string | null;
  references: PlaybookReference[];
  createdBy: string | null;
  provenance: PlaybookProvenance;
  createdAt: string;
}

/**
 * O corpo de criação/edição. NÃO existem `isSystem`, `companyId` nem `source`
 * aqui de propósito: a origem é decidida na API, e mandá-los seria sugerir que
 * o cliente escolhe.
 */
export interface PlaybookInput {
  title: string;
  summary?: string | null;
  owaspCategory?: string | null;
  cweIds?: string[] | null;
  rootCause?: string | null;
  remediation?: string | null;
  validationSteps?: string | null;
  secureExample?: string | null;
  compensatingControls?: string | null;
  references?: PlaybookReference[] | null;
}

/** As seções de conteúdo, na ordem em que a tela as mostra. */
export const SECOES_PLAYBOOK = [
  { campo: "rootCause", titulo: "Causa raiz" },
  { campo: "remediation", titulo: "Como corrigir" },
  { campo: "validationSteps", titulo: "Como validar a correção" },
  { campo: "secureExample", titulo: "Exemplo" },
  { campo: "compensatingControls", titulo: "Controles compensatórios" },
] as const satisfies ReadonlyArray<{ campo: keyof Playbook; titulo: string }>;
