/**
 * graph-comment.test.ts
 *
 * Comentários fixados em nós de grafo (ADR-061): /api/graph-comments.
 *
 *   GCO-01  EXPOSURE: comentar, listar e apagar o próprio; o escopo vem da
 *           company do usuário (um `escopo` no body é ignorado)
 *   GCO-02  notificação: quem já comentou no nó recebe; o autor não; nó
 *           diferente não notifica
 *   GCO-03  só o autor (ou ADMIN) apaga
 *   GCO-04  validação: grafo inválido, texto vazio → 400
 *   GCO-05  DAST_SCAN: o acesso é o de ver o scan (requester/ADMIN); CLIENT → 403;
 *           outro PENTESTER → 403
 *
 *   TEN-GCO  company B não lê, não apaga e não comenta no grafo da A
 *            (comentário de outra company responde 404, não 403)
 */

import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma.database";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const SENHA = "senha12345";
const ROTA = "/api/graph-comments";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let seq = 0;

async function empresa(nome: string) {
  seq += 1;
  const plan = await seedPlan({ name: `PRO-${seq}` });
  const company = await seedCompany({ name: nome, planId: plan.id });
  return company;
}

async function usuario(dados: { role: "CLIENT" | "PENTESTER" | "ADMIN"; companyId?: string; companyRole?: "OWNER" | "MEMBER" }) {
  seq += 1;
  const email = `u${seq}@teste.com`;
  const user = await seedUser({ name: `Pessoa ${seq}`, email, password: SENHA, ...dados });
  return { user, token: await loginAs(app, email, SENHA) };
}

const comentar = (token: string, corpo: Record<string, unknown>) => request(app).post(ROTA).set(auth(token)).send(corpo);

