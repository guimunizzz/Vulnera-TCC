/**
 * findings-csv.test.ts
 *
 * 🎯 O teste que mais importa aqui é o de INJEÇÃO DE FÓRMULA. Um título de
 * finding é texto que veio de fora; exportar isso sem neutralizar transforma
 * uma planilha num vetor de execução na máquina de quem abre — num produto de
 * segurança, seria constrangedor.
 */

import { describe, expect, it } from "vitest";
import { COLUNAS_CSV, celula, montarCsv, nomeDoArquivo } from "./findings-csv";
import type { FindingListItem } from "../types/vulnerability.types";

const base: FindingListItem = {
  id: "cmsolfdbk0032px4gnoplsu40",
  title: "SQL Injection em /login",
  severityFinal: "CRITICAL",
  severityCalculated: "CRITICAL",
  cvssScore: 9.8,
  status: "OPEN",
  owaspCategory: "A03",
  createdAt: "2026-09-14T12:00:00.000Z",
  projectId: "p1",
  projectName: "Pentest Web",
  applicationId: "a1",
  applicationName: "Portal E-commerce",
  companyId: "c1",
  companyName: "TechNova Solutions",
  // SLA (CP-2) — o CSV não os exporta na v1, mas o item da lista os carrega.
  slaState: "ON_TRACK",
  slaDueAt: "2026-09-16T12:00:00.000Z",
  slaRemainingMs: 172_800_000,
  vrsScore: 77,
  vrsBand: "URGENTE",
  hasActiveRiskAcceptance: false,
  assignedTo: null,
  assigneeName: null,
};

const linhas = (csv: string) => csv.replace(/^\uFEFF/, "").trim().split("\r\n");

describe("celula — escape", () => {
  it("texto simples passa intacto", () => {
    expect(celula("SQL Injection")).toBe("SQL Injection");
  });

  it("nulo e indefinido viram vazio, não a string 'null'", () => {
    expect(celula(null)).toBe("");
    expect(celula(undefined)).toBe("");
  });

  it("ponto e vírgula força as aspas", () => {
    expect(celula("a;b")).toBe('"a;b"');
  });

  it("aspas internas são duplicadas", () => {
    expect(celula('diz "olá"')).toBe('"diz ""olá"""');
  });

  it("quebra de linha força as aspas", () => {
    expect(celula("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });
});

describe("🎯 celula — injeção de fórmula", () => {
  const ataques = [
    "=cmd|'/c calc'!A0",
    "+1+1",
    "-2+3",
    "@SUM(1:2)",
    "=HYPERLINK(\"http://malicioso\",\"clique\")",
    "\t=1+1",
  ];

  it.each(ataques)("neutraliza %j com aspa simples", (entrada) => {
    const saida = celula(entrada);

    // a aspa simples vem ANTES de tudo, inclusive de um eventual campo citado
    expect(saida.replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("um título malicioso não sai como fórmula no arquivo", () => {
    const csv = montarCsv([{ ...base, title: "=1+1" }]);

    const celulaDoTitulo = linhas(csv)[1]!.split(";")[1];
    expect(celulaDoTitulo).toBe("'=1+1");
    expect(celulaDoTitulo!.startsWith("=")).toBe(false);
  });

  it("texto legítimo que começa com hífen também é protegido, e não se perde", () => {
    // "-- descrição" é título plausível; vira texto, nunca fórmula
    expect(celula("-- pendente")).toBe("'-- pendente");
  });
});

describe("montarCsv", () => {
  it("começa com BOM, para o Excel ler acento", () => {
    expect(montarCsv([])).toMatch(/^\uFEFF/);
  });

  it("a primeira linha é o cabeçalho, com todas as colunas", () => {
    const [cabecalho] = linhas(montarCsv([]));

    expect(cabecalho!.split(";")).toHaveLength(COLUNAS_CSV.length);
    expect(cabecalho).toContain("Título");
    expect(cabecalho).toContain("Severidade");
    expect(cabecalho).toContain("Empresa");
  });

  it("uma linha por finding", () => {
    const csv = montarCsv([base, { ...base, id: "outro", title: "XSS" }]);

    expect(linhas(csv)).toHaveLength(3); // cabeçalho + 2
  });

  it("traduz severidade e status, e mantém o código ao lado", () => {
    const campos = linhas(montarCsv([base]))[1]!.split(";");

    expect(campos).toContain("Crítica");
    expect(campos).toContain("CRITICAL");
    expect(campos).toContain("Aberto");
  });

  it("score usa vírgula decimal (Excel pt-BR lê como número)", () => {
    expect(linhas(montarCsv([base]))[1]).toContain("9,8");
  });

  it("score ausente vira célula vazia, não 'null' nem '0,0'", () => {
    const campos = linhas(montarCsv([{ ...base, cvssScore: null }]))[1]!.split(";");
    const indice = COLUNAS_CSV.findIndex((c) => c.cabecalho === "Score CVSS");

    expect(campos[indice]).toBe("");
  });

  it("valor com o separador dentro não desloca colunas", () => {
    const csv = montarCsv([{ ...base, companyName: "Acme; Ltda" }]);

    expect(csv).toContain('"Acme; Ltda"');
    // o parser ingênuo quebraria; o citado mantém o número de colunas reais
    expect(linhas(csv)[1]!.split(";").length).toBe(COLUNAS_CSV.length + 1);
  });

  it("lista vazia produz só o cabeçalho", () => {
    expect(linhas(montarCsv([]))).toHaveLength(1);
  });
});

describe("nomeDoArquivo", () => {
  const data = new Date("2026-09-14T12:00:00.000Z");

  it("marca quando houve recorte", () => {
    expect(nomeDoArquivo(true, data)).toBe("findings-vulnera-2026-09-14-filtrado.csv");
  });

  it("marca quando é a exportação inteira", () => {
    expect(nomeDoArquivo(false, data)).toBe("findings-vulnera-2026-09-14-completo.csv");
  });
});
