/**
 * notification.service.ts
 *
 * Fase 7 — escopo enxuto: só o registro do token de push do app mobile.
 * Sem model/DTO dedicado (não existe entidade nova sendo serializada aqui,
 * só um campo em User) e sem o Notification do vault (histórico in-app,
 * WebSocket, categorias RN24) — fora do escopo desta fase, ver
 * docs/BACKLOG.md.
 *
 * Qualquer usuário autenticado pode registrar seu próprio token — não é
 * exclusivo de CLIENT aqui (o app mobile É exclusivo de CLIENT por decisão
 * de produto, ADR-004, mas o endpoint em si não precisa reforçar isso: um
 * ADMIN/PENTESTER que por acaso chamasse o endpoint só estaria guardando um
 * token que nunca vai receber push, porque o disparo de CRITICAL é sempre
 * pra CLIENT — ver o hook em vulnerability.service.ts).
 */

import type { UserRepository } from "../repositories/user.repository";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export class NotificationService {
  constructor(private readonly userRepository: UserRepository) {}

  async registerPush(actor: Actor, expoPushToken: string): Promise<void> {
    await this.userRepository.updateExpoPushToken(actor.userId, expoPushToken);
  }
}
