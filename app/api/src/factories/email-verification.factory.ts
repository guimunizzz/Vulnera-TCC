// Monta o serviço de verificação de e-mail com persistência e transporte.
// Mantém o adapter SMTP fora do serviço e permite injetar remetente e relógio nos testes.
// Consumido por composição futura do fluxo de acesso; não registra rotas nem bootstrap.
import { prisma } from "../database/prisma.database";
import { readEmailConfig } from "../config/email.config";
import { AccessRequestRepository } from "../repositories/access-request.repository";
import { EmailVerificationService } from "../services/email-verification.service";
import { SmtpEmailAdapter } from "../adapters/smtp-email.adapter";
import type { EmailSender } from "../models/email.model";

export type EmailVerificationFactoryOptions = {
  sender?: EmailSender;
  publicWebUrl?: string;
  clock?: () => Date;
};

export function makeEmailVerificationService(
  options: EmailVerificationFactoryOptions = {},
): EmailVerificationService {
  // Configuração SMTP só é necessária quando a factory precisa criar o adapter;
  // uma URL também pode vir da configuração quando o sender é injetado.
  const config = !options.sender || !options.publicWebUrl ? readEmailConfig() : undefined;
  const sender = options.sender ?? new SmtpEmailAdapter(config!.smtp);
  const publicWebUrl = options.publicWebUrl ?? config!.publicWebUrl;
  const requests = new AccessRequestRepository(prisma);
  return new EmailVerificationService(requests, sender, publicWebUrl, options.clock);
}
