// app/api/src/factories/graph-comment.factory.ts
//
// FACTORY METHOD para comentários em nós de grafo (ADR-061). O acesso ao grafo
// de um scan reaproveita o `DastScanService` montado pela factory do DAST —
// a regra de quem vê um scan continua num lugar só.
//
// Consumidor: `graph-comment.routes.ts`.

import { prisma } from "../database/prisma.database";
import { GraphCommentRepository } from "../repositories/graph-comment.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { UserRepository } from "../repositories/user.repository";
import { GraphCommentService } from "../services/graph-comment.service";
import { GraphCommentController } from "../controllers/graph-comment.controller";
import { makeDastScanService } from "./dast-scan.factory";

export function makeGraphCommentController(): GraphCommentController {
  const service = new GraphCommentService(
    new GraphCommentRepository(prisma),
    new UserRepository(prisma),
    makeDastScanService(),
    new NotificationRepository(prisma),
  );
  return new GraphCommentController(service);
}
