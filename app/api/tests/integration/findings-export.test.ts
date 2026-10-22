/**
 * findings-export.test.ts
 *
 * Exportação Excel dos findings, pela rota REAL, contra o banco de teste. O
 * arquivo é baixado e LIDO DE VOLTA — o que se compara é o conteúdo do xlsx.
 *
 * CONTEÚDO E COERÊNCIA
 *   FX-I-01  ADMIN sem filtro: todos os findings, abas na ordem, Auxiliar oculta, headers
 *   FX-I-02  filtro → só o recorte, e a contagem bate com a listagem
 *   FX-I-03  ordenação customizada (inclusive severidade, o caminho SQL) = ordem da listagem
 *   FX-I-04  busca textual + filtros combinados = listagem
 *   FX-I-05  os números do Dashboard batem com a aba Findings
 *   FX-I-06  Acompanhamento: pré-preenchimento, validação, proteção, fórmulas
 *   FX-I-07  gráficos nativos presentes no pacote
 *   FX-I-08  mais de um lote (1.250 findings): nenhuma linha perdida ou repetida
 *
 * SEGURANÇA DO ARQUIVO
 *   FX-I-10  injeção de fórmula: o dado fica intacto e é gravado como TEXTO
 *   FX-I-11  texto acima do limite da célula é truncado com marcador explícito
 *   FX-I-12  acentos, emoji e caracteres ilegais em XML
 *   FX-I-13  campos nulos/vazios
 *   FX-I-14  zero e um resultado
 *   FX-I-15  origem DAST e CWE
 *
 * RBAC E TENANCY (nos dois sentidos — GOTCHA G16)
 *   FX-I-20  CLIENT só exporta a própria empresa, mesmo manipulando parâmetros
 *   FX-I-21  CLIENT: projeto de outro tenant → 403, inexistente → 404
 *   FX-I-22  filtro por recurso de outro tenant: 0 linhas e NENHUM nome vaza no arquivo
 *   FX-I-23  PENTESTER só exporta projetos onde é membro
 *   FX-I-24  ADMIN filtra por empresa; nome do arquivo usa o slug do projeto
 *   FX-I-25  CLIENT sem empresa: arquivo vazio, sem vazamento
 *   FX-I-26  sem token → 401
 *
 * PROTOCOLO
 *   FX-I-30  parâmetro inválido → o mesmo 400 da listagem
 *   FX-I-31  "export.xlsx" não é capturado por /:id
 *   FX-I-32  auditoria: quem, quando, filtros, quantidade — e nada em requisição recusada
 *   FX-I-33  CORS expõe Content-Disposition e Retry-After
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
import { PARTE, cacheDaCelula, exportarXlsx, linhasDeFindings, partesDoZip, textoDeTudo, valorDe, xmlDaParte } from "../fixtures/xlsx.fixture";
import { ACOMP, DASH } from "../../src/utils/findings-xlsx/planilha";

const SENHA = "senha12345";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface Cenario {
  adminToken: string;
  clientAToken: string;
  clientBToken: string;
  pentesterToken: string;
  empresaA: { id: string };
  empresaB: { id: string };
  projA1: { id: string; name: string };
  projA2: { id: string };
  projB1: { id: string };
  appA1: { id: string; name: string };
  appA2: { id: string };
  appB1: { id: string; name: string };
  admin: { id: string };
  pentester: { id: string };
  clientA: { id: string };
  /** id → título, de todos os 7 findings. */
  findings: Array<{ id: string; title: string; empresa: "A" | "B"; projeto: "A1" | "A2" | "B1" }>;
}

/**
 * Duas empresas. A tem dois projetos (A1: 3 findings, A2: 2); B tem um (B1: 2).
 * O PENTESTER é membro só de A1. 7 findings no total, de todas as severidades e status.
 */
async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "BASIC" });
  const empresaA = await seedCompany({ name: "Empresa Alfa", planId: plan.id });
  const empresaB = await seedCompany({ name: "Empresa Beta Sigilosa", planId: plan.id });

  const appA1 = await seedApplication({ name: "Portal Açaí & Cia", companyId: empresaA.id });
  const appA2 = await seedApplication({ name: "App Alfa Dois", companyId: empresaA.id });
  const appB1 = await seedApplication({ name: "Cofre da Beta", companyId: empresaB.id });
  const projA1 = await seedProject({ name: "Projeto Alfa Um", applicationId: appA1.id, companyId: empresaA.id });
  const projA2 = await seedProject({ name: "Projeto Alfa Dois", applicationId: appA2.id, companyId: empresaA.id });
  const projB1 = await seedProject({ name: "Projeto Beta Secreto", applicationId: appB1.id, companyId: empresaB.id });

  const admin = await seedUser({ name: "Admin Geral", email: "admin@vulnera.local", password: SENHA, role: "ADMIN" });
  const clientA = await seedUser({ name: "Cliente Alfa", email: "a@alfa.local", password: SENHA, role: "CLIENT", companyId: empresaA.id });
  const clientB = await seedUser({ name: "Cliente Beta", email: "b@beta.local", password: SENHA, role: "CLIENT", companyId: empresaB.id });
  const pentester = await seedUser({ name: "Pentester Um", email: "pt@vulnera.local", password: SENHA, role: "PENTESTER" });
  await seedProjectMember(projA1.id, pentester.id);

  const base = (p: typeof projA1, app: typeof appA1, empresa: typeof empresaA) => ({
    projectId: p.id,
    applicationId: app.id,
    companyId: empresa.id,
    createdBy: admin.id,
  });
  const dias = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000);
  const defs: Array<[string, "A" | "B", "A1" | "A2" | "B1", ReturnType<typeof base>, string, string, number]> = [
    ["SQL Injection no login", "A", "A1", base(projA1, appA1, empresaA), "CRITICAL", "OPEN", 1],
    ["XSS refletido na busca", "A", "A1", base(projA1, appA1, empresaA), "HIGH", "IN_PROGRESS", 2],
    ["Cabeçalho de segurança ausente", "A", "A1", base(projA1, appA1, empresaA), "LOW", "FIXED", 3],
    ["IDOR em pedidos", "A", "A2", base(projA2, appA2, empresaA), "MEDIUM", "OPEN", 4],
    ["Credencial padrão no painel", "A", "A2", base(projA2, appA2, empresaA), "CRITICAL", "CLOSED", 5],
    ["Vazamento do cofre da Beta", "B", "B1", base(projB1, appB1, empresaB), "CRITICAL", "OPEN", 6],
    ["Token JWT sem expiração", "B", "B1", base(projB1, appB1, empresaB), "HIGH", "OPEN", 7],
  ];
  const findings: Cenario["findings"] = [];
  for (const [title, empresa, projeto, ids, severidade, status, d] of defs) {
    const v = await seedVulnerability({ ...ids, title, severityCalculated: severidade, severityFinal: severidade, status, createdAt: dias(d) });
    findings.push({ id: v.id, title, empresa, projeto });
  }

  return {
    adminToken: await loginAs(app, admin.email, SENHA),
    clientAToken: await loginAs(app, clientA.email, SENHA),
    clientBToken: await loginAs(app, clientB.email, SENHA),
    pentesterToken: await loginAs(app, pentester.email, SENHA),
    empresaA,
    empresaB,
    projA1,
    projA2,
    projB1,
    appA1,
    appA2,
    appB1,
    admin,
    pentester,
    clientA,
    findings,
  };
}

