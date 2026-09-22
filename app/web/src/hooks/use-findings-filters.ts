/**
 * use-findings-filters.ts
 *
 * O QUE FAZ
 * Todo o estado de filtro, ordenação e paginação da listagem de findings.
 *
 * ==========================================================================
 * AS TRÊS REPRESENTAÇÕES, E QUAL MANDA
 * ==========================================================================
 * O mesmo filtro existe em três formas, e confundi-las é como nascem os bugs
 * de "limpei o filtro mas a lista não mudou":
 *
 *   1. RASCUNHO (string)  — o que está no campo de texto agora, meio digitado.
 *                            Estado LOCAL. Não é filtro, é buffer de edição.
 *   2. TOKENS             — o rascunho parseado. É a forma de TRABALHO: chips,
 *                            remoção individual, marcar/desmarcar opção.
 *   3. URL (ou seu espelho local) — o filtro APLICADO. É a VERDADE.
 *
 * 🎯 Quando `syncToUrl` é true, a URL é a fonte única — não existe `useState`
 * espelhando filtro. É o que dá de graça: link compartilhável, voltar do
 * navegador desfazendo o último filtro, e recarregar preservando o contexto.
 * É a mesma regra do `use-filtros-metricas.ts` da Fase 6.5.
 *
 * Quando é false (aba do ProjectDetail), o mesmo `URLSearchParams` vive num
 * `useState` local. A interface do hook não muda — só onde o objeto mora.
 * Assim a tabela é UM componente, não dois.
 *
 * ⚠️ O RASCUNHO NÃO É DUPLICAÇÃO DA URL. Ele guarda o que ainda não foi
 * aplicado (incluindo expressão inválida, que nunca vai à API). Assim que
 * aplica, a URL manda; e quando a URL muda por fora — voltar do navegador,
 * chip removido, filtro travado — o rascunho é reescrito a partir dela.
 * ==========================================================================
 *
 * QUEM USA
 * `components/findings/findings-table.tsx`, e ninguém mais.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CAMPOS,
  parseQuery,
  paramsToTokens,
  tokensToParams,
  tokensToString,
  type FilterField,
  type QueryToken,
} from "../lib/finding-query";
import { FINDINGS_PAGE_SIZE_MAX } from "../lib/api/vulnerabilities.api";
import type { FindingSortField, SortOrder } from "../types/vulnerability.types";

/** Filtros no vocabulário da API — o formato de `lockedFilters`. */
export type FindingFilters = {
  projectId: string | string[];
  applicationId: string | string[];
  companyId: string | string[];
  severity: string | string[];
  status: string | string[];
  owaspCategory: string | string[];
  slaState: string | string[];
  vrsMin: string | string[];
  vrsMax: string | string[];
  riskAcceptance: string | string[];
  assignedTo: string | string[];
  search: string;
};

export const PAGE_SIZE_PADRAO = 25;

/** Parâmetros que este hook administra. Os demais da URL passam intactos. */
const PARAMS_DO_FILTRO = [
  "projectId",
  "applicationId",
  "companyId",
  "severity",
  "status",
  "owaspCategory",
  "slaState",
  "vrsMin",
  "vrsMax",
  "riskAcceptance",
  "assignedTo",
  "search",
] as const;
const PARAMS_DA_VISTA = ["page", "pageSize", "sortBy", "sortOrder"] as const;

const MS_DEBOUNCE = 350;

export interface ControlesDeFindings {
  /** Texto do campo de busca. */
  rascunho: string;
  /** Tokens do rascunho — inclui os inválidos, que viram chip em erro. */
  tokens: QueryToken[];
  /** Pronto pra API: filtros aplicados + travados + paginação + ordenação. */
  paramsDaApi: URLSearchParams;
  /** Quantos filtros (fora os travados) estão ativos. */
  quantidadeAtiva: boolean;
  page: number;
  pageSize: number;
  sortBy: FindingSortField;
  sortOrder: SortOrder;

  definirRascunho: (texto: string) => void;
  /** Aplica o rascunho agora, sem esperar o debounce (Enter no campo). */
  aplicarAgora: () => void;
  /** Marca/desmarca um valor de um campo de enum — os controles estruturados. */
  alternarValor: (field: FilterField, valor: string) => void;
  /** Já está marcado? */
  estaAtivo: (field: FilterField, valor: string) => boolean;
  removerToken: (indice: number) => void;
  limparTudo: () => void;
  irParaPagina: (pagina: number) => void;
  /** Clique no cabeçalho: mesma coluna alterna a direção, outra começa em desc. */
  ordenarPor: (campo: FindingSortField) => void;
}

const lerLista = (valor: string | string[] | undefined): string[] => {
  if (valor === undefined) return [];
  return (Array.isArray(valor) ? valor : valor.split(",")).map((v) => v.trim()).filter(Boolean);
};

