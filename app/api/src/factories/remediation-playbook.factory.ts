/**
 * remediation-playbook.factory.ts
 *
 * FACTORY METHOD (GoF) do catálogo de remediação — CP-5.
 * Monta Repository -> Service -> Controller e devolve o controller pronto.
 * Único consumidor do controller: routes/remediation-playbook.routes.ts.
 *
 * `makeOwaspSyncService` fica aqui separada porque o consumidor dela NÃO é uma
 * rota: é o script `npm run sync:owasp-playbooks` e o seed offline. Não existe
 * controller de sync de propósito (docs/DECISIONS.md D5) — um fetch ao GitHub
 * dentro de um request transformaria indisponibilidade do GitHub em
 * indisponibilidade do Vulnera.
 *
 * 💡 Trocar o repository por um mock em teste = trocar uma linha aqui.
 */

import { prisma } from "../database/prisma.database";
import { RemediationPlaybookRepository } from "../repositories/remediation-playbook.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { RemediationPlaybookService } from "../services/remediation-playbook.service";
import { OwaspSyncService } from "../services/owasp-sync.service";
import { RemediationPlaybookController } from "../controllers/remediation-playbook.controller";

/** Exposto além do controller porque o finding detail resolve playbooks por categoria. */
export function makeRemediationPlaybookService(): RemediationPlaybookService {
  return new RemediationPlaybookService(
    new RemediationPlaybookRepository(prisma),
    new UserRepository(prisma),
    new AuditLogRepository(prisma),
  );
}

export function makeRemediationPlaybookController(): RemediationPlaybookController {
  return new RemediationPlaybookController(makeRemediationPlaybookService());
}

/** Consumidores: `prisma/seed-playbooks.ts` e `scripts/sync-owasp-playbooks.ts`. */
export function makeOwaspSyncService(): OwaspSyncService {
  return new OwaspSyncService(new RemediationPlaybookRepository(prisma));
}
