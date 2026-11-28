/**
 * Canários independentes de isolamento e permissões para a wave B2B.
 * Exercita requests HTTP e confirma que recusas não alteram dados ou auditorias.
 * Consumido pelo Jest de integração contra o schema MySQL descartável.
 */

import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma.database";
import { loginAs } from "../fixtures/auth.fixture";
import {
  seedTenantSecurityWaveFixture,
  TENANT_SECURITY_WAVE_PASSWORD,
} from "../fixtures/tenant-security-wave.fixture";
import { cleanDatabase } from "../setup";

let wave: Awaited<ReturnType<typeof seedTenantSecurityWaveFixture>>;

beforeEach(async () => {
  await cleanDatabase();
  wave = await seedTenantSecurityWaveFixture();
});

describe("canários independentes da wave de tenant security", () => {
  it("mantém listagens e acesso direto no tenant e no ProjectMember persistidos", async () => {
    const [ownerAToken, memberAToken, ownerBToken, memberBToken, pentesterToken, unassignedToken, adminToken, legacyToken] =
      await Promise.all([
        loginAs(app, wave.ownerA.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.memberA.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.ownerB.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.memberB.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.pentesterAssigned.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.pentesterUnassigned.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.admin.email, TENANT_SECURITY_WAVE_PASSWORD),
        loginAs(app, wave.legacyClient.email, TENANT_SECURITY_WAVE_PASSWORD),
      ]);

    const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
    for (const token of [ownerAToken, memberAToken]) {
      const applications = await request(app)
        .get("/api/applications")
        .set("Authorization", `Bearer ${token}`);
      expect(applications.status).toBe(200);
      expect(ids(applications.body)).toEqual(expect.arrayContaining([
        wave.applicationA.id,
        wave.applicationAWithoutProject.id,
      ]));
      expect(ids(applications.body)).not.toContain(wave.applicationB.id);
      expect(JSON.stringify(applications.body)).not.toContain(wave.applicationB.name);

      const projects = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${token}`);
      expect(projects.status).toBe(200);
      expect(ids(projects.body)).toEqual([wave.projectA.id]);

      const foreignProject = await request(app)
        .get(`/api/projects/${wave.projectB.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(foreignProject.status).toBe(403);
      expect(foreignProject.body.error).toBe("FORBIDDEN");
      expect(JSON.stringify(foreignProject.body)).not.toContain(wave.projectB.name);
    }

    for (const token of [ownerBToken, memberBToken]) {
      const companyBProjects = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${token}`);
      expect(companyBProjects.status).toBe(200);
      expect(ids(companyBProjects.body)).toEqual([wave.projectB.id]);

      const foreignProject = await request(app)
        .get(`/api/projects/${wave.projectA.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(foreignProject.status).toBe(403);
      expect(foreignProject.body.error).toBe("FORBIDDEN");
      expect(JSON.stringify(foreignProject.body)).not.toContain(wave.projectA.name);
    }

    const assignedProjects = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${pentesterToken}`);
    expect(assignedProjects.status).toBe(200);
    expect(ids(assignedProjects.body)).toEqual([wave.projectA.id]);
    const unassignedProjects = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${unassignedToken}`);
    expect(unassignedProjects.status).toBe(200);
    expect(unassignedProjects.body).toEqual([]);

    const pentesterForeignProject = await request(app)
      .get(`/api/projects/${wave.projectB.id}`)
      .set("Authorization", `Bearer ${pentesterToken}`);
    expect(pentesterForeignProject.status).toBe(403);

    const adminProjects = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminProjects.status).toBe(200);
    expect(ids(adminProjects.body)).toEqual(expect.arrayContaining([wave.projectA.id, wave.projectB.id]));

    const legacyProjects = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${legacyToken}`);
    expect(legacyProjects.status).toBe(200);
    expect(legacyProjects.body).toEqual([]);

    const anonymous = await request(app).get(`/api/applications/${wave.applicationA.id}`);
    expect(wave.anonymous.authorization).toBeUndefined();
    expect(anonymous.status).toBe(401);
  });

  it("permite a operação de projeto do MEMBER dentro da empresa e neutraliza ID de tenant enviado pelo cliente", async () => {
    const memberToken = await loginAs(app, wave.memberA.email, TENANT_SECURITY_WAVE_PASSWORD);
    const foreignProjectCountBefore = await prisma.project.count({ where: { companyId: wave.companyB.id } });
    const foreignAuditCountBefore = await prisma.auditLog.count({ where: { companyId: wave.companyB.id } });

    const allowed = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        applicationId: wave.applicationAWithoutProject.id,
        name: "Project criado pelo MEMBER",
        companyId: wave.companyB.id,
        ownerId: wave.ownerB.id,
        status: "COMPLETED",
      });
    expect(allowed.status).toBe(201);
    expect(allowed.body).toMatchObject({
      applicationId: wave.applicationAWithoutProject.id,
      companyId: wave.companyA.id,
      status: "PENDING",
    });
    expect(allowed.body).not.toHaveProperty("ownerId");
    const totalAuditCountBeforeDeniedRequests = await prisma.auditLog.count();

    const foreignCreate = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ applicationId: wave.applicationB.id, name: "Cross tenant project" });
    expect(foreignCreate.status).toBe(403);
    expect(foreignCreate.body.error).toBe("FORBIDDEN");

    const foreignUpdate = await request(app)
      .put(`/api/projects/${wave.projectB.id}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Nome alterado pelo tenant A", companyId: wave.companyA.id });
    expect(foreignUpdate.status).toBe(403);
    expect(foreignUpdate.body.error).toBe("FORBIDDEN");

    expect(await prisma.project.count({ where: { companyId: wave.companyB.id } })).toBe(foreignProjectCountBefore);
    expect(await prisma.auditLog.count()).toBe(totalAuditCountBeforeDeniedRequests);
    expect(await prisma.project.findUnique({ where: { id: wave.projectB.id } })).toMatchObject({
      name: wave.projectB.name,
      companyId: wave.companyB.id,
      applicationId: wave.applicationB.id,
    });
    expect(await prisma.auditLog.count({ where: { companyId: wave.companyB.id } })).toBe(foreignAuditCountBefore);
  });

  it("filtra o report-data por empresa e atribuição sem registrar efeitos de leitura", async () => {
    const [ownerAToken, pentesterToken, unassignedToken, adminToken] = await Promise.all([
      loginAs(app, wave.ownerA.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.pentesterAssigned.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.pentesterUnassigned.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.admin.email, TENANT_SECURITY_WAVE_PASSWORD),
    ]);
    const auditCountBefore = await prisma.auditLog.count({ where: { companyId: wave.companyB.id } });
    const totalAuditCountBefore = await prisma.auditLog.count();

    const denied = await request(app)
      .get(`/api/projects/${wave.projectB.id}/report-data`)
      .set("Authorization", `Bearer ${ownerAToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("FORBIDDEN");
    expect(JSON.stringify(denied.body)).not.toContain(wave.vulnerabilityB.title);

    const pentesterAllowed = await request(app)
      .get(`/api/projects/${wave.projectA.id}/report-data`)
      .set("Authorization", `Bearer ${pentesterToken}`);
    expect(pentesterAllowed.status).toBe(200);
    expect(pentesterAllowed.body.company.name).toBe(wave.companyA.name);
    expect(pentesterAllowed.body.vulnerabilities.map((row: { id: string }) => row.id))
      .toContain(wave.vulnerabilityA.id);
    expect(JSON.stringify(pentesterAllowed.body)).not.toContain(wave.vulnerabilityB.title);

    const pentesterDenied = await request(app)
      .get(`/api/projects/${wave.projectA.id}/report-data`)
      .set("Authorization", `Bearer ${unassignedToken}`);
    expect(pentesterDenied.status).toBe(403);

    const adminAllowed = await request(app)
      .get(`/api/projects/${wave.projectB.id}/report-data`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminAllowed.status).toBe(200);
    expect(adminAllowed.body.company.name).toBe(wave.companyB.name);
    expect(adminAllowed.body.vulnerabilities.map((row: { id: string }) => row.id))
      .toContain(wave.vulnerabilityB.id);
    expect(await prisma.auditLog.count({ where: { companyId: wave.companyB.id } })).toBe(auditCountBefore);
    expect(await prisma.auditLog.count()).toBe(totalAuditCountBefore);
  });
});
