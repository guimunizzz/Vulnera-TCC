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
  // DastFinding antes de DastScan (FK cascade cuidaria disso, mas explícito é
  // mais seguro); DastScan antes de User — requestedById é RESTRICT, não
  // CASCADE (deletar user com scan pendurado quebraria a constraint).
  await prisma.dastFinding.deleteMany();
  await prisma.dastScan.deleteMany();
  // RiskAcceptance (CP-4) antes de Vulnerability — FK Cascade cuidaria, mas
  // explícito é mais seguro e mantém a ordem legível de cima para baixo.
  await prisma.riskAcceptance.deleteMany();
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
  // SlaPolicy (CP-2) tem FK Cascade pra Company — o cascade limparia, mas
  // explícito é mais seguro, e a política PADRÃO (companyId = null) não é
  // alcançada por cascade nenhum: sem esta linha ela sobreviveria entre testes.
  await prisma.slaPolicy.deleteMany();
  // RemediationPlaybook (CP-5): o custom tem FK Cascade pra Company, mas o
  // System (companyId = null) não é alcançado por cascade nenhum — sem esta
  // linha o catálogo semeado vazaria de um teste para o outro.
  // SavedQuery (CP-6) tem FK Cascade para User; explícito mantém a ordem
  // legível e não depende do cascade para a limpeza entre testes.
  await prisma.savedQuery.deleteMany();
  await prisma.remediationPlaybook.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.plan.deleteMany();
}

afterAll(async () => {
  await prisma.$disconnect();
});
