/**
 * threat-intel.test.ts — Threat Intel (ADR-053) ponta a ponta pela API, com
 * banco real e as FONTES trocadas por uma implementação em memória (mock só
 * da rede: NVD, OSV, KEV e EPSS). O resto — rotas, factory, services,
 * repositories, agendamento do backfill e notificações — é o código real.
 *
 *   TI-INV-01  inventário: CLIENT OWNER adiciona; MEMBER e PENTESTER não; duplicata 409; validação 400
 *   TI-INV-02  SBOM importado vira SUGESTÃO só na empresa do projeto; confirmar, descartar, confirmar todas
 *   TI-INV-03  fingerprint do DAST sugere só para a empresa dona do host escaneado
 *   TI-TEN-01  tenancy nos dois sentidos: B não vê, não apaga e não tria o que é de A
 *   TI-SYN-01  backfill: CVE antiga casa como pré-existente e NÃO notifica (D19.7)
 *   TI-SYN-02  CVE nova e crítica notifica ADMIN, CLIENT e PENTESTER da empresa — e só eles, uma vez só
 *   TI-SYN-03  CVE antiga que entra no KEV depois do mapeamento notifica (THREAT_KEV)
 *   TI-SYN-04  fonte fora do ar: execução PARTIAL com o motivo, as outras fontes seguem
 *   TI-SYN-05  mais de 3 eventos numa execução viram UM resumo por pessoa
 *   TI-SYN-06  só ADMIN dispara "Sincronizar agora"
 *   TI-MAT-01  triagem: PENTESTER membro e OWNER triam; MEMBER não; status inválido 400
 *   TI-PRO-01  promoção: THREAT_INTEL no projeto da empresa, A06, vetor revisado; outra empresa 404; 409 na segunda
 *   TI-NOT-01  notificações: só as próprias; marcar a de outra pessoa é 404
 *   TI-FEED-01 feed marca o que afeta a empresa
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
import { makeThreatIntelSyncService, makeTechSuggestionService } from "../../src/factories/threat-intel.factory";
import type { AvisoNormalizado, EntradaKev } from "../../src/utils/threat-intel.util";

// ---------------------------------------------------------------------------
// Fontes em memória (a única coisa falsa aqui é a rede)
// ---------------------------------------------------------------------------
const mockFontes = {
  osv: new Map<string, AvisoNormalizado[]>(), // "npm|lodash" → avisos
  nvdProduto: new Map<string, AvisoNormalizado[]>(), // "f5:nginx" → avisos
  kev: [] as EntradaKev[],
  falharNvd: false,
};

jest.mock("../../src/services/threat-intel/fontes", () => {
  const real = jest.requireActual("../../src/services/threat-intel/fontes");
  class FontesEmMemoria {
    async nvdPublicadas() {
      if (mockFontes.falharNvd) throw new real.FonteIndisponivel("NVD", "HTTP 503");
      return { avisos: [], bruto: {}, truncado: false };
    }
    async nvdPorProduto(cpe: string) {
      if (mockFontes.falharNvd) throw new real.FonteIndisponivel("NVD", "HTTP 503");
      const [, , , vendor, product] = cpe.split(":");
      return { avisos: mockFontes.nvdProduto.get(`${vendor}:${product}`) ?? [], bruto: {}, truncado: false };
    }
    async nvdBuscarProdutos() {
      return [{ cpePart: "a", cpeVendor: "f5", cpeProduct: "nginx", titulo: "F5 Nginx", exemplo: "cpe:2.3:a:f5:nginx:1.18.0" }];
    }
    async osvLote(consultas: { ecosystem: string; name: string }[]) {
      return consultas.map((c) => (mockFontes.osv.get(`${c.ecosystem}|${c.name}`) ?? []).map((a) => `OSV-${a.id}`));
    }
    async osvAviso(id: string) {
      const aviso = [...mockFontes.osv.values()].flat().find((a) => `OSV-${a.id}` === id);
      return aviso ? { aviso, bruto: { affected: [{ package: { ecosystem: "npm", name: "lodash" }, ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }] } } : null;
    }
    async kev() {
      return mockFontes.kev;
    }
    async epss(cves: string[]) {
      return new Map(cves.map((c) => [c, { score: 0.42, percentil: 0.97 }]));
    }
  }
  return { ...real, FontesPublicas: FontesEmMemoria };
});

const PASSWORD = "senha12345";
const VETOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";
const DIA = 24 * 3600_000;
const sync = makeThreatIntelSyncService();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function aviso(id: string, publicadoHaDias: number, nota: number | null): AvisoNormalizado {
  return {
    id,
    aliases: [],
    source: "OSV",
    title: `Falha ${id} no lodash`,
    description: `Descrição de ${id}.`,
    cvssScore: nota,
    cvssVersion: nota === null ? null : "3.1",
    cvssVector: nota === null ? null : VETOR,
    severity: nota === null ? null : nota >= 9 ? "CRITICAL" : nota >= 7 ? "HIGH" : "MEDIUM",
    cweId: "94",
    publishedAt: new Date(Date.now() - publicadoHaDias * DIA),
    modifiedAt: new Date(),
    references: [],
  };
}

function cyclonedx(): Buffer {
  return Buffer.from(
    JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      metadata: { tools: { components: [{ name: "trivy", version: "0.57.0" }] } },
      components: [
        { "bom-ref": "pkg:npm/lodash@4.17.15", name: "lodash", version: "4.17.15", purl: "pkg:npm/lodash@4.17.15" },
        { "bom-ref": "pkg:npm/express@4.17.1", name: "express", version: "4.17.1", purl: "pkg:npm/express@4.17.1" },
        { "bom-ref": "pkg:deb/debian/openssl@1.1", name: "openssl", version: "1.1", purl: "pkg:deb/debian/openssl@1.1" },
      ],
    }),
  );
}

async function cenario() {
  const plan = await seedPlan({ name: "Plano TI", maxApplications: 10, maxProjects: 10, price: 0 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  const appA = await seedApplication({ name: "App A", companyId: companyA.id });
  const appB = await seedApplication({ name: "App B", companyId: companyB.id });
  const projectA = await seedProject({ name: "Projeto A", applicationId: appA.id, companyId: companyA.id });
  const projectB = await seedProject({ name: "Projeto B", applicationId: appB.id, companyId: companyB.id });

  const admin = await seedUser({ name: "Admin", email: "admin@ti.local", password: PASSWORD, role: "ADMIN" });
  const ownerA = await seedUser({ name: "Dona A", email: "owner@a.local", password: PASSWORD, role: "CLIENT", companyId: companyA.id, companyRole: "OWNER" });
  const memberA = await seedUser({ name: "Membro A", email: "member@a.local", password: PASSWORD, role: "CLIENT", companyId: companyA.id, companyRole: "MEMBER" });
  const ownerB = await seedUser({ name: "Dono B", email: "owner@b.local", password: PASSWORD, role: "CLIENT", companyId: companyB.id, companyRole: "OWNER" });
  const pentA = await seedUser({ name: "Pentester A", email: "pent@a.local", password: PASSWORD, role: "PENTESTER" });
  const pentB = await seedUser({ name: "Pentester B", email: "pent@b.local", password: PASSWORD, role: "PENTESTER" });
  await seedProjectMember(projectA.id, pentA.id);
  await seedProjectMember(projectB.id, pentB.id);

  return {
    companyA,
    companyB,
    appA,
    projectA,
    projectB,
    ids: { admin: admin.id, ownerA: ownerA.id, memberA: memberA.id, ownerB: ownerB.id, pentA: pentA.id, pentB: pentB.id },
    t: {
      admin: await loginAs(app, admin.email, PASSWORD),
      ownerA: await loginAs(app, ownerA.email, PASSWORD),
      memberA: await loginAs(app, memberA.email, PASSWORD),
      ownerB: await loginAs(app, ownerB.email, PASSWORD),
      pentA: await loginAs(app, pentA.email, PASSWORD),
      pentB: await loginAs(app, pentB.email, PASSWORD),
    },
  };
}

type Cenario = Awaited<ReturnType<typeof cenario>>;

const lodash = { kind: "PACKAGE", ecosystem: "npm", packageName: "lodash", version: "4.17.15" };

async function adicionarLodash(c: Cenario) {
  const r = await request(app).post("/api/threat-intel/assets").set(auth(c.t.ownerA)).send(lodash);
  expect(r.status).toBe(201);
  await sync.aguardarOcioso();
  return r.body;
}

const casamentos = (token: string, companyId: string, qs = "") =>
  request(app).get(`/api/threat-intel/matches?companyId=${companyId}${qs}`).set(auth(token));

beforeEach(async () => {
  await sync.aguardarOcioso();
  await cleanDatabase();
  mockFontes.osv.clear();
  mockFontes.nvdProduto.clear();
  mockFontes.kev = [];
  mockFontes.falharNvd = false;
});

afterAll(async () => {
  await sync.aguardarOcioso();
});

describe("Threat Intel — inventário", () => {
  it("TI-INV-01 CLIENT OWNER adiciona; MEMBER e PENTESTER não; duplicata 409; validação 400", async () => {
    const c = await cenario();
    const r = await request(app).post("/api/threat-intel/assets").set(auth(c.t.ownerA)).send({ ...lodash, companyId: c.companyB.id });
    expect(r.status).toBe(201);
    // companyId do body é ignorado para CLIENT: vai para a empresa DELE (SEC2).
    expect(await prisma.techAsset.findUniqueOrThrow({ where: { id: r.body.id } })).toMatchObject({ companyId: c.companyA.id, status: "CONFIRMED", source: "MANUAL" });
    expect(r.body.displayName).toBe("lodash 4.17.15 (npm)");
    await sync.aguardarOcioso();

    expect((await request(app).post("/api/threat-intel/assets").set(auth(c.t.ownerA)).send(lodash)).status).toBe(409);
    expect((await request(app).post("/api/threat-intel/assets").set(auth(c.t.memberA)).send({ ...lodash, version: "1" })).status).toBe(403);
    expect((await request(app).post("/api/threat-intel/assets").set(auth(c.t.pentA)).send({ ...lodash, version: "1", companyId: c.companyA.id })).status).toBe(403);

    const invalidos: [object, string][] = [
      [{ ...lodash, ecosystem: "cocoapods" }, "INVALID_ECOSYSTEM"],
      [{ ...lodash, packageName: "" }, "MISSING_PACKAGE_NAME"],
      [{ ...lodash, packageName: "a b<script>" }, "INVALID_PACKAGE_NAME"],
      [{ kind: "PRODUCT", cpeVendor: "f5" }, "MISSING_CPE_PRODUCT"],
      [{ kind: "PRODUCT", cpeVendor: "f5", cpeProduct: "ng inx" }, "INVALID_CPE_PRODUCT"],
      [{ kind: "OUTRO" }, "INVALID_TECH_KIND"],
      [{ ...lodash, version: "1.0; drop" }, "INVALID_VERSION"],
    ];
    for (const [body, erro] of invalidos) {
      const x = await request(app).post("/api/threat-intel/assets").set(auth(c.t.ownerA)).send(body);
      expect([x.status, x.body.error]).toEqual([400, erro]);
    }
    // ADMIN precisa dizer de qual empresa.
    expect((await request(app).post("/api/threat-intel/assets").set(auth(c.t.admin)).send({ ...lodash, version: "2" })).body.error).toBe("MISSING_COMPANY_ID");
    expect((await request(app).post("/api/threat-intel/assets").set(auth(c.t.admin)).send({ ...lodash, version: "2", companyId: c.companyB.id })).status).toBe(201);
    await sync.aguardarOcioso();
  });

  it("TI-INV-02 SBOM importado vira sugestão só na empresa do projeto; confirmar, descartar, confirmar todas", async () => {
    const c = await cenario();
    const imp = await request(app)
      .post("/api/code-imports")
      .set(auth(c.t.pentA))
      .field("projectId", c.projectA.id)
      .attach("file", cyclonedx(), { filename: "sbom.json", contentType: "application/json" });
    expect(imp.status).toBe(201);

    const sugestoes = await prisma.techAsset.findMany({ where: { status: "SUGGESTED" }, orderBy: { packageName: "asc" } });
    // openssl (deb) não é ecossistema do OSV: não vira sugestão.
    expect(sugestoes.map((s) => [s.companyId, s.packageName, s.version, s.source, s.sourceRef])).toEqual([
      [c.companyA.id, "express", "4.17.1", "SBOM", imp.body.id],
      [c.companyA.id, "lodash", "4.17.15", "SBOM", imp.body.id],
    ]);
    // Reimportar não duplica.
    await request(app).post("/api/code-imports").set(auth(c.t.pentA)).field("projectId", c.projectA.id).attach("file", cyclonedx(), { filename: "sbom.json", contentType: "application/json" });
    expect(await prisma.techAsset.count()).toBe(2);

    const [express, lodashSug] = sugestoes;
    // PENTESTER vê, mas não edita o inventário (D19.9).
    expect((await request(app).post(`/api/threat-intel/assets/${express!.id}/confirm`).set(auth(c.t.pentA))).status).toBe(403);
    const lista = await request(app).get(`/api/threat-intel/assets?companyId=${c.companyA.id}`).set(auth(c.t.pentA));
    expect(lista.body).toHaveLength(2);

    expect((await request(app).post(`/api/threat-intel/assets/${express!.id}/dismiss`).set(auth(c.t.ownerA))).body.status).toBe("DISMISSED");
    expect((await request(app).post(`/api/threat-intel/assets/${express!.id}/dismiss`).set(auth(c.t.ownerA))).status).toBe(409);
    const todas = await request(app).post("/api/threat-intel/assets/confirm-all").set(auth(c.t.ownerA)).send({});
    expect(todas.body).toEqual({ confirmadas: 1 });
    await sync.aguardarOcioso();
    expect(await prisma.techAsset.findUniqueOrThrow({ where: { id: lodashSug!.id } })).toMatchObject({ status: "CONFIRMED" });
    // Descartada não volta como sugestão numa nova importação.
    await request(app).post("/api/code-imports").set(auth(c.t.pentA)).field("projectId", c.projectA.id).attach("file", cyclonedx(), { filename: "sbom.json", contentType: "application/json" });
    expect(await prisma.techAsset.findUniqueOrThrow({ where: { id: express!.id } })).toMatchObject({ status: "DISMISSED" });
  });

  it("TI-INV-03 fingerprint do DAST sugere só para a empresa dona do host", async () => {
    const c = await cenario();
    await prisma.application.update({ where: { id: c.appA.id }, data: { url: "https://portal.empresa-a.com.br/login" } });
    const n = await makeTechSuggestionService().sugerirDoScan(
      "scan-1",
      "https://portal.empresa-a.com.br/",
      [{ nome: "nginx", versao: "1.18.0" }, { nome: "Desconhecido", versao: "1" }],
      ["cpe:/a:php:php:7.4.3"],
    );
    expect(n).toBe(2);
    const s = await prisma.techAsset.findMany({ orderBy: { cpeProduct: "asc" } });
    expect(s.map((x) => [x.companyId, x.cpeVendor, x.cpeProduct, x.version, x.source])).toEqual([
      [c.companyA.id, "f5", "nginx", "1.18.0", "FINGERPRINT"],
      [c.companyA.id, "php", "php", "7.4.3", "FINGERPRINT"],
    ]);
    expect(await makeTechSuggestionService().sugerirDoScan("scan-2", "https://outro-host.com/", [{ nome: "nginx", versao: "1" }], [])).toBe(0);
  });
});

describe("Threat Intel — tenancy", () => {
  it("TI-TEN-01 B não vê, não apaga e não tria o que é de A", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2020-8203", 400, 7.4)]);
    const ativo = await adicionarLodash(c);
    const [m] = (await casamentos(c.t.ownerA, c.companyA.id)).body;
    expect(m).toBeDefined();

    // CLIENT de B forçando companyId=A recebe o recorte DELE (vazio), nunca o de A.
    expect((await request(app).get(`/api/threat-intel/assets?companyId=${c.companyA.id}`).set(auth(c.t.ownerB))).body).toEqual([]);
    expect((await casamentos(c.t.ownerB, c.companyA.id)).body).toEqual([]);
    // PENTESTER sem projeto em A: 403 explícito no escopo pedido.
    expect((await casamentos(c.t.pentB, c.companyA.id)).status).toBe(403);
    // Por id: recurso de outra empresa é 404 (não confirma que existe).
    expect((await request(app).delete(`/api/threat-intel/assets/${ativo.id}`).set(auth(c.t.ownerB))).status).toBe(404);
    expect((await request(app).patch(`/api/threat-intel/matches/${m.id}/triage`).set(auth(c.t.ownerB)).send({ triageStatus: "FALSE_POSITIVE" })).status).toBe(404);
    expect((await request(app).get(`/api/threat-intel/matches/${m.id}/promotion-draft`).set(auth(c.t.pentB))).status).toBe(404);
    // E o sentido certo funciona.
    expect((await request(app).get(`/api/threat-intel/assets?companyId=${c.companyA.id}`).set(auth(c.t.pentA))).body).toHaveLength(1);
    expect(await prisma.techAsset.count()).toBe(1);
  });
});

describe("Threat Intel — sincronização e notificações", () => {
  it("TI-SYN-01 backfill: CVE antiga casa como pré-existente e não notifica", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2021-23337", 900, 9.1)]);
    await adicionarLodash(c);
    const [m] = (await casamentos(c.t.ownerA, c.companyA.id)).body;
    expect(m).toMatchObject({ preexisting: true, versionConfirmed: true, fixedVersion: "4.17.21", triageStatus: "NEW" });
    expect(m.advisory).toMatchObject({ id: "CVE-2021-23337", cvssScore: 9.1, epssScore: 0.42 });
    expect(await prisma.notification.count()).toBe(0);
    // O resumo do cabeçalho: abertas por severidade e tecnologias afetadas.
    const resumo = await request(app).get("/api/threat-intel/overview").set(auth(c.t.ownerA));
    expect(resumo.body.casamentos).toMatchObject({ abertosPorSeveridade: { CRITICAL: 1 }, tecnologiasAfetadas: 1, criticosAbertos: 1, novosSemana: 0 });
    const run = await prisma.threatSyncRun.findFirstOrThrow({ where: { trigger: "ASSET" } });
    expect(run).toMatchObject({ status: "OK", newMatches: 1, notifications: 0 });
  });

  it("TI-SYN-02 CVE nova e crítica notifica ADMIN, CLIENT e PENTESTER da empresa — só eles, uma vez", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", []);
    await adicionarLodash(c);
    // Publicada DEPOIS do mapeamento.
    await new Promise((r) => setTimeout(r, 20));
    mockFontes.osv.set("npm|lodash", [{ ...aviso("CVE-2026-50001", 0, 9.8), publishedAt: new Date() }, { ...aviso("CVE-2026-50002", 0, 5.0), publishedAt: new Date() }]);
    const r = await sync.executar("MANUAL");
    expect(r).toMatchObject({ status: "OK", newMatches: 2, notifications: 4 });

    const notas = await prisma.notification.findMany();
    expect(notas.map((n) => n.userId).sort()).toEqual([c.ids.admin, c.ids.ownerA, c.ids.memberA, c.ids.pentA].sort());
    expect(notas[0]).toMatchObject({ category: "THREAT_MATCH", title: "CVE-2026-50001 afeta lodash 4.17.15 (npm)" });
    expect(notas[0]!.link).toContain(`/threat-intel?empresa=${c.companyA.id}&aba=afeta&match=`);
    // CVSS 5.0 não notifica; nem B, nem o PENTESTER de B.
    expect(notas.some((n) => n.title.includes("50002"))).toBe(false);

    expect((await sync.executar("MANUAL"))!.notifications).toBe(0);
    expect(await prisma.notification.count()).toBe(4);
  });

  it("TI-SYN-03 CVE antiga que entra no KEV depois do mapeamento notifica", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2020-8203", 400, 7.4)]);
    await adicionarLodash(c);
    expect(await prisma.notification.count()).toBe(0);
    mockFontes.kev = [{ cveId: "CVE-2020-8203", nome: "Lodash Prototype Pollution", descricao: "x", adicionadaEm: new Date(Date.now() + 1000), prazo: null, ransomware: false }];
    const r = await sync.executar("SCHEDULED");
    expect(r!.notifications).toBe(4);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: c.ids.ownerA } });
    expect(n).toMatchObject({ category: "THREAT_KEV", title: "CVE-2020-8203 está sendo explorada ativamente" });
    expect((await sync.executar("SCHEDULED"))!.notifications).toBe(0);
  });

  it("TI-SYN-04 fonte fora do ar: PARTIAL com o motivo, as outras seguem", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2020-8203", 400, 7.4)]);
    await adicionarLodash(c);
    await request(app).post("/api/threat-intel/assets").set(auth(c.t.ownerA)).send({ kind: "PRODUCT", cpeVendor: "f5", cpeProduct: "nginx", version: "1.18.0" });
    await sync.aguardarOcioso();
    mockFontes.falharNvd = true;
    const r = await sync.executar("MANUAL");
    expect(r!.status).toBe("PARTIAL");
    expect(r!.sources.NVD_FEED).toMatchObject({ ok: false, erro: "NVD: HTTP 503" });
    expect(r!.sources.NVD_PRODUTOS).toMatchObject({ ok: false });
    expect(r!.sources.OSV).toMatchObject({ ok: true });
    const status = await request(app).get(`/api/threat-intel/sync?companyId=${c.companyA.id}`).set(auth(c.t.ownerA));
    expect(status.body.execucoes[0]).toMatchObject({ status: "PARTIAL", errorMessage: expect.stringContaining("NVD_FEED: NVD: HTTP 503") });
  });

  it("TI-SYN-05 mais de 3 eventos numa execução viram um resumo por pessoa", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", []);
    await adicionarLodash(c);
    await new Promise((r) => setTimeout(r, 20));
    mockFontes.osv.set("npm|lodash", [1, 2, 3, 4, 5].map((i) => ({ ...aviso(`CVE-2026-6000${i}`, 0, 8), publishedAt: new Date() })));
    expect((await sync.executar("MANUAL"))!.notifications).toBe(4);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: c.ids.memberA } });
    expect(n).toMatchObject({ category: "THREAT_DIGEST", title: "5 CVEs novas afetam o inventário" });
  });

  it("TI-SYN-06 só ADMIN dispara a sincronização manual", async () => {
    const c = await cenario();
    expect((await request(app).post("/api/threat-intel/sync").set(auth(c.t.ownerA))).status).toBe(403);
    expect((await request(app).post("/api/threat-intel/sync").set(auth(c.t.pentA))).status).toBe(403);
    expect((await request(app).post("/api/threat-intel/sync").set(auth(c.t.admin))).status).toBe(202);
    await sync.aguardarOcioso();
    expect(await prisma.threatSyncRun.count({ where: { trigger: "MANUAL" } })).toBe(1);
  });
});

describe("Threat Intel — triagem, promoção, notificações e feed", () => {
  it("TI-MAT-01 triagem: PENTESTER membro e OWNER triam; MEMBER não", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2020-8203", 400, 7.4)]);
    await adicionarLodash(c);
    const [m] = (await casamentos(c.t.ownerA, c.companyA.id)).body;
    const triar = (t: string, body: object) => request(app).patch(`/api/threat-intel/matches/${m.id}/triage`).set(auth(t)).send(body);
    expect((await triar(c.t.memberA, { triageStatus: "CONFIRMED" })).status).toBe(403);
    expect((await triar(c.t.pentA, { triageStatus: "TALVEZ" })).body.error).toBe("INVALID_TRIAGE_STATUS");
    const ok = await triar(c.t.ownerA, { triageStatus: "ACCEPTED_RISK", note: "Componente só no build." });
    expect(ok.body).toMatchObject({ triageStatus: "ACCEPTED_RISK", triageNote: "Componente só no build.", triagedByName: "Dona A" });
    expect((await casamentos(c.t.pentA, c.companyA.id, "&triage=NEW")).body).toEqual([]);
    expect(await prisma.auditLog.count({ where: { entityType: "ThreatMatch", entityId: m.id } })).toBe(1);
  });

  it("TI-PRO-01 promoção para Vulnerability THREAT_INTEL", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2021-23337", 900, 7.2)]);
    await adicionarLodash(c);
    const [m] = (await casamentos(c.t.ownerA, c.companyA.id)).body;

    expect((await request(app).get(`/api/threat-intel/matches/${m.id}/promotion-draft`).set(auth(c.t.ownerA))).status).toBe(403);
    const draft = await request(app).get(`/api/threat-intel/matches/${m.id}/promotion-draft`).set(auth(c.t.pentA));
    expect(draft.body).toMatchObject({ owaspCategory: "A06", cvssVector: VETOR, projetos: [{ id: c.projectA.id, name: "Projeto A" }] });
    expect(draft.body.recommendation).toContain("4.17.21");

    const corpo = { title: draft.body.title, description: draft.body.description, owaspCategory: "A06", cvssVector: VETOR };
    expect((await request(app).post(`/api/threat-intel/matches/${m.id}/promote`).set(auth(c.t.admin)).send({ ...corpo, projectId: c.projectB.id })).status).toBe(404);
    const r = await request(app).post(`/api/threat-intel/matches/${m.id}/promote`).set(auth(c.t.pentA)).send({ ...corpo, projectId: c.projectA.id });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ sourceType: "THREAT_INTEL", sourceThreatMatchId: m.id, projectId: c.projectA.id, companyId: c.companyA.id, cvssScore: 9.8, owaspCategory: "A06" });
    expect((await request(app).post(`/api/threat-intel/matches/${m.id}/promote`).set(auth(c.t.pentA)).send({ ...corpo, projectId: c.projectA.id })).status).toBe(409);
    const depois = (await casamentos(c.t.pentA, c.companyA.id)).body[0];
    expect(depois).toMatchObject({ triageStatus: "CONFIRMED", promotedVulnerability: { id: r.body.id } });
    // A visão unificada (D18) já reconhece a origem nova.
    const lista = await request(app).get("/api/vulnerabilities?sourceType=THREAT_INTEL").set(auth(c.t.admin));
    expect(lista.body.data.map((v: { id: string }) => v.id)).toEqual([r.body.id]);
  });

  it("TI-NOT-01 notificações: só as próprias", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", []);
    await adicionarLodash(c);
    await new Promise((r) => setTimeout(r, 20));
    mockFontes.osv.set("npm|lodash", [{ ...aviso("CVE-2026-70001", 0, 9.0), publishedAt: new Date() }]);
    await sync.executar("MANUAL");

    const minhas = await request(app).get("/api/notifications").set(auth(c.t.ownerA));
    expect(minhas.body.naoLidas).toBe(1);
    expect(minhas.body.data).toHaveLength(1);
    expect((await request(app).get("/api/notifications").set(auth(c.t.ownerB))).body).toEqual({ data: [], naoLidas: 0 });
    const id = minhas.body.data[0].id;
    expect((await request(app).post(`/api/notifications/${id}/read`).set(auth(c.t.ownerB))).status).toBe(404);
    expect((await request(app).post(`/api/notifications/${id}/read`).set(auth(c.t.ownerA))).status).toBe(204);
    expect((await request(app).get("/api/notifications/unread-count").set(auth(c.t.ownerA))).body).toEqual({ naoLidas: 0 });
    expect((await request(app).post("/api/notifications/read-all").set(auth(c.t.pentA))).body).toEqual({ marcadas: 1 });
  });

  it("TI-FEED-01 feed marca o que afeta a empresa", async () => {
    const c = await cenario();
    mockFontes.osv.set("npm|lodash", [aviso("CVE-2026-80001", 1, 8.0)]);
    await adicionarLodash(c);
    await prisma.threatAdvisory.create({ data: { id: "CVE-2026-80002", source: "NVD", title: "Outra", severity: "LOW", cvssScore: 3, publishedAt: new Date() } });
    const feedA = await request(app).get(`/api/threat-intel/feed?companyId=${c.companyA.id}&days=7`).set(auth(c.t.ownerA));
    expect(feedA.body.map((a: { id: string; afeta: boolean }) => [a.id, a.afeta]).sort()).toEqual([
      ["CVE-2026-80001", true],
      ["CVE-2026-80002", false],
    ]);
    const feedB = await request(app).get("/api/threat-intel/feed").set(auth(c.t.ownerB));
    expect(feedB.body.every((a: { afeta: boolean }) => !a.afeta)).toBe(true);
    expect((await request(app).get(`/api/threat-intel/feed?companyId=${c.companyA.id}&days=90`).set(auth(c.t.ownerA))).body.error).toBe("INVALID_DAYS");
  });
});
