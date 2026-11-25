/**
 * notification.repository.ts
 *
 * Persistência da central de notificações in-app (ADR-053). Usa o model
 * `Notification` que existia no schema desde a modelagem original e nunca
 * tinha sido usado: cada linha é de UM usuário, e toda consulta filtra por ele.
 */

import type { Notification, PrismaClient } from "@prisma/client";
import { TenantLockRepository } from "./tenant-lock.repository";

export interface NovaNotificacao {
  userId: string;
  category: string;
  title: string;
  message: string;
  link: string | null;
}

export class NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async criarVarias(notificacoes: NovaNotificacao[]): Promise<number> {
    if (notificacoes.length === 0) return 0;
    return this.prisma.$transaction(async (tx) => {
      const locks = new TenantLockRepository(tx);
      const userIds = [...new Set(notificacoes.map(({ userId }) => userId))];
      await locks.lockUsers(userIds);
      const active = await tx.user.findMany({
        where: { id: { in: userIds }, deactivatedAt: null },
        select: { id: true },
      });
      const activeIds = new Set(active.map(({ id }) => id));
      const authorized = notificacoes.filter(({ userId }) => activeIds.has(userId));
      if (authorized.length === 0) return 0;
      const result = await tx.notification.createMany({ data: authorized });
      return result.count;
    }, { isolationLevel: "ReadCommitted" });
  }

  /**
   * Avisos já enviados a este usuário nestas categorias e links. É a deduplicação do
   * monitor de SLA: categoria + link identificam o aviso, sem migration nova.
   */
  async jaEnviadas(userId: string, categorias: string[], links: string[]): Promise<{ category: string; link: string | null }[]> {
    if (categorias.length === 0 || links.length === 0) return [];
    return this.prisma.notification.findMany({
      where: { userId, category: { in: categorias }, link: { in: links } },
      select: { category: true, link: true },
    });
  }

  async listar(userId: string, apenasNaoLidas: boolean, limite: number): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, ...(apenasNaoLidas ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limite,
    });
  }

  async contarNaoLidas(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /** Marca como lida SÓ se for do usuário — id de outra pessoa simplesmente não casa (0 linhas). */
  async marcarLida(id: string, userId: string): Promise<number> {
    const r = await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    return r.count;
  }

  async marcarTodasLidas(userId: string): Promise<number> {
    const r = await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return r.count;
  }
}
