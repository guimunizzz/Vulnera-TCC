import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

import { prisma } from "../src/database/prisma.database";

/**
 * Limpa todas as tabelas do banco de teste, na ordem que respeita as FKs
 * (filhos antes dos pais). Chamar em beforeEach/afterEach pra isolar testes.
 */
export async function cleanDatabase(): Promise<void> {
  await prisma.evidence.deleteMany();
  await prisma.vulnerabilityComment.deleteMany();
  await prisma.vulnerability.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.application.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.maturityScore.deleteMany();
  await prisma.maturityControl.deleteMany();
  await prisma.maturityDomain.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.plan.deleteMany();
}

afterAll(async () => {
  await prisma.$disconnect();
});
