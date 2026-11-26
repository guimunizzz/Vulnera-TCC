/**
 * exposure-analysis.service.ts
 *
 * O QUE FAZ
 * As três análises sobre o Exposure Graph (ADR-061): combinações tóxicas,
 * raio de impacto e histórico da exposição (máquina do tempo). Regra de
 * negócio sem HTTP e sem Prisma; as regras puras estão em
 * `models/exposure-analysis.model.ts`.
 *
 * ISOLAMENTO MULTI-TENANT
 * A company vem do USUÁRIO autenticado, lido do banco — nunca de query, body
 * ou JWT. Mesma regra do `exposure-graph.service.ts`. Só aplicações ATIVAS
 * entram (RN04), como no grafo.
 *
 * QUEM USA
 * `exposure-analysis.controller.ts`, via `exposure-analysis.factory.ts`.
 */

import type { ExposureAnalysisRepository } from "../repositories/exposure-analysis.repository";
import type { AplicacaoBrutaDoGrafo, ExposureGraphRepository } from "../repositories/exposure-graph.repository";
import type { UserRepository } from "../repositories/user.repository";
import {
  destinoDaMudanca,
  LIMIAR_EPSS_PERCENTIL,
  MINIMO_DE_AGRAVANTES,
  montarCombinacoes,
  montarImpacto,
  normalizarValorDeImpacto,
  TIPOS_DE_IMPACTO,
  type CombinacoesToxicasDTO,
  type HistoricoDaExposicaoDTO,
  type ImpactoDTO,
  type OcorrenciaDeImpacto,
  type OpcaoDeImpactoDTO,
  type TipoDeImpacto,
  type VulnerabilidadeCandidata,
} from "../models/exposure-analysis.model";

interface Actor {
  userId: string;
}

/** Quantas opções de pacote e de CVE o seletor do raio de impacto recebe. */
export const LIMITE_DE_OPCOES = 100;
const TAMANHO_MAXIMO_DO_VALOR = 300;
/** Categoria OWASP Top 10 2021: A01..A10. */
const FORMATO_CATEGORIA = /^A(0[1-9]|10)$/;

