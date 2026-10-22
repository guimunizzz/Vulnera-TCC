/**
 * findings-xlsx-agregados-filtros.test.ts
 *
 * O cálculo por trás do Dashboard e do Acompanhamento, e o que a planilha
 * diz sobre o recorte (filtros, nome do arquivo, auditoria). Sem banco.
 *
 *   FX-U-20  situação do SLA — a árvore inteira, com as fronteiras
 *   FX-U-21  dias em aberto
 *   FX-U-22  agregados: severidade, status, abertos × resolvidos, idade média
 *   FX-U-23  ranking de ativos: sem diferenciar caixa, desempate determinístico
 *   FX-U-24  linha do Acompanhamento
 *   FX-U-25  períodos do gráfico de evolução (semana × mês, teto)
 *   FX-U-30  nome do arquivo: escopo e nome hostil
 *   FX-U-31  existe filtro?
 *   FX-U-32  filtros no Resumo: id sem nome sai CRU (nunca nome de outro tenant)
 *   FX-U-33  o filtro da auditoria não carrega paginação nem escopo interno
 *   FX-U-34  a configuração do limite nunca cai em "sem limite"
 */

import type { FindingsExportRow } from "../../src/models/findings-export.model";
import type { VulnerabilityQuery } from "../../src/models/vulnerability.model";
import {
  Agregados,
  LIMITE_SEMANAL_DIAS,
  MAX_PERIODOS,
  diasEmAberto,
  situacaoSla,
} from "../../src/utils/findings-xlsx/agregados";
import {
  descreverFiltros,
  descreverOrdenacao,
  filtroParaAuditoria,
  nomeDoArquivo,
  slugDoNome,
  temFiltroAtivo,
  type RotulosResolvidos,
} from "../../src/utils/findings-xlsx/filtros";
import { dataDoDia, relogioSP } from "../../src/utils/findings-xlsx/tempo";
import { EXPORT_MAX_ROWS_PADRAO, loadExportMaxRows } from "../../src/config/export.config";

const REF = 46317; // 22/10/2026

const dia = (serial: number, hora = 12): Date => new Date(dataDoDia(serial).getTime() + hora * 3_600_000 + 3 * 3_600_000); // meio-dia em SP, expresso em UTC

function linha(sobre: Partial<FindingsExportRow> = {}): FindingsExportRow {
  return {
    id: "id-1",
    title: "SQL Injection",
    description: "d",
    impact: null,
    recommendation: null,
    severityFinal: "CRITICAL",
    severityCalculated: "CRITICAL",
    cvssScore: 9.8,
    status: "OPEN",
    owaspCategory: "A03",
    projectName: "P",
    applicationName: "App A",
    companyName: "C",
    slaState: "ON_TRACK",
    slaDueAt: null,
    vrsScore: 90,
    vrsBand: "IMEDIATO",
    hasActiveRiskAcceptance: false,
    assigneeName: null,
    sourceType: "MANUAL",
    cweId: null,
    resolvedAt: null,
    createdAt: dia(REF - 10),
    updatedAt: dia(REF - 10),
    ...sobre,
  };
}

function consulta(sobre: Partial<VulnerabilityQuery> = {}): VulnerabilityQuery {
  return {
    projectIds: [],
    applicationIds: [],
    companyIds: [],
    createdByIds: [],
    severities: [],
    statuses: [],
    owaspCategories: [],
    slaStates: [],
    riskAcceptances: [],
    assignedToIds: [],
    page: 1,
    pageSize: 25,
    sortBy: "createdAt",
    sortOrder: "desc",
    ...sobre,
  };
}

const SEM_ROTULOS: RotulosResolvidos = { projetos: new Map(), aplicacoes: new Map(), empresas: new Map(), responsaveis: new Map() };

