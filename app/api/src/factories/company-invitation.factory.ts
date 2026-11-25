// Factory Method para as rotas de convites de equipe e aceitação pública.
// Mantém Prisma, SMTP, limiter e serviços fora dos routers Express.
import { SmtpEmailAdapter } from "../adapters/smtp-email.adapter";
import { readEmailConfig } from "../config/email.config";
import { CompanyInvitationController, type CompanyInvitationControllerService } from "../controllers/company-invitation.controller";
import { prisma } from "../database/prisma.database";
import { CompanyInvitationRepository } from "../repositories/company-invitation.repository";
import { UserRepository } from "../repositories/user.repository";
import { CompanyInvitationRateLimitService } from "../services/company-invitation-rate-limit.service";
import { CompanyInvitationService } from "../services/company-invitation.service";

export type CompanyInvitationRouteDependencies = {
  service: CompanyInvitationControllerService;
  limiter: CompanyInvitationRateLimitService;
};

export function makeCompanyInvitationController(
  service: CompanyInvitationControllerService,
): CompanyInvitationController {
  return new CompanyInvitationController(service);
}

export function makeDefaultCompanyInvitationRouteDependencies(): CompanyInvitationRouteDependencies {
  const limiter = new CompanyInvitationRateLimitService();
  const service = new CompanyInvitationService(
    new CompanyInvitationRepository(prisma),
    new UserRepository(prisma),
    limiter,
    () => {
      const config = readEmailConfig();
      return { sender: new SmtpEmailAdapter(config.smtp), publicWebUrl: config.publicWebUrl };
    },
  );
  return { service, limiter };
}
