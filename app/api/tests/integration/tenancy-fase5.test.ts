/**
 * tenancy-fase5.test.ts
 *
 * Canários de isolamento multi-tenant para TODA a superfície da Fase 5.
 * A regra de ouro do Vulnera é "nenhuma empresa enxerga dado de outra, em
 * nenhuma rota" (Contexto Mestre v4) — a Fase 5 tinha só o TEN-06, que cobria
 * apenas leitura de Vulnerability. Este arquivo fecha o resto.
 *
 * Dois vetores de ataque por recurso, porque são regras diferentes:
 *   - CLIENT da company B contra dado da company A  → RN16 (escopo por company)
 *   - PENTESTER sem ProjectMember no projeto        → RN17 (escopo por atribuição)
 *
 * Status esperado: 403 FORBIDDEN em todos. É o padrão que as Fases 3 e 4 já
 * usam (TEN-01..05) e o que o CLAUDE.md §9 define pra acesso negado. Ver a
 * seção de limitações conhecidas em docs/BACKLOG.md sobre a alternativa 404.
 *
 *   TEN-07  Evidence   · CLIENT cross-tenant       (list / download / upload)
 *   TEN-08  Evidence   · PENTESTER não-membro      (list / download / upload)
 *   TEN-09  Comment    · CLIENT cross-tenant       (list / create / delete)
 *   TEN-10  Comment    · PENTESTER não-membro      (list / create / delete)
 *   TEN-11  Vulnerability · CLIENT cross-tenant    (update / transition / override)
 *   TEN-12  Vulnerability · PENTESTER não-membro   (update / transition / override)
 */

import request from "supertest";
import * as fs from "fs";
import * as path from "path";
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
const UPLOADS_TEST_ROOT = path.resolve(process.cwd(), "uploads-test");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

/**
 * Monta o cenário completo dos canários:
 *   - company A com projeto, finding, evidência e comentário reais
 *   - company B com um CLIENT que não tem nada a ver com A
 *   - um PENTESTER sem ProjectMember em nenhum projeto
 *   - um PENTESTER membro do projeto de A (controle positivo)
 */
async function cenarioDuasCompanies() {
  const plan = await seedPlan({ name: "BASIC" });
  const companyA = await seedCompany({ name: "Company A", planId: plan.id });
  const companyB = await seedCompany({ name: "Company B", planId: plan.id });

  const applicationA = await seedApplication({ name: "App A", companyId: companyA.id });
  const projectA = await seedProject({ name: "Projeto A", applicationId: applicationA.id, companyId: companyA.id });

  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
  const adminToken = await loginAs(app, admin.email, PASSWORD);

  const vulnA = await seedVulnerability({
    projectId: projectA.id,
    applicationId: applicationA.id,
    companyId: companyA.id,
    createdBy: admin.id,
  });

  // CLIENT da company B — não deve enxergar NADA de A
  const clientB = await seedUser({
    name: "Client B",
    email: "clientB@vulnera.local",
    password: PASSWORD,
    role: "CLIENT",
    companyId: companyB.id,
    companyRole: "OWNER",
  });
  const clientBToken = await loginAs(app, clientB.email, PASSWORD);

  // PENTESTER sem atribuição em projeto nenhum
  const pentesterForaId = await seedUser({
    name: "Pentester Fora",
    email: "fora@vulnera.local",
    password: PASSWORD,
    role: "PENTESTER",
  });
  const pentesterForaToken = await loginAs(app, pentesterForaId.email, PASSWORD);

  // PENTESTER membro do projeto A — controle positivo (tem que conseguir)
  const pentesterMembro = await seedUser({
    name: "Pentester Membro",
    email: "membro@vulnera.local",
    password: PASSWORD,
    role: "PENTESTER",
  });
  await seedProjectMember(projectA.id, pentesterMembro.id);
  const pentesterMembroToken = await loginAs(app, pentesterMembro.email, PASSWORD);

  // evidência e comentário reais na vuln de A, criados pelo ADMIN
  const evidencia = await request(app)
    .post(`/api/vulnerabilities/${vulnA.id}/evidences`)
    .set("Authorization", `Bearer ${adminToken}`)
    .field("proof", "prova da company A")
    .attach("file", PNG, "print.png");

  const comentario = await request(app)
    .post(`/api/vulnerabilities/${vulnA.id}/comments`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ content: "Comentário interno da company A." });

  return {
    companyA,
    companyB,
    projectA,
    vulnA,
    admin,
    adminToken,
    clientBToken,
    pentesterForaToken,
    pentesterMembroToken,
    evidenciaId: evidencia.body.id as string,
    comentarioId: comentario.body.id as string,
  };
}

