/**
 * graph-comment.repository.ts
 *
 * O QUE FAZ
 * Persistência dos comentários de nó de grafo (ADR-061). Toda leitura recebe
 * o par (graphKind, scopeId) que o service já autorizou; nenhuma consulta
 * lista comentários sem escopo.
 *
 * QUEM USA
 * `graph-comment.service.ts`, exclusivamente.
 */

import type { PrismaClient } from "@prisma/client";
import type { GrafoComentavel } from "../models/graph-comment.model";

export interface ComentarioBruto {
  id: string;
  graphKind: string;
  scopeId: string;
  companyId: string | null;
  nodeId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string };
}

const SELECAO = {
  id: true,
  graphKind: true,
  scopeId: true,
  companyId: true,
  nodeId: true,
  authorId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
} as const;

/** Um grafo raramente passa disto; o teto protege a resposta de um escopo patológico. */
const LIMITE_POR_GRAFO = 500;

export class GraphCommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listarDoEscopo(graphKind: GrafoComentavel, scopeId: string): Promise<ComentarioBruto[]> {
    return this.prisma.graphComment.findMany({
      where: { graphKind, scopeId },
      select: SELECAO,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIMITE_POR_GRAFO,
    });
  }

  criar(dados: { graphKind: GrafoComentavel; scopeId: string; companyId: string | null; nodeId: string; authorId: string; body: string }): Promise<ComentarioBruto> {
    return this.prisma.graphComment.create({ data: dados, select: SELECAO });
  }

  buscar(id: string): Promise<ComentarioBruto | null> {
    return this.prisma.graphComment.findUnique({ where: { id }, select: SELECAO });
  }

  async apagar(id: string): Promise<void> {
    await this.prisma.graphComment.delete({ where: { id } });
  }

  /** Quem já comentou neste nó (para a notificação), sem repetir. */
  async participantes(graphKind: GrafoComentavel, scopeId: string, nodeId: string): Promise<string[]> {
    const linhas = await this.prisma.graphComment.findMany({
      where: { graphKind, scopeId, nodeId },
      select: { authorId: true },
      distinct: ["authorId"],
    });
    return linhas.map((l) => l.authorId);
  }
}
