/**
 * exposure-graph.service.ts
 *
 * O QUE FAZ
 * Monta o Exposure Graph da company do ator: aplicações ativas, quantos achados
 * abertos há em cada severidade, categorias OWASP, principais abertos e a ordem
 * em que tudo aparece. Regra de negócio, sem HTTP e sem Prisma.
 *
 * ISOLAMENTO MULTI-TENANT
 * A company vem do USUÁRIO autenticado, lido do banco. Nunca do JWT (que
 * carrega só `{userId, role}`) e nunca de query ou body. Mesma regra do
 * comparativo (`metrics.service.ts`, `getComparison`).
 *
 * O QUE NÃO FAZ
 * Não agrega em JavaScript coleções grandes de `Vulnerability`: contagens,
 * agrupamentos e o corte das 5 principais ficam no `exposure-graph.repository.ts`.
 * Aqui entra só a montagem de um número pequeno de linhas já agregadas, e a
 * ordenação, que é a regra de exibição.
 *
 * QUEM USA
 * `exposure-graph.controller.ts`, via `exposure-graph.factory.ts`.
 */

import type {
  AplicacaoBrutaDoGrafo,
  ExposureGraphRepository,
  LinhaAbertasPorAplicacao,
  LinhaCategoriaAberta,
  LinhaPrincipalAberta,
  LinhaResolvidasPorAplicacao,
} from "../repositories/exposure-graph.repository";
import type { UserRepository } from "../repositories/user.repository";
import {
  SEVERIDADES_DO_GRAFO,
  type AplicacaoDoGrafoDTO,
  type CategoriaDoGrafoDTO,
  type ExposureGraphDTO,
  type PrincipalAbertaDTO,
  type SeveridadeDoGrafo,
} from "../models/exposure-graph.model";

interface Actor {
  userId: string;
}

/** Quantas abertas aparecem por aplicação. Cinco cabe num nó do grafo sem poluí-lo. */
export const LIMITE_PRINCIPAIS = 5;

/** Ordem de gravidade: menor número = mais grave. Quem ordena a lista depende disto. */
const RANK_SEVERIDADE: Record<SeveridadeDoGrafo, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
/** Aplicação sem nada aberto vai para o fim da lista. */
const RANK_SEM_ABERTAS = 4;

export interface EntradaExposureGraph {
  aplicacoes: AplicacaoBrutaDoGrafo[];
  abertasPorAplicacao: LinhaAbertasPorAplicacao[];
  resolvidasPorAplicacao: LinhaResolvidasPorAplicacao[];
  categoriasAbertas: LinhaCategoriaAberta[];
  principaisAbertas: LinhaPrincipalAberta[];
}

export class ExposureGraphService {
  constructor(
    private readonly repository: ExposureGraphRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getGraph(actor: Actor, agora: Date = new Date()): Promise<ExposureGraphDTO> {
    // Um usuário sem company (ADMIN da plataforma, por exemplo) não tem grafo
    // próprio para mostrar.
    const user = await this.userRepository.findById(actor.userId);
    const companyId = user?.companyId;
    if (!companyId) throw new Error("COMPANY_NOT_FOUND");

    const aplicacoes = await this.repository.listarAplicacoesAtivas(companyId);
    // Sem aplicação ativa não há o que consultar. Devolver aqui também evita
    // mandar uma lista vazia para o `in` das consultas seguintes.
    if (aplicacoes.length === 0) {
      return { companyId, geradoEm: agora.toISOString(), aplicacoes: [] };
    }

    const ids = aplicacoes.map((a) => a.id);
    const [abertasPorAplicacao, resolvidasPorAplicacao, categoriasAbertas, principaisAbertas] = await Promise.all([
      this.repository.contarAbertasPorAplicacao(companyId, ids),
      this.repository.contarResolvidasPorAplicacao(companyId, ids),
      this.repository.contarCategoriasAbertas(companyId, ids),
      this.repository.listarPrincipaisAbertas(companyId, ids, LIMITE_PRINCIPAIS),
    ]);

    return {
      companyId,
      geradoEm: agora.toISOString(),
      aplicacoes: montarAplicacoesDoGrafo({
        aplicacoes,
        abertasPorAplicacao,
        resolvidasPorAplicacao,
        categoriasAbertas,
        principaisAbertas,
      }),
    };
  }
}

/* ==========================================================================
   Funções puras — a regra de agregação e de ordenação
   ========================================================================== */

/**
 * Junta as linhas agregadas do banco no formato do grafo e ordena o resultado.
 *
 * Severidade `NONE` (CVSS 0) não entra nos totais nem nas categorias. Decisão
 * registrada: o grafo mostra risco, e um achado sem nenhum score não é risco
 * a priorizar. O repository já deixa esses achados de fora; o filtro aqui cobre
 * qualquer linha que chegue com severidade fora do vocabulário.
 */
export function montarAplicacoesDoGrafo(entrada: EntradaExposureGraph): AplicacaoDoGrafoDTO[] {
  const abertasDe = agrupar(entrada.abertasPorAplicacao, (l) => l.applicationId);
  const resolvidasDe = new Map(entrada.resolvidasPorAplicacao.map((l) => [l.applicationId, l.total]));
  const categoriasDe = agrupar(entrada.categoriasAbertas, (l) => l.applicationId);
  const principaisDe = agrupar(entrada.principaisAbertas, (l) => l.applicationId);

  const aplicacoes = entrada.aplicacoes.map((app): AplicacaoDoGrafoDTO => {
    const abertas: Record<SeveridadeDoGrafo, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const l of (abertasDe.get(app.id) ?? []).filter(ehSeveridadeDoGrafo)) {
      abertas[l.severityFinal] += l.total;
    }
    const totalAbertas = SEVERIDADES_DO_GRAFO.reduce((soma, s) => soma + abertas[s], 0);

    return {
      id: app.id,
      name: app.name,
      url: app.url,
      environment: app.environment,
      criticality: app.criticality,
      internetFacing: app.internetFacing,
      dataSensitivity: app.dataSensitivity,
      abertas,
      totalAbertas,
      totalResolvidas: resolvidasDe.get(app.id) ?? 0,
      piorSeveridade: SEVERIDADES_DO_GRAFO.find((s) => abertas[s] > 0) ?? null,
      categorias: montarCategorias(categoriasDe.get(app.id) ?? []),
      principais: montarPrincipais(principaisDe.get(app.id) ?? []),
    };
  });

