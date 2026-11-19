/**
 * sla-monitor.test.ts — monitor de SLA (FILA-FUT-02) com banco real.
 *
 * O service roda com o repository e o NotificationRepository reais; só o relógio
 * é controlado (o "agora" entra por parâmetro). Sem HTTP: o aviso é gravado na
 * tabela Notification e lido de volta por categoria e por usuário.
 *
 *   SLM-01  vence em 2 dias: ADMIN, CLIENT da empresa e PENTESTER membro recebem;
 *           CLIENT de outra empresa, PENTESTER de outro projeto da mesma empresa,
 *           PENTESTER de outra empresa e PENTESTER não membro NÃO recebem (SEC4)
 *   SLM-02  rodar duas vezes não duplica
 *   SLM-03  vencida depois de avisada: segundo aviso (SLA_OVERDUE), uma vez só
 *   SLM-04  FIXED/CLOSED, aceite de risco vigente e prazo além de 3 dias: nada
 *   SLM-05  três avisos pendentes para a mesma pessoa viram avisos individuais
 *   SLM-06  quatro avisos viram UM resumo por pessoa; repetir não duplica; conjunto novo, resumo novo
 *   SLM-07  a deduplicação olha a categoria: outra categoria no mesmo link não bloqueia o aviso
 *   SLM-08  resumo com vencidas e a vencer separa as contagens no texto
 */

import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { SlaMonitorRepository } from "../../src/repositories/sla-monitor.repository";
import { NotificationRepository } from "../../src/repositories/notification.repository";
import { SlaMonitorService } from "../../src/services/sla-monitor.service";
import { DIA_MS } from "../../src/utils/sla.util";

const AGORA = new Date("2026-11-19T11:00:00.000Z");
let agoraAtual = AGORA;

function monitor(): SlaMonitorService {
  return new SlaMonitorService(new SlaMonitorRepository(prisma), new NotificationRepository(prisma), () => agoraAtual);
}

interface Cenario {
  admin: { id: string };
  clienteA: { id: string };
  clienteB: { id: string };
  pentesterMembro: { id: string };
  pentesterOutroProjeto: { id: string };
  pentesterOutraEmpresa: { id: string };
  pentesterNaoMembro: { id: string };
  projetoA: { id: string; applicationId: string; companyId: string };
  empresaA: { id: string };
}

async function montarCenario(): Promise<Cenario> {
  const plano = await seedPlan({ name: "Plano SLA" });
  const empresaA = await seedCompany({ name: "Empresa A", planId: plano.id });
  const empresaB = await seedCompany({ name: "Empresa B", planId: plano.id });
  const appA = await seedApplication({ name: "App A", companyId: empresaA.id });
  const appB = await seedApplication({ name: "App B", companyId: empresaB.id });
  const projetoA = await seedProject({ name: "Projeto A", applicationId: appA.id, companyId: empresaA.id, status: "IN_PROGRESS" });
  const projetoA2 = await seedProject({ name: "Projeto A2", applicationId: appA.id, companyId: empresaA.id, status: "IN_PROGRESS" });
  const projetoB = await seedProject({ name: "Projeto B", applicationId: appB.id, companyId: empresaB.id, status: "IN_PROGRESS" });

  const admin = await seedUser({ name: "Admin", email: "admin@sla.test", password: "Senha@123456", role: "ADMIN" });
  const clienteA = await seedUser({ name: "Cliente A", email: "cliente.a@sla.test", password: "Senha@123456", role: "CLIENT", companyId: empresaA.id, companyRole: "OWNER" });
  const clienteB = await seedUser({ name: "Cliente B", email: "cliente.b@sla.test", password: "Senha@123456", role: "CLIENT", companyId: empresaB.id, companyRole: "OWNER" });
  const pentesterMembro = await seedUser({ name: "Pentester Membro", email: "pen.membro@sla.test", password: "Senha@123456", role: "PENTESTER" });
  const pentesterOutroProjeto = await seedUser({ name: "Pentester Outro Projeto", email: "pen.outro@sla.test", password: "Senha@123456", role: "PENTESTER" });
  const pentesterOutraEmpresa = await seedUser({ name: "Pentester Outra Empresa", email: "pen.b@sla.test", password: "Senha@123456", role: "PENTESTER" });
  const pentesterNaoMembro = await seedUser({ name: "Pentester Não Membro", email: "pen.nao@sla.test", password: "Senha@123456", role: "PENTESTER" });

  await seedProjectMember(projetoA.id, pentesterMembro.id);
  await seedProjectMember(projetoA2.id, pentesterOutroProjeto.id);
  await seedProjectMember(projetoB.id, pentesterOutraEmpresa.id);

  return {
    admin,
    clienteA,
    clienteB,
    pentesterMembro,
    pentesterOutroProjeto,
    pentesterOutraEmpresa,
    pentesterNaoMembro,
    projetoA,
    empresaA,
  };
}

