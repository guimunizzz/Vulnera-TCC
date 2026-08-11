// app/api/src/factories/notification.factory.ts
//
// FACTORY METHOD para o recurso Notification (padrão GoF).
// Fase 7 — escopo enxuto: só o registro de push token, por isso a "stack"
// é curta (sem repository próprio — reaproveita UserRepository, já que o
// token vive em User.expoPushToken, não numa tabela própria).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS notification.routes.ts.

import { prisma } from "../database/prisma.database";
import { UserRepository } from "../repositories/user.repository";
import { NotificationService } from "../services/notification.service";
import { NotificationController } from "../controllers/notification.controller";

export function makeNotificationController(): NotificationController {
  const userRepository = new UserRepository(prisma);
  const service = new NotificationService(userRepository);
  return new NotificationController(service);
}