  return aplicacoes.sort(compararAplicacoes);
}

/** Categorias com achados abertos, da pior para a menos grave. */
function montarCategorias(linhas: LinhaCategoriaAberta[]): CategoriaDoGrafoDTO[] {
  const porCategoria = new Map<string, CategoriaDoGrafoDTO>();
  for (const l of linhas.filter(ehSeveridadeDoGrafo)) {
    if (l.total <= 0) continue;
    const atual = porCategoria.get(l.owaspCategory);
    if (!atual) {
      porCategoria.set(l.owaspCategory, { owaspCategory: l.owaspCategory, abertas: l.total, piorSeveridade: l.severityFinal });
      continue;
    }
    atual.abertas += l.total;
    if (RANK_SEVERIDADE[l.severityFinal] < RANK_SEVERIDADE[atual.piorSeveridade]) atual.piorSeveridade = l.severityFinal;
  }

  return [...porCategoria.values()].sort(
    (a, b) =>
      RANK_SEVERIDADE[a.piorSeveridade] - RANK_SEVERIDADE[b.piorSeveridade] ||
      b.abertas - a.abertas ||
      a.owaspCategory.localeCompare(b.owaspCategory),
  );
}

/**
 * Até cinco abertas, a mais grave primeiro e, dentro da mesma severidade, a
 * mais antiga. O corte já foi feito no banco; reaplicar a ordem aqui mantém a
 * saída correta mesmo que a consulta mude.
 */
function montarPrincipais(linhas: LinhaPrincipalAberta[]): PrincipalAbertaDTO[] {
  return linhas
    .filter(ehSeveridadeDoGrafo)
    .sort(
      (a, b) =>
        RANK_SEVERIDADE[a.severityFinal] - RANK_SEVERIDADE[b.severityFinal] ||
        // `new Date(...)` porque o valor vem de $queryRaw: não confio que chegue como Date.
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.id.localeCompare(b.id),
    )
    .slice(0, LIMITE_PRINCIPAIS)
    .map(({ id, title, severityFinal, status, owaspCategory }) => ({ id, title, severityFinal, status, owaspCategory }));
}

/** Pior severidade primeiro; empate pelo maior número de abertas; depois pelo nome. */
function compararAplicacoes(a: AplicacaoDoGrafoDTO, b: AplicacaoDoGrafoDTO): number {
  return (
    rankPior(a.piorSeveridade) - rankPior(b.piorSeveridade) ||
    b.totalAbertas - a.totalAbertas ||
    a.name.localeCompare(b.name)
  );
}

function rankPior(severidade: SeveridadeDoGrafo | null): number {
  return severidade === null ? RANK_SEM_ABERTAS : RANK_SEVERIDADE[severidade];
}

function ehSeveridadeDoGrafo<T extends { severityFinal: string }>(
  linha: T,
): linha is T & { severityFinal: SeveridadeDoGrafo } {
  return (SEVERIDADES_DO_GRAFO as readonly string[]).includes(linha.severityFinal);
}

function agrupar<T>(linhas: T[], chave: (linha: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const linha of linhas) {
    const k = chave(linha);
    const lista = mapa.get(k);
    if (lista) lista.push(linha);
    else mapa.set(k, [linha]);
  }
  return mapa;
}