describe("findings-xlsx · situação do SLA e dias em aberto", () => {
  const base = { status: "Aberto", resolucao: null as Date | null };
  const prazoEm = (serial: number): Date => dataDoDia(serial);

  it("FX-U-20 sem prazo não afirma nada", () => {
    expect(situacaoSla({ ...base, prazo: null }, REF, 7)).toBe("Sem prazo");
  });

  it("FX-U-20 aberto: vencido depois do prazo, vencendo na janela, no prazo fora dela", () => {
    expect(situacaoSla({ ...base, prazo: prazoEm(REF - 1) }, REF, 7)).toBe("Vencido");
    expect(situacaoSla({ ...base, prazo: prazoEm(REF) }, REF, 7)).toBe("Vencendo"); // vence HOJE ainda não venceu
    expect(situacaoSla({ ...base, prazo: prazoEm(REF + 7) }, REF, 7)).toBe("Vencendo"); // fronteira da janela
    expect(situacaoSla({ ...base, prazo: prazoEm(REF + 8) }, REF, 7)).toBe("No prazo");
  });

  it("FX-U-20 a janela de alerta é o parâmetro, não um número fixo", () => {
    expect(situacaoSla({ ...base, prazo: prazoEm(REF + 3) }, REF, 2)).toBe("No prazo");
    expect(situacaoSla({ ...base, prazo: prazoEm(REF + 3) }, REF, 3)).toBe("Vencendo");
    expect(situacaoSla({ ...base, prazo: prazoEm(REF + 3) }, REF, 0)).toBe("No prazo");
  });

  it("FX-U-20 com data de resolução compara resolução × prazo, ignorando a referência", () => {
    const prazo = prazoEm(REF - 30);
    expect(situacaoSla({ status: "Fechado", prazo, resolucao: dataDoDia(REF - 31) }, REF, 7)).toBe("No prazo");
    expect(situacaoSla({ status: "Fechado", prazo, resolucao: dataDoDia(REF - 30) }, REF, 7)).toBe("No prazo"); // no próprio dia
    expect(situacaoSla({ status: "Fechado", prazo, resolucao: dataDoDia(REF - 29) }, REF, 7)).toBe("Vencido");
  });

  it("FX-U-20 resolvido SEM data de resolução não inventa uma", () => {
    expect(situacaoSla({ status: "Corrigido", prazo: prazoEm(REF - 5), resolucao: null }, REF, 7)).toBe("Resolvido s/ data");
    expect(situacaoSla({ status: "Fechado", prazo: prazoEm(REF + 5), resolucao: null }, REF, 7)).toBe("Resolvido s/ data");
  });

  it("FX-U-21 dias em aberto: até a referência se aberto, até a resolução se resolvido, nunca negativo", () => {
    const detectado = relogioSP(dia(REF - 10, 20)); // 20h em SP, dia REF-10
    expect(diasEmAberto(detectado, null, REF)).toBe(10);
    expect(diasEmAberto(detectado, dataDoDia(REF - 4), REF)).toBe(6);
    expect(diasEmAberto(detectado, dataDoDia(REF - 20), REF)).toBe(0); // resolução anterior à detecção
    expect(diasEmAberto(relogioSP(dia(REF + 5)), null, REF)).toBe(0); // detectado "no futuro"
  });
});