describe("Comentários em nós de grafo (ADR-061)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("GCO-01 — comenta, lista e apaga no grafo da própria company", async () => {
    const a = await empresa("TechNova");
    const dona = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });

    const criado = await comentar(dona.token, { grafo: "EXPOSURE", escopo: "company-de-outro", noId: "app:portal", texto: "  Esta API sai do ar em março  " });
    expect(criado.status).toBe(201);
    expect(criado.body).toMatchObject({ nodeId: "app:portal", body: "Esta API sai do ar em março", podeApagar: true, autor: { id: dona.user.id } });
    // O escopo do body foi ignorado: o comentário mora na company do usuário.
    expect((await prisma.graphComment.findUniqueOrThrow({ where: { id: criado.body.id } })).scopeId).toBe(a.id);

    const lista = await request(app).get(ROTA).query({ grafo: "EXPOSURE" }).set(auth(dona.token));
    expect(lista.status).toBe(200);
    expect(lista.body.map((c: { id: string }) => c.id)).toEqual([criado.body.id]);

    const apagado = await request(app).delete(`${ROTA}/${criado.body.id}`).set(auth(dona.token));
    expect(apagado.status).toBe(204);
    expect(await prisma.graphComment.count()).toBe(0);
  });

  it("GCO-02 — notifica quem já comentou no nó, menos o autor", async () => {
    const a = await empresa("TechNova");
    const dona = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });
    const colega = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "MEMBER" });

    await comentar(dona.token, { grafo: "EXPOSURE", noId: "app:portal", texto: "Primeiro" });
    await comentar(colega.token, { grafo: "EXPOSURE", noId: "app:outro", texto: "Em outro nó" });
    expect(await prisma.notification.count()).toBe(0);

    const resposta = await comentar(colega.token, { grafo: "EXPOSURE", noId: "app:portal", texto: "Respondendo", rotulo: "Portal" });
    expect(resposta.status).toBe(201);
    const avisos = await prisma.notification.findMany();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ userId: dona.user.id, category: "COMMENT", link: "/exposure-graph?no=app%3Aportal" });
    expect(avisos[0].message).toContain('em "Portal"');
  });

  it("não entrega notificações do Exposure Graph a ex-integrantes ativos", async () => {
    const alpha = await empresa("Alpha");
    const beta = await empresa("Beta");
    const colega = await usuario({ role: "CLIENT", companyId: alpha.id, companyRole: "MEMBER" });
    const exIntegrante = await usuario({ role: "CLIENT", companyId: alpha.id, companyRole: "MEMBER" });
    const responsavel = await usuario({ role: "CLIENT", companyId: alpha.id, companyRole: "OWNER" });
    const no = { grafo: "EXPOSURE", noId: "app:portal" };

    expect((await comentar(colega.token, { ...no, texto: "Primeiro comentário" })).status).toBe(201);
    expect((await comentar(exIntegrante.token, { ...no, texto: "Comentário anterior à saída" })).status).toBe(201);
    await prisma.user.update({ where: { id: exIntegrante.user.id }, data: { companyId: beta.id } });

    expect((await comentar(responsavel.token, { ...no, texto: "Atualização", rotulo: "Portal Alpha" })).status).toBe(201);
    const avisos = await prisma.notification.findMany({
      where: { message: { contains: "Portal Alpha" } },
      select: { userId: true },
    });
    expect(avisos).toEqual([{ userId: colega.user.id }]);
  });

  it("GCO-03 — só o autor ou o ADMIN apaga", async () => {
    const a = await empresa("TechNova");
    const dona = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });
    const colega = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "MEMBER" });
    const criado = await comentar(dona.token, { grafo: "EXPOSURE", noId: "cat:A03", texto: "Injeção em três apps" });

    const lidoPelaColega = await request(app).get(ROTA).query({ grafo: "EXPOSURE" }).set(auth(colega.token));
    expect(lidoPelaColega.body[0].podeApagar).toBe(false);
    const recusado = await request(app).delete(`${ROTA}/${criado.body.id}`).set(auth(colega.token));
    expect(recusado.status).toBe(403);
    expect(await prisma.graphComment.count()).toBe(1);
  });

  it("GCO-04 — valida grafo e texto", async () => {
    const a = await empresa("TechNova");
    const dona = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });
    const grafo = await comentar(dona.token, { grafo: "REDE", noId: "x", texto: "y" });
    expect(grafo.status).toBe(400);
    expect(grafo.body.error).toBe("INVALID_GRAPH_KIND");
    const vazio = await comentar(dona.token, { grafo: "EXPOSURE", noId: "x", texto: "   " });
    expect(vazio.status).toBe(400);
    expect(vazio.body.error).toBe("MISSING_COMMENT_BODY");
    const lista = await request(app).get(ROTA).query({ grafo: "OUTRO" }).set(auth(dona.token));
    expect(lista.status).toBe(400);
  });

  it("GCO-05 — no grafo do scan DAST vale o acesso ao scan", async () => {
    const dono = await usuario({ role: "PENTESTER" });
    const outro = await usuario({ role: "PENTESTER" });
    const admin = await usuario({ role: "ADMIN" });
    const a = await empresa("TechNova");
    const cliente = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://app.exemplo.test", requestedById: dono.user.id, status: "COMPLETED" } });

    const criado = await comentar(dono.token, { grafo: "DAST_SCAN", escopo: scan.id, noId: "asset:app.exemplo.test", texto: "Alvo de homologação" });
    expect(criado.status).toBe(201);
    expect((await prisma.graphComment.findUniqueOrThrow({ where: { id: criado.body.id } })).scopeId).toBe(scan.id);

    const doAdmin = await request(app).get(ROTA).query({ grafo: "DAST_SCAN", escopo: scan.id }).set(auth(admin.token));
    expect(doAdmin.status).toBe(200);
    expect(doAdmin.body).toHaveLength(1);
    expect(doAdmin.body[0].podeApagar).toBe(true);

    const doOutro = await request(app).get(ROTA).query({ grafo: "DAST_SCAN", escopo: scan.id }).set(auth(outro.token));
    expect(doOutro.status).toBe(403);
    const doCliente = await comentar(cliente.token, { grafo: "DAST_SCAN", escopo: scan.id, noId: "x", texto: "y" });
    expect(doCliente.status).toBe(403);
    const inexistente = await request(app).get(ROTA).query({ grafo: "DAST_SCAN", escopo: "nao-existe" }).set(auth(dono.token));
    expect(inexistente.status).toBe(404);
  });

  it("TEN-GCO — a company B não lê, não apaga e não comenta no grafo da A", async () => {
    const a = await empresa("TechNova");
    const b = await empresa("Concorrente");
    const donaA = await usuario({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });
    const donaB = await usuario({ role: "CLIENT", companyId: b.id, companyRole: "OWNER" });
    const criado = await comentar(donaA.token, { grafo: "EXPOSURE", noId: "app:portal", texto: "Só da A" });

    const listaB = await request(app).get(ROTA).query({ grafo: "EXPOSURE" }).set(auth(donaB.token));
    expect(listaB.body).toEqual([]);
    const apagarB = await request(app).delete(`${ROTA}/${criado.body.id}`).set(auth(donaB.token));
    expect(apagarB.status).toBe(404);
    // B comentando no "mesmo" nó cai no grafo da B, não no da A, e não notifica a A.
    await comentar(donaB.token, { grafo: "EXPOSURE", escopo: a.id, noId: "app:portal", texto: "Tentativa" });
    const listaA = await request(app).get(ROTA).query({ grafo: "EXPOSURE" }).set(auth(donaA.token));
    expect(listaA.body.map((c: { body: string }) => c.body)).toEqual(["Só da A"]);
    expect(await prisma.notification.count()).toBe(0);
  });
});
