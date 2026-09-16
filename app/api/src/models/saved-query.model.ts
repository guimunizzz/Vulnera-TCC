/**
 * saved-query.model.ts
 *
 * Tipos das buscas salvas / watchlists (CP-6).
 *
 * DOIS ESCOPOS:
 *   PRIVATE  só o dono vê. É o padrão — o atalho pessoal de quem trabalha.
 *   COMPANY  todos da empresa veem. É a watchlist do time ("críticas
 *            estouradas", "aceites vencendo"), e por isso só quem pertence a
 *            uma empresa pode criar.
 *
 * 🎯 NÃO EXISTE SNAPSHOT DE RESULTADO (docs/DECISIONS.md D6). O que se guarda é
 * a PERGUNTA, e ela é reexecutada com o escopo de quem abre. Isso resolve de
 * uma vez o problema de tenancy mais sutil da feature: a watchlist da empresa
 * aberta por dois usuários diferentes devolve o que CADA UM pode ver, porque
 * quem recorta é o `search` da vulnerability, não a busca salva.
 */

import type { SavedQuery as PrismaSavedQuery } from "@prisma/client";
import { resumirQuery } from "../utils/saved-query.util";

export type SavedQuery = PrismaSavedQuery;

export const SAVED_QUERY_SCOPES = ["PRIVATE", "COMPANY"] as const;
export type SavedQueryScope = (typeof SAVED_QUERY_SCOPES)[number];

export const SAVED_QUERY_LIMITS = {
  name: 120,
  description: 400,
  /** Teto de atalhos fixados por pessoa. Uma barra lateral infinita deixa de ser atalho. */
  maxPinned: 8,
  /** Teto de buscas salvas por pessoa — evita uso como armazenamento arbitrário. */
  maxPorUsuario: 50,
} as const;

export type CreateSavedQueryDTO = {
  name: string;
  description?: string | null;
  queryString: string;
  scope?: SavedQueryScope;
  pinned?: boolean;
};

export type UpdateSavedQueryDTO = Partial<CreateSavedQueryDTO>;

export type SavedQueryResponseDTO = {
  id: string;
  name: string;
  description: string | null;
  queryString: string;
  scope: SavedQueryScope;
  ownerId: string;
  companyId: string | null;
  pinned: boolean;
  /** true quando quem pediu é o dono — a tela decide se mostra editar/remover. */
  isOwner: boolean;
  /** Os filtros, já decompostos, para a tela descrever o atalho. */
  filtros: Array<{ campo: string; valores: string[] }>;
  createdAt: string;
  updatedAt: string;
};

export class SavedQueryEntity {
  constructor(private readonly data: SavedQuery) {}

  toResponse(actorId: string): SavedQueryResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      description: this.data.description,
      queryString: this.data.queryString,
      scope: this.data.scope as SavedQueryScope,
      ownerId: this.data.ownerId,
      companyId: this.data.companyId,
      pinned: this.data.pinned,
      isOwner: this.data.ownerId === actorId,
      filtros: resumirQuery(this.data.queryString),
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }
}