describe("findings-xlsx · agregados", () => {
  it("FX-U-22 conta por severidade e status e separa abertos de resolvidos", () => {
    const a = new Agregados(REF);
    a.registrar(linha({ severityFinal: "CRITICAL", status: "OPEN" }));
    a.registrar(linha({ severityFinal: "CRITICAL", status: "IN_PROGRESS" }));
    a.registrar(linha({ severityFinal: "HIGH", status: "FIXED" }));
    a.registrar(linha({ severityFinal: "NONE", status: "CLOSED" }));

    expect(a.total).toBe(4);
    expect(a.porSeveridade).toEqual({ Crítica: 2, Alta: 1, Média: 0, Baixa: 0, Informativa: 1 });
    expect(a.porStatus).toEqual({ Aberto: 1, "Em andamento": 1, Corrigido: 1, Fechado: 1 });
    expect([a.abertos, a.resolvidos]).toEqual([2, 2]);
  });

  it("FX-U-22 idade média considera só os abertos, em dias corridos do calendário de SP", () => {
    const a = new Agregados(REF);
    a.registrar(linha({ status: "OPEN", createdAt: dia(REF - 10) }));
    a.registrar(linha({ status: "IN_PROGRESS", createdAt: dia(REF - 20) }));
    a.registrar(linha({ status: "CLOSED", createdAt: dia(REF - 500) })); // resolvido: fora da média
    expect(a.idadeMediaAbertos()).toBe(15);
    expect(new Agregados(REF).idadeMediaAbertos()).toBe(0); // sem abertos, sem divisão por zero
  });

  it("FX-U-23 ativos: agrupa sem diferenciar caixa e desempata por nome", () => {
    const a = new Agregados(REF);
    for (const nome of ["Beta", "beta", "Alfa", "Zeta", "Zeta", "Gama"]) a.registrar(linha({ applicationName: nome }));
    const ordenados = a.ativosOrdenados();
    // Beta/beta contam juntos (o Excel compara texto sem diferenciar caixa); empate em 2 → nome asc.
    expect(ordenados.map((x) => [x.nome, x.n])).toEqual([
      ["Beta", 2],
      ["Zeta", 2],
      ["Alfa", 1],
      ["Gama", 1],
    ]);
  });

  it("FX-U-23 o ranking respeita o teto da aba Auxiliar", () => {
    const a = new Agregados(REF);
    for (let i = 0; i < 80; i++) a.registrar(linha({ applicationName: `App ${String(i).padStart(2, "0")}` }));
    expect(a.ativosOrdenados()).toHaveLength(50);
    expect(a.ativosOrdenados(10)).toHaveLength(10);
  });

  it("FX-U-24 a linha do Acompanhamento carrega o que o sistema já sabe — e deixa vazio o que não sabe", () => {
    const a = new Agregados(REF);
    a.registrar(
      linha({
        id: "abc",
        status: "IN_PROGRESS",
        assigneeName: "Maria",
        slaDueAt: dia(REF + 3, 23),
        vrsBand: "URGENTE",
        resolvedAt: null,
      }),
    );
    a.registrar(linha({ id: "def", status: "FIXED", assigneeName: null, slaDueAt: null, vrsBand: null, resolvedAt: dia(REF - 2) }));

    const [x, y] = a.acompanhamento;
    expect(x).toMatchObject({ id: "abc", status: "Em andamento", responsavel: "Maria", prioridade: "Urgente", resolucao: null });
    expect(x!.prazo).not.toBeNull();
    expect(y).toMatchObject({ id: "def", status: "Corrigido", responsavel: "", prioridade: "", prazo: null });
    expect(y!.resolucao).not.toBeNull();
  });

  it("FX-U-25 até 90 dias agrupa por SEMANA, começando na segunda", () => {
    const a = new Agregados(REF);
    a.registrar(linha({ createdAt: dia(46317) })); // quinta 22/10
    a.registrar(linha({ createdAt: dia(46315) })); // terça 20/10 — mesma semana
    a.registrar(linha({ createdAt: dia(46310) })); // sexta 16/10 — semana anterior
    const r = a.periodos();
    expect(r.granularidade).toBe("semana");
    expect(r.periodos.map((p) => [p.rotulo, p.n])).toEqual([
      ["12/10", 1],
      ["19/10", 2],
    ]);
  });

  it("FX-U-25 acima de 90 dias agrupa por MÊS e cobre meses sem finding", () => {
    const a = new Agregados(REF);
    a.registrar(linha({ createdAt: dia(46317) })); // out/26
    a.registrar(linha({ createdAt: dia(46317 - (LIMITE_SEMANAL_DIAS + 40)) })); // ~jun/26
    const r = a.periodos();
    expect(r.granularidade).toBe("mes");
    expect(r.periodos.reduce((s, p) => s + p.n, 0)).toBe(2);
    expect(r.periodos.some((p) => p.n === 0)).toBe(true); // meses do meio aparecem zerados
    expect(r.periodos[r.periodos.length - 1]!.rotulo).toBe("out/26");
  });

  it("FX-U-25 acima do teto de períodos ficam os mais recentes e `truncado` avisa", () => {
    const a = new Agregados(REF);
    a.registrar(linha({ createdAt: dia(REF) }));
    a.registrar(linha({ createdAt: dia(REF - 365 * 5) })); // 5 anos = ~60 meses
    const r = a.periodos();
    expect(r.truncado).toBe(true);
    expect(r.periodos).toHaveLength(MAX_PERIODOS);
    expect(r.periodos[r.periodos.length - 1]!.n).toBe(1);
  });

  it("FX-U-25 sem findings não há períodos", () => {
    expect(new Agregados(REF).periodos()).toEqual({ granularidade: "mes", periodos: [], truncado: false });
  });
});

