/**
 * notification.service.ts
 *
 * Duas responsabilidades:
 *  1. Fase 7 — registrar o token de push do app mobile (campo em User).
 *  2. ADR-053 — a central de notificações in-app de cada usuário: listar,
 *     contar não lidas e marcar como lidas. Quem CRIA notificações é a
 *     sincronização da Threat Intel; aqui só se lê o que é do próprio ator.
 *
 * Qualquer usuário autenticado pode registrar seu próprio token — não é
 * exclusivo de CLIENT aqui (o app mobile É exclusivo de CLIENT por decisão
 * de produto, ADR-004, mas o endpoint em si não precisa reforçar isso: um
 * ADMIN/PENTESTER que por acaso chamasse o endpoint só estaria guardando um
 * token que nunca vai receber push, porque o disparo de CRITICAL é sempre
 * pra CLIENT — ver o hook em vulnerability.service.ts).
 *
 * ISOLAMENTO: toda leitura e escrita da central filtra pelo `userId` do token.
 * Marcar como lida uma notificação de outra pessoa devolve 404, sem revelar
 * que ela existe.
 */

import type { Notification } from "@prisma/client";
import type { UserRepository } from "../repositories/user.repository";
import type { NotificationRepository } from "../repositories/notification.repository";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export interface NotificacaoDTO {
  id: string;
  category: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const LIMITE_PADRAO = 30;
const LIMITE_MAXIMO = 100;

const paraDTO = (n: Notification): NotificacaoDTO => ({
  id: n.id,
  category: n.category,
  title: n.title,
  message: n.message,
  link: n.link,
  isRead: n.isRead,
  createdAt: n.createdAt.toISOString(),
});

export class NotificationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async registerPush(actor: Actor, expoPushToken: string): Promise<void> {
    await this.userRepository.updateExpoPushToken(actor.userId, expoPushToken);
  }

  async listar(actor: Actor, apenasNaoLidas: boolean, limite?: number): Promise<{ data: NotificacaoDTO[]; naoLidas: number }> {
    const take = Math.min(LIMITE_MAXIMO, Math.max(1, limite ?? LIMITE_PADRAO));
    const [linhas, naoLidas] = await Promise.all([
      this.notificationRepository.listar(actor.userId, apenasNaoLidas, take),
      this.notificationRepository.contarNaoLidas(actor.userId),
    ]);
    return { data: linhas.map(paraDTO), naoLidas };
  }

  async contarNaoLidas(actor: Actor): Promise<number> {
    return this.notificationRepository.contarNaoLidas(actor.userId);
  }

  async marcarLida(actor: Actor, id: string): Promise<void> {
    const n = await this.notificationRepository.marcarLida(id, actor.userId);
    if (n === 0) throw new Error("NOTIFICATION_NOT_FOUND");
  }

  async marcarTodasLidas(actor: Actor): Promise<number> {
    return this.notificationRepository.marcarTodasLidas(actor.userId);
  }
}