export class ExposureAnalysisService {
  constructor(
    private readonly repository: ExposureAnalysisRepository,
    private readonly grafo: ExposureGraphRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /** A company do ator e as suas aplicações ativas. Sem company não há o que analisar. */
  private async escopo(actor: Actor): Promise<{ companyId: string; aplicacoes: AplicacaoBrutaDoGrafo[] }> {
    const user = await this.userRepository.findById(actor.userId);
    const companyId = user?.companyId;
    if (!companyId) throw new Error("COMPANY_NOT_FOUND");
    return { companyId, aplicacoes: await this.grafo.listarAplicacoesAtivas(companyId) };
  }

  async combinacoesToxicas(actor: Actor, agora: Date = new Date()): Promise<CombinacoesToxicasDTO> {
    const { companyId, aplicacoes } = await this.escopo(actor);
    const criterio = { minimoDeAgravantes: MINIMO_DE_AGRAVANTES, limiarEpssPercentil: LIMIAR_EPSS_PERCENTIL };
    const vazio = { companyId, geradoEm: agora.toISOString(), criterio, total: 0, combinacoes: [] };
    // Sem aplicação exposta não há combinação possível (Internet é obrigatória).
    if (!aplicacoes.some((a) => a.internetFacing)) return vazio;

    const porId = new Map(aplicacoes.map((a) => [a.id, a]));
    const abertas = await this.repository.listarAbertasComOrigem(companyId, aplicacoes.map((a) => a.id));
    if (abertas.length === 0) return vazio;

    const { porCodeFinding, porThreatMatch } = await this.repository.advisoriesDasOrigens(
      companyId,
      abertas.flatMap((v) => (v.sourceCodeFindingId ? [v.sourceCodeFindingId] : [])),
      abertas.flatMap((v) => (v.sourceThreatMatchId ? [v.sourceThreatMatchId] : [])),
    );
    const advisoryDe = (v: (typeof abertas)[number]) =>
      (v.sourceCodeFindingId ? porCodeFinding.get(v.sourceCodeFindingId) : undefined) ??
      (v.sourceThreatMatchId ? porThreatMatch.get(v.sourceThreatMatchId) : undefined) ??
      null;
    const ids = [...new Set(abertas.map(advisoryDe).filter((id): id is string => id !== null))];
    const ameacas = new Map((await this.repository.buscarAmeacas(ids)).map((a) => [a.id.toUpperCase(), a]));

    const candidatas: VulnerabilidadeCandidata[] = abertas.flatMap((v) => {
      const app = porId.get(v.applicationId);
      if (!app) return [];
      const advisory = advisoryDe(v);
      return [{
        id: v.id,
        title: v.title,
        severityFinal: v.severityFinal,
        owaspCategory: v.owaspCategory,
        sourceType: v.sourceType,
        vrsScore: v.vrsScore,
        createdAt: v.createdAt,
        aplicacao: {
          id: app.id,
          name: app.name,
          environment: app.environment,
          criticality: app.criticality,
          internetFacing: app.internetFacing,
          dataSensitivity: app.dataSensitivity,
        },
        ameaca: advisory ? ameacas.get(advisory) ?? null : null,
      }];
    });

    return { ...vazio, ...montarCombinacoes(candidatas) };
  }

  async opcoesDeImpacto(actor: Actor): Promise<OpcaoDeImpactoDTO[]> {
    const { companyId, aplicacoes } = await this.escopo(actor);
    if (aplicacoes.length === 0) return [];
    const [pacotes, cves, categorias] = await Promise.all([
      this.repository.opcoesDePacote(companyId, LIMITE_DE_OPCOES),
      this.repository.opcoesDeCve(companyId, LIMITE_DE_OPCOES),
      this.repository.opcoesDeCategoria(companyId, aplicacoes.map((a) => a.id)),
    ]);
    return [
      ...categorias.map((o) => ({ tipo: "CATEGORIA" as const, ...o })),
      ...pacotes.map((o) => ({ tipo: "PACOTE" as const, ...o })),
      ...cves.map((o) => ({ tipo: "CVE" as const, ...o })),
    ];
  }

  async impacto(actor: Actor, tipoBruto: unknown, valorBruto: unknown): Promise<ImpactoDTO> {
    if (typeof tipoBruto !== "string" || !(TIPOS_DE_IMPACTO as readonly string[]).includes(tipoBruto)) {
      throw new Error("INVALID_IMPACT_TYPE");
    }
    const tipo = tipoBruto as TipoDeImpacto;
    if (typeof valorBruto !== "string" || !valorBruto.trim() || valorBruto.length > TAMANHO_MAXIMO_DO_VALOR) {
      throw new Error("INVALID_IMPACT_VALUE");
    }
    const valor = normalizarValorDeImpacto(tipo, valorBruto);
    if (tipo === "CATEGORIA" && !FORMATO_CATEGORIA.test(valor)) throw new Error("INVALID_IMPACT_VALUE");

    const { companyId, aplicacoes } = await this.escopo(actor);
    if (aplicacoes.length === 0) return montarImpacto(tipo, valor, [], []);
    const ids = aplicacoes.map((a) => a.id);

    let ocorrencias: OcorrenciaDeImpacto[];
    if (tipo === "CATEGORIA") ocorrencias = await this.repository.ocorrenciasDeCategoria(companyId, ids, valor);
    else if (tipo === "PACOTE") ocorrencias = await this.repository.ocorrenciasDePacote(companyId, valor);
    else ocorrencias = await this.repository.ocorrenciasDeCve(companyId, ids, valor);

    return montarImpacto(tipo, valor, aplicacoes, ocorrencias);
  }

  async historico(actor: Actor, agora: Date = new Date()): Promise<HistoricoDaExposicaoDTO> {
    const { companyId, aplicacoes } = await this.escopo(actor);
    if (aplicacoes.length === 0) return { companyId, geradoEm: agora.toISOString(), inicio: null, vulnerabilidades: [] };

    const vulnerabilidades = await this.repository.listarParaHistorico(companyId, aplicacoes.map((a) => a.id));
    const mudancas = await this.repository.listarMudancasDeStatus(companyId, vulnerabilidades.map((v) => v.id));

    const porVulnerabilidade = new Map<string, Array<{ em: string; para: string }>>();
    for (const m of mudancas) {
      const para = destinoDaMudanca(m.diffJson);
      if (!para) continue;
      const lista = porVulnerabilidade.get(m.entityId) ?? [];
      lista.push({ em: m.createdAt.toISOString(), para });
      porVulnerabilidade.set(m.entityId, lista);
    }

    return {
      companyId,
      geradoEm: agora.toISOString(),
      inicio: vulnerabilidades[0]?.createdAt.toISOString() ?? null,
      vulnerabilidades: vulnerabilidades.map((v) => ({
        id: v.id,
        applicationId: v.applicationId,
        title: v.title,
        owaspCategory: v.owaspCategory,
        severityFinal: v.severityFinal,
        sourceType: v.sourceType,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
        mudancas: porVulnerabilidade.get(v.id) ?? [],
      })),
    };
  }
}