describe("findings-xlsx · nome do arquivo e filtros", () => {
  const geradoEm = new Date("2026-10-22T14:30:00Z");

  it("FX-U-30 escopo: todos, filtrado ou o slug do projeto", () => {
    expect(nomeDoArquivo({ projetoUnico: null, filtrado: false, geradoEm })).toBe("findings_todos_2026-10-22_1130.xlsx");
    expect(nomeDoArquivo({ projetoUnico: null, filtrado: true, geradoEm })).toBe("findings_filtrado_2026-10-22_1130.xlsx");
    expect(nomeDoArquivo({ projetoUnico: { name: "Portal E-commerce" }, filtrado: true, geradoEm })).toBe(
      "findings_portal-e-commerce_2026-10-22_1130.xlsx",
    );
  });

  it("FX-U-30 nome de projeto hostil não chega ao header (aspas, barras, quebra de linha, acento)", () => {
    const nome = nomeDoArquivo({ projetoUnico: { name: '../Portal "Açaí" & Cia\r\nX-Evil: 1' }, filtrado: true, geradoEm });
    expect(nome).toBe("findings_portal-acai-cia-x-evil-1_2026-10-22_1130.xlsx");
    expect(nome).toMatch(/^findings_[a-z0-9-]+_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);
    expect(slugDoNome("!!!")).toBe("projeto");
    expect(slugDoNome("a".repeat(100))).toHaveLength(40);
  });

  it("FX-U-31 só ordenação e paginação não contam como filtro", () => {
    expect(temFiltroAtivo(consulta())).toBe(false);
    expect(temFiltroAtivo(consulta({ sortBy: "severity", sortOrder: "asc", page: 3 }))).toBe(false);
    for (const sobre of [
      { projectIds: ["p"] },
      { severities: ["HIGH"] },
      { statuses: ["OPEN"] },
      { search: "sql" },
      { vrsMin: 0 },
      { vrsMax: 10 },
      { semResponsavel: true },
      { createdFrom: new Date() },
      { riskAcceptances: ["NONE"] },
    ] as Partial<VulnerabilityQuery>[]) {
      expect(temFiltroAtivo(consulta(sobre))).toBe(true);
    }
  });

  it("FX-U-32 traduz os filtros e mostra id CRU quando não há nome resolvido", () => {
    const rotulos: RotulosResolvidos = { ...SEM_ROTULOS, projetos: new Map([["p1", "Portal"]]) };
    const linhas = descreverFiltros(
      consulta({
        projectIds: ["p1", "p-de-outro-tenant"],
        severities: ["CRITICAL", "HIGH"],
        statuses: ["OPEN"],
        owaspCategories: ["A03"],
        slaStates: ["BREACHED"],
        vrsMin: 40,
        vrsMax: 80,
        riskAcceptances: ["ACTIVE"],
        assignedToIds: ["u1"],
        semResponsavel: true,
        search: "=1+1",
      }),
      rotulos,
    );
    const mapa = Object.fromEntries(linhas.map((l) => [l.rotulo, l.valor]));
    // O nome de "p-de-outro-tenant" NÃO foi resolvido → o id que o usuário enviou, e nada mais.
    expect(mapa["Projeto"]).toBe("Portal, p-de-outro-tenant");
    expect(mapa["Severidade"]).toBe("Crítica, Alta");
    expect(mapa["Status"]).toBe("Aberto");
    expect(mapa["OWASP Top 10"]).toBe("A03 · Injection");
    expect(mapa["SLA"]).toBe("Vencido");
    expect(mapa["VRS"]).toBe("de 40 a 80");
    expect(mapa["Aceite de risco"]).toBe("Vigente");
    expect(mapa["Responsável"]).toBe("u1, Sem responsável");
    expect(mapa["Busca por texto"]).toBe("=1+1");
    expect(descreverFiltros(consulta(), SEM_ROTULOS)).toEqual([]);
    expect(descreverOrdenacao({ sortBy: "severity", sortOrder: "desc" })).toBe("Severidade (decrescente)");
  });

  it("FX-U-33 o filtro da auditoria é só o recorte pedido", () => {
    const f = filtroParaAuditoria(consulta({ severities: ["HIGH"], page: 7, pageSize: 100 }));
    expect(f).toMatchObject({ severities: ["HIGH"], sortBy: "createdAt", sortOrder: "desc" });
    expect(f).not.toHaveProperty("page");
    expect(f).not.toHaveProperty("pageSize");
    expect(f).not.toHaveProperty("escopo");
  });
});

describe("findings-xlsx · configuração do limite", () => {
  const original = process.env.EXPORT_MAX_ROWS;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPORT_MAX_ROWS;
    else process.env.EXPORT_MAX_ROWS = original;
  });

  it("FX-U-34 valor válido vale; inválido cai no padrão, nunca em 'sem limite'", () => {
    process.env.EXPORT_MAX_ROWS = "1234";
    expect(loadExportMaxRows()).toBe(1234);
    for (const ruim of ["0", "-5", "abc", "1.5", "", "Infinity"]) {
      process.env.EXPORT_MAX_ROWS = ruim;
      expect(loadExportMaxRows()).toBe(EXPORT_MAX_ROWS_PADRAO);
    }
    delete process.env.EXPORT_MAX_ROWS;
    expect(loadExportMaxRows()).toBe(EXPORT_MAX_ROWS_PADRAO);
  });
});
