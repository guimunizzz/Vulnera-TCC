/**
 * saved-query.repository.ts
 *
 * Acesso a dados das buscas salvas (CP-6). Única camada que toca o Prisma.
 *
 * 🎯 O RECORTE ESTÁ NO WHERE, NÃO EM UM `.filter()` DEPOIS.
 * `list` recebe o escopo do ator e monta o OR que devolve exatamente o que ele
 * pode ver: as PRIVATE dele mesmo e as COMPANY da empresa dele. Filtrar em
 * memória depois da query significa que o banco já devolveu o que não podia —
 * e uma paginação ou um `take` acrescentado depois vazaria pela borda.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import type { SavedQuery } from "../models/saved-query.model";

export interface CreateSavedQueryData {
  name: string;
  description: string | null;
  queryString: string;
  scope: string;
  ownerId: string;
  companyId: string | null;
  pinned: boolean;
}

export type UpdateSavedQueryData = Partial<Omit<CreateSavedQueryData, "ownerId">>;

export interface ListSavedQueriesFilter {
  actorId: string;
  /** A empresa do ator. Null = sem empresa: só enxerga as próprias PRIVATE. */
  companyId: string | null;
  /** ADMIN enxerga as COMPANY de qualquer empresa (opera todas). */
  todasAsEmpresas: boolean;
  apenasFixadas?: boolean;
}

export class SavedQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<SavedQuery | null> {
    return this.prisma.savedQuery.findUnique({ where: { id } });
  }

  /** O WHERE do recorte — ver o comentário do topo. */
  private where(f: ListSavedQueriesFilter): Prisma.SavedQueryWhereInput {
    const alcance: Prisma.SavedQueryWhereInput[] = [{ ownerId: f.actorId }];
    if (f.todasAsEmpresas) alcance.push({ scope: "COMPANY" });
    else if (f.companyId) alcance.push({ scope: "COMPANY", companyId: f.companyId });

    return {
      OR: alcance,
      ...(f.apenasFixadas ? { pinned: true } : {}),
    };
  }

  async list(f: ListSavedQueriesFilter): Promise<SavedQuery[]> {
    return this.prisma.savedQuery.findMany({
      where: this.where(f),
      // Fixadas primeiro; entre iguais, a mais recente em cima.
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.prisma.savedQuery.count({ where: { ownerId } });
  }

  async countPinnedByOwner(ownerId: string): Promise<number> {
    return this.prisma.savedQuery.count({ where: { ownerId, pinned: true } });
  }

  /** Mesma query já salva por este dono — a checagem de duplicata do service. */
  async findByOwnerAndQuery(ownerId: string, queryString: string): Promise<SavedQuery | null> {
    return this.prisma.savedQuery.findFirst({ where: { ownerId, queryString } });
  }

  async create(data: CreateSavedQueryData): Promise<SavedQuery> {
    return this.prisma.savedQuery.create({ data });
  }

  async update(id: string, data: UpdateSavedQueryData): Promise<SavedQuery> {
    return this.prisma.savedQuery.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.savedQuery.delete({ where: { id } });
  }
}
