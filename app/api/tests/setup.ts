import * as dotenv from "dotenv";
import * as path from "path";

// quiet: true silencia o banner promocional que o dotenv 17.x imprime a cada
// carga ("◇ injected env (N) from .env.test // tip: ..."). Fica aqui, no
// código versionado, e não numa variável de ambiente — .env* está no
// .gitignore, então quem clonasse o repo veria o banner de novo na saída dos
// testes (e ela vira screenshot de evidência do TCC).
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), quiet: true });

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
  // MaturityAssessment.companyId não tem FK declarada no schema (é só uma
  // String), então nunca dava erro de constraint por faltar aqui — mas sem
  // isso, cada teste que cria uma avaliação deixava a linha órfã pra sempre
  // no banco de teste (o cascade em MaturityScore só anda nessa direção:
  // apagar o assessment apaga os scores, não o contrário).
  await prisma.maturityAssessment.deleteMany();
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
