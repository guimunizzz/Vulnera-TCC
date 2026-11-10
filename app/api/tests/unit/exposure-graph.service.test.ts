/**
 * exposure-graph.service.test.ts (unit)
 *
 * A montagem do Exposure Graph é função pura: recebe linhas já agregadas pelo
 * banco e devolve o DTO. Aqui testam-se as regras que o banco não decide:
 * soma por severidade, pior severidade de categoria, corte e ordem das
 * principais, e a ordem das aplicações. Sem Prisma, sem HTTP.
 *
 * Canários: EXG-U-01..EXG-U-04.
 */

import {
  LIMITE_PRINCIPAIS,
  montarAplicacoesDoGrafo,
  type EntradaExposureGraph,
} from "../../src/services/exposure-graph.service";
import type { AplicacaoBrutaDoGrafo, LinhaPrincipalAberta } from "../../src/repositories/exposure-graph.repository";

const app = (id: string, name: string): AplicacaoBrutaDoGrafo => ({
  id,
  name,
  url: null,
  environment: "PROD",
  criticality: "MEDIUM",
  internetFacing: false,
  dataSensitivity: "INTERNAL",
});

const vazia = (): EntradaExposureGraph => ({
  aplicacoes: [],
  abertasPorAplicacao: [],
  resolvidasPorAplicacao: [],
  categoriasAbertas: [],
  principaisAbertas: [],
});

const principal = (id: string, applicationId: string, severityFinal: string, diaMs: number): LinhaPrincipalAberta => ({
  id,
  title: `Achado ${id}`,
  severityFinal,
  status: "OPEN",
  owaspCategory: "A03",
  applicationId,
  createdAt: new Date(Date.UTC(2026, 0, 1) + diaMs),
});

describe("montarAplicacoesDoGrafo (unit)", () => {
  it("EXG-U-01 — soma abertas por severidade e ignora NONE e linhas fora do vocabulário", () => {
    const entrada = vazia();
    entrada.aplicacoes = [app("a1", "Portal")];
    entrada.abertasPorAplicacao = [
      { applicationId: "a1", severityFinal: "CRITICAL", total: 2 },
      { applicationId: "a1", severityFinal: "HIGH", total: 3 },
      { applicationId: "a1", severityFinal: "NONE", total: 9 },
      { applicationId: "a1", severityFinal: "DESCONHECIDA", total: 4 },
    ];

    const [p] = montarAplicacoesDoGrafo(entrada);

    // 2 críticas + 3 altas = 5. As 9 NONE e as 4 desconhecidas ficam de fora.
    expect(p.abertas).toEqual({ CRITICAL: 2, HIGH: 3, MEDIUM: 0, LOW: 0 });
    expect(p.totalAbertas).toBe(5);
    expect(p.piorSeveridade).toBe("CRITICAL");
  });

  it("EXG-U-02 — categoria usa a PIOR severidade entre as suas linhas, e corta principais em 5", () => {
    const entrada = vazia();
    entrada.aplicacoes = [app("a1", "Portal")];
    entrada.categoriasAbertas = [
      { applicationId: "a1", owaspCategory: "A03", severityFinal: "LOW", total: 1 },
      { applicationId: "a1", owaspCategory: "A03", severityFinal: "HIGH", total: 1 },
    ];
    // Sete abertas. Ordem esperada: CRITICAL (dia 1), CRITICAL (dia 2), HIGH (dia 3),
    // HIGH (dia 4), MEDIUM (dia 5). Fora do limite: MEDIUM (dia 6) e LOW (dia 0).
    const dia = 86_400_000;
    entrada.principaisAbertas = [
      principal("low", "a1", "LOW", 0),
      principal("h2", "a1", "HIGH", 4 * dia),
      principal("c2", "a1", "CRITICAL", 2 * dia),
      principal("m1", "a1", "MEDIUM", 5 * dia),
      principal("h1", "a1", "HIGH", 3 * dia),
      principal("c1", "a1", "CRITICAL", 1 * dia),
      principal("m2", "a1", "MEDIUM", 6 * dia),
    ];

    const [p] = montarAplicacoesDoGrafo(entrada);

    expect(p.categorias).toEqual([{ owaspCategory: "A03", abertas: 2, piorSeveridade: "HIGH" }]);
    expect(LIMITE_PRINCIPAIS).toBe(5);
    expect(p.principais.map((x) => x.id)).toEqual(["c1", "c2", "h1", "h2", "m1"]);
    // createdAt não vaza para o contrato.
    expect(Object.keys(p.principais[0])).not.toContain("createdAt");
  });

  it("EXG-U-03 — aplicação sem abertas tem piorSeveridade null e vai para o fim", () => {
    const entrada = vazia();
    entrada.aplicacoes = [app("a1", "Zerada"), app("a2", "Com média")];
    entrada.resolvidasPorAplicacao = [{ applicationId: "a1", total: 4 }];
    entrada.abertasPorAplicacao = [{ applicationId: "a2", severityFinal: "MEDIUM", total: 1 }];

    const aplicacoes = montarAplicacoesDoGrafo(entrada);

    expect(aplicacoes.map((x) => x.name)).toEqual(["Com média", "Zerada"]);
    expect(aplicacoes[1]).toMatchObject({
      piorSeveridade: null,
      totalAbertas: 0,
      totalResolvidas: 4,
      categorias: [],
      principais: [],
    });
  });

  it("EXG-U-04 — ordena por pior severidade e, no empate, por total de abertas", () => {
    const entrada = vazia();
    entrada.aplicacoes = [app("a1", "Pequena"), app("a2", "Grande"), app("a3", "Crítica")];
    entrada.abertasPorAplicacao = [
      { applicationId: "a1", severityFinal: "MEDIUM", total: 1 },
      { applicationId: "a2", severityFinal: "MEDIUM", total: 4 },
      { applicationId: "a3", severityFinal: "CRITICAL", total: 1 },
    ];

    const aplicacoes = montarAplicacoesDoGrafo(entrada);

    expect(aplicacoes.map((x) => x.name)).toEqual(["Crítica", "Grande", "Pequena"]);
  });
});
