/**
 * code-import.test.ts — importação SAST/SCA por projeto (ADR-052), ponta a ponta
 * pela API (multipart real, banco real).
 *
 *   CODE-IMP-01  membro importa SARIF: 201, contadores, companyId herdado do Project (body ignorado)
 *   CODE-IMP-02  reimportação: persistente herda triagem, novo nasce NEW, resolvido contado; compare lista os três
 *   CODE-IMP-03  CycloneDX importa SCA; SBOM sem `vulnerabilities` importa com aviso
 *   CODE-IMP-04  arquivo ausente/ inválido/ formato desconhecido/ projectId ausente/ projeto inexistente
 *   CODE-IMP-05  ferramentas diferentes não se comparam entre si
 *   CODE-TEN-01  PENTESTER fora do projeto: 403 em importar, listar, ler, triar, rascunho e promover
 *   CODE-TEN-02  CLIENT recebe 403 em todas as rotas; ADMIN acessa qualquer projeto
 *   CODE-TRI-01  triagem grava status, nota, autor; nota > 2000 → 400; status inválido → 400
 *   CODE-PRO-01  promover cria Vulnerability SAST_IMPORT no projeto DO ACHADO, score do vetor (RN10), SLA/VRS, triagem → CONFIRMED
 *   CODE-PRO-02  promover de novo → 409; o MESMO achado reimportado também → 409 e aparece como promovido
 *   CODE-PRO-03  vetor inválido → 400 e nada é criado
 *   CODE-PRO-04  SCA: rascunho A06 com vetor da ferramenta; promovida vira SCA_IMPORT
 *   CODE-AUD-01  importar, triar e promover geram AuditLog
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";

const PASSWORD = "senha12345";
const VETOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"; // 9.8 CRITICAL

interface SarifResultInput {
  ruleId: string;
  file: string;
  line: number;
  fp: string;
}

function sarif(results: SarifResultInput[], toolName = "Semgrep OSS"): Buffer {
  const rules = [...new Set(results.map((r) => r.ruleId))].map((id) => ({
    id,
    shortDescription: { text: `Regra ${id}` },
    properties: { tags: ["CWE-89"], "security-severity": "8.1" },
  }));
  return Buffer.from(
    JSON.stringify({
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: toolName, semanticVersion: "1.0.0", rules } },
          results: results.map((r) => ({
            ruleId: r.ruleId,
            level: "error",
            message: { text: `Achado ${r.ruleId} em ${r.file}` },
            locations: [{ physicalLocation: { artifactLocation: { uri: r.file }, region: { startLine: r.line } } }],
            fingerprints: { "matchBasedId/v1": r.fp },
          })),
        },
      ],
    }),
  );
}

function cyclonedx(withVulns = true): Buffer {
  return Buffer.from(
    JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      metadata: { tools: { components: [{ name: "trivy", version: "0.57.0" }] } },
      components: [{ "bom-ref": "pkg:npm/lodash@4.17.15", name: "lodash", version: "4.17.15", purl: "pkg:npm/lodash@4.17.15" }],
      ...(withVulns
        ? {
            vulnerabilities: [
              {
                id: "CVE-2021-23337",
                ratings: [{ severity: "high", score: 7.2, method: "CVSSv31", vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" }],
                cwes: [94],
                description: "Command injection in lodash template.",
                affects: [{ ref: "pkg:npm/lodash@4.17.15" }],
              },
            ],
          }
        : {}),
    }),
  );
}

async function seedCenario() {
  const plan = await seedPlan({ name: "Plano Code", maxApplications: 10, maxProjects: 10, price: 0 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  const appA = await seedApplication({ name: "App A", companyId: companyA.id });
  const appB = await seedApplication({ name: "App B", companyId: companyB.id });
  const projectA = await seedProject({ name: "Projeto A", applicationId: appA.id, companyId: companyA.id });
  const projectB = await seedProject({ name: "Projeto B", applicationId: appB.id, companyId: companyB.id });

  const admin = await seedUser({ name: "Admin", email: "admin@code.local", password: PASSWORD, role: "ADMIN" });
  const pentesterA = await seedUser({ name: "Pentester A", email: "penta@code.local", password: PASSWORD, role: "PENTESTER" });
  const pentesterB = await seedUser({ name: "Pentester B", email: "pentb@code.local", password: PASSWORD, role: "PENTESTER" });
  const client = await seedUser({ name: "Cliente A", email: "client@code.local", password: PASSWORD, role: "CLIENT", companyId: companyA.id });
  await seedProjectMember(projectA.id, pentesterA.id);
  await seedProjectMember(projectB.id, pentesterB.id);

  return {
    companyA,
    companyB,
    projectA,
    projectB,
    pentesterA,
    adminToken: await loginAs(app, admin.email, PASSWORD),
    tokenA: await loginAs(app, pentesterA.email, PASSWORD),
    tokenB: await loginAs(app, pentesterB.email, PASSWORD),
    clientToken: await loginAs(app, client.email, PASSWORD),
  };
}

function importar(token: string, projectId: string | null, file: Buffer | null, fileName = "semgrep.sarif", extra: Record<string, string> = {}) {
  let req = request(app).post("/api/code-imports").set("Authorization", `Bearer ${token}`);
  if (projectId !== null) req = req.field("projectId", projectId);
  for (const [k, v] of Object.entries(extra)) req = req.field(k, v);
  if (file) req = req.attach("file", file, { filename: fileName, contentType: "application/json" });
  return req;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  await cleanDatabase();
});

describe("Importação SAST/SCA", () => {
  it("CODE-IMP-01 membro importa SARIF; companyId vem do Project, não do body", async () => {
    const { tokenA, projectA, companyA, companyB } = await seedCenario();
    const res = await importar(
      tokenA,
      projectA.id,
      sarif([
        { ruleId: "sqli", file: "src/db.js", line: 10, fp: "a" },
        { ruleId: "xss", file: "src/view.js", line: 3, fp: "b" },
      ]),
      "semgrep.sarif",
      { companyId: companyB.id },
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ format: "SARIF", toolName: "Semgrep OSS", totalFindings: 2, newFindings: 2, persistedFindings: 0, resolvedFindings: 0, previousImportId: null, fileName: "semgrep.sarif" });

    const row = await prisma.codeScanImport.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.companyId).toBe(companyA.id);
    const findings = await request(app).get(`/api/code-imports/${res.body.id}/findings`).set(auth(tokenA));
    expect(findings.status).toBe(200);
    expect(findings.body).toHaveLength(2);
    expect(findings.body[0]).toMatchObject({ category: "SAST", severity: "HIGH", cweId: "89", triageStatus: "NEW", promotedVulnerability: null });

    const list = await request(app).get(`/api/code-imports?projectId=${projectA.id}`).set(auth(tokenA));
    expect(list.status).toBe(200);
    expect(list.body.map((i: { id: string }) => i.id)).toEqual([res.body.id]);
    // security-severity 8.1 nas regras do fixture → HIGH
    expect(list.body[0].severityCounts).toEqual({ CRITICAL: 0, HIGH: 2, MEDIUM: 0, LOW: 0, INFO: 0 });
  });

  it("CODE-IMP-02 reimportação herda triagem, conta novos/persistentes/resolvidos e o compare lista os três", async () => {
    const { tokenA, projectA } = await seedCenario();
    const primeira = await importar(
      tokenA,
      projectA.id,
      sarif([
        { ruleId: "sqli", file: "src/db.js", line: 10, fp: "persiste" },
        { ruleId: "xss", file: "src/view.js", line: 3, fp: "some" },
      ]),
    );
    const achados1 = (await request(app).get(`/api/code-imports/${primeira.body.id}/findings`).set(auth(tokenA))).body;
    const persiste = achados1.find((f: { ruleId: string }) => f.ruleId === "sqli");
    await request(app).patch(`/api/code-imports/findings/${persiste.id}/triage`).set(auth(tokenA)).send({ triageStatus: "FALSE_POSITIVE", note: "Query parametrizada no ORM." });

    // A linha mudou (40 em vez de 10), mas o fingerprint da ferramenta é o mesmo.
    const segunda = await importar(
      tokenA,
      projectA.id,
      sarif([
        { ruleId: "sqli", file: "src/db.js", line: 40, fp: "persiste" },
        { ruleId: "rce", file: "src/exec.js", line: 1, fp: "novo" },
      ]),
    );
    expect(segunda.status).toBe(201);
    expect(segunda.body).toMatchObject({ totalFindings: 2, newFindings: 1, persistedFindings: 1, resolvedFindings: 1, previousImportId: primeira.body.id });

    const achados2 = (await request(app).get(`/api/code-imports/${segunda.body.id}/findings`).set(auth(tokenA))).body;
    const herdado = achados2.find((f: { ruleId: string }) => f.ruleId === "sqli");
    expect(herdado).toMatchObject({ triageStatus: "FALSE_POSITIVE", triageNote: "Query parametrizada no ORM.", triageInherited: true, triagedByName: "Pentester A", startLine: 40 });
    expect(achados2.find((f: { ruleId: string }) => f.ruleId === "rce")).toMatchObject({ triageStatus: "NEW", triageInherited: false });

    const cmp = await request(app).get(`/api/code-imports/${segunda.body.id}/compare`).set(auth(tokenA));
    expect(cmp.status).toBe(200);
    expect(cmp.body.baseImport.id).toBe(primeira.body.id);
    expect(cmp.body.introduced.map((e: { title: string }) => e.title)).toEqual(["Regra rce"]);
    expect(cmp.body.persisted.map((e: { title: string }) => e.title)).toEqual(["Regra sqli"]);
    expect(cmp.body.resolved).toHaveLength(1);
    expect(cmp.body.resolved[0]).toMatchObject({ title: "Regra xss", location: "src/view.js:3" });

    // Retriar o herdado deixa de ser herança.
    const retriado = await request(app).patch(`/api/code-imports/findings/${herdado.id}/triage`).set(auth(tokenA)).send({ triageStatus: "CONFIRMED" });
    expect(retriado.body.triageInherited).toBe(false);
  });

  it("CODE-IMP-03 CycloneDX vira SCA; SBOM sem vulnerabilities importa com aviso", async () => {
    const { tokenA, projectA } = await seedCenario();
    const res = await importar(tokenA, projectA.id, cyclonedx(), "sbom.cdx.json");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ format: "CYCLONEDX", toolName: "trivy", totalFindings: 1, componentsCount: 1 });
    const [f] = (await request(app).get(`/api/code-imports/${res.body.id}/findings`).set(auth(tokenA))).body;
    expect(f).toMatchObject({ category: "SCA", advisoryId: "CVE-2021-23337", packageName: "lodash", packageVersion: "4.17.15", severity: "HIGH" });

    const vazio = await importar(tokenA, projectA.id, cyclonedx(false), "sbom-sem-vulns.json");
    expect(vazio.status).toBe(201);
    expect(vazio.body.totalFindings).toBe(0);
    expect(vazio.body.warningMessage).toMatch(/vulnerabilities/);
    // Mesmo projeto/formato/ferramenta: a CVE anterior conta como resolvida.
    expect(vazio.body.resolvedFindings).toBe(1);
  });

  it("CODE-IMP-04 entradas inválidas", async () => {
    const { tokenA, projectA } = await seedCenario();
    expect((await importar(tokenA, projectA.id, null)).body.error).toBe("MISSING_FILE");
    expect((await importar(tokenA, null, sarif([]))).body.error).toBe("MISSING_PROJECT_ID");

    const lixo = await importar(tokenA, projectA.id, Buffer.from("<html>não é json</html>"));
    expect(lixo.status).toBe(400);
    expect(lixo.body.error).toBe("INVALID_FILE_FORMAT");

    const desconhecido = await importar(tokenA, projectA.id, Buffer.from(JSON.stringify({ issues: [] })));
    expect(desconhecido.status).toBe(422);
    expect(desconhecido.body.error).toBe("UNSUPPORTED_REPORT_FORMAT");

    const inexistente = await importar(tokenA, "projeto-que-nao-existe", sarif([]));
    expect(inexistente.status).toBe(404);
    expect(await prisma.codeScanImport.count()).toBe(0);

    expect((await request(app).get("/api/code-imports/nao-existe").set(auth(tokenA))).status).toBe(404);
  });

  it("CODE-IMP-05 ferramentas diferentes não se comparam", async () => {
    const { tokenA, projectA } = await seedCenario();
    await importar(tokenA, projectA.id, sarif([{ ruleId: "a", file: "x.js", line: 1, fp: "1" }], "Semgrep OSS"));
    const codeql = await importar(tokenA, projectA.id, sarif([{ ruleId: "b", file: "y.js", line: 1, fp: "2" }], "CodeQL"));
    expect(codeql.body).toMatchObject({ previousImportId: null, newFindings: 1, resolvedFindings: 0 });
  });
});

describe("Importação SAST/SCA — tenancy e papéis", () => {
  it("CODE-TEN-01 PENTESTER fora do projeto recebe 403 em tudo", async () => {
    const { tokenA, tokenB, projectA } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, sarif([{ ruleId: "sqli", file: "a.js", line: 1, fp: "x" }]));
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;

    expect((await importar(tokenB, projectA.id, sarif([]))).status).toBe(403);
    expect((await request(app).get(`/api/code-imports?projectId=${projectA.id}`).set(auth(tokenB))).status).toBe(403);
    expect((await request(app).get(`/api/code-imports/${imp.body.id}`).set(auth(tokenB))).status).toBe(403);
    expect((await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenB))).status).toBe(403);
    expect((await request(app).get(`/api/code-imports/${imp.body.id}/compare`).set(auth(tokenB))).status).toBe(403);
    expect((await request(app).patch(`/api/code-imports/findings/${f.id}/triage`).set(auth(tokenB)).send({ triageStatus: "CONFIRMED" })).status).toBe(403);
    expect((await request(app).get(`/api/code-imports/findings/${f.id}/promotion-draft`).set(auth(tokenB))).status).toBe(403);
    const promo = await request(app)
      .post(`/api/code-imports/findings/${f.id}/promote`)
      .set(auth(tokenB))
      .send({ title: "x", description: "y", owaspCategory: "A03", cvssVector: VETOR });
    expect(promo.status).toBe(403);

    expect(await prisma.codeScanImport.count()).toBe(1);
    expect(await prisma.vulnerability.count()).toBe(0);
    expect((await prisma.codeFinding.findUniqueOrThrow({ where: { id: f.id } })).triageStatus).toBe("NEW");
  });

  it("CODE-TEN-02 CLIENT recebe 403 em todas as rotas; ADMIN acessa qualquer projeto", async () => {
    const { tokenA, clientToken, adminToken, projectA, projectB } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, sarif([{ ruleId: "sqli", file: "a.js", line: 1, fp: "x" }]));
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;

    const rotas = [
      () => importar(clientToken, projectA.id, sarif([])),
      () => request(app).get(`/api/code-imports?projectId=${projectA.id}`).set(auth(clientToken)),
      () => request(app).get(`/api/code-imports/${imp.body.id}`).set(auth(clientToken)),
      () => request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(clientToken)),
      () => request(app).get(`/api/code-imports/${imp.body.id}/compare`).set(auth(clientToken)),
      () => request(app).patch(`/api/code-imports/findings/${f.id}/triage`).set(auth(clientToken)).send({ triageStatus: "CONFIRMED" }),
      () => request(app).get(`/api/code-imports/findings/${f.id}/promotion-draft`).set(auth(clientToken)),
      () => request(app).post(`/api/code-imports/findings/${f.id}/promote`).set(auth(clientToken)).send({}),
    ];
    for (const rota of rotas) expect((await rota()).status).toBe(403);
    expect((await request(app).get("/api/code-imports").set("Authorization", "Bearer token-invalido")).status).toBe(401);

    expect((await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(adminToken))).status).toBe(200);
    expect((await importar(adminToken, projectB.id, sarif([{ ruleId: "a", file: "b.js", line: 2, fp: "y" }]))).status).toBe(201);
  });
});

describe("Importação SAST/SCA — triagem e promoção", () => {
  it("CODE-TRI-01 triagem valida entrada e grava autor", async () => {
    const { tokenA, projectA } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, sarif([{ ruleId: "sqli", file: "a.js", line: 1, fp: "x" }]));
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;

    const invalido = await request(app).patch(`/api/code-imports/findings/${f.id}/triage`).set(auth(tokenA)).send({ triageStatus: "TALVEZ" });
    expect(invalido.status).toBe(400);
    const notaLonga = await request(app).patch(`/api/code-imports/findings/${f.id}/triage`).set(auth(tokenA)).send({ triageStatus: "CONFIRMED", note: "x".repeat(2001) });
    expect(notaLonga.status).toBe(400);

    const ok = await request(app).patch(`/api/code-imports/findings/${f.id}/triage`).set(auth(tokenA)).send({ triageStatus: "ACCEPTED_RISK", note: "  Código morto, sai na v2.  " });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ triageStatus: "ACCEPTED_RISK", triageNote: "Código morto, sai na v2.", triagedByName: "Pentester A" });
  });

  it("CODE-PRO-01 promover cria Vulnerability no projeto do achado, com score do vetor revisado", async () => {
    const { tokenA, projectA, projectB, companyA } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, sarif([{ ruleId: "sqli", file: "src/db.js", line: 10, fp: "x" }]));
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;

    const draft = await request(app).get(`/api/code-imports/findings/${f.id}/promotion-draft`).set(auth(tokenA));
    expect(draft.status).toBe(200);
    expect(draft.body).toMatchObject({ owaspCategory: "A03", cvssVectorSource: "SEVERITY", alreadyPromotedTo: null });
    expect(draft.body.description).toContain("Local: src/db.js:10");

    const res = await request(app)
      .post(`/api/code-imports/findings/${f.id}/promote`)
      .set(auth(tokenA))
      // projectId do body é IGNORADO: o destino é o projeto do achado.
      .send({ ...draft.body, projectId: projectB.id, cvssVector: VETOR });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ projectId: projectA.id, companyId: companyA.id, sourceType: "SAST_IMPORT", sourceCodeFindingId: f.id, cvssScore: 9.8, severityFinal: "CRITICAL", owaspCategory: "A03" });
    expect(res.body.slaDueAt).toBeTruthy();
    expect(res.body.vrsScore).not.toBeNull();

    const depois = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body[0];
    expect(depois.triageStatus).toBe("CONFIRMED");
    expect(depois.promotedVulnerability.id).toBe(res.body.id);
  });

  it("CODE-PRO-02 dedup: promover de novo, ou o mesmo achado reimportado, → 409", async () => {
    const { tokenA, projectA } = await seedCenario();
    const arquivo = sarif([{ ruleId: "sqli", file: "a.js", line: 1, fp: "x" }]);
    const imp1 = await importar(tokenA, projectA.id, arquivo);
    const [f1] = (await request(app).get(`/api/code-imports/${imp1.body.id}/findings`).set(auth(tokenA))).body;
    const body = { title: "SQLi", description: "d", owaspCategory: "A03", cvssVector: VETOR };
    expect((await request(app).post(`/api/code-imports/findings/${f1.id}/promote`).set(auth(tokenA)).send(body)).status).toBe(201);
    expect((await request(app).post(`/api/code-imports/findings/${f1.id}/promote`).set(auth(tokenA)).send(body)).status).toBe(409);

    const imp2 = await importar(tokenA, projectA.id, arquivo);
    const [f2] = (await request(app).get(`/api/code-imports/${imp2.body.id}/findings`).set(auth(tokenA))).body;
    expect(f2.promotedVulnerability).not.toBeNull();
    const draft = await request(app).get(`/api/code-imports/findings/${f2.id}/promotion-draft`).set(auth(tokenA));
    expect(draft.body.alreadyPromotedTo).toBe(f2.promotedVulnerability.id);
    const again = await request(app).post(`/api/code-imports/findings/${f2.id}/promote`).set(auth(tokenA)).send(body);
    expect(again.status).toBe(409);
    expect(await prisma.vulnerability.count()).toBe(1);
  });

  it("CODE-PRO-03 vetor inválido → 400 e nada é criado", async () => {
    const { tokenA, projectA } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, sarif([{ ruleId: "sqli", file: "a.js", line: 1, fp: "x" }]));
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;
    const res = await request(app).post(`/api/code-imports/findings/${f.id}/promote`).set(auth(tokenA)).send({ title: "x", description: "y", owaspCategory: "A03", cvssVector: "CVSS:3.1/AV:X" });
    expect(res.status).toBe(400);
    const owasp = await request(app).post(`/api/code-imports/findings/${f.id}/promote`).set(auth(tokenA)).send({ title: "x", description: "y", owaspCategory: "A99", cvssVector: VETOR });
    expect(owasp.body.error).toBe("INVALID_OWASP_CATEGORY");
    expect(await prisma.vulnerability.count()).toBe(0);
  });

  it("CODE-PRO-04 SCA: rascunho A06 com vetor da ferramenta; promovida vira SCA_IMPORT", async () => {
    const { tokenA, projectA } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, cyclonedx(), "sbom.json");
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;
    const draft = (await request(app).get(`/api/code-imports/findings/${f.id}/promotion-draft`).set(auth(tokenA))).body;
    expect(draft).toMatchObject({ owaspCategory: "A06", cvssVectorSource: "TOOL", cvssVector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" });
    const res = await request(app).post(`/api/code-imports/findings/${f.id}/promote`).set(auth(tokenA)).send(draft);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ sourceType: "SCA_IMPORT", cvssScore: 7.2, severityFinal: "HIGH" });
  });

  it("CODE-AUD-01 importar, triar e promover ficam no AuditLog", async () => {
    const { tokenA, projectA, companyA } = await seedCenario();
    const imp = await importar(tokenA, projectA.id, sarif([{ ruleId: "sqli", file: "a.js", line: 1, fp: "x" }]));
    const [f] = (await request(app).get(`/api/code-imports/${imp.body.id}/findings`).set(auth(tokenA))).body;
    await request(app).patch(`/api/code-imports/findings/${f.id}/triage`).set(auth(tokenA)).send({ triageStatus: "CONFIRMED" });
    await request(app).post(`/api/code-imports/findings/${f.id}/promote`).set(auth(tokenA)).send({ title: "x", description: "y", owaspCategory: "A03", cvssVector: VETOR });

    const logs = await prisma.auditLog.findMany({ where: { companyId: companyA.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => `${l.entityType}:${l.action}`)).toEqual(expect.arrayContaining(["CodeScanImport:CREATE", "CodeFinding:STATUS_CHANGE", "Vulnerability:CREATE"]));
    const promo = logs.find((l) => l.entityType === "Vulnerability");
    expect(JSON.parse(promo!.diffJson!)).toMatchObject({ sourceType: "SAST_IMPORT", sourceCodeFindingId: f.id });
  });
});

describe("Importação SAST/SCA — lista global e dados do relatório", () => {
  it("CODE-LST-01 sem projectId: PENTESTER vê só os projetos de que é membro; ADMIN vê todos", async () => {
    const { tokenA, tokenB, adminToken, projectA, projectB } = await seedCenario();
    const impA = await importar(tokenA, projectA.id, sarif([{ ruleId: "a", file: "a.js", line: 1, fp: "1" }]));
    const impB = await importar(tokenB, projectB.id, sarif([{ ruleId: "b", file: "b.js", line: 1, fp: "2" }]));

    const visaoA = await request(app).get("/api/code-imports").set(auth(tokenA));
    expect(visaoA.status).toBe(200);
    expect(visaoA.body.map((i: { id: string }) => i.id)).toEqual([impA.body.id]);
    expect(visaoA.body[0]).toMatchObject({ projectName: "Projeto A", applicationName: "App A" });

    const visaoAdmin = await request(app).get("/api/code-imports").set(auth(adminToken));
    expect(visaoAdmin.body.map((i: { id: string }) => i.id).sort()).toEqual([impA.body.id, impB.body.id].sort());
  });

  it("CODE-REP-01 report/data traz importação, achados e resolvidos; fora do projeto → 403", async () => {
    const { tokenA, tokenB, projectA } = await seedCenario();
    await importar(tokenA, projectA.id, sarif([{ ruleId: "velho", file: "v.js", line: 1, fp: "v" }]));
    const atual = await importar(tokenA, projectA.id, sarif([{ ruleId: "novo", file: "n.js", line: 2, fp: "n" }]));

    const res = await request(app).get(`/api/code-imports/${atual.body.id}/report/data`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.import).toMatchObject({ id: atual.body.id, newFindings: 1, resolvedFindings: 1 });
    expect(res.body.findings).toHaveLength(1);
    expect(res.body.resolved.map((e: { title: string }) => e.title)).toEqual(["Regra velho"]);
    expect(res.body.generatedAt).toBeTruthy();

    expect((await request(app).get(`/api/code-imports/${atual.body.id}/report/data`).set(auth(tokenB))).status).toBe(403);
  });
});
