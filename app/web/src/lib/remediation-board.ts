/**
 * Agregador do quadro de remediação.
 *
 * O backend pagina a listagem em no máximo 100 itens; o quadro, porém,
 * precisa desenhar todas as colunas e seus totais sem esconder findings.
 * Este helper percorre as páginas do mesmo filtro e entrega um retrato único
 * para a tela. Consumidor: `pages/remediation-page.tsx` e seu teste unitário.
 */

import type { FindingSearchResponse } from "../types/vulnerability.types";

export async function buscarTodosFindings(
  buscar: (params: URLSearchParams) => Promise<FindingSearchResponse>,
  filtros: URLSearchParams,
): Promise<FindingSearchResponse> {
  const pageSize = 100;
  const todos: FindingSearchResponse["data"] = [];
  let pagina = 1;
  let primeira: FindingSearchResponse | null = null;

  let continuar = true;
  while (continuar) {
    const params = new URLSearchParams(filtros);
    params.set("page", String(pagina));
    params.set("pageSize", String(pageSize));
    const resposta = await comEspera(() => buscar(params));
    primeira ??= resposta;
    todos.push(...resposta.data);

    continuar = todos.length < resposta.pagination.total && resposta.data.length > 0;
    if (continuar) pagina += 1;
  }

  // `primeira` só seria nula se o callback não retornasse; o loop sempre faz
  // uma chamada e o tipo explícito evita espalhar `undefined` pela página.
  const base = primeira!;
  return {
    ...base,
    data: todos,
    pagination: {
      ...base.pagination,
      page: 1,
      pageSize: todos.length || pageSize,
      totalPages: todos.length ? 1 : Math.max(1, base.pagination.totalPages),
    },
  };
}

/**
 * A busca fica no bucket "expensive" do rate limit (burst de 3 por usuário) e
 * percorrer o recorte pode pedir mais páginas que isso: no 429, espera o
 * Retry-After e tenta de novo, em vez de derrubar o quadro ou o calendário.
 */
async function comEspera<T>(chamar: () => Promise<T>, tentativas = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await chamar();
    } catch (erro) {
      const segundos = esperaDo429(erro);
      if (segundos === null || i >= tentativas) throw erro;
      await new Promise((resolver) => setTimeout(resolver, segundos * 1000));
    }
  }
}

function esperaDo429(erro: unknown): number | null {
  const resposta = (erro as { response?: { status?: number; data?: { retryAfterSeconds?: unknown } } } | null)?.response;
  if (resposta?.status !== 429) return null;
  const segundos = Number(resposta.data?.retryAfterSeconds);
  return Number.isFinite(segundos) && segundos > 0 ? Math.min(segundos, 15) : 2;
}

