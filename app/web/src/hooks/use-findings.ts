/**
 * use-findings.ts
 *
 * O QUE FAZ
 * A ÚNICA fonte de busca de findings do app. Tudo que lista achado — a página
 * global, a aba do projeto, os dashboards — passa por aqui.
 *
 * 🎯 POR QUE ÚNICA
 * Antes da FEAT-09 havia duas listagens com regras diferentes: a aba do projeto
 * puxava tudo e filtrava em memória, e os dashboards chamavam o endpoint cru.
 * Duas implementações da mesma coisa divergem — e divergiram: a aba paginava de
 * 10 em 10 sobre um array já inteiro na memória, enquanto o dashboard nem
 * paginava. Com um hook só, mudar o contrato da busca é mudar um arquivo.
 *
 * ESTADO NA URL
 * O hook NÃO guarda estado. Ele recebe filtros já resolvidos e devolve dados.
 * Quem sincroniza com a URL é `use-findings-filters.ts` — separar as duas
 * coisas é o que permite usar a tabela dentro do ProjectDetail (sem tocar na
 * URL) e na página global (com a URL mandando), sem dois componentes.
 *
 * QUEM USA
 * `components/findings/findings-table.tsx` e os dashboards.
 */

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import type { FacetCounts, FindingListItem, FindingSearchResponse } from "../types/vulnerability.types";

/**
 * Chave do cache: a query string inteira, pra dois recortes nunca se
 * confundirem.
 *
 * ⚠️ ORDENADA antes de virar chave. O mesmo recorte montado por dois lugares
 * diferentes sai com os parâmetros em ordens diferentes (`severity=HIGH&page=1`
 * vs `page=1&severity=HIGH`) e viraria DUAS entradas de cache — duas
 * requisições idênticas a cada abertura da página global, onde o cabeçalho e a
 * tabela pedem o mesmo recorte. Ordenar faz as duas compartilharem a resposta.
 */
export const findingsQueryKey = (params: URLSearchParams) => {
  const ordenados = new URLSearchParams(params);
  ordenados.sort();
  return ["vulnerabilities", "search", ordenados.toString()];
};

/**
 * ⚠️ `"always"` em vez do padrão `"online"` do TanStack Query.
 *
 * No modo padrão, uma busca que falha por erro de rede não vira ERRO: a
 * consulta fica PAUSADA (`fetchStatus: "paused"`, `status: "pending"`,
 * `error: null`) esperando a conexão voltar. Na prática, com a API fora do ar
 * e o navegador online, isso produzia uma tela sem dado, sem erro e sem
 * carregamento — e o botão "Tentar novamente" não disparava requisição
 * nenhuma, porque `refetch()` numa consulta pausada também pausa. Só
 * recarregar a página inteira saía do estado. Diagnosticado na validação do
 * CP8 (nenhuma requisição no painel de rede, `navigator.onLine === true`).
 *
 * Com `"always"`, a falha vira erro de verdade: a tela mostra o estado de erro
 * e o "Tentar novamente" refaz a busca.
 *
 * 🚧 [FUTURO] provavelmente deveria ser o padrão do `queryClient` inteiro —
 * toda tela do app tem hoje o mesmo comportamento silencioso. Fica aqui
 * porque mudar o cliente global afeta telas fora do escopo desta entrega.
 */
const NETWORK_MODE = "always" as const;

export interface UseFindingsResult {
  dados: FindingSearchResponse | undefined;
  carregando: boolean;
  /** `true` enquanto REVALIDA com dados antigos na tela — alimenta a transição. */
  atualizando: boolean;
  erro: unknown;
  recarregar: () => void;
}

/**
 * Busca uma página de findings.
 *
 * `placeholderData: keepPreviousData` é o que faz a troca de filtro parecer uma
 * transição e não um recarregamento: a tabela anterior fica na tela, esmaecida,
 * enquanto a nova chega. Sem isso, cada tecla na barra de busca pisca a tabela
 * inteira para o skeleton e a página salta de altura.
 */
export function useFindings(params: URLSearchParams, habilitado = true): UseFindingsResult {
  const query = useQuery({
    queryKey: findingsQueryKey(params),
    queryFn: () => vulnerabilitiesApi.search(params),
    enabled: habilitado,
    placeholderData: keepPreviousData,
    networkMode: NETWORK_MODE,
  });

  return {
    dados: query.data,
    // `isLoading` só é true na PRIMEIRA carga (sem nada em cache) — é o
    // momento do skeleton. Revalidação com dados antigos na tela é `atualizando`.
    carregando: query.isLoading,
    atualizando: query.isFetching && !query.isLoading,
    erro: query.error,
    recarregar: () => void query.refetch(),
  };
}

/* ==========================================================================
   Resumo para dashboards
   ========================================================================== */

/** Status que contam como "ainda não fechado". */
const ABERTOS = ["OPEN", "IN_PROGRESS", "FIXED"];
const QUANTOS_RECENTES = 5;

export interface ResumoDeFindings {
  total: number;
  porSeveridade: FacetCounts;
  porStatus: FacetCounts;
  /** Chave = companyId. */
  porEmpresa: FacetCounts;
  criticosAbertos: number;
  recentes: FindingListItem[];
  carregando: boolean;
}

/**
 * Os números que os três dashboards mostram, contados NO BANCO.
 *
 * 🎯 Antes da FEAT-09 cada dashboard baixava TODOS os findings que o ator
 * podia ver e contava em JavaScript — `list.filter(...).length`. Funcionava
 * com 11 findings de seed e não funcionaria com dez mil: o navegador receberia
 * megabytes de descrição e recomendação para exibir cinco números.
 *
 * Agora são duas requisições, ambas com `pageSize` mínimo:
 *   1. as facetas (que já vêm contadas por `groupBy`) + os 5 mais recentes;
 *   2. o total do recorte "CRITICAL e ainda não fechado", que é o único número
 *      que cruza duas dimensões e por isso não sai de uma faceta.
 *
 * O escopo continua vindo do papel do ator, resolvido no backend — o hook não
 * passa filtro de empresa nenhum.
 */
export function useFindingsResumo(): ResumoDeFindings {
  const paramsGerais = new URLSearchParams({
    pageSize: String(QUANTOS_RECENTES),
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const paramsCriticos = new URLSearchParams({
    severity: "CRITICAL",
    status: ABERTOS.join(","),
    pageSize: "1",
  });

  const [geral, criticos] = useQueries({
    queries: [paramsGerais, paramsCriticos].map((params) => ({
      queryKey: findingsQueryKey(params),
      queryFn: () => vulnerabilitiesApi.search(params),
      networkMode: NETWORK_MODE,
    })),
  });

  return {
    total: geral.data?.pagination.total ?? 0,
    porSeveridade: geral.data?.facets.severity ?? {},
    porStatus: geral.data?.facets.status ?? {},
    porEmpresa: geral.data?.facets.company ?? {},
    criticosAbertos: criticos.data?.pagination.total ?? 0,
    recentes: geral.data?.data ?? [],
    carregando: geral.isLoading || criticos.isLoading,
  };
}
