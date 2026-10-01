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

import { Prisma, type PrismaClient } from "@prisma/client";
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

export interface SavedQueryCreateLimits {
  maxPorUsuario: number;
  maxPinned: number;
}

export type SerializedCreateResult =
  | { kind: "CREATED"; saved: SavedQuery }
  | { kind: "QUERY_DUPLICATE" }
  | { kind: "LIMIT_REACHED" }
  | { kind: "PINNED_LIMIT_REACHED" };

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

  /**
   * Cria uma busca sob o lock pessimista da linha User.
   *
   * O MySQL não oferece unique parcial para a pergunta canônica, e a guarda
   * `findByOwnerAndQuery` isolada teria uma janela TOCTOU. A mesma transação
   * serializa limites, duplicata e INSERT por owner; o lock não altera schema
   * e não expõe dados além do contrato do repository.
   */
  async createSerialized(data: CreateSavedQueryData, limites: SavedQueryCreateLimits): Promise<SerializedCreateResult> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM \`User\` WHERE id = ${data.ownerId} FOR UPDATE`,
      );
      if (!owner[0]) throw new Error("USER_NOT_FOUND");

      const total = await tx.savedQuery.count({ where: { ownerId: data.ownerId } });
      if (total >= limites.maxPorUsuario) return { kind: "LIMIT_REACHED" };
      if (data.pinned) {
        const pinned = await tx.savedQuery.count({ where: { ownerId: data.ownerId, pinned: true } });
        if (pinned >= limites.maxPinned) return { kind: "PINNED_LIMIT_REACHED" };
      }

      const duplicate = await tx.savedQuery.findFirst({
        where: { ownerId: data.ownerId, queryString: data.queryString },
      });
      if (duplicate) return { kind: "QUERY_DUPLICATE" };

      const saved = await tx.savedQuery.create({ data });
      return { kind: "CREATED", saved };
    });
  }

  async update(id: string, data: UpdateSavedQueryData): Promise<SavedQuery> {
    return this.prisma.savedQuery.update({ where: { id }, data });
  }

  /**
   * Atualiza sob o mesmo lock por owner. Quando a query canônica muda, a
   * colisão é verificada depois do lock e antes do UPDATE, evitando que dois
   * PUTs concorrentes deixem a mesma pergunta salva duas vezes.
   */
  async updateSerialized(id: string, ownerId: string, data: UpdateSavedQueryData): Promise<SavedQuery | null> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM \`User\` WHERE id = ${ownerId} FOR UPDATE`,
      );
      if (!owner[0]) throw new Error("USER_NOT_FOUND");

      const existente = await tx.savedQuery.findUnique({ where: { id } });
      if (!existente || existente.ownerId !== ownerId) throw new Error("SAVED_QUERY_NOT_FOUND");
      if (data.queryString !== undefined) {
        const duplicate = await tx.savedQuery.findFirst({
          where: { ownerId, queryString: data.queryString, NOT: { id } },
        });
        if (duplicate) return null;
      }

      return tx.savedQuery.update({ where: { id }, data });
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.savedQuery.delete({ where: { id } });
  }
}
