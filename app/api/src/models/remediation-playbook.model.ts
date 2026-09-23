/**
 * remediation-playbook.model.ts
 *
 * Tipos do catálogo de remediação (CP-5) — o "como corrigir" do produto.
 *
 * DUAS ORIGENS, UMA TABELA (docs/DECISIONS.md D5):
 *   SYSTEM  conteúdo OFICIAL da OWASP. `isSystem = true`, `companyId = null`.
 *           Ninguém edita — nem ADMIN. Só o sync escreve.
 *   CUSTOM  escrito pelo tenant. `isSystem = false`, `companyId = <empresa>`.
 *
 * A invariante `isSystem = true ⟺ companyId IS NULL` é imposta no service, e
 * `isSystem` NUNCA vem do corpo de uma requisição: seria a porta por onde um
 * tenant criaria um "playbook oficial" falso, visível para todas as empresas.
 *
 * CONTEÚDO É MARKDOWN. A sanitização acontece na ESCRITA (nada perigoso entra
 * no banco) e de novo na RENDERIZAÇÃO (marked + DOMPurify no web). Guardar
 * HTML pré-renderizado seria guardar o vetor de XSS.
 */

import type { RemediationPlaybook as PrismaRemediationPlaybook } from "@prisma/client";
import { OWASP_LICENSE, OWASP_LICENSE_URL, type OwaspReference } from "../utils/owasp-parser.util";

export type RemediationPlaybook = PrismaRemediationPlaybook;

export const PLAYBOOK_SOURCES = ["OWASP_TOP10", "CUSTOM"] as const;
export type PlaybookSource = (typeof PLAYBOOK_SOURCES)[number];

/**
 * Tetos de tamanho. Markdown longo é legítimo num playbook (o A01 da OWASP
 * tem milhares de caracteres), mas sem teto um POST de 10 MB vira um jeito
 * barato de encher o banco.
 */
export const PLAYBOOK_FIELD_LIMITS = {
  title: 180,
  summary: 2000,
  text: 20000,
  maxReferences: 50,
  maxCwes: 100,
} as const;

/** Os campos de conteúdo em Markdown — o que o clone copia e o sanitizador limpa. */
export const PLAYBOOK_TEXT_FIELDS = [
  "summary",
  "rootCause",
  "remediation",
  "validationSteps",
  "secureExample",
  "compensatingControls",
] as const;

export type CreatePlaybookDTO = {
  title: string;
  summary?: string | null;
  owaspCategory?: string | null;
  cweIds?: string[] | null;
  rootCause?: string | null;
  remediation?: string | null;
  validationSteps?: string | null;
  secureExample?: string | null;
  compensatingControls?: string | null;
  references?: OwaspReference[] | null;
};

export type UpdatePlaybookDTO = Partial<CreatePlaybookDTO>;

/** A procedência, montada para a tela — a atribuição CC BY-SA exigida (D5). */
export type PlaybookProvenanceDTO = {
  source: PlaybookSource;
  sourceUrl: string | null;
  sourceVersion: string | null;
  /** "OWASP" quando o conteúdo tem origem oficial; null num custom do zero. */
  attribution: string | null;
  license: string | null;
  licenseUrl: string | null;
  /** Id do playbook de onde este foi clonado, se foi. */
  clonedFromId: string | null;
};

export type PlaybookResponseDTO = {
  id: string;
  title: string;
  summary: string | null;
  owaspCategory: string | null;
  cweIds: string[];
  rootCause: string | null;
  remediation: string | null;
  validationSteps: string | null;
  secureExample: string | null;
  compensatingControls: string | null;
  references: OwaspReference[];
  isSystem: boolean;
  companyId: string | null;
  createdBy: string | null;
  provenance: PlaybookProvenanceDTO;
  createdAt: string;
  updatedAt: string;
};

/** A linha da listagem — sem os campos de Markdown longo. */
export type PlaybookListItemDTO = {
  id: string;
  title: string;
  summary: string | null;
  owaspCategory: string | null;
  isSystem: boolean;
  companyId: string | null;
  source: PlaybookSource;
  clonedFromId: string | null;
  updatedAt: string;
};

/** JSON de array guardado em TEXT. Corrompido devolve vazio, nunca derruba a resposta. */
function parseArray<T>(bruto: string | null): T[] {
  if (!bruto) return [];
  try {
    const v = JSON.parse(bruto);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export class PlaybookEntity {
  constructor(private readonly data: RemediationPlaybook) {}

  toResponse(): PlaybookResponseDTO {
    return {
      id: this.data.id,
      title: this.data.title,
      summary: this.data.summary,
      owaspCategory: this.data.owaspCategory,
      cweIds: parseArray<string>(this.data.cweIds),
      rootCause: this.data.rootCause,
      remediation: this.data.remediation,
      validationSteps: this.data.validationSteps,
      secureExample: this.data.secureExample,
      compensatingControls: this.data.compensatingControls,
      references: parseArray<OwaspReference>(this.data.references),
      isSystem: this.data.isSystem,
      companyId: this.data.companyId,
      createdBy: this.data.createdBy,
      provenance: this.provenance(),
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }

  toListItem(): PlaybookListItemDTO {
    return {
      id: this.data.id,
      title: this.data.title,
      summary: this.data.summary,
      owaspCategory: this.data.owaspCategory,
      isSystem: this.data.isSystem,
      companyId: this.data.companyId,
      source: this.data.source as PlaybookSource,
      clonedFromId: this.data.clonedFromId,
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }

  /**
   * A atribuição só aparece quando o conteúdo de fato veio da OWASP — num
   * custom escrito do zero, dizer "OWASP · CC BY-SA" seria atribuição falsa.
   * Um CLONE de System preserva `sourceUrl`/`sourceVersion`, então continua
   * creditando: é obra derivada, e a ShareAlike pede exatamente isso.
   */
  private provenance(): PlaybookProvenanceDTO {
    const temOrigemOwasp = this.data.sourceUrl != null && this.data.sourceUrl.includes("owasp.org");
    return {
      source: this.data.source as PlaybookSource,
      sourceUrl: this.data.sourceUrl,
      sourceVersion: this.data.sourceVersion,
      attribution: temOrigemOwasp ? "OWASP Foundation" : null,
      license: temOrigemOwasp ? OWASP_LICENSE : null,
      licenseUrl: temOrigemOwasp ? OWASP_LICENSE_URL : null,
      clonedFromId: this.data.clonedFromId,
    };
  }
}
