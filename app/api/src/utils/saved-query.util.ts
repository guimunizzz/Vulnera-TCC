/**
 * saved-query.util.ts
 *
 * Valida e CANONIZA a query string de uma busca salva (CP-6). Funções puras —
 * nada de banco, nada de HTTP.
 *
 * ==========================================================================
 * POR QUE NÃO GUARDAR A STRING COMO ELA CHEGOU
 * ==========================================================================
 * Porque uma busca salva é uma string que o produto vai DEVOLVER e REEXECUTAR
 * depois, e isso muda o que ela é. Três problemas de guardar o texto cru:
 *
 *   1. LIXO VIRA CONTRATO. `?foo=bar&<script>` seria persistido, devolvido na
 *      listagem e reenviado para a API. Nada explode hoje; amanhã alguém
 *      renderiza o parâmetro numa tela.
 *   2. DUPLICATAS INVISÍVEIS. `status=OPEN&severity=HIGH` e
 *      `severity=HIGH&status=OPEN` são a MESMA busca, e sem canonizar viram
 *      dois atalhos diferentes na barra lateral.
 *   3. PARÂMETRO INVÁLIDO SÓ APARECE NO USO. Salvar `severity=URGENTE` é
 *      aceito, e o erro 400 só aparece quando alguém clica no atalho — longe,
 *      no tempo e na tela, de onde o erro foi cometido.
 *
 * ==========================================================================
 * O QUE É PRESERVADO E O QUE É DESCARTADO
 * ==========================================================================
 * PRESERVADO  todos os filtros da listagem de findings e a ordenação.
 * DESCARTADO  `page` e `pageSize`: busca salva sempre abre na primeira página.
 *             Guardar "página 7" congela um recorte que depende do total de
 *             resultados de quando a busca foi salva.
 *
 * ⚠️ ESTE ARQUIVO ACOMPANHA `vulnerability.controller.ts`. Todo filtro novo da
 * listagem precisa entrar aqui também — senão ele é silenciosamente removido
 * ao salvar, e o atalho passa a devolver mais resultados do que deveria. O
 * teste SQ-U-08 existe exatamente para prender os dois arquivos juntos.
 */

import { OWASP_CATEGORIES, SEVERITY_ORDER, VULNERABILITY_SORT_FIELDS } from "../models/vulnerability.model";
import type { VulnerabilityStatus } from "../models/vulnerability.model";
import { SLA_FILTER_VALUES } from "./sla.util";

/**
 * ⚠️ Os vocabulários de status e de aceite estão declarados COMO CONSTANTES
 * LOCAIS dentro de `vulnerability.controller.ts`, não exportados. Reaproveitar
 * exigiria mexer naquele arquivo, e o CP-6 não é a hora de refatorar o
 * controller mais usado do produto. A duplicação é assumida e presa por teste:
 * SQ-U-08 compara esta lista com a de lá e falha se divergirem.
 */
const STATUSES: readonly VulnerabilityStatus[] = ["OPEN", "IN_PROGRESS", "FIXED", "CLOSED"];
const RISK_ACCEPTANCE_FILTER_VALUES = ["ACTIVE", "EXPIRED", "REQUESTED", "NONE"] as const;
const SEVERITIES = SEVERITY_ORDER;

/** Teto do texto salvo — o schema declara VarChar(2000). */
export const SAVED_QUERY_MAX_LENGTH = 2000;
/** Teto de itens numa lista (`severity=A,B,C`) — evita query de mil valores. */
const MAX_VALORES_POR_CAMPO = 40;
/** Teto do texto livre, igual ao da listagem. */
const MAX_BUSCA = 200;

