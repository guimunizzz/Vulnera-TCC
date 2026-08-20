/**
 * metrics.test.ts
 *
 * Testes dos endpoints de métricas analíticas (Fase 6.5, CP4).
 *
 * ESTRATÉGIA
 * Todo cenário é montado com DATAS EXPLÍCITAS e valores de CVSS escolhidos a
 * mão, para que cada número esperado possa ser conferido por aritmética no
 * comentário — e não contra o próprio código, que é o erro clássico de teste
 * de agregação ("o teste passa porque copia o bug").
 *
 *   MET-01  summary  · contagens, taxa de remediação e risk score
 *   MET-02  summary  · risk score conferido contra query direta ao banco
 *   MET-03  summary  · aging nos quatro buckets
 *   MET-04  summary  · MTTR é MEDIANA e ignora outlier
 *   MET-05  summary  · comparação com período anterior
 *   MET-06  borda    · aplicação sem nenhum finding
 *   MET-07  borda    · janela sem dados dentro de aplicação com dados
 *   MET-08  borda    · um único finding
 *   MET-09  borda    · todos os findings no mesmo dia
 *   MET-10  fuso     · finding às 23h59 UTC não vaza para o dia seguinte
 *   MET-11  série    · períodos vazios aparecem como zero
 *   MET-12  série    · granularidade automática por tamanho de janela
 *   MET-13  série    · burndown acumula criados − resolvidos
 *   MET-14  insights · crítico antigo e reabertura
 *   MET-15  insights · lista nunca volta vazia
 *   MET-16  comparação entre aplicações da company
 *   MET-17  validação de query string
 *
 *   TEN-14  summary     · CLIENT de outra company → 403
 *   TEN-15  timeseries  · CLIENT de outra company → 403
 *   TEN-16  insights    · PENTESTER não-membro → 403
 *   TEN-17  comparison  · só enxerga aplicações da própria company
 */

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

const SENHA = "senha12345";
const DIA_MS = 86_400_000;

/** Data a N dias atrás, sempre à meia-noite UTC — deixa o bucket previsível. */
function diasAtras(n: number, hora = 12): Date {
  const d = new Date(Date.now() - n * DIA_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hora, 0, 0, 0));
}

/** Cria um finding com data controlada — o fixture não expõe `createdAt`. */
async function finding(dados: {
  projectId: string;
  applicationId: string;
  companyId: string;
  createdBy: string;
  cvss: number;
  severidade: string;
  status: string;
  criadoEm: Date;
  owasp?: string;
}) {
  const v = await seedVulnerability({
    projectId: dados.projectId,
    applicationId: dados.applicationId,
    companyId: dados.companyId,
    createdBy: dados.createdBy,
    title: `Finding CVSS ${dados.cvss}`,
    owaspCategory: dados.owasp ?? "A03",
    cvssScore: dados.cvss,
    severityCalculated: dados.severidade,
    severityFinal: dados.severidade,
    status: dados.status,
  });
  // `createdAt` tem `@default(now())` — o fixture não consegue definir. Só um
  // update depois da criação permite datar o finding no passado.
  return prisma.vulnerability.update({ where: { id: v.id }, data: { createdAt: dados.criadoEm } });
}

/** Registra a transição para FIXED — é dela que MTTR e "resolvidos" saem. */
async function registrarRemediacao(vulnId: string, companyId: string, actorId: string, em: Date) {
  await prisma.auditLog.create({
    data: {
      actorId,
      companyId,
      entityType: "Vulnerability",
      entityId: vulnId,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: "IN_PROGRESS", to: "FIXED" }),
      createdAt: em,
    },
  });
}

async function registrarReabertura(vulnId: string, companyId: string, actorId: string, em: Date) {
  await prisma.auditLog.create({
    data: {
      actorId,
      companyId,
      entityType: "Vulnerability",
      entityId: vulnId,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: "FIXED", to: "OPEN" }),
      createdAt: em,
    },
  });
}

/** Cenário base: uma company, uma aplicação, um projeto, um dono e um analista. */
async function cenario() {
  const plan = await seedPlan({ name: "PRO" });
  const company = await seedCompany({ name: "TechNova Teste", planId: plan.id });
  const application = await seedApplication({ name: "Portal", companyId: company.id });
  const owner = await seedUser({
    name: "Dona",
    email: "dona@teste.com",
    password: SENHA,
    role: "CLIENT",
    companyId: company.id,
    companyRole: "OWNER",
  });
  const pentester = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
  const project = await seedProject({ name: "Análise", applicationId: application.id, companyId: company.id });
  await seedProjectMember(project.id, pentester.id);

  const token = await loginAs(app, owner.email, SENHA);
  return { plan, company, application, project, owner, pentester, token };
}

