// FACTORY METHOD (GoF) para o módulo administrativo de AccessRequest.
// Agrupa repositórios, autorização e services antes de entregar Controller às rotas;
// permite injetar doubles nos testes sem Prisma, SMTP ou credenciais de ambiente.
// Consumidor direto: routes/admin-access-request.routes.ts; registro central em routes/routes.ts.

import { SmtpEmailAdapter } from "../adapters/smtp-email.adapter";
import { loadAccessInvitationConfig } from "../config/access-invitation.config";
import { readEmailConfig } from "../config/email.config";
import { AdminAccessRequestController } from "../controllers/admin-access-request.controller";
import { prisma } from "../database/prisma.database";
import { makeAccessRequestAdminMiddleware } from "../middlewares/access-request-admin.middleware";
import { AccessRequestRepository } from "../repositories/access-request.repository";
import { AdminAccessRequestQueryRepository } from "../repositories/admin-access-request.repository";
import { UserRepository } from "../repositories/user.repository";
import { AccessInvitationService } from "../services/access-invitation.service";
import { AccessRequestAdminAuthorizationService } from "../services/access-request-admin-authorization.service";
import { AdminAccessRequestDecisionService } from "../services/admin-access-request-decision.service";
import { AdminAccessRequestQueryService } from "../services/admin-access-request-query.service";
import type { PreparedAccessInvitation, InvitationDeliveryStatus } from "../models/access-invitation.model";
import type { AccessRepositories } from "../repositories/access-request.repository";
import type { AccessRequestAdminActor } from "../models/admin-access-request.model";
import type { AdminAccessRequestControllerDependencies } from "../controllers/admin-access-request.controller";

export type AdminAccessRequestRouteDependencies = AdminAccessRequestControllerDependencies & {
  authorization: Pick<AccessRequestAdminAuthorizationService, "ensureAdmin">;
};

export function makeAdminAccessRequestController(
  dependencies: AdminAccessRequestControllerDependencies,
): AdminAccessRequestController {
  return new AdminAccessRequestController(dependencies);
}

export function makeAdminAccessRequestAdminMiddleware(
  dependencies: Pick<AdminAccessRequestRouteDependencies, "authorization">,
) {
  return makeAccessRequestAdminMiddleware(dependencies.authorization);
}

/**
 * Monta somente DB e autorização. A factory de convite fica lazy para GET/rejeição
 * não exigirem SMTP; em aprovação ela é chamada dentro da transação e falha antes
 * do commit, sem deixar pedido aprovado sem preparo persistido.
 */
export function makeDefaultAdminAccessRequestRouteDependencies(): AdminAccessRequestRouteDependencies {
  const requests = new AccessRequestRepository(prisma);
  const authorization = new AccessRequestAdminAuthorizationService(new UserRepository(prisma));
  const invitationService = new LazyAccessInvitationService(() => {
    const email = readEmailConfig();
    const invitation = loadAccessInvitationConfig();
    return new AccessInvitationService(
      requests,
      new SmtpEmailAdapter(email.smtp),
      email.publicWebUrl,
      authorization,
      { cooldownMs: invitation.resendCooldownMs },
    );
  });

  return {
    queryService: new AdminAccessRequestQueryService(
      new AdminAccessRequestQueryRepository(prisma),
      authorization,
    ),
    decisionService: new AdminAccessRequestDecisionService(requests, invitationService, authorization),
    invitationService,
    authorization,
  };
}

class LazyAccessInvitationService {
  private service?: AccessInvitationService;

  constructor(private readonly create: () => AccessInvitationService) {}

  prepareInitial(
    repositories: AccessRepositories,
    accessRequestId: string,
    actor: AccessRequestAdminActor,
    now: Date,
  ): Promise<PreparedAccessInvitation> {
    return this.getService().prepareInitial(repositories, accessRequestId, actor, now);
  }

  sendPrepared(prepared: PreparedAccessInvitation): Promise<InvitationDeliveryStatus> {
    return this.getService().sendPrepared(prepared);
  }

  resend(
    accessRequestId: string,
    actor: AccessRequestAdminActor,
  ): ReturnType<AccessInvitationService["resend"]> {
    return this.getService().resend(accessRequestId, actor);
  }

  private getService(): AccessInvitationService {
    this.service ??= this.create();
    return this.service;
  }
}