/**
 * Constrói o recorte que chega ao endpoint de findings.
 *
 * URL, chips aplicados e atalhos de Saved Query convergem para o mesmo
 * `URLSearchParams`; manter esta montagem pura evita que uma nova dimensão
 * (SLA/VRS/aceite/responsável) seja preservada na URL, mas desapareça antes de
 * `useFindings` chamar a API. Consumidor: o `useMemo` deste hook e seu teste.
 */
export function montarParamsDaBusca(
  params: URLSearchParams,
  lockedFilters: Partial<FindingFilters> | undefined,
  page: number,
  pageSize: number,
  sortBy: FindingSortField,
  sortOrder: SortOrder,
): URLSearchParams {
  const saida = new URLSearchParams();

  for (const p of PARAMS_DO_FILTRO) {
    const valor = params.get(p);
    if (valor) saida.set(p, valor);
  }

  // Os travados entram por último: o contexto da aba vence preferências do
  // link, sem remover os cinco cruzamentos da busca global.
  for (const [chave, valor] of Object.entries(lockedFilters ?? {})) {
    const lista = lerLista(valor as string | string[]);
    if (lista.length > 0) saida.set(chave, lista.join(","));
  }

  saida.set("page", String(page));
  saida.set("pageSize", String(pageSize));
  saida.set("sortBy", sortBy);
  saida.set("sortOrder", sortOrder);
  return saida;
}

/**
 * `useSearchParams` ou um espelho local, com a MESMA assinatura.
 *
 * Os dois ramos são chamados incondicionalmente — `syncToUrl` escolhe qual
 * resultado usar, nunca se um hook roda. Chamar `useSearchParams` só às vezes
 * quebraria a ordem dos hooks entre renders.
 */
function useParamsDeFiltro(syncToUrl: boolean): [URLSearchParams, (p: URLSearchParams) => void] {
  const [paramsDaUrl, setParamsDaUrl] = useSearchParams();
  const [paramsLocais, setParamsLocais] = useState(() => new URLSearchParams());

  const escrever = useCallback(
    (novos: URLSearchParams) => {
      if (syncToUrl) {
        // `replace: true`: marcar quatro severidades não pode empilhar quatro
        // entradas no histórico — sair da página exigiria quatro cliques no
        // "voltar". O voltar continua desfazendo a NAVEGAÇÃO, e como cada
        // aplicação de filtro troca a URL, também desfaz o último filtro.
        setParamsDaUrl(novos, { replace: false });
        return;
      }
      setParamsLocais(novos);
    },
    [syncToUrl, setParamsDaUrl],
  );

  return [syncToUrl ? paramsDaUrl : paramsLocais, escrever];
}

