import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

/** Company + application + project (IN_REVIEW, pronto pra relatório) + admin logado. */
async function setupReadyProject() {
  const plan = await seedPlan({ name: "BASIC" });
  const company = await seedCompany({ name: "Acme", planId: plan.id });
  const application = await seedApplication({ name: "App 1", companyId: company.id });
  const project = await seedProject({
    name: "Projeto 1",
    applicationId: application.id,
    companyId: company.id,
    status: "IN_REVIEW",
  });
  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
  const token = await loginAs(app, admin.email, PASSWORD);
  return { plan, company, application, project, admin, token };
}

describe("Report (report-data + metadata)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // RPT-01 — os números do report-data batem com o que está no banco
  it("GET /api/projects/:id/report-data: stats, byOwasp e topRisks batem com o banco", async () => {
    const { project, application, company, admin, token } = await setupReadyProject();

    await seedVulnerability({
      projectId: project.id,
      applicationId: application.id,
      companyId: company.id,
      createdBy: admin.id,
      title: "SQL Injection",
      owaspCategory: "A03",
      cvssVector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      cvssScore: 9.8,
      severityCalculated: "CRITICAL",
      severityFinal: "CRITICAL",
      status: "OPEN",
    });
    await seedVulnerability({
      projectId: project.id,
      applicationId: application.id,
      companyId: company.id,
      createdBy: admin.id,
      title: "Cabeçalho ausente",
      owaspCategory: "A05",
      cvssVector: "AV:A/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:N",
      cvssScore: 5.1,
      severityCalculated: "MEDIUM",
      severityFinal: "MEDIUM",
      status: "FIXED",
    });
    await seedVulnerability({
      projectId: project.id,
      applicationId: application.id,
      companyId: company.id,
      createdBy: admin.id,
      title: "Componente desatualizado",
      owaspCategory: "A06",
      cvssVector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L",
      cvssScore: 3.7,
      severityCalculated: "LOW",
      severityFinal: "LOW",
      status: "OPEN",
    });

    const res = await request(app)
      .get(`/api/projects/${project.id}/report-data`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(project.id);
    expect(res.body.company.id).toBe(company.id);
    expect(res.body.application.id).toBe(application.id);
    expect(res.body.stats.total).toBe(3);
    expect(res.body.stats.bySeverity.CRITICAL).toBe(1);
    expect(res.body.stats.bySeverity.MEDIUM).toBe(1);
    expect(res.body.stats.bySeverity.LOW).toBe(1);
    expect(res.body.stats.byStatus.OPEN).toBe(2);
    expect(res.body.stats.byStatus.FIXED).toBe(1);
    expect(res.body.stats.byOwasp.A03).toBe(1);
    expect(res.body.stats.byOwasp.A05).toBe(1);
    expect(res.body.stats.byOwasp.A06).toBe(1);
    // topRisks ordenado por cvssScore desc
    expect(res.body.topRisks).toHaveLength(3);
    expect(res.body.topRisks[0].title).toBe("SQL Injection");
    expect(res.body.topRisks[0].cvssScore).toBe(9.8);
    expect(res.body.topRisks[2].title).toBe("Componente desatualizado");
    expect(res.body.maturity).toBeNull();
    // 🚧 [FUTURO] Fase 8 — maturity fica null até lá
  });

  // RN18 — Project ainda não está em IN_REVIEW/COMPLETED
  it("GET /api/projects/:id/report-data: Project PENDING retorna 422 PROJECT_NOT_READY_FOR_REPORT", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id }); // status default PENDING
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .get(`/api/projects/${project.id}/report-data`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("PROJECT_NOT_READY_FOR_REPORT");
  });

  // RPT-02 — TEN: vulnerability/report de uma company não vaza pra outra
  it("GET /api/projects/:id/report-data: CLIENT de outra company recebe 403", async () => {
    const { project } = await setupReadyProject();

    const plan2 = await seedPlan({ name: "PRO" });
    const otherCompany = await seedCompany({ name: "Other Corp", planId: plan2.id });
    const outsider = await seedUser({
      name: "Cliente Outsider",
      email: "outsider@other.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: otherCompany.id,
      companyRole: "OWNER",
    });
    const outsiderToken = await loginAs(app, outsider.email, PASSWORD);

    const res = await request(app)
      .get(`/api/projects/${project.id}/report-data`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  // RPT-03 — pentester não-membro do projeto recebe 403
  it("GET /api/projects/:id/report-data: PENTESTER não-membro recebe 403", async () => {
    const { project } = await setupReadyProject();

    const pentester = await seedUser({
      name: "Pentester Estranho",
      email: "outro-pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const pentesterToken = await loginAs(app, pentester.email, PASSWORD);

    const res = await request(app)
      .get(`/api/projects/${project.id}/report-data`)
      .set("Authorization", `Bearer ${pentesterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("PENTESTER membro do projeto consegue ver o report-data", async () => {
    const { project } = await setupReadyProject();

    const pentester = await seedUser({
      name: "Pentester Membro",
      email: "membro@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    await seedProjectMember(project.id, pentester.id);
    const pentesterToken = await loginAs(app, pentester.email, PASSWORD);

    const res = await request(app)
      .get(`/api/projects/${project.id}/report-data`)
      .set("Authorization", `Bearer ${pentesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(project.id);
  });

  // POST /api/reports — registra metadado + AuditLog REPORT_GENERATED
  it("POST /api/reports: registra o metadado e gera AuditLog REPORT_GENERATED", async () => {
    const { project, token } = await setupReadyProject();

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: project.id, type: "EXECUTIVE" });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe(project.id);
    expect(res.body.type).toBe("EXECUTIVE");
    expect(res.body.title).toContain("Executivo");

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Report", entityId: res.body.id, action: "REPORT_GENERATED" },
    });
    expect(log).not.toBeNull();
    expect(log?.companyId).toBe(project.companyId);
  });

  it("POST /api/reports: Project não pronto retorna 422; tipo inválido retorna 400", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const notReady = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: project.id, type: "EXECUTIVE" });
    expect(notReady.status).toBe(422);
    expect(notReady.body.error).toBe("PROJECT_NOT_READY_FOR_REPORT");

    await prisma.project.update({ where: { id: project.id }, data: { status: "IN_REVIEW" } });

    const badType = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: project.id, type: "BOGUS" });
    expect(badType.status).toBe(400);
    expect(badType.body.error).toBe("INVALID_TYPE");
  });

  // GET /api/reports?projectId= — histórico de gerações
  it("GET /api/reports?projectId=: lista as gerações anteriores, mais recente primeiro", async () => {
    const { project, token } = await setupReadyProject();

    await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: project.id, type: "EXECUTIVE" });
    await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: project.id, type: "TECHNICAL" });

    const res = await request(app)
      .get("/api/reports")
      .query({ projectId: project.id })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].type).toBe("TECHNICAL"); // mais recente primeiro
  });

  it("GET /api/reports sem projectId retorna 400 MISSING_PROJECT_ID", async () => {
    const { token } = await setupReadyProject();

    const res = await request(app).get("/api/reports").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("MISSING_PROJECT_ID");
  });
});