/** Os ids da LISTAGEM (todas as páginas), na ordem em que ela os devolve. */
async function idsDaListagem(token: string, query = ""): Promise<{ ids: string[]; total: number }> {
  const ids: string[] = [];
  let total = 0;
  for (let pagina = 1; ; pagina++) {
    const res = await request(app)
      .get(`/api/vulnerabilities?${query}${query ? "&" : ""}page=${pagina}&pageSize=100`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    ids.push(...res.body.data.map((d: { id: string }) => d.id));
    total = res.body.pagination.total;
    if (pagina >= res.body.pagination.totalPages) break;
  }
  return { ids, total };
}

const idsDoArquivo = (linhas: Array<Record<string, unknown>>): string[] => linhas.map((l) => String(l["ID"]));
const titulosDoArquivo = (linhas: Array<Record<string, unknown>>): string[] => linhas.map((l) => String(l["Título"]));

describe("Exportação Excel de findings", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  /* ======================================================================
     Conteúdo e coerência
     ====================================================================== */

  it("FX-I-01 ADMIN sem filtro: todos os findings, abas na ordem, Auxiliar oculta, headers corretos", async () => {
    const c = await montarCenario();
    const r = await exportarXlsx(app, c.adminToken);

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain(XLSX_MIME);
    expect(r.headers["content-disposition"]).toMatch(/^attachment; filename="findings_todos_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx"/);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");

    const wb = r.wb!;
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Findings", "Dashboard", "Acompanhamento", "Auxiliar"]);
    expect(wb.getWorksheet("Auxiliar")!.state).toBe("hidden");

    const linhas = linhasDeFindings(wb);
    expect(idsDoArquivo(linhas).sort()).toEqual(c.findings.map((f) => f.id).sort());

    const resumo = wb.getWorksheet("Resumo")!;
    expect(valorDe(resumo.getCell("B6"))).toBe("Admin Geral");
    expect(valorDe(resumo.getCell("B7"))).toBe("Administrador");
    expect(valorDe(resumo.getCell("B9"))).toBe(7);
    expect(textoDeTudo(wb)).toContain("Nenhum filtro aplicado");
  });

  it("FX-I-02 com filtro: só o recorte, e o total bate com a listagem", async () => {
    const c = await montarCenario();
    const consulta = "severity=CRITICAL,HIGH&status=OPEN,IN_PROGRESS";
    const r = await exportarXlsx(app, c.adminToken, consulta);
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toContain("findings_filtrado_");

    const arquivo = idsDoArquivo(linhasDeFindings(r.wb!));
    const lista = await idsDaListagem(c.adminToken, consulta);

    expect(lista.total).toBe(4); // SQLi, XSS, Vazamento, JWT
    expect(arquivo).toHaveLength(lista.total);
    expect([...arquivo].sort()).toEqual([...lista.ids].sort());
    expect(valorDe(r.wb!.getWorksheet("Resumo")!.getCell("B9"))).toBe(lista.total);
    // Os filtros aplicados aparecem no arquivo, em português.
    const texto = textoDeTudo(r.wb!);
    expect(texto).toContain("Crítica, Alta");
    expect(texto).toContain("Aberto, Em andamento");
  });

  it("FX-I-03 ordenação customizada, inclusive severidade (caminho SQL), reproduz a ordem da listagem", async () => {
    const c = await montarCenario();
    for (const consulta of [
      "sortBy=title&sortOrder=asc",
      "sortBy=title&sortOrder=desc",
      "sortBy=severity&sortOrder=desc",
      "sortBy=severity&sortOrder=asc",
      "sortBy=createdAt&sortOrder=asc",
    ]) {
      const r = await exportarXlsx(app, c.adminToken, consulta);
      expect(r.status).toBe(200);
      expect(idsDoArquivo(linhasDeFindings(r.wb!))).toEqual((await idsDaListagem(c.adminToken, consulta)).ids);
    }
  });

  it("FX-I-04 busca textual combinada com filtros = listagem", async () => {
    const c = await montarCenario();
    const consulta = `search=${encodeURIComponent("injection")}&severity=CRITICAL&projectId=${c.projA1.id}`;
    const r = await exportarXlsx(app, c.adminToken, consulta);
    expect(r.status).toBe(200);
    const arquivo = idsDoArquivo(linhasDeFindings(r.wb!));
    expect(arquivo).toEqual((await idsDaListagem(c.adminToken, consulta)).ids);
    expect(titulosDoArquivo(linhasDeFindings(r.wb!))).toEqual(["SQL Injection no login"]);
    expect(textoDeTudo(r.wb!)).toContain("Busca por texto");
  });

  it("FX-I-05 os números do Dashboard batem com a aba Findings", async () => {
    const c = await montarCenario();
    const r = await exportarXlsx(app, c.adminToken);
    const linhas = linhasDeFindings(r.wb!);
    // Lê o resultado EM CACHE direto do XML: é o que o LibreOffice e o Excel Online mostram sem recalcular.
    const xml = await xmlDaParte(r.buffer, PARTE.dashboard);
    const cache = (ref: string) => cacheDaCelula(xml, ref).valor;

    const contar = (campo: string, valor: string) => linhas.filter((l) => l[campo] === valor).length;
    const esperado = {
      total: linhas.length,
      critica: contar("Severidade", "Crítica"),
      alta: contar("Severidade", "Alta"),
      media: contar("Severidade", "Média"),
      baixa: contar("Severidade", "Baixa"),
      info: contar("Severidade", "Informativa"),
      abertos: contar("Status", "Aberto") + contar("Status", "Em andamento"),
      resolvidos: contar("Status", "Corrigido") + contar("Status", "Fechado"),
    };
    expect(esperado).toMatchObject({ total: 7, critica: 3, alta: 2, media: 1, baixa: 1, info: 0, abertos: 5, resolvidos: 2 });

    // Cards
    expect(cache("A5")).toBe(esperado.total);
    expect(cache("C5")).toBe(esperado.critica);
    expect(cache("E5")).toBe(esperado.alta);
    expect(cache("G5")).toBe(esperado.media);
    expect(cache("I5")).toBe(esperado.baixa);
    expect(cache("K5")).toBe(esperado.info); // zero também tem cache
    expect(cache("M5")).toBe(esperado.abertos);
    expect(cache("O5")).toBe(esperado.resolvidos);
    expect(cache("A8")).toBeCloseTo(esperado.abertos / esperado.total, 10);
    expect(cache("C8")).toBeCloseTo(esperado.resolvidos / esperado.total, 10);

    // Tabelas que alimentam os gráficos
    const sev = [esperado.critica, esperado.alta, esperado.media, esperado.baixa, esperado.info];
    sev.forEach((n, i) => expect(cache(`B${DASH.sevIni + i}`)).toBe(n));
    expect(cache(`B${DASH.sevIni + 5}`)).toBe(esperado.total);
    const status = ["Aberto", "Em andamento", "Corrigido", "Fechado"].map((s) => contar("Status", s));
    status.forEach((n, i) => expect(cache(`B${DASH.statusIni + i}`)).toBe(n));

    // Top 10: cada linha é um ativo real, com a contagem real
    const porAtivo = new Map<string, number>();
    for (const l of linhas) porAtivo.set(String(l["Ativo (aplicação)"]), (porAtivo.get(String(l["Ativo (aplicação)"])) ?? 0) + 1);
    const esperadoTop = [...porAtivo.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
    esperadoTop.forEach(([nome, n], i) => {
      expect(cache(`B${DASH.topIni + i}`)).toBe(nome);
      expect(cache(`F${DASH.topIni + i}`)).toBe(n);
    });

    // E as fórmulas estão vivas (não são valores colados): o Dashboard lê da aba Findings.
    expect(cacheDaCelula(xml, "A5").formula).toContain("f_ID");
    expect(cacheDaCelula(xml, `B${DASH.sevIni}`).formula).toContain("COUNTIF(f_Sev");
    expect(cacheDaCelula(xml, "E8").formula).toContain("data_ref");
  });

  it("FX-I-06 Acompanhamento: pré-preenche o que o sistema sabe, valida, protege e calcula", async () => {
    const c = await montarCenario();
    const alvo = c.findings[0]!; // SQL Injection, OPEN, projeto A1
    await prisma.vulnerability.update({
      where: { id: alvo.id },
      data: { assignedTo: c.pentester.id, slaDueAt: new Date("2026-09-20T15:00:00Z"), vrsScore: 90 },
    });
    const fechado = c.findings[4]!; // Credencial padrão, CLOSED
    await prisma.auditLog.create({
      data: {
        actorId: c.admin.id,
        companyId: c.empresaA.id,
        entityType: "Vulnerability",
        entityId: fechado.id,
        action: "STATUS_CHANGE",
        diffJson: JSON.stringify({ from: "IN_PROGRESS", to: "FIXED" }),
      },
    });

    const r = await exportarXlsx(app, c.adminToken);
    const ws = r.wb!.getWorksheet("Acompanhamento")!;
    const primeira = ACOMP.primeira;

    // Uma linha por finding
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push(String(valorDe(ws.getCell(`A${primeira + i}`))));
    expect(ids.sort()).toEqual(c.findings.map((f) => f.id).sort());

    // Pré-preenchimento: responsável, status, prazo, prioridade
    const linha = [...Array(7).keys()].map((i) => primeira + i).find((n) => valorDe(ws.getCell(`A${n}`)) === alvo.id)!;
    expect(valorDe(ws.getCell(`E${linha}`))).toBe("Pentester Um");
    expect(valorDe(ws.getCell(`F${linha}`))).toBe("Aberto");
    expect(valorDe(ws.getCell(`I${linha}`))).toBe("Imediato"); // VRS 90 → IMEDIATO
    const prazo = valorDe(ws.getCell(`G${linha}`)) as Date;
    expect(prazo.toISOString().slice(0, 10)).toBe("2026-09-20");

    // Data de resolução veio do AuditLog (primeira transição para FIXED), só para quem foi resolvido
    const linhaFechado = [...Array(7).keys()].map((i) => primeira + i).find((n) => valorDe(ws.getCell(`A${n}`)) === fechado.id)!;
    expect(valorDe(ws.getCell(`H${linhaFechado}`))).toBeInstanceOf(Date);
    expect(valorDe(ws.getCell(`H${linha}`))).toBeNull();

    // Colunas para preencher: destravadas e com validação. Calculadas: travadas.
    expect(ws.getCell(`E${linha}`).protection?.locked).toBe(false);
    expect(ws.getCell(`J${linha}`).protection?.locked).toBe(false);
    expect(ws.getCell(`K${linha}`).protection?.locked).not.toBe(false);
    expect(ws.getCell(`F${linha}`).dataValidation).toMatchObject({ type: "list" });
    expect(ws.getCell(`I${linha}`).dataValidation).toMatchObject({ type: "list" });
    expect(ws.getCell(`G${linha}`).dataValidation).toMatchObject({ type: "date" });
    expect((ws as unknown as { sheetProtection?: { sheet?: boolean } }).sheetProtection?.sheet).toBe(true);

    // Fórmulas: dias em aberto e situação do SLA, com resultado
    expect((ws.getCell(`K${linha}`).value as { formula: string }).formula).toContain("data_ref");
    expect((ws.getCell(`L${linha}`).value as { formula: string }).formula).toContain("Vencendo");
    expect(["Sem prazo", "No prazo", "Vencendo", "Vencido", "Resolvido s/ data"]).toContain(valorDe(ws.getCell(`L${linha}`)));
    expect(valorDe(ws.getCell(`L${linha}`))).toBe("Vencido"); // prazo 20/09/2026, referência = hoje (2026-10-22 ou depois)

    // Mini-resumo no topo
    expect(valorDe(ws.getCell("A3"))).toBe(7);
    expect(valorDe(ws.getCell("B3"))).toBe(1); // um IN_PROGRESS (XSS)
    expect(valorDe(ws.getCell("C3"))).toBe(2); // FIXED + CLOSED
    expect(valorDe(ws.getCell("E3"))).toBe(7); // alerta de vencimento (dias), padrão
  });

  it("FX-I-07 os gráficos nativos estão no pacote, ligados ao Dashboard", async () => {
    const c = await montarCenario();
    const r = await exportarXlsx(app, c.adminToken);
    const partes = await partesDoZip(r.buffer);
    for (const p of ["xl/charts/chart1.xml", "xl/charts/chart2.xml", "xl/charts/chart3.xml", "xl/charts/chart4.xml", "xl/drawings/drawing1.xml", "xl/worksheets/_rels/sheet3.xml.rels"]) {
      expect(partes).toContain(p);
    }

    // O Top 10 cobre só os ativos que existem (3 no cenário), não um intervalo fixo de 10 com barras vazias.
    const top10 = await xmlDaParte(r.buffer, "xl/charts/chart3.xml");
    expect(top10).toContain(`Dashboard!$F$${DASH.topIni}:$F$${DASH.topIni + 2}`);
    expect(top10).not.toContain(`$F$${DASH.topIni + 9}`);
    expect(top10).toContain('<c:ptCount val="3"/>');
  });

  it("FX-I-08 mais de um lote (1.250 findings): nenhuma linha perdida ou repetida, mesma ordem da listagem", async () => {
    const c = await montarCenario();
    const dados = Array.from({ length: 1250 }, (_, i) => ({
      projectId: c.projA1.id,
      applicationId: c.appA1.id,
      companyId: c.empresaA.id,
      createdBy: c.admin.id,
      title: `Carga ${String(i).padStart(4, "0")}`,
      description: "gerado para o teste de lotes",
      owaspCategory: "A03",
      severityCalculated: "MEDIUM",
      severityFinal: "MEDIUM",
      status: "OPEN",
      createdAt: new Date(Date.UTC(2026, 0, 1) + (i % 50) * 86_400_000), // muitas datas repetidas: o desempate por id é o que segura a ordem
    }));
    await prisma.vulnerability.createMany({ data: dados });

    const consulta = "sortBy=createdAt&sortOrder=asc";
    const r = await exportarXlsx(app, c.adminToken, consulta);
    expect(r.status).toBe(200);
    const arquivo = idsDoArquivo(linhasDeFindings(r.wb!));
    expect(arquivo).toHaveLength(1257);
    expect(new Set(arquivo).size).toBe(1257);
    expect(arquivo).toEqual((await idsDaListagem(c.adminToken, consulta)).ids);
  }, 60_000);

  /* ======================================================================
     Segurança do arquivo
     ====================================================================== */

  it("FX-I-10 injeção de fórmula: o dado fica INTACTO e vai como texto, nunca como fórmula", async () => {
    const c = await montarCenario();
    const perigosos = [
      { campo: "title", valor: '=HYPERLINK("http://evil.example","clique")' },
      { campo: "title", valor: "+cmd|' /C calc'!A0" },
      { campo: "title", valor: "-2+3" },
      { campo: "title", valor: "@SUM(1+1)" },
      { campo: "title", valor: "\t=1+1" },
    ];
    for (const p of perigosos) {
      await seedVulnerability({
        projectId: c.projA1.id,
        applicationId: c.appA1.id,
        companyId: c.empresaA.id,
        createdBy: c.admin.id,
        title: p.valor,
        description: "=cmd|' /C calc'!A0",
      });
    }
    // O nome do ativo também é texto livre — e alimenta o ranking do Dashboard.
    const appPerigosa = await seedApplication({ name: "=App*perigosa?", companyId: c.empresaA.id });
    const projPerigoso = await seedProject({ name: "+Projeto", applicationId: appPerigosa.id, companyId: c.empresaA.id });
    await seedVulnerability({ projectId: projPerigoso.id, applicationId: appPerigosa.id, companyId: c.empresaA.id, createdBy: c.admin.id, title: "normal" });

    const r = await exportarXlsx(app, c.adminToken, `search=${encodeURIComponent("")}`);
    expect(r.status).toBe(200);
    const ws = r.wb!.getWorksheet("Findings")!;

    let achados = 0;
    ws.eachRow((row, n) => {
      if (n === 1) return;
      for (const col of [2, 5, 6, 21]) {
        // Título, Ativo, Projeto, Descrição
        const cell = row.getCell(col);
        const texto = typeof cell.value === "string" ? cell.value : "";
        if (/^[=+\-@\t]/.test(texto)) {
          achados += 1;
          // Texto puro (não um objeto de fórmula) e com formato TEXTO: editar a célula não a transforma em fórmula.
          expect(typeof cell.value).toBe("string");
          expect(cell.numFmt).toBe("@");
        }
      }
    });
    expect(achados).toBeGreaterThanOrEqual(perigosos.length + 5 + 1 + 1);

    // O valor original está preservado, caractere a caractere.
    const titulos = new Set(titulosDoArquivo(linhasDeFindings(r.wb!)));
    for (const p of perigosos) expect(titulos).toContain(p.valor);

    // E na aba Acompanhamento e no ranking do Dashboard também.
    const acomp = r.wb!.getWorksheet("Acompanhamento")!;
    const tituloAcomp: string[] = [];
    acomp.eachRow((row, n) => {
      if (n >= ACOMP.primeira) tituloAcomp.push(String(valorDe(row.getCell(2))));
    });
    expect(tituloAcomp).toContain('=HYPERLINK("http://evil.example","clique")');
    const dash = r.wb!.getWorksheet("Dashboard")!;
    const ranking = [...Array(10).keys()].map((i) => valorDe(dash.getCell(`B${DASH.topIni + i}`)));
    expect(ranking).toContain("=App*perigosa?");

    // Nenhuma célula de DADOS virou fórmula vinda de dado externo: as únicas fórmulas são as nossas.
    const formulasEstranhas: string[] = [];
    for (const nome of ["Findings", "Acompanhamento"]) {
      r.wb!.getWorksheet(nome)!.eachRow((row, n) => {
        if (n < (nome === "Findings" ? 2 : ACOMP.primeira)) return;
        row.eachCell((cell) => {
          const v = cell.value as { formula?: string } | null;
          if (v && typeof v === "object" && "formula" in v && !/data_ref/.test(String(v.formula))) formulasEstranhas.push(String(v.formula));
        });
      });
    }
    expect(formulasEstranhas).toEqual([]);
  });

  it("FX-I-11 texto acima do limite da célula é truncado COM marcador explícito, nunca em silêncio", async () => {
    const c = await montarCenario();
    const longo = await seedVulnerability({
      projectId: c.projA1.id,
      applicationId: c.appA1.id,
      companyId: c.empresaA.id,
      createdBy: c.admin.id,
      title: "Descrição gigante",
      description: "d".repeat(40_000),
    });
    const r = await exportarXlsx(app, c.adminToken, `projectId=${c.projA1.id}&search=Descri`);
    expect(r.status).toBe(200);
    const linha = linhasDeFindings(r.wb!).find((l) => l["ID"] === longo.id)!;
    const desc = String(linha["Descrição"]);
    expect(desc.length).toBeLessThanOrEqual(32_767);
    expect(desc).toMatch(/\[… truncado: 7\.300 caracteres omitidos\]$/);
    expect(desc.startsWith("d".repeat(32_700))).toBe(true);

    const trilha = await prisma.auditLog.findFirst({ where: { action: "FINDINGS_EXPORTED" } });
    expect(JSON.parse(trilha!.diffJson!).camposTruncados).toBe(1);
  });

  it("FX-I-12 acentuação, emoji e caracteres ilegais em XML não corrompem o arquivo", async () => {
    const c = await montarCenario();
    const titulo = "Injeção — ñ 日本語 😀 “aspas” <b>&amp;</b>";
    await seedVulnerability({
      projectId: c.projA1.id,
      applicationId: c.appA1.id,
      companyId: c.empresaA.id,
      createdBy: c.admin.id,
      title: titulo,
      description: "linha1\nlinha2\r\nlinha3\ttab\u0000\u0007\u001Fcontrole",
    });
    const r = await exportarXlsx(app, c.adminToken, `search=${encodeURIComponent("Injeção —")}`);
    expect(r.status).toBe(200); // o arquivo abriu de volta: o XML é válido

    // No XML cru o texto está escapado UMA vez (&amp;amp; é o "&amp;" literal do título).
    // (O leitor do ExcelJS decodifica entidades duas vezes; por isso a prova é no XML, não na leitura.)
    const xml = await xmlDaParte(r.buffer, PARTE.findings);
    expect(xml).toContain("Injeção — ñ 日本語 😀 “aspas” &lt;b&gt;&amp;amp;&lt;/b&gt;");
    // Os caracteres ilegais saíram; a quebra CRLF virou LF; TAB ficou.
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(xml).toContain("linha1\nlinha2\nlinha3\ttabcontrole");

    const linha = linhasDeFindings(r.wb!)[0]!;
    expect(String(linha["Título"]).startsWith("Injeção — ñ 日本語 😀 “aspas”")).toBe(true);
    expect(String(linha["Descrição"])).toBe("linha1\nlinha2\nlinha3\ttabcontrole");
  });

  it("FX-I-13 campos nulos e vazios viram célula vazia, não 'null' nem erro", async () => {
    const c = await montarCenario();
    const r = await exportarXlsx(app, c.adminToken, `projectId=${c.projA1.id}&search=Cabe%C3%A7alho`);
    expect(r.status).toBe(200);
    const [linha] = linhasDeFindings(r.wb!);
    expect(linha!["Responsável"] ?? null).toBeNull();
    expect(linha!["Impacto"] ?? null).toBeNull();
    expect(linha!["Recomendação"] ?? null).toBeNull();
    expect(linha!["VRS"] ?? null).toBeNull();
    expect(linha!["CWE"] ?? null).toBeNull();
    expect(linha!["Prazo do SLA"] ?? null).toBeNull();
    // Vazio é vazio: nenhuma célula carrega o TEXTO "null", "undefined" ou "NaN".
    for (const v of Object.values(linha!)) if (v !== null && v !== undefined) expect(["null", "undefined", "NaN"]).not.toContain(String(v));
    expect(linha!["Origem"]).toBe("Manual");
    expect(linha!["Aceite de risco"]).toBe("Não");
  });

  it("FX-I-14 zero resultados e um resultado produzem arquivos válidos", async () => {
    const c = await montarCenario();

    const vazio = await exportarXlsx(app, c.adminToken, "severity=NONE");
    expect(vazio.status).toBe(200);
    expect(linhasDeFindings(vazio.wb!)).toHaveLength(0);
    const dash = await xmlDaParte(vazio.buffer, PARTE.dashboard);
    expect(cacheDaCelula(dash, "A5").valor).toBe(0);
    expect(cacheDaCelula(dash, "A8").valor).toBe(0); // % sem divisão por zero
    expect(cacheDaCelula(dash, "E8").valor).toBe(0); // idade média sem divisão por zero
    expect(cacheDaCelula(await xmlDaParte(vazio.buffer, PARTE.resumo), "B9").valor).toBe(0);
    expect(cacheDaCelula(await xmlDaParte(vazio.buffer, PARTE.acompanhamento), "A3").valor).toBe(0);
    // Sem dados não há ranking nem evolução, mas severidade e status continuam desenhados.
    const graficos = (await partesDoZip(vazio.buffer)).filter((p) => p.startsWith("xl/charts/"));
    expect(graficos).toHaveLength(2);

    const um = await exportarXlsx(app, c.adminToken, `projectId=${c.projB1.id}&search=JWT`);
    expect(um.status).toBe(200);
    expect(titulosDoArquivo(linhasDeFindings(um.wb!))).toEqual(["Token JWT sem expiração"]);
    expect(cacheDaCelula(await xmlDaParte(um.buffer, PARTE.dashboard), "A5").valor).toBe(1);
  });

  it("FX-I-15 finding promovido de DAST traz Origem=DAST e o CWE; sem CWE no scan fica vazio; o manual nunca tem CWE", async () => {
    const c = await montarCenario();
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://example.com", requestedById: c.admin.id } });
    const base = { scanId: scan.id, pluginId: "40018", risk: "HIGH" as const, confidence: "High", url: "https://example.com/x", normalizedUrl: "https://example.com/x" };
    const numerico = await prisma.dastFinding.create({ data: { ...base, fingerprint: "a".repeat(64), title: "SQL Injection", cweId: "89" } });
    const prefixado = await prisma.dastFinding.create({ data: { ...base, fingerprint: "b".repeat(64), title: "XSS", cweId: "CWE-79" } });
    const semCwe = await prisma.dastFinding.create({ data: { ...base, fingerprint: "c".repeat(64), title: "Info", cweId: null } });
    const [f0, f1, f2, f3] = c.findings;
    for (const [f, dast] of [[f0, numerico], [f1, prefixado], [f2, semCwe]] as const) {
      await prisma.vulnerability.update({ where: { id: f!.id }, data: { sourceType: "DAST_IMPORT", sourceDastFindingId: dast.id } });
    }

    const r = await exportarXlsx(app, c.adminToken);
    const porId = new Map(linhasDeFindings(r.wb!).map((l) => [String(l["ID"]), l]));
    expect(porId.get(f0!.id)).toMatchObject({ Origem: "DAST", CWE: "CWE-89" });
    expect(porId.get(f1!.id)).toMatchObject({ Origem: "DAST", CWE: "CWE-79" }); // não vira "CWE-CWE-79"
    expect(porId.get(f2!.id)!["Origem"]).toBe("DAST");
    expect(porId.get(f2!.id)!["CWE"] ?? null).toBeNull();
    expect(porId.get(f3!.id)!["Origem"]).toBe("Manual");
    expect(porId.get(f3!.id)!["CWE"] ?? null).toBeNull();
  });

  /* ======================================================================
     RBAC e tenancy — nos dois sentidos
     ====================================================================== */

  it("FX-I-20 CLIENT só exporta a própria empresa — mesmo manipulando parâmetros", async () => {
    const c = await montarCenario();
    const daAlfa = c.findings.filter((f) => f.empresa === "A").map((f) => f.id).sort();
    const daBeta = c.findings.filter((f) => f.empresa === "B").map((f) => f.id).sort();

    for (const consulta of [
      "",
      `companyId=${c.empresaB.id}`, // descartado para quem não é ADMIN
      `companyId=${c.empresaB.id},${c.empresaA.id}`,
      `companyId[]=${c.empresaB.id}`,
      `createdBy=${c.admin.id}&companyId=${c.empresaB.id}`,
    ]) {
      const r = await exportarXlsx(app, c.clientAToken, consulta);
      expect(r.status).toBe(200);
      const ids = idsDoArquivo(linhasDeFindings(r.wb!)).sort();
      expect(ids).toEqual(daAlfa);
      for (const id of daBeta) expect(ids).not.toContain(id);
    }

    // Sentido inverso: o CLIENT da Beta nunca vê a Alfa.
    const b = await exportarXlsx(app, c.clientBToken, `companyId=${c.empresaA.id}`);
    expect(idsDoArquivo(linhasDeFindings(b.wb!)).sort()).toEqual(daBeta);
    expect(valorDe(b.wb!.getWorksheet("Resumo")!.getCell("B7"))).toBe("Cliente");

    // E o arquivo inteiro (todas as abas, inclusive a oculta) não cita a outra empresa.
    const texto = textoDeTudo((await exportarXlsx(app, c.clientAToken)).wb!);
    for (const segredo of ["Cofre da Beta", "Projeto Beta Secreto", "Empresa Beta Sigilosa", "Vazamento do cofre da Beta", "Token JWT sem expiração"]) {
      expect(texto).not.toContain(segredo);
    }
    // O Dashboard do CLIENT soma só os findings dele.
    const dash = (await exportarXlsx(app, c.clientAToken)).wb!.getWorksheet("Dashboard")!;
    expect(valorDe(dash.getCell("A5"))).toBe(daAlfa.length);
  });

  it("FX-I-21 CLIENT: projeto de outro tenant → 403; projeto inexistente → 404; sem arquivo e sem auditoria", async () => {
    const c = await montarCenario();
    const alheio = await exportarXlsx(app, c.clientAToken, `projectId=${c.projB1.id}`);
    expect(alheio.status).toBe(403);
    expect(alheio.json).toEqual({ error: "FORBIDDEN" });
    expect(alheio.wb).toBeNull();

    const inexistente = await exportarXlsx(app, c.clientAToken, "projectId=cm0000000000000000000000x");
    expect(inexistente.status).toBe(404);
    expect(inexistente.json).toEqual({ error: "PROJECT_NOT_FOUND" });

    expect(await prisma.auditLog.count({ where: { action: "FINDINGS_EXPORTED" } })).toBe(0);

    // O próprio projeto continua acessível ao CLIENT dono (aba Findings do projeto).
    const proprio = await exportarXlsx(app, c.clientAToken, `projectId=${c.projA1.id}`);
    expect(proprio.status).toBe(200);
    expect(idsDoArquivo(linhasDeFindings(proprio.wb!)).sort()).toEqual(c.findings.filter((f) => f.projeto === "A1").map((f) => f.id).sort());
    expect(proprio.headers["content-disposition"]).toContain("findings_projeto-alfa-um_");
  });

  it("FX-I-22 filtrar por recurso de OUTRO tenant: 0 linhas, e nenhum nome dele vaza no arquivo", async () => {
    const c = await montarCenario();
    for (const consulta of [`applicationId=${c.appB1.id}`, `projectId=${c.projB1.id},${c.projA1.id}&applicationId=${c.appB1.id}`, `assignedTo=${c.admin.id}`]) {
      const r = await exportarXlsx(app, c.clientAToken, consulta);
      expect(r.status).toBe(200);
      const linhas = linhasDeFindings(r.wb!);
      for (const l of linhas) expect(String(l["Empresa"])).not.toBe("Empresa Beta Sigilosa");

      const texto = textoDeTudo(r.wb!);
      for (const segredo of ["Cofre da Beta", "Projeto Beta Secreto", "Empresa Beta Sigilosa"]) expect(texto).not.toContain(segredo);
    }

    // O Resumo mostra o id CRU que o usuário mandou, não o nome do recurso alheio.
    const r = await exportarXlsx(app, c.clientAToken, `applicationId=${c.appB1.id}`);
    expect(r.status).toBe(200);
    expect(linhasDeFindings(r.wb!)).toHaveLength(0);
    expect(textoDeTudo(r.wb!)).toContain(c.appB1.id);
  });

  it("FX-I-23 PENTESTER só exporta projetos onde é membro; o resto é recusado ou vazio", async () => {
    const c = await montarCenario();
    const r = await exportarXlsx(app, c.pentesterToken);
    expect(r.status).toBe(200);
    expect(idsDoArquivo(linhasDeFindings(r.wb!)).sort()).toEqual(c.findings.filter((f) => f.projeto === "A1").map((f) => f.id).sort());
    expect(valorDe(r.wb!.getWorksheet("Resumo")!.getCell("B7"))).toBe("Pentester");

    // Projeto onde NÃO é membro (mesma empresa, inclusive): recusado.
    expect((await exportarXlsx(app, c.pentesterToken, `projectId=${c.projA2.id}`)).status).toBe(403);
    expect((await exportarXlsx(app, c.pentesterToken, `projectId=${c.projB1.id}`)).status).toBe(403);

    // Filtros que apontariam para fora do escopo apenas não casam; nada vaza.
    for (const consulta of [`applicationId=${c.appA2.id}`, `companyId=${c.empresaB.id}`, `projectId=${c.projA1.id},${c.projB1.id}`]) {
      const x = await exportarXlsx(app, c.pentesterToken, consulta);
      expect(x.status).toBe(200);
      for (const l of linhasDeFindings(x.wb!)) expect(["Projeto Alfa Um"]).toContain(String(l["Projeto"]));
      expect(textoDeTudo(x.wb!)).not.toContain("Cofre da Beta");
    }
  });

  it("FX-I-24 ADMIN filtra por empresa e por projeto; o nome do arquivo vem do projeto", async () => {
    const c = await montarCenario();
    const empresa = await exportarXlsx(app, c.adminToken, `companyId=${c.empresaB.id}`);
    expect(idsDoArquivo(linhasDeFindings(empresa.wb!)).sort()).toEqual(c.findings.filter((f) => f.empresa === "B").map((f) => f.id).sort());
    expect(empresa.headers["content-disposition"]).toContain("findings_filtrado_");
    // O ADMIN PODE ver o nome do que filtrou.
    expect(textoDeTudo(empresa.wb!)).toContain("Empresa Beta Sigilosa");

    const projeto = await exportarXlsx(app, c.adminToken, `projectId=${c.projB1.id}`);
    expect(projeto.headers["content-disposition"]).toContain("findings_projeto-beta-secreto_");
    expect(textoDeTudo(projeto.wb!)).toContain("Projeto Beta Secreto");
  });

  it("FX-I-25 CLIENT sem empresa vinculada: arquivo vazio e sem vazamento", async () => {
    const c = await montarCenario();
    await seedUser({ name: "Órfão", email: "orfao@x.local", password: SENHA, role: "CLIENT" });
    const token = await loginAs(app, "orfao@x.local", SENHA);
    const r = await exportarXlsx(app, token);
    expect(r.status).toBe(200);
    expect(linhasDeFindings(r.wb!)).toHaveLength(0);
    expect(textoDeTudo(r.wb!)).not.toContain("Alfa");
    void c;
  });

  it("FX-I-26 sem token → 401", async () => {
    const r = await exportarXlsx(app, null);
    expect(r.status).toBe(401);
    expect(r.wb).toBeNull();
  });

  /* ======================================================================
     Protocolo
     ====================================================================== */

  it("FX-I-30 parâmetro inválido devolve o MESMO erro da listagem", async () => {
    const c = await montarCenario();
    for (const [consulta, codigo] of [
      ["severity=URGENTE", "INVALID_SEVERITY"],
      ["status=ABERTO", "INVALID_STATUS"],
      ["owaspCategory=A99", "INVALID_OWASP_CATEGORY"],
      ["sortBy=password", "INVALID_SORT_BY"],
      ["sortOrder=sideways", "INVALID_SORT_ORDER"],
      ["createdFrom=ontem", "INVALID_CREATED_FROM"],
      ["vrsMin=80&vrsMax=10", "INVALID_VRS_RANGE"],
      [`search=${"x".repeat(201)}`, "INVALID_SEARCH"],
    ] as const) {
      const exp = await exportarXlsx(app, c.adminToken, consulta);
      const lista = await request(app).get(`/api/vulnerabilities?${consulta}`).set("Authorization", `Bearer ${c.adminToken}`);
      expect(exp.status).toBe(400);
      expect(exp.json).toEqual({ error: codigo });
      expect(lista.body).toEqual({ error: codigo });
    }
    expect(await prisma.auditLog.count({ where: { action: "FINDINGS_EXPORTED" } })).toBe(0);
  });

  it("FX-I-31 'export.xlsx' é uma rota própria, não um id capturado por /:id", async () => {
    const c = await montarCenario();
    const r = await exportarXlsx(app, c.adminToken);
    expect(r.status).toBe(200); // /:id teria respondido 404 (finding "export.xlsx" inexistente)
    // page e pageSize são ignorados: exportar é o recorte inteiro.
    const paginado = await exportarXlsx(app, c.adminToken, "page=2&pageSize=1");
    expect(linhasDeFindings(paginado.wb!)).toHaveLength(7);
  });

  it("FX-I-33 a web é outra origem: Content-Disposition e Retry-After são EXPOSTOS via CORS", async () => {
    const c = await montarCenario();
    const res = await request(app)
      .get("/api/vulnerabilities/export.xlsx")
      .set("Authorization", `Bearer ${c.adminToken}`)
      .set("Origin", "http://localhost:3000")
      .buffer(true)
      .parse((r, cb) => {
        r.on("data", () => undefined);
        r.on("end", () => cb(null, Buffer.alloc(0)));
      });
    expect(res.status).toBe(200);
    // Sem isto o navegador esconde o header e o nome do arquivo cai no padrão do front.
    const expostos = String(res.headers["access-control-expose-headers"]).toLowerCase();
    expect(expostos).toContain("content-disposition");
    expect(expostos).toContain("retry-after");
  });

  it("FX-I-32 auditoria: quem, quando, filtros e quantidade — e nada quando a requisição é recusada", async () => {
    const c = await montarCenario();
    const antes = Date.now();
    const r = await exportarXlsx(app, c.clientAToken, `severity=CRITICAL,HIGH&sortBy=title&sortOrder=asc&page=9`);
    expect(r.status).toBe(200);

    const trilhas = await prisma.auditLog.findMany({ where: { action: "FINDINGS_EXPORTED" } });
    expect(trilhas).toHaveLength(1);
    const t = trilhas[0]!;
    expect(t.actorId).toBe(c.clientA.id);
    expect(t.companyId).toBe(c.empresaA.id);
    expect(t.entityType).toBe("FindingsExport");
    expect(t.createdAt.getTime()).toBeGreaterThanOrEqual(antes - 5_000);

    const diff = JSON.parse(t.diffJson!);
    expect(diff).toMatchObject({ formato: "xlsx", linhas: 3, camposTruncados: 0, escopo: "COMPANY" });
    expect(diff.filtros).toMatchObject({ severities: ["CRITICAL", "HIGH"], sortBy: "title", sortOrder: "asc" });
    expect(diff.filtros).not.toHaveProperty("page");

    // A trilha do FINDING não é poluída: a exportação não é um evento de nenhum finding.
    expect(await prisma.auditLog.count({ where: { entityType: "Vulnerability" } })).toBe(0);

    // ADMIN: escopo TODAS e sem empresa.
    await exportarXlsx(app, c.adminToken);
    const doAdmin = await prisma.auditLog.findFirst({ where: { actorId: c.admin.id, action: "FINDINGS_EXPORTED" } });
    expect(JSON.parse(doAdmin!.diffJson!).escopo).toBe("TODAS");
    expect(doAdmin!.companyId).toBeNull();
  });
});