export function useFindingsFilters(
  syncToUrl: boolean,
  lockedFilters?: Partial<FindingFilters>,
): ControlesDeFindings {
  const [params, escreverParams] = useParamsDeFiltro(syncToUrl);

  /* --- o filtro aplicado, lido da fonte da verdade ----------------------- */

  const textoAplicado = useMemo(() => tokensToString(paramsToTokens(params)), [params]);

  const [rascunho, setRascunho] = useState(textoAplicado);

  /**
   * A última query string que NÓS escrevemos.
   *
   * ⚠️ É o que distingue "a URL mudou porque aplicamos o rascunho" de "a URL
   * mudou por fora" (voltar do navegador, link colado). Sem essa distinção, o
   * rascunho é sobrescrito pelo filtro aplicado logo depois de aplicar — e o
   * efeito visível disso é uma expressão INVÁLIDA sumindo do campo: ela nunca
   * chega à URL (de propósito), então a volta apaga o chip vermelho antes de a
   * pessoa ler o motivo. Era exatamente o que acontecia.
   */
  const ultimoAplicado = useRef<string | null>(null);

  useEffect(() => {
    if (params.toString() === ultimoAplicado.current) return; // escrita nossa
    setRascunho(textoAplicado);
  }, [textoAplicado, params]);

  const tokens = useMemo(() => parseQuery(rascunho), [rascunho]);

  /* --- escrita ----------------------------------------------------------- */

  const aplicarTokens = useCallback(
    (novos: QueryToken[]) => {
      const doFiltro = tokensToParams(novos);
      const finais = new URLSearchParams(params);

      for (const p of PARAMS_DO_FILTRO) finais.delete(p);
      doFiltro.forEach((valor, chave) => finais.set(chave, valor));
      // Todo filtro novo devolve à página 1: manter a 7 depois de filtrar para
      // 3 resultados mostraria uma lista vazia que parece erro.
      finais.delete("page");

      ultimoAplicado.current = finais.toString();
      escreverParams(finais);
    },
    [params, escreverParams],
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const definirRascunho = useCallback(
    (texto: string) => {
      setRascunho(texto);
      if (timer.current) clearTimeout(timer.current);
      // Debounce: o campo responde à digitação na hora, mas só a APLICAÇÃO é
      // adiada. Sem ele, cada tecla vira uma requisição e uma entrada de
      // histórico.
      timer.current = setTimeout(() => aplicarTokens(parseQuery(texto)), MS_DEBOUNCE);
    },
    [aplicarTokens],
  );

  const aplicarAgora = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    aplicarTokens(parseQuery(rascunho));
  }, [aplicarTokens, rascunho]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  /** Reescreve rascunho e filtro de uma vez — usado por tudo que não é digitação. */
  const substituirTokens = useCallback(
    (novos: QueryToken[]) => {
      if (timer.current) clearTimeout(timer.current);
      setRascunho(tokensToString(novos));
      aplicarTokens(novos);
    },
    [aplicarTokens],
  );

  const alternarValor = useCallback(
    (field: FilterField, valor: string) => {
      const outros = tokens.filter((t) => !(t.kind === "filter" && t.field === field));
      const doCampo = tokens.find((t) => t.kind === "filter" && t.field === field);
      const atuais = doCampo?.kind === "filter" ? doCampo.values : [];
      const proximos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];

      if (proximos.length === 0) {
        substituirTokens(outros);
        return;
      }
      substituirTokens([
        ...outros,
        { kind: "filter", field, operator: "=", values: proximos, raw: `${field} = ${proximos.join(", ")}` },
      ]);
    },
    [tokens, substituirTokens],
  );

  const estaAtivo = useCallback(
    (field: FilterField, valor: string) =>
      tokens.some((t) => t.kind === "filter" && t.field === field && t.values.includes(valor)),
    [tokens],
  );

  const removerToken = useCallback(
    (indice: number) => substituirTokens(tokens.filter((_, i) => i !== indice)),
    [tokens, substituirTokens],
  );

  const limparTudo = useCallback(() => substituirTokens([]), [substituirTokens]);

  /* --- paginação e ordenação --------------------------------------------- */

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(FINDINGS_PAGE_SIZE_MAX, Math.max(1, Number(params.get("pageSize")) || PAGE_SIZE_PADRAO));
  const sortBy = (params.get("sortBy") as FindingSortField) || "createdAt";
  const sortOrder = (params.get("sortOrder") as SortOrder) || "desc";

  const escreverVista = useCallback(
    (mudancas: Record<string, string | null>) => {
      const novos = new URLSearchParams(params);
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null) novos.delete(chave);
        else novos.set(chave, valor);
      }
      // Também é escrita nossa: paginar ou reordenar não pode reescrever o
      // rascunho e apagar um chip inválido que a pessoa ainda está lendo.
      ultimoAplicado.current = novos.toString();
      escreverParams(novos);
    },
    [params, escreverParams],
  );

  const irParaPagina = useCallback(
    (pagina: number) => escreverVista({ page: pagina <= 1 ? null : String(pagina) }),
    [escreverVista],
  );

  const ordenarPor = useCallback(
    (campo: FindingSortField) => {
      const mesmaColuna = campo === sortBy;
      const direcao: SortOrder = mesmaColuna && sortOrder === "desc" ? "asc" : "desc";
      // Trocar a ordenação volta à página 1: a página 3 de outra ordem é
      // outro conjunto de linhas, e ficar nela parece que a tabela embaralhou.
      escreverVista({ sortBy: campo, sortOrder: direcao, page: null });
    },
    [sortBy, sortOrder, escreverVista],
  );

  /* --- o que vai pra API -------------------------------------------------- */

  const paramsDaApi = useMemo(
    () => montarParamsDaBusca(params, lockedFilters, page, pageSize, sortBy, sortOrder),
    [params, lockedFilters, page, pageSize, sortBy, sortOrder],
  );

  const quantidadeAtiva = PARAMS_DO_FILTRO.some((p) => Boolean(params.get(p)));

  return {
    rascunho,
    tokens,
    paramsDaApi,
    quantidadeAtiva,
    page,
    pageSize,
    sortBy,
    sortOrder,
    definirRascunho,
    aplicarAgora,
    alternarValor,
    estaAtivo,
    removerToken,
    limparTudo,
    irParaPagina,
    ordenarPor,
  };
}

/** Campos que fazem sentido oferecer na barra, na ordem em que aparecem. */
export const CAMPOS_FILTRAVEIS = Object.keys(CAMPOS) as FilterField[];

/** Só os parâmetros da vista — exportado pra quem precisa limpar a URL. */
export const PARAMS_DA_LISTAGEM = [...PARAMS_DO_FILTRO, ...PARAMS_DA_VISTA];