/** Cria um achado no projeto A com o prazo informado (o fixture não aceita slaDueAt). */
async function achado(c: Cenario, opcoes: { titulo: string; prazo: Date; status?: string; severidade?: string }) {
  const v = await seedVulnerability({
    projectId: c.projetoA.id,
    applicationId: c.projetoA.applicationId,
    companyId: c.projetoA.companyId,
    createdBy: c.admin.id,
    title: opcoes.titulo,
    status: opcoes.status ?? "OPEN",
    severityCalculated: opcoes.severidade ?? "HIGH",
  });
  return prisma.vulnerability.update({
    where: { id: v.id },
    data: { slaDueAt: opcoes.prazo, slaStartedAt: new Date(opcoes.prazo.getTime() - 30 * DIA_MS) },
  });
}

async function destinatariosDa(categoria: string): Promise<string[]> {
  const linhas = await prisma.notification.findMany({ where: { category: categoria }, select: { userId: true } });
  return linhas.map((l) => l.userId).sort();
}

describe("Monitor de SLA (FILA-FUT-02)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    agoraAtual = AGORA;
  });

  it("SLM-01 — vence em 2 dias: avisa ADMIN, CLIENT da empresa e PENTESTER membro; o resto não recebe", async () => {
    const c = await montarCenario();
    const v = await achado(c, { titulo: "SQL Injection em /login", prazo: new Date(AGORA.getTime() + 2 * DIA_MS) });

    const resumo = await monitor().executar();
    expect(resumo).toEqual({ candidatas: 1, individuais: 3, resumos: 0 });

    const quem = await destinatariosDa("SLA_DUE_SOON");
    expect(quem).toEqual([c.admin.id, c.clienteA.id, c.pentesterMembro.id].sort());
    // SEC4: cliente de outra empresa, pentester de outro projeto/empresa e não membro ficam de fora.
    expect(quem).not.toContain(c.clienteB.id);
    expect(quem).not.toContain(c.pentesterOutroProjeto.id);
    expect(quem).not.toContain(c.pentesterOutraEmpresa.id);
    expect(quem).not.toContain(c.pentesterNaoMembro.id);

    const aviso = await prisma.notification.findFirst({ where: { userId: c.clienteA.id, category: "SLA_DUE_SOON" } });
    expect(aviso?.title).toBe("Prazo de remediação vence em 2 dias");
    expect(aviso?.message).toContain("SQL Injection em /login");
    expect(aviso?.link).toBe(`/findings/${v.id}`);
  });

  it("SLM-02 — rodar duas vezes não duplica o aviso", async () => {
    const c = await montarCenario();
    await achado(c, { titulo: "XSS no carrinho", prazo: new Date(AGORA.getTime() + 1 * DIA_MS) });

    await monitor().executar();
    const segunda = await monitor().executar();

    expect(segunda).toEqual({ candidatas: 1, individuais: 0, resumos: 0 });
    expect(await prisma.notification.count({ where: { category: "SLA_DUE_SOON" } })).toBe(3);
  });

  it("SLM-03 — vencida depois de avisada: segundo aviso (SLA_OVERDUE), uma vez só por pessoa", async () => {
    const c = await montarCenario();
    await achado(c, { titulo: "IDOR em /pedidos", prazo: new Date(AGORA.getTime() + 2 * DIA_MS) });
    await monitor().executar();

    // Três dias depois o prazo já passou.
    agoraAtual = new Date(AGORA.getTime() + 3 * DIA_MS);
    const vencida = await monitor().executar();
    expect(vencida).toEqual({ candidatas: 1, individuais: 3, resumos: 0 });

    const quem = await destinatariosDa("SLA_OVERDUE");
    expect(quem).toEqual([c.admin.id, c.clienteA.id, c.pentesterMembro.id].sort());
    const titulo = await prisma.notification.findFirst({ where: { category: "SLA_OVERDUE" }, select: { title: true } });
    expect(titulo?.title).toBe("Prazo de remediação vencido há 1 dia");

    // Mesma vulnerabilidade, mesmo dia: nenhum aviso novo.
    expect(await monitor().executar()).toEqual({ candidatas: 1, individuais: 0, resumos: 0 });
    expect(await prisma.notification.count({ where: { category: "SLA_OVERDUE" } })).toBe(3);
    expect(await prisma.notification.count({ where: { category: "SLA_DUE_SOON" } })).toBe(3);
  });

  it("SLM-04 — FIXED, CLOSED, aceite de risco vigente e prazo além de 3 dias não geram aviso", async () => {
    const c = await montarCenario();
    await achado(c, { titulo: "Corrigida", prazo: new Date(AGORA.getTime() - 5 * DIA_MS), status: "FIXED" });
    await achado(c, { titulo: "Fechada", prazo: new Date(AGORA.getTime() + 1 * DIA_MS), status: "CLOSED" });
    const aceita = await achado(c, { titulo: "Risco aceito", prazo: new Date(AGORA.getTime() + 1 * DIA_MS) });
    await prisma.riskAcceptance.create({
      data: {
        vulnerabilityId: aceita.id,
        companyId: c.empresaA.id,
        status: "APPROVED",
        reason: "Componente isolado",
        businessJustification: "Risco aceito pela diretoria até a próxima release.",
        requestedById: c.admin.id,
        expiresAt: new Date(AGORA.getTime() + 30 * DIA_MS),
      },
    });
    await achado(c, { titulo: "Longe do prazo", prazo: new Date(AGORA.getTime() + 5 * DIA_MS) });

    // Nenhum dos quatro entra na consulta: são candidatas 0. Se o filtro de aceite
    // não funcionasse, a vulnerabilidade aceita apareceria aqui e o total seria 1.
    const resumo = await monitor().executar();
    expect(resumo).toEqual({ candidatas: 0, individuais: 0, resumos: 0 });
    expect(await prisma.notification.count()).toBe(0);
  });

  it("SLM-05 — três avisos pendentes para a mesma pessoa viram avisos individuais", async () => {
    const c = await montarCenario();
    for (const titulo of ["Achado 1", "Achado 2", "Achado 3"]) {
      await achado(c, { titulo, prazo: new Date(AGORA.getTime() + 1 * DIA_MS) });
    }

    const resumo = await monitor().executar();
    expect(resumo).toEqual({ candidatas: 3, individuais: 9, resumos: 0 });
    expect(await prisma.notification.count({ where: { userId: c.admin.id, category: "SLA_RESUMO" } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: c.admin.id, category: "SLA_DUE_SOON" } })).toBe(3);
  });

  it("SLM-06 — quatro avisos viram UM resumo por pessoa; repetir não duplica; conjunto novo gera resumo novo", async () => {
    const c = await montarCenario();
    for (const titulo of ["Achado 1", "Achado 2", "Achado 3", "Achado 4"]) {
      await achado(c, { titulo, prazo: new Date(AGORA.getTime() + 1 * DIA_MS) });
    }

    const primeira = await monitor().executar();
    expect(primeira).toEqual({ candidatas: 4, individuais: 0, resumos: 3 });
    expect(await prisma.notification.count({ where: { userId: c.admin.id, category: "SLA_DUE_SOON" } })).toBe(0);
    const resumoAdmin = await prisma.notification.findFirst({ where: { userId: c.admin.id, category: "SLA_RESUMO" } });
    expect(resumoAdmin?.title).toBe("4 vulnerabilidades pedem atenção no prazo de remediação");
    expect(resumoAdmin?.message).toBe("4 vencendo em até 3 dias.");
    expect(resumoAdmin?.link).toMatch(/^\/findings\/[^?]+\?lote=[0-9a-f]{16}$/);

    // Mesmo conjunto, outro dia: não repete.
    agoraAtual = new Date(AGORA.getTime() + 1 * DIA_MS);
    expect(await monitor().executar()).toEqual({ candidatas: 4, individuais: 0, resumos: 0 });
    expect(await prisma.notification.count({ where: { userId: c.admin.id, category: "SLA_RESUMO" } })).toBe(1);

    // Entra um quinto achado: o conjunto mudou, então sai um resumo novo.
    await achado(c, { titulo: "Achado 5", prazo: new Date(AGORA.getTime() + 2 * DIA_MS) });
    expect(await monitor().executar()).toEqual({ candidatas: 5, individuais: 0, resumos: 3 });
    expect(await prisma.notification.count({ where: { userId: c.admin.id, category: "SLA_RESUMO" } })).toBe(2);
  });

  it("SLM-07 — a deduplicação olha a categoria: outra categoria no mesmo link não bloqueia o aviso", async () => {
    const c = await montarCenario();
    const v = await achado(c, { titulo: "Achado com histórico", prazo: new Date(AGORA.getTime() + 1 * DIA_MS) });
    await prisma.notification.create({
      data: { userId: c.admin.id, category: "FINDING_CRITICAL", title: "Crítica", message: "Crítica", link: `/findings/${v.id}` },
    });

    await monitor().executar();

    expect(await prisma.notification.count({ where: { userId: c.admin.id, category: "SLA_DUE_SOON", link: `/findings/${v.id}` } })).toBe(1);
  });

  it("SLM-08 — resumo separa vencidas e a vencer no texto", async () => {
    const c = await montarCenario();
    await achado(c, { titulo: "Vencida 1", prazo: new Date(AGORA.getTime() - 2 * DIA_MS) });
    await achado(c, { titulo: "Vencida 2", prazo: new Date(AGORA.getTime() - 1 * DIA_MS) });
    await achado(c, { titulo: "A vencer 1", prazo: new Date(AGORA.getTime() + 1 * DIA_MS) });
    await achado(c, { titulo: "A vencer 2", prazo: new Date(AGORA.getTime() + 2 * DIA_MS) });

    await monitor().executar();

    const resumoAdmin = await prisma.notification.findFirst({ where: { userId: c.admin.id, category: "SLA_RESUMO" } });
    expect(resumoAdmin?.message).toBe("2 com prazo vencido e 2 vencendo em até 3 dias.");
    expect(resumoAdmin?.title).toBe("4 vulnerabilidades pedem atenção no prazo de remediação");
  });
});