const rota = (appId: string, sufixo: string) => `/api/applications/${appId}/metrics/${sufixo}`;

describe("Métricas analíticas (Fase 6.5)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  /* ====================================================================
     Corretude
     ==================================================================== */

  it("MET-01 — conta findings, calcula taxa de remediação e risk score", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };

    // 4 findings: 2 abertos (9.0 e 6.0), 2 remediados (8.0 e 5.0)
    await finding({ ...base, cvss: 9.0, severidade: "CRITICAL", status: "OPEN", criadoEm: diasAtras(10) });
    await finding({ ...base, cvss: 6.0, severidade: "MEDIUM", status: "IN_PROGRESS", criadoEm: diasAtras(9) });
    await finding({ ...base, cvss: 8.0, severidade: "HIGH", status: "FIXED", criadoEm: diasAtras(8) });
    await finding({ ...base, cvss: 5.0, severidade: "MEDIUM", status: "CLOSED", criadoEm: diasAtras(7) });

    const res = await request(app).get(rota(c.application.id, "summary")).set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalFindings).toBe(4);
    expect(res.body.totalAbertos).toBe(2);
    expect(res.body.totalRemediados).toBe(2);
    // 2 de 4 = 50,0%
    expect(res.body.taxaRemediacao).toBe(50);
    expect(res.body.abertosPorSeveridade).toEqual({ CRITICAL: 1, HIGH: 0, MEDIUM: 1, LOW: 0, NONE: 0 });
    // Só os ABERTOS entram: 9.0²/10 + 6.0²/10 = 8.1 + 3.6 = 11.7
    expect(res.body.riskScore).toBe(11.7);
  });

  it("MET-02 — risk score bate com a soma feita direto no banco", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    const scores = [9.8, 7.5, 4.2, 3.1, 6.6];
    for (const [i, cvss] of scores.entries()) {
      await finding({ ...base, cvss, severidade: "HIGH", status: "OPEN", criadoEm: diasAtras(20 - i) });
    }

    const res = await request(app).get(rota(c.application.id, "summary")).set("Authorization", `Bearer ${c.token}`);

    // Conferência independente: soma calculada em JS a partir dos mesmos
    // valores, sem passar pelo código do service.
    const esperado = Math.round(scores.reduce((a, s) => a + (s * s) / 10, 0) * 100) / 100;
    expect(res.body.riskScore).toBeCloseTo(esperado, 2);

    // E também contra o próprio banco, que é a terceira fonte independente.
    const [{ risco }] = await prisma.$queryRaw<{ risco: number }[]>`
      SELECT COALESCE(SUM(POW(cvssScore,2)/10),0) AS risco
      FROM Vulnerability WHERE applicationId = ${c.application.id} AND status IN ('OPEN','IN_PROGRESS')
    `;
    expect(res.body.riskScore).toBeCloseTo(Number(risco), 2);
  });

  it("MET-03 — aging distribui os abertos nos quatro buckets", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(2) }); // <7
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(15) }); // 7–30
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(45) }); // 30–90
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(200) }); // >90
    // Remediado não entra no aging — a dívida é do que está ABERTO.
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "FIXED", criadoEm: diasAtras(150) });

    const res = await request(app)
      .get(rota(c.application.id, "summary"))
      // Janela ampla para alcançar o finding de 200 dias.
      .query({ from: diasAtras(365).toISOString() })
      .set("Authorization", `Bearer ${c.token}`);

    expect(res.body.aging).toEqual({ ate7Dias: 1, de7A30Dias: 1, de30A90Dias: 1, mais90Dias: 1 });
  });

  it("MET-04 — MTTR usa mediana, então um outlier não distorce", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };

    // 4 remediações de HIGH: 2, 2, 4 e 400 dias.
    // média = 102 dias · MEDIANA = (2+4)/2 = 3 dias
    const tempos = [2, 2, 4, 400];
    for (const dias of tempos) {
      const criadoEm = diasAtras(500);
      const v = await finding({ ...base, cvss: 8, severidade: "HIGH", status: "FIXED", criadoEm });
      await registrarRemediacao(v.id, c.company.id, c.pentester.id, new Date(criadoEm.getTime() + dias * DIA_MS));
    }

    const res = await request(app)
      .get(rota(c.application.id, "summary"))
      .query({ from: diasAtras(600).toISOString() })
      .set("Authorization", `Bearer ${c.token}`);

    expect(res.body.mttrPorSeveridade.HIGH.amostras).toBe(4);
    expect(res.body.mttrPorSeveridade.HIGH.medianaDias).toBe(3);
    // A média seria 102 — o teste existe justamente para provar que NÃO é isso.
    expect(res.body.mttrPorSeveridade.HIGH.medianaDias).not.toBe(102);
  });

  it("MET-05 — compare=previous devolve o período anterior de mesmo tamanho", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    // 1 finding no período atual (últimos 10 dias), 3 no anterior (10–20 dias).
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(5) });
    for (const d of [12, 15, 18]) {
      await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(d) });
    }

    const res = await request(app)
      .get(rota(c.application.id, "summary"))
      .query({ from: diasAtras(10).toISOString(), to: new Date().toISOString(), compare: "previous" })
      .set("Authorization", `Bearer ${c.token}`);

    expect(res.body.totalFindings).toBe(1);
    expect(res.body.comparacao.totalFindings.atual).toBe(1);
    expect(res.body.comparacao.totalFindings.anterior).toBe(3);
    expect(res.body.comparacao.totalFindings.variacao).toBe(-2);
  });

  /* ====================================================================
     Bordas
     ==================================================================== */

  it("MET-06 — aplicação sem findings devolve zeros, não erro", async () => {
    const c = await cenario();
    const res = await request(app).get(rota(c.application.id, "summary")).set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalFindings).toBe(0);
    expect(res.body.totalAbertos).toBe(0);
    expect(res.body.riskScore).toBe(0);
    // Divisão por zero não pode virar NaN — o frontend imprimiria "NaN%".
    expect(res.body.taxaRemediacao).toBe(0);
    expect(res.body.aging).toEqual({ ate7Dias: 0, de7A30Dias: 0, de30A90Dias: 0, mais90Dias: 0 });
    expect(res.body.abertosPorSeveridade).toEqual({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 });
  });

  it("MET-07 — janela sem dados numa aplicação que tem dados", async () => {
    const c = await cenario();
    await finding({
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
      cvss: 9,
      severidade: "CRITICAL",
      status: "OPEN",
      criadoEm: diasAtras(200),
    });

    const res = await request(app)
      .get(rota(c.application.id, "summary"))
      .query({ from: diasAtras(10).toISOString(), to: new Date().toISOString() })
      .set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalFindings).toBe(0);
    expect(res.body.riskScore).toBe(0);
  });

  it("MET-08 — um único finding", async () => {
    const c = await cenario();
    await finding({
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
      cvss: 10,
      severidade: "CRITICAL",
      status: "OPEN",
      criadoEm: diasAtras(3),
    });

    const res = await request(app).get(rota(c.application.id, "summary")).set("Authorization", `Bearer ${c.token}`);

    expect(res.body.totalFindings).toBe(1);
    // 10²/10 = 10 — a unidade do risk score: um crítico perfeito vale 10.
    expect(res.body.riskScore).toBe(10);
    expect(res.body.taxaRemediacao).toBe(0);
  });

  it("MET-09 — todos os findings no mesmo dia colapsam num ponto só", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    const mesmoDia = diasAtras(5, 9);
    for (let i = 0; i < 5; i++) {
      await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: new Date(mesmoDia.getTime() + i * 3600_000) });
    }

    const res = await request(app)
      .get(rota(c.application.id, "timeseries"))
      .query({ from: diasAtras(10).toISOString(), granularity: "day" })
      .set("Authorization", `Bearer ${c.token}`);

    const comDados = res.body.pontos.filter((p: { criados: number }) => p.criados > 0);
    expect(comDados).toHaveLength(1);
    expect(comDados[0].criados).toBe(5);
  });

  it("MET-10 — fuso: finding às 23h59 UTC fica no dia UTC, não no seguinte", async () => {
    const c = await cenario();
    // A agregação é em UTC (ver metrics.repository.ts). Um finding às 23h59
    // UTC do dia D pertence ao dia D. Se a agregação usasse o fuso local do
    // servidor (UTC-3 nesta máquina), ele cairia às 20h59 do mesmo dia — o que
    // por acaso daria certo; por isso o caso decisivo é o das 00h30 UTC, que
    // em UTC-3 seria 21h30 do dia ANTERIOR.
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    const d = new Date(Date.now() - 5 * DIA_MS);
    const diaUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const quaseMeiaNoite = new Date(diaUtc.getTime() + 23 * 3600_000 + 59 * 60_000);
    const logoDepoisDaMeiaNoite = new Date(diaUtc.getTime() + 24 * 3600_000 + 30 * 60_000);

    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: quaseMeiaNoite });
    await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: logoDepoisDaMeiaNoite });

    const res = await request(app)
      .get(rota(c.application.id, "timeseries"))
      .query({ from: diasAtras(10).toISOString(), granularity: "day" })
      .set("Authorization", `Bearer ${c.token}`);

    const rotuloDia = diaUtc.toISOString().slice(0, 10);
    const rotuloSeguinte = new Date(diaUtc.getTime() + DIA_MS).toISOString().slice(0, 10);

    const pontoDia = res.body.pontos.find((p: { periodo: string }) => p.periodo === rotuloDia);
    const pontoSeguinte = res.body.pontos.find((p: { periodo: string }) => p.periodo === rotuloSeguinte);

    // Um em cada dia — se a agregação deslocasse por fuso, os dois cairiam juntos.
    expect(pontoDia?.criados).toBe(1);
    expect(pontoSeguinte?.criados).toBe(1);
  });

  /* ====================================================================
     Série temporal
     ==================================================================== */

  it("MET-11 — períodos sem findings aparecem como zero, não somem", async () => {
    const c = await cenario();
    await finding({
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
      cvss: 5,
      severidade: "MEDIUM",
      status: "OPEN",
      criadoEm: diasAtras(5),
    });

    const res = await request(app)
      .get(rota(c.application.id, "timeseries"))
      .query({ from: diasAtras(10).toISOString(), to: new Date().toISOString(), granularity: "day" })
      .set("Authorization", `Bearer ${c.token}`);

    // 11 dias de janela → 11 pontos, mesmo com um único finding. Uma série que
    // pulasse os dias vazios desenharia uma reta que mente sobre a inclinação.
    expect(res.body.pontos.length).toBeGreaterThanOrEqual(10);
    expect(res.body.pontos.filter((p: { criados: number }) => p.criados === 0).length).toBeGreaterThan(5);
  });

  it("MET-12 — granularidade automática segue o tamanho da janela", async () => {
    const c = await cenario();
    const chamar = (dias: number) =>
      request(app)
        .get(rota(c.application.id, "timeseries"))
        .query({ from: diasAtras(dias).toISOString(), to: new Date().toISOString() })
        .set("Authorization", `Bearer ${c.token}`);

    expect((await chamar(20)).body.granularidade).toBe("day"); // ≤31d
    expect((await chamar(90)).body.granularidade).toBe("week"); // ≤180d
    expect((await chamar(300)).body.granularidade).toBe("month"); // >180d
  });

  it("MET-13 — burndown acumula criados menos resolvidos", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    // 3 criados há 8 dias; 1 resolvido há 3 dias. Acumulado final = 2.
    for (let i = 0; i < 3; i++) {
      const v = await finding({ ...base, cvss: 5, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(8, 10) });
      if (i === 0) {
        await prisma.vulnerability.update({ where: { id: v.id }, data: { status: "FIXED" } });
        await registrarRemediacao(v.id, c.company.id, c.pentester.id, diasAtras(3, 10));
      }
    }

    const res = await request(app)
      .get(rota(c.application.id, "timeseries"))
      .query({ from: diasAtras(12).toISOString(), to: new Date().toISOString(), granularity: "day" })
      .set("Authorization", `Bearer ${c.token}`);

    const pontos = res.body.pontos as { criados: number; resolvidos: number; abertosAcumulados: number }[];
    expect(pontos.reduce((a, p) => a + p.criados, 0)).toBe(3);
    expect(pontos.reduce((a, p) => a + p.resolvidos, 0)).toBe(1);
    expect(pontos[pontos.length - 1].abertosAcumulados).toBe(2);
  });

  /* ====================================================================
     Insights
     ==================================================================== */

  it("MET-14 — gera insight de crítico antigo e de reabertura", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };
    await finding({ ...base, cvss: 9.5, severidade: "CRITICAL", status: "OPEN", criadoEm: diasAtras(45) });

    const reaberto = await finding({ ...base, cvss: 6, severidade: "MEDIUM", status: "OPEN", criadoEm: diasAtras(40) });
    await registrarRemediacao(reaberto.id, c.company.id, c.pentester.id, diasAtras(20));
    await registrarReabertura(reaberto.id, c.company.id, c.pentester.id, diasAtras(10));

    const res = await request(app)
      .get(rota(c.application.id, "insights"))
      .query({ from: diasAtras(90).toISOString() })
      .set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.insights.map((i: { id: string }) => i.id);
    expect(ids).toContain("criticos-antigos");
    expect(ids).toContain("reabertura");

    // Crítico vem antes de atenção — a ordem é o que faz a lista ser útil.
    expect(res.body.insights[0].severidade).toBe("critico");

    // O insight de crítico antigo carrega o filtro que reproduz o recorte.
    const criticos = res.body.insights.find((i: { id: string }) => i.id === "criticos-antigos");
    expect(criticos.filtro).toEqual({ severity: "CRITICAL", status: "OPEN", agingMinDias: 30 });
  });

  it("MET-15 — insights nunca volta lista vazia", async () => {
    const c = await cenario();
    const res = await request(app).get(rota(c.application.id, "insights")).set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    expect(res.body.insights.length).toBeGreaterThan(0);
  });

  /* ====================================================================
     Comparativo
     ==================================================================== */

  it("MET-16 — comparativo lista as aplicações da company ordenadas por risco", async () => {
    const c = await cenario();
    const app2 = await seedApplication({ name: "App Secundária", companyId: c.company.id });

    await finding({
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
      cvss: 9.8,
      severidade: "CRITICAL",
      status: "OPEN",
      criadoEm: diasAtras(5),
    });

    const projeto2 = await seedProject({ name: "Análise 2", applicationId: app2.id, companyId: c.company.id });
    await finding({
      projectId: projeto2.id,
      applicationId: app2.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
      cvss: 3.1,
      severidade: "LOW",
      status: "OPEN",
      criadoEm: diasAtras(5),
    });

    const res = await request(app).get("/api/companies/me/metrics/comparison").set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    expect(res.body.aplicacoes).toHaveLength(2);
    // Ordenado por risco DESC: 9.8²/10 = 9.6 antes de 3.1²/10 = 0.96
    expect(res.body.aplicacoes[0].applicationId).toBe(c.application.id);
    expect(res.body.aplicacoes[0].riskScore).toBeCloseTo(9.6, 1);
    expect(res.body.aplicacoes[0].criticosAbertos).toBe(1);
    expect(res.body.aplicacoes[1].riskScore).toBeCloseTo(0.96, 2);
  });

  /* ====================================================================
     Validação
     ==================================================================== */

  it("MET-17 — rejeita query string inválida", async () => {
    const c = await cenario();
    const auth = { Authorization: `Bearer ${c.token}` };

    const dataInvalida = await request(app).get(rota(c.application.id, "summary")).query({ from: "ontem" }).set(auth);
    expect(dataInvalida.status).toBe(400);
    expect(dataInvalida.body.error).toBe("INVALID_FROM");

    const janelaInvertida = await request(app)
      .get(rota(c.application.id, "summary"))
      .query({ from: new Date().toISOString(), to: diasAtras(10).toISOString() })
      .set(auth);
    expect(janelaInvertida.status).toBe(400);
    expect(janelaInvertida.body.error).toBe("INVALID_PERIOD");

    const granularidadeInvalida = await request(app)
      .get(rota(c.application.id, "timeseries"))
      .query({ granularity: "hour" })
      .set(auth);
    expect(granularidadeInvalida.status).toBe(400);
    expect(granularidadeInvalida.body.error).toBe("INVALID_GRANULARITY");

    const inexistente = await request(app).get(rota("cuid-que-nao-existe", "summary")).set(auth);
    expect(inexistente.status).toBe(404);
  });

  /* ====================================================================
     Isolamento multi-tenant — canários TEN-14..17
     ==================================================================== */

  it("TEN-14 — CLIENT de outra company não lê summary", async () => {
    const c = await cenario();
    const outraCompany = await seedCompany({ name: "Concorrente", planId: c.plan.id });
    const intruso = await seedUser({
      name: "Intruso",
      email: "intruso@concorrente.com",
      password: SENHA,
      role: "CLIENT",
      companyId: outraCompany.id,
      companyRole: "OWNER",
    });
    const tokenIntruso = await loginAs(app, intruso.email, SENHA);

    const res = await request(app).get(rota(c.application.id, "summary")).set("Authorization", `Bearer ${tokenIntruso}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("TEN-15 — CLIENT de outra company não lê timeseries", async () => {
    const c = await cenario();
    const outraCompany = await seedCompany({ name: "Concorrente", planId: c.plan.id });
    const intruso = await seedUser({
      name: "Intruso",
      email: "intruso2@concorrente.com",
      password: SENHA,
      role: "CLIENT",
      companyId: outraCompany.id,
      companyRole: "OWNER",
    });
    const tokenIntruso = await loginAs(app, intruso.email, SENHA);

    const res = await request(app).get(rota(c.application.id, "timeseries")).set("Authorization", `Bearer ${tokenIntruso}`);

    expect(res.status).toBe(403);
  });

  it("TEN-16 — PENTESTER sem ProjectMember não lê insights", async () => {
    const c = await cenario();
    const forasteiro = await seedUser({
      name: "Analista externo",
      email: "externo@vulnera.local",
      password: SENHA,
      role: "PENTESTER",
    });
    const tokenForasteiro = await loginAs(app, forasteiro.email, SENHA);

    const res = await request(app).get(rota(c.application.id, "insights")).set("Authorization", `Bearer ${tokenForasteiro}`);
    expect(res.status).toBe(403);

    // Controle positivo: o PENTESTER que É membro enxerga.
    const tokenMembro = await loginAs(app, c.pentester.email, SENHA);
    const permitido = await request(app).get(rota(c.application.id, "insights")).set("Authorization", `Bearer ${tokenMembro}`);
    expect(permitido.status).toBe(200);
  });

  it("TEN-17 — comparativo só enxerga aplicações da própria company", async () => {
    const c = await cenario();
    const outraCompany = await seedCompany({ name: "Concorrente", planId: c.plan.id });
    const appDaOutra = await seedApplication({ name: "App do Concorrente", companyId: outraCompany.id });
    const projetoOutra = await seedProject({ name: "Análise deles", applicationId: appDaOutra.id, companyId: outraCompany.id });
    await finding({
      projectId: projetoOutra.id,
      applicationId: appDaOutra.id,
      companyId: outraCompany.id,
      createdBy: c.pentester.id,
      cvss: 10,
      severidade: "CRITICAL",
      status: "OPEN",
      criadoEm: diasAtras(2),
    });

    const res = await request(app).get("/api/companies/me/metrics/comparison").set("Authorization", `Bearer ${c.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.aplicacoes.map((a: { applicationId: string }) => a.applicationId);
    expect(ids).toContain(c.application.id);
    // O canário: a aplicação da outra company NÃO pode aparecer, nem com
    // risco zero — a simples presença do nome já vazaria informação.
    expect(ids).not.toContain(appDaOutra.id);
  });

  /* ====================================================================
     Desempenho
     ==================================================================== */

  it("MET-18 — responde em menos de 500ms com 500 findings", async () => {
    const c = await cenario();
    const base = {
      projectId: c.project.id,
      applicationId: c.application.id,
      companyId: c.company.id,
      createdBy: c.pentester.id,
    };

    // `createMany` em vez de 500 `create`: o objetivo é medir a LEITURA, e
    // montar o cenário com 500 round-trips levaria mais que o teste inteiro.
    const agora = Date.now();
    await prisma.vulnerability.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        projectId: base.projectId,
        applicationId: base.applicationId,
        companyId: base.companyId,
        createdBy: base.createdBy,
        title: `Carga ${i}`,
        description: "Finding de carga para medir desempenho.",
        owaspCategory: ["A01", "A03", "A05", "A07"][i % 4],
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        cvssScore: 1 + (i % 90) / 10,
        severityCalculated: ["CRITICAL", "HIGH", "MEDIUM", "LOW"][i % 4],
        severityFinal: ["CRITICAL", "HIGH", "MEDIUM", "LOW"][i % 4],
        status: ["OPEN", "IN_PROGRESS", "FIXED", "CLOSED"][i % 4],
        createdAt: new Date(agora - (i % 90) * DIA_MS),
      })),
    });

    const auth = { Authorization: `Bearer ${c.token}` };
    for (const sufixo of ["summary?compare=previous", "timeseries", "insights"]) {
      const inicio = Date.now();
      const res = await request(app).get(rota(c.application.id, sufixo)).set(auth);
      const duracao = Date.now() - inicio;
      expect(res.status).toBe(200);
      expect(duracao).toBeLessThan(500);
    }
  });
});