describe("Isolamento multi-tenant — Fase 5 completa (TEN-07..TEN-12)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(() => {
    fs.rmSync(UPLOADS_TEST_ROOT, { recursive: true, force: true });
  });

  // ==========================================================================
  // Evidence
  // ==========================================================================
  describe("TEN-07: Evidence — CLIENT da company B contra evidência da company A", () => {
    it("não lista, não baixa e não sobe evidência (403 em todas)", async () => {
      const c = await cenarioDuasCompanies();

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${c.clientBToken}`);
      expect(list.status).toBe(403);
      expect(list.body.error).toBe("FORBIDDEN");

      const download = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences/${c.evidenciaId}`)
        .set("Authorization", `Bearer ${c.clientBToken}`);
      expect(download.status).toBe(403);

      const upload = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${c.clientBToken}`)
        .attach("file", PNG, "invasao.png");
      expect(upload.status).toBe(403);
    });

    it("o CLIENT da própria company (A) lê normalmente — o bloqueio é por tenant, não por role", async () => {
      const c = await cenarioDuasCompanies();
      const clientA = await seedUser({
        name: "Client A",
        email: "clientA@vulnera.local",
        password: PASSWORD,
        role: "CLIENT",
        companyId: c.companyA.id,
        companyRole: "OWNER",
      });
      const tokenA = await loginAs(app, clientA.email, PASSWORD);

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${tokenA}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);

      const download = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences/${c.evidenciaId}`)
        .set("Authorization", `Bearer ${tokenA}`);
      expect(download.status).toBe(200);
    });
  });

  describe("TEN-08: Evidence — PENTESTER sem ProjectMember (RN17)", () => {
    it("não lista, não baixa e não sobe evidência (403 em todas)", async () => {
      const c = await cenarioDuasCompanies();

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`);
      expect(list.status).toBe(403);

      const download = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences/${c.evidenciaId}`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`);
      expect(download.status).toBe(403);

      const upload = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`)
        .attach("file", PNG, "invasao.png");
      expect(upload.status).toBe(403);
    });

    it("o PENTESTER MEMBRO do projeto faz tudo (controle positivo)", async () => {
      const c = await cenarioDuasCompanies();

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`);
      expect(list.status).toBe(200);

      const upload = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/evidences`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`)
        .attach("file", PNG, "print.png");
      expect(upload.status).toBe(201);
    });
  });

  // ==========================================================================
  // VulnerabilityComment
  // ==========================================================================
  describe("TEN-09: Comment — CLIENT da company B contra finding da company A", () => {
    it("não lista, não cria e não apaga comentário (403 em todas)", async () => {
      const c = await cenarioDuasCompanies();

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${c.clientBToken}`);
      expect(list.status).toBe(403);
      expect(list.body.error).toBe("FORBIDDEN");

      const create = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${c.clientBToken}`)
        .send({ content: "Comentário de quem não deveria estar aqui." });
      expect(create.status).toBe(403);

      const del = await request(app)
        .delete(`/api/vulnerabilities/${c.vulnA.id}/comments/${c.comentarioId}`)
        .set("Authorization", `Bearer ${c.clientBToken}`);
      expect(del.status).toBe(403);

      // o comentário continua lá — o DELETE não teve efeito colateral
      const aindaExiste = await prisma.vulnerabilityComment.findUnique({ where: { id: c.comentarioId } });
      expect(aindaExiste).not.toBeNull();
    });

    it("o CLIENT da própria company (A) lê e comenta — RN: comentar é canal de comunicação", async () => {
      const c = await cenarioDuasCompanies();
      const clientA = await seedUser({
        name: "Client A",
        email: "clientA@vulnera.local",
        password: PASSWORD,
        role: "CLIENT",
        companyId: c.companyA.id,
        companyRole: "OWNER",
      });
      const tokenA = await loginAs(app, clientA.email, PASSWORD);

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${tokenA}`);
      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);

      const create = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ content: "Dúvida do cliente sobre a correção proposta." });
      expect(create.status).toBe(201);

      // mas não apaga comentário de OUTRO autor (só autor ou ADMIN)
      const del = await request(app)
        .delete(`/api/vulnerabilities/${c.vulnA.id}/comments/${c.comentarioId}`)
        .set("Authorization", `Bearer ${tokenA}`);
      expect(del.status).toBe(403);
    });
  });

  describe("TEN-10: Comment — PENTESTER sem ProjectMember (RN17)", () => {
    it("não lista, não cria e não apaga comentário (403 em todas)", async () => {
      const c = await cenarioDuasCompanies();

      const list = await request(app)
        .get(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`);
      expect(list.status).toBe(403);

      const create = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`)
        .send({ content: "Não deveria entrar." });
      expect(create.status).toBe(403);

      const del = await request(app)
        .delete(`/api/vulnerabilities/${c.vulnA.id}/comments/${c.comentarioId}`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`);
      expect(del.status).toBe(403);
    });

    it("o PENTESTER MEMBRO comenta normalmente (controle positivo)", async () => {
      const c = await cenarioDuasCompanies();

      const create = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/comments`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`)
        .send({ content: "Reproduzi o payload no ambiente de homologação." });
      expect(create.status).toBe(201);

      // e apaga o PRÓPRIO comentário
      const del = await request(app)
        .delete(`/api/vulnerabilities/${c.vulnA.id}/comments/${create.body.id}`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`);
      expect(del.status).toBe(204);
    });
  });

  // ==========================================================================
  // Vulnerability — escrita
  // ==========================================================================
  describe("TEN-11: Vulnerability — CLIENT da company B contra finding da company A", () => {
    it("não atualiza, não transiciona e não faz override (403 em todas)", async () => {
      const c = await cenarioDuasCompanies();

      const update = await request(app)
        .put(`/api/vulnerabilities/${c.vulnA.id}`)
        .set("Authorization", `Bearer ${c.clientBToken}`)
        .send({ title: "Título sequestrado" });
      expect(update.status).toBe(403);
      expect(update.body.error).toBe("FORBIDDEN");

      const transition = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/transition`)
        .set("Authorization", `Bearer ${c.clientBToken}`)
        .send({ toStatus: "IN_PROGRESS" });
      expect(transition.status).toBe(403);

      const override = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/override-severity`)
        .set("Authorization", `Bearer ${c.clientBToken}`)
        .send({ newSeverity: "LOW", justification: "Justificativa com mais de vinte caracteres." });
      expect(override.status).toBe(403);

      // nada mudou no registro
      const intacta = await prisma.vulnerability.findUnique({ where: { id: c.vulnA.id } });
      expect(intacta!.title).toBe("SQL Injection em /login");
      expect(intacta!.status).toBe("OPEN");
      expect(intacta!.severityFinal).toBe("CRITICAL");
      expect(intacta!.severityOverrideReason).toBeNull();
    });

    it("nem deleta (DELETE é ADMIN-only e o finding é de outra company)", async () => {
      const c = await cenarioDuasCompanies();

      const del = await request(app)
        .delete(`/api/vulnerabilities/${c.vulnA.id}`)
        .set("Authorization", `Bearer ${c.clientBToken}`);
      expect(del.status).toBe(403);

      const aindaExiste = await prisma.vulnerability.findUnique({ where: { id: c.vulnA.id } });
      expect(aindaExiste).not.toBeNull();
    });
  });

  describe("TEN-12: Vulnerability — PENTESTER sem ProjectMember (RN17)", () => {
    it("não atualiza, não transiciona e não faz override (403 em todas)", async () => {
      const c = await cenarioDuasCompanies();

      const update = await request(app)
        .put(`/api/vulnerabilities/${c.vulnA.id}`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`)
        .send({ title: "Título sequestrado" });
      expect(update.status).toBe(403);

      const transition = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/transition`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`)
        .send({ toStatus: "IN_PROGRESS" });
      expect(transition.status).toBe(403);

      const override = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/override-severity`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`)
        .send({ newSeverity: "LOW", justification: "Justificativa com mais de vinte caracteres." });
      expect(override.status).toBe(403);
    });

    it("não vê o finding nem pela listagem por projeto (RN17 no listByProject)", async () => {
      const c = await cenarioDuasCompanies();

      const porProjeto = await request(app)
        .get(`/api/vulnerabilities?projectId=${c.projectA.id}`)
        .set("Authorization", `Bearer ${c.pentesterForaToken}`);
      expect(porProjeto.status).toBe(403);

      // e a listagem geral dele vem vazia, não com o finding de A
      const geral = await request(app)
        .get("/api/vulnerabilities")
        .set("Authorization", `Bearer ${c.pentesterForaToken}`);
      expect(geral.status).toBe(200);
      expect(geral.body).toHaveLength(0);
    });

    it("o PENTESTER MEMBRO atualiza, transiciona e faz override (controle positivo)", async () => {
      const c = await cenarioDuasCompanies();

      const update = await request(app)
        .put(`/api/vulnerabilities/${c.vulnA.id}`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`)
        .send({ title: "SQL Injection em /login (confirmado)" });
      expect(update.status).toBe(200);

      const transition = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/transition`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`)
        .send({ toStatus: "IN_PROGRESS" });
      expect(transition.status).toBe(200);

      const override = await request(app)
        .post(`/api/vulnerabilities/${c.vulnA.id}/override-severity`)
        .set("Authorization", `Bearer ${c.pentesterMembroToken}`)
        .send({ newSeverity: "HIGH", justification: "Exploração exige credencial válida de operador." });
      expect(override.status).toBe(200);
      expect(override.body.severityFinal).toBe("HIGH");
    });
  });

  // ==========================================================================
  // Mass assignment — o companyId nunca vem do corpo da requisição
  // ==========================================================================
  describe("TEN-13: campos de tenancy não são aceitos do corpo da requisição", () => {
    it("PUT com companyId/projectId/applicationId de outra company é ignorado", async () => {
      const c = await cenarioDuasCompanies();

      const res = await request(app)
        .put(`/api/vulnerabilities/${c.vulnA.id}`)
        .set("Authorization", `Bearer ${c.adminToken}`)
        .send({
          title: "Título legítimo",
          // tentativa de mover o finding pra outra company
          companyId: c.companyB.id,
          projectId: "projeto-inventado",
          applicationId: "app-inventado",
          // e de forjar a severidade sem passar pelo override justificado
          severityFinal: "LOW",
          severityCalculated: "LOW",
          cvssScore: 0.1,
          severityOverrideReason: "burlado",
        });
      expect(res.status).toBe(200);

      const depois = await prisma.vulnerability.findUnique({ where: { id: c.vulnA.id } });
      expect(depois!.title).toBe("Título legítimo"); // o campo legítimo passou
      expect(depois!.companyId).toBe(c.companyA.id); // tenancy intacta
      expect(depois!.projectId).toBe(c.projectA.id);
      expect(depois!.severityFinal).toBe("CRITICAL"); // severidade não forjada
      expect(depois!.cvssScore).toBe(9.8);
      expect(depois!.severityOverrideReason).toBeNull();
    });

    it("POST com companyId/applicationId no corpo herda do Project, não do que foi enviado (RN09)", async () => {
      const c = await cenarioDuasCompanies();

      const res = await request(app)
        .post("/api/vulnerabilities")
        .set("Authorization", `Bearer ${c.adminToken}`)
        .send({
          projectId: c.projectA.id,
          title: "XSS refletido",
          description: "Parâmetro q refletido sem escape.",
          owaspCategory: "A03",
          cvssVector: "AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
          companyId: c.companyB.id, // ignorado
          applicationId: "app-inventado", // ignorado
          severityFinal: "CRITICAL", // ignorado — vem do CVSS
          cvssScore: 10, // ignorado — recalculado
        });
      expect(res.status).toBe(201);
      expect(res.body.companyId).toBe(c.companyA.id);
      expect(res.body.severityFinal).toBe("MEDIUM"); // 6.1 do vetor informado
      expect(res.body.cvssScore).toBe(6.1);
    });
  });
});
