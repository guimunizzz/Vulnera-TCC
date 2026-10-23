/**
 * findings-export-limit.test.ts
 *
 * O teto de linhas da exportação (EXPORT_MAX_ROWS). Arquivo à parte porque o
 * limite é lido da env quando a rota é montada — aqui ele vale 2.
 *
 *   FX-L-01  acima do limite: 422 com limite e total, sem arquivo e sem auditoria
 *   FX-L-02  exatamente no limite: exporta
 *   FX-L-03  um filtro que traz o recorte para dentro do limite volta a exportar
 *   FX-L-04  a recusa vale para qualquer papel, e a contagem respeita o escopo
 */

import type { Express } from "express";

process.env.EXPORT_MAX_ROWS = "2";
// `require` (e não `import`) para garantir que a env acima já existe quando a rota é montada.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app") as { app: Express };

import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { exportarXlsx, linhasDeFindings } from "../fixtures/xlsx.fixture";

const SENHA = "senha12345";

async function montar(totalA: number, totalB = 0) {
  const plan = await seedPlan({ name: "BASIC" });
  const alfa = await seedCompany({ name: "Alfa", planId: plan.id });
  const beta = await seedCompany({ name: "Beta", planId: plan.id });
  const appA = await seedApplication({ name: "App A", companyId: alfa.id });
  const appB = await seedApplication({ name: "App B", companyId: beta.id });
  const projA = await seedProject({ name: "PA", applicationId: appA.id, companyId: alfa.id });
  const projB = await seedProject({ name: "PB", applicationId: appB.id, companyId: beta.id });
  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: SENHA, role: "ADMIN" });
  const clientA = await seedUser({ name: "Cli A", email: "a@alfa.local", password: SENHA, role: "CLIENT", companyId: alfa.id });
  for (let i = 0; i < totalA; i++) {
    await seedVulnerability({ projectId: projA.id, applicationId: appA.id, companyId: alfa.id, createdBy: admin.id, title: `A${i}`, severityFinal: i === 0 ? "LOW" : "HIGH", severityCalculated: i === 0 ? "LOW" : "HIGH" });
  }
  for (let i = 0; i < totalB; i++) {
    await seedVulnerability({ projectId: projB.id, applicationId: appB.id, companyId: beta.id, createdBy: admin.id, title: `B${i}` });
  }
  return { adminToken: await loginAs(app, admin.email, SENHA), clientAToken: await loginAs(app, clientA.email, SENHA) };
}

describe("Exportação Excel · limite de linhas", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("FX-L-01 acima do limite: 422 com limite e total — sem arquivo e sem auditoria", async () => {
    const { adminToken } = await montar(3);
    const r = await exportarXlsx(app, adminToken);
    expect(r.status).toBe(422);
    expect(r.json).toEqual({ error: "EXPORT_LIMIT_EXCEEDED", limit: 2, total: 3 });
    expect(r.wb).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "FINDINGS_EXPORTED" } })).toBe(0);
  });

  it("FX-L-02 exatamente no limite exporta", async () => {
    const { adminToken } = await montar(2);
    const r = await exportarXlsx(app, adminToken);
    expect(r.status).toBe(200);
    expect(linhasDeFindings(r.wb!)).toHaveLength(2);
  });

  it("FX-L-03 um filtro que traz o recorte para dentro do limite volta a exportar", async () => {
    const { adminToken } = await montar(3);
    expect((await exportarXlsx(app, adminToken)).status).toBe(422);
    const r = await exportarXlsx(app, adminToken, "severity=LOW"); // 1 finding
    expect(r.status).toBe(200);
    expect(linhasDeFindings(r.wb!)).toHaveLength(1);
  });

  it("FX-L-04 a contagem respeita o escopo: findings de OUTRO tenant não contam para o limite do CLIENT", async () => {
    const { clientAToken } = await montar(2, 5); // 7 no sistema, 2 da Alfa
    const r = await exportarXlsx(app, clientAToken);
    expect(r.status).toBe(200);
    expect(linhasDeFindings(r.wb!)).toHaveLength(2);

    const { adminToken } = { adminToken: await loginAs(app, "admin@vulnera.local", SENHA) };
    const admin = await exportarXlsx(app, adminToken);
    expect(admin.status).toBe(422);
    expect(admin.json.total).toBe(7);
  });
});