/**
 * Id de entidade do produto.
 *
 * ⚠️ São CUIDs (`cmu3hjv620091bruceawf6xs0`), não UUIDs — todas as 24 tabelas
 * usam `@default(cuid())`. A primeira versão desta validação exigia o formato
 * UUID e descartava em silêncio todo filtro por projeto, aplicação ou empresa:
 * a busca era salva "com sucesso", só que sem o filtro principal, devolvendo
 * mais findings do que a pessoa pediu. O teste SQ-10 pegou isso.
 *
 * O padrão aceita cuid e uuid, porque o que importa aqui é barrar lixo — quem
 * decide se o id EXISTE é a listagem, não este arquivo.
 */
const ID_ENTIDADE = /^[A-Za-z0-9_-]{8,64}$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

type Validador = (valor: string) => boolean;

const eUmDe = (valores: readonly string[]): Validador => (v) => valores.includes(v);
const eId: Validador = (v) => ID_ENTIDADE.test(v);
const eData: Validador = (v) => DATA_ISO.test(v) && !Number.isNaN(Date.parse(v));
const eInteiro0a100: Validador = (v) => /^\d{1,3}$/.test(v) && Number(v) >= 0 && Number(v) <= 100;

/**
 * Os parâmetros aceitos. `lista: true` quer dizer que o campo aceita vários
 * valores separados por vírgula (que viram OR dentro do campo na API).
 *
 * A ordem deste objeto é a ORDEM CANÔNICA da string resultante.
 */
const PARAMETROS: Record<string, { lista: boolean; valido: Validador }> = {
  companyId: { lista: true, valido: eId },
  applicationId: { lista: true, valido: eId },
  projectId: { lista: true, valido: eId },
  createdBy: { lista: true, valido: eId },
  severity: { lista: true, valido: eUmDe(SEVERITIES) },
  status: { lista: true, valido: eUmDe(STATUSES) },
  owaspCategory: { lista: true, valido: eUmDe(OWASP_CATEGORIES) },
  slaState: { lista: true, valido: eUmDe(SLA_FILTER_VALUES) },
  riskAcceptance: { lista: true, valido: eUmDe(RISK_ACCEPTANCE_FILTER_VALUES) },
  // Responsável (CP-7). `none` é o valor especial de "sem responsável" — a
  // listagem o traduz para IS NULL, e uma busca salva precisa poder guardá-lo:
  // "sem dono e estourado" é justamente a watchlist que alguém quer fixar.
  assignedTo: { lista: true, valido: (v) => v === "none" || ID_ENTIDADE.test(v) },
  vrsMin: { lista: false, valido: eInteiro0a100 },
  vrsMax: { lista: false, valido: eInteiro0a100 },
  createdFrom: { lista: false, valido: eData },
  createdTo: { lista: false, valido: eData },
  search: { lista: false, valido: (v) => v.length > 0 && v.length <= MAX_BUSCA },
  sortBy: { lista: false, valido: eUmDe(VULNERABILITY_SORT_FIELDS) },
  sortOrder: { lista: false, valido: eUmDe(["asc", "desc"]) },
};

/** Descartados de propósito: uma busca salva não guarda em que página estava. */
const IGNORADOS = new Set(["page", "pageSize"]);

export interface ResultadoCanonizacao {
  /** A query canônica, pronta para gravar e para reexecutar. */
  queryString: string;
  /** Parâmetros que foram descartados, com o motivo — a tela avisa quem salvou. */
  descartados: Array<{ param: string; motivo: string }>;
}

/**
 * Canoniza uma query string de busca de findings.
 *
 * NUNCA LANÇA por causa de um parâmetro ruim: descarta e relata. Recusar a
 * busca inteira porque um filtro envelheceu (um projeto apagado, por exemplo)
 * transformaria um atalho levemente desatualizado em erro de tela.
 *
 * Lança apenas quando não há busca alguma a salvar (`EMPTY_QUERY`) ou quando a
 * entrada é grande demais (`QUERY_TOO_LONG`) — aí não há o que preservar.
 */
