import request from "supertest";
import * as fs from "fs";
import * as path from "path";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

// PNG real (assinatura completa de 8 bytes) + padding — o service só olha
// os 4 primeiros bytes, mas usar a assinatura inteira deixa o teste realista.
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);
// Cabeçalho MZ/PE (executável Windows) — não bate com nenhuma assinatura
// aceita e não decodifica como UTF-8 válido (0x90 é byte de continuação
// sem líder válido antes).
const EXE_BUFFER = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);

const UPLOADS_TEST_ROOT = path.resolve(process.cwd(), "uploads-test");

async function setupVulnerability() {
  const plan = await seedPlan({ name: "BASIC" });
  const company = await seedCompany({ name: "Acme", planId: plan.id });
  const application = await seedApplication({ name: "App 1", companyId: company.id });
  const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });
  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
  const adminToken = await loginAs(app, admin.email, PASSWORD);
  const vulnerability = await seedVulnerability({
    projectId: project.id,
    applicationId: application.id,
    companyId: company.id,
    createdBy: admin.id,
  });
  return { plan, company, application, project, admin, adminToken, vulnerability };
}

describe("Evidence (upload multipart + download)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(() => {
    // limpeza do volume de teste — não faz sentido acumular entre execuções
    fs.rmSync(UPLOADS_TEST_ROOT, { recursive: true, force: true });
  });

  // BIZ-09 (parte 1) — upload de .exe é rejeitado por magic number, mesmo sem extensão .exe no nome
  it("upload de executável (.exe) retorna 400 INVALID_FILE_TYPE", async () => {
    const { vulnerability, adminToken } = await setupVulnerability();

    const res = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", EXE_BUFFER, "payload.exe");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_FILE_TYPE");
  });

  // BIZ-09 (parte 2) — upload de PNG válido é aceito, gravado em disco com nome UUID
  it("upload de PNG válido retorna 201, grava em uploads/{companyId}/{vulnId}/ com nome UUID", async () => {
    const { vulnerability, company, adminToken } = await setupVulnerability();

    const res = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("proof", "Screenshot do payload refletido no response.")
      .attach("file", PNG_BUFFER, "screenshot.png");

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe("image/png");
    expect(res.body.originalName).toBe("screenshot.png");
    expect(res.body.fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(res.body.sizeBytes).toBe(PNG_BUFFER.length);
    expect(res.body).not.toHaveProperty("filePath"); // detalhe interno nunca vaza na resposta

    const expectedPath = path.join(UPLOADS_TEST_ROOT, company.id, vulnerability.id, res.body.fileName);
    expect(fs.existsSync(expectedPath)).toBe(true);
    expect(fs.readFileSync(expectedPath)).toEqual(PNG_BUFFER);
  });

  it("declarar Content-Type errado não engana a validação — magic number manda, não o header declarado", async () => {
    const { vulnerability, adminToken } = await setupVulnerability();

    // arquivo é na verdade um .exe, mas o cliente declara como PNG
    const res = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", EXE_BUFFER, { filename: "fake.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_FILE_TYPE");
  });

  it("arquivo acima de 10MB retorna 400 FILE_TOO_LARGE", async () => {
    const { vulnerability, adminToken } = await setupVulnerability();
    const oversized = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(10 * 1024 * 1024 + 1),
    ]);

    const res = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", oversized, "grande.png");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("FILE_TOO_LARGE");
  }, 15000);

  it("CLIENT não faz upload (403 FORBIDDEN), mas lista e baixa evidências (read-only)", async () => {
    const { vulnerability, company, adminToken } = await setupVulnerability();
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const clientToken = await loginAs(app, client.email, PASSWORD);

    const uploadRes = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${clientToken}`)
      .attach("file", PNG_BUFFER, "print.png");
    expect(uploadRes.status).toBe(403);

    const created = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", PNG_BUFFER, "print.png");
    expect(created.status).toBe(201);

    const listRes = await request(app)
      .get(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const downloadRes = await request(app)
      .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${created.body.id}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(downloadRes.status).toBe(200);
  });

  it("PENTESTER não-membro não vê nem baixa evidência de projeto alheio (TEN-06 aplicado a Evidence)", async () => {
    const { vulnerability, adminToken } = await setupVulnerability();
    const created = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", PNG_BUFFER, "print.png");
    expect(created.status).toBe(201);

    const outsider = await seedUser({
      name: "Pentester Fora",
      email: "outsider@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const outsiderToken = await loginAs(app, outsider.email, PASSWORD);

    const listRes = await request(app)
      .get(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(listRes.status).toBe(403);

    const downloadRes = await request(app)
      .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${created.body.id}`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(downloadRes.status).toBe(403);
  });

  it("upload de .txt válido (UTF-8) é aceito; conteúdo binário disfarçado de .txt é rejeitado", async () => {
    const { vulnerability, adminToken } = await setupVulnerability();

    const validText = Buffer.from("Request completo:\nGET /api/users?id=1' OR '1'='1\n", "utf-8");
    const validRes = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", validText, "request.txt");
    expect(validRes.status).toBe(201);
    expect(validRes.body.mimeType).toBe("text/plain");

    const binaryAsText = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", EXE_BUFFER, "log.txt");
    expect(binaryAsText.status).toBe(400);
    expect(binaryAsText.body.error).toBe("INVALID_FILE_TYPE");
  });

  it("PENTESTER membro do Project faz upload normalmente (201)", async () => {
    const { vulnerability, project } = await setupVulnerability();
    const member = await seedUser({
      name: "Pentester Membro",
      email: "member@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    await seedProjectMember(project.id, member.id);
    const memberToken = await loginAs(app, member.email, PASSWORD);

    const res = await request(app)
      .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
      .set("Authorization", `Bearer ${memberToken}`)
      .attach("file", PNG_BUFFER, "print.png");
    expect(res.status).toBe(201);
  });
});