export function canonicalizarQuery(bruta: string): ResultadoCanonizacao {
  if (typeof bruta !== "string") throw new Error("INVALID_QUERY");
  const entrada = bruta.trim().replace(/^[?#]+/, "");
  if (entrada.length > SAVED_QUERY_MAX_LENGTH * 2) throw new Error("QUERY_TOO_LONG");

  const params = new URLSearchParams(entrada);
  const descartados: ResultadoCanonizacao["descartados"] = [];
  const canonico = new Map<string, string[]>();

  for (const [chaveBruta, valorBruto] of params) {
    // `severity[]` é a forma que alguns clientes HTTP emitem para lista.
    const chave = chaveBruta.replace(/\[\]$/, "");

    if (IGNORADOS.has(chave)) continue;

    const def = PARAMETROS[chave];
    if (!def) {
      descartados.push({ param: chaveBruta, motivo: "parâmetro desconhecido" });
      continue;
    }

    const valores = def.lista
      ? valorBruto.split(",").map((v) => v.trim()).filter(Boolean)
      : [valorBruto.trim()];

    const aceitos = canonico.get(chave) ?? [];
    for (const v of valores) {
      if (!def.valido(v)) {
        descartados.push({ param: `${chave}=${v}`, motivo: "valor inválido" });
        continue;
      }
      if (!def.lista && aceitos.length > 0) {
        // Segundo valor num campo de valor único: o primeiro vence, e o
        // silêncio aqui seria pior que o descarte.
        descartados.push({ param: `${chave}=${v}`, motivo: "campo aceita um valor só" });
        continue;
      }
      if (aceitos.length >= MAX_VALORES_POR_CAMPO) {
        descartados.push({ param: `${chave}=${v}`, motivo: "limite de valores por campo" });
        continue;
      }
      if (!aceitos.includes(v)) aceitos.push(v);
    }
    if (aceitos.length > 0) canonico.set(chave, aceitos);
  }

  // Ordem canônica: a das chaves em PARAMETROS; valores em ordem alfabética.
  // É o que faz duas buscas equivalentes virarem a MESMA string.
  const partes: string[] = [];
  for (const chave of Object.keys(PARAMETROS)) {
    const valores = canonico.get(chave);
    if (!valores || valores.length === 0) continue;
    const lista = PARAMETROS[chave]!.lista;
    const ordenados = lista ? [...valores].sort() : valores;
    // A vírgula separadora fica LITERAL nos campos de lista: ela é sub-delim
    // válido em query string, e esta string vai para a URL da tela e para o
    // rótulo do atalho. `status=FIXED%2COPEN` funcionaria e seria ilegível.
    // Nos campos de valor único o encode é integral — `search` pode conter
    // qualquer coisa, inclusive `&`.
    const valor = encodeURIComponent(ordenados.join(","));
    partes.push(`${encodeURIComponent(chave)}=${lista ? valor.replace(/%2C/g, ",") : valor}`);
  }

  const queryString = partes.join("&");
  if (!queryString) throw new Error("EMPTY_QUERY");
  if (queryString.length > SAVED_QUERY_MAX_LENGTH) throw new Error("QUERY_TOO_LONG");

  return { queryString, descartados };
}

/**
 * Duas buscas são a mesma busca? Comparação feita sobre a forma canônica —
 * é assim que o service detecta atalho duplicado sem depender do nome.
 */
export function mesmaQuery(a: string, b: string): boolean {
  try {
    return canonicalizarQuery(a).queryString === canonicalizarQuery(b).queryString;
  } catch {
    return false;
  }
}

/** Os filtros da busca, para a tela descrever o atalho sem reparsear. */
export function resumirQuery(queryString: string): Array<{ campo: string; valores: string[] }> {
  const params = new URLSearchParams(queryString);
  const saida: Array<{ campo: string; valores: string[] }> = [];
  for (const chave of Object.keys(PARAMETROS)) {
    const valor = params.get(chave);
    if (valor) saida.push({ campo: chave, valores: valor.split(",") });
  }
  return saida;
}

/** Exportado para o teste que prende este arquivo ao controller (SQ-U-08). */
export const PARAMETROS_SUPORTADOS = Object.keys(PARAMETROS);
