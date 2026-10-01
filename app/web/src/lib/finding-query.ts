/**
 * finding-query.ts
 *
 * O QUE FAZ
 * Traduz a barra de busca da listagem de findings — a linguagem que a pessoa
 * digita — para os parâmetros que a API entende, e de volta.
 *
 * 🎯 FUNÇÕES PURAS, ZERO REACT. Este é o pedaço mais testável da entrega e o
 * que mais dá errado se for escrito junto da interface: parser misturado com
 * `useState` só se testa abrindo a tela, e aí cada caso de erro vira um clique.
 * Aqui cada caso de erro é uma linha de teste.
 *
 * 🎯 NUNCA LANÇA. A barra de busca é reparsada A CADA TECLA. Se o parser
 * lançasse, a página quebraria no meio de uma palavra — `severidade =` existe
 * como estado intermediário de toda digitação de filtro. Entrada malformada
 * vira token `invalid` com motivo legível, e a tela mostra o chip em erro.
 *
 * SINTAXE
 *   severidade = HIGH                 igual
 *   severidade = HIGH, CRITICAL       vários valores = OR dentro do campo
 *   status != CLOSED                  diferente
 *   titulo ~ injection                contém
 *   projeto = "Portal E-commerce"     aspas para valor com espaço
 *   sql injection                     texto solto vira busca livre
 * Expressões separadas por espaço (ou por `AND`) combinam com AND.
 *
 * ⚠️ RESOLUÇÃO DE ENTIDADE
 * `projeto`, `aplicacao` e `empresa` são NOMES na tela e IDS na API. Quem
 * resolve é a interface, via autocomplete: ao escolher, o chip guarda o id e
 * exibe o nome. Um nome digitado à mão que não resolve vira token `invalid` e
 * NÃO é enviado — a API aceita só id, de propósito. Deixar o backend adivinhar
 * nome seria ambiguidade ("Portal" de qual empresa?) resolvida no lugar errado.
 *
 * QUEM USA
 * `components/findings/findings-table.tsx` e `hooks/use-findings.ts`.
 */

import { OWASP_CATEGORIES, SLA_FILTER_VALUES } from "../types/vulnerability.types";
import { RISK_ACCEPTANCE_FILTER_VALUES } from "../types/risk-acceptance.types";

/* ==========================================================================
   Campos
   ========================================================================== */

export type FilterField =
  | "projeto"
  | "aplicacao"
  | "empresa"
  | "severidade"
  | "status"
  | "owasp"
  | "sla"
  | "vrsMin"
  | "vrsMax"
  | "aceite"
  | "responsavel"
  | "titulo";

export type OperadorFiltro = "=" | "!=" | "~";

/** Como cada campo se comporta — o que decide a validação e a serialização. */
interface DefinicaoDeCampo {
  /** Nome do parâmetro na API. */
  param: string;
  tipo: "enum" | "entidade" | "texto" | "numero";
  /** Só para `enum`: valores aceitos. */
  valores?: readonly string[];
  /** Rótulo no singular, para as mensagens de erro. */
  rotulo: string;
}

export const SEVERIDADES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const;
export const STATUS = ["OPEN", "IN_PROGRESS", "FIXED", "CLOSED"] as const;
/** O vocabulário da BUSCA (CP-2) — `RESOLVED` junta "no prazo" e "com atraso"; ver `SLA_FILTER_VALUES`. */
export const SLA = SLA_FILTER_VALUES;
/** Aceite formal de risco (CP-4): ACTIVE | EXPIRED | REQUESTED | NONE. */
export const ACEITE = RISK_ACCEPTANCE_FILTER_VALUES;

export const CAMPOS: Record<FilterField, DefinicaoDeCampo> = {
  projeto: { param: "projectId", tipo: "entidade", rotulo: "projeto" },
  aplicacao: { param: "applicationId", tipo: "entidade", rotulo: "aplicação" },
  empresa: { param: "companyId", tipo: "entidade", rotulo: "empresa" },
  severidade: { param: "severity", tipo: "enum", valores: SEVERIDADES, rotulo: "severidade" },
  status: { param: "status", tipo: "enum", valores: STATUS, rotulo: "status" },
  owasp: { param: "owaspCategory", tipo: "enum", valores: OWASP_CATEGORIES, rotulo: "categoria OWASP" },
  sla: { param: "slaState", tipo: "enum", valores: SLA, rotulo: "SLA" },
  vrsMin: { param: "vrsMin", tipo: "numero", rotulo: "VRS mínimo" },
  vrsMax: { param: "vrsMax", tipo: "numero", rotulo: "VRS máximo" },
  aceite: { param: "riskAcceptance", tipo: "enum", valores: ACEITE, rotulo: "aceite de risco" },
  // Responsável (CP-7). É `entidade` porque na tela é um NOME e na API é um id
  // — quem resolve é o autocomplete, igual a projeto/aplicação/empresa. O
  // valor especial `none` (sem responsável) passa pelo mesmo caminho: a API o
  // trata como IS NULL.
  responsavel: { param: "assignedTo", tipo: "entidade", rotulo: "responsável" },
  titulo: { param: "search", tipo: "texto", rotulo: "título" },
};

/**
 * Apelidos aceitos na digitação.
 *
 * Com e sem acento porque ninguém deveria ter que lembrar de digitar "ç" no
 * meio de uma busca; em inglês porque o vocabulário do domínio (e da API) é
 * inglês e a pessoa acaba misturando. Tudo normalizado para caixa baixa e sem
 * diacrítico antes de procurar aqui.
 */
const APELIDOS: Record<string, FilterField> = {
  projeto: "projeto",
  project: "projeto",
  aplicacao: "aplicacao",
  app: "aplicacao",
  application: "aplicacao",
  empresa: "empresa",
  company: "empresa",
  cliente: "empresa",
  severidade: "severidade",
  severity: "severidade",
  sev: "severidade",
  status: "status",
  estado: "status",
  owasp: "owasp",
  categoria: "owasp",
  titulo: "titulo",
  title: "titulo",
  busca: "titulo",
  sla: "sla",
  prazo: "sla",
  vrsmin: "vrsMin",
  "vrs-min": "vrsMin",
  vrsmax: "vrsMax",
  "vrs-max": "vrsMax",
  aceite: "aceite",
  risco: "aceite",
  acceptance: "aceite",
  responsavel: "responsavel",
  responsable: "responsavel",
  assignee: "responsavel",
  atribuido: "responsavel",
  dono: "responsavel",
};

/**
 * O que cada campo faz, em uma linha, e um exemplo pronto.
 *
 * É o texto da caixa de sugestões: quem abre a barra pela primeira vez não sabe
 * que existe `owasp` nem como se escreve `severidade`. A alternativa — deixar a
 * pessoa adivinhar a chave — transforma um recurso poderoso em um campo de
 * busca comum, porque ninguém usa o que não descobre.
 */
export const DESCRICAO_DOS_CAMPOS: Record<FilterField, { descricao: string; exemplo: string }> = {
  severidade: { descricao: "Gravidade do achado", exemplo: "severidade = HIGH, CRITICAL" },
  status: { descricao: "Em que ponto do ciclo está", exemplo: "status != CLOSED" },
  owasp: { descricao: "Categoria do OWASP Top 10", exemplo: "owasp = A03" },
  sla: { descricao: "Prazo de remediação", exemplo: "sla = BREACHED, DUE_SOON" },
  vrsMin: { descricao: "Piso da prioridade contextual", exemplo: "vrsMin = 40" },
  vrsMax: { descricao: "Teto da prioridade contextual", exemplo: "vrsMax = 84" },
  aceite: { descricao: "Aceite formal de risco", exemplo: "aceite = ACTIVE" },
  projeto: { descricao: "Projeto de análise", exemplo: "projeto = Pentest Web" },
  aplicacao: { descricao: "Aplicação analisada", exemplo: "aplicacao = Portal" },
  empresa: { descricao: "Empresa dona do finding", exemplo: "empresa = TechNova" },
  responsavel: { descricao: "Quem ficou de corrigir", exemplo: "responsavel = Ana Souza" },
  titulo: { descricao: "Texto no título e na descrição", exemplo: "titulo ~ injection" },
};

/** Tira acento e baixa a caixa — "Aplicação" e "aplicacao" têm que casar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* ==========================================================================
   Tokens
   ========================================================================== */

export type QueryToken =
  | { kind: "filter"; field: FilterField; operator: OperadorFiltro; values: string[]; raw: string }
  | { kind: "text"; value: string; raw: string }
  | { kind: "invalid"; raw: string; reason: string };

/** Rótulo humano de um token — o texto do chip. */
export function tokenLabel(token: QueryToken, nomeDaEntidade?: (field: FilterField, id: string) => string): string {
  if (token.kind === "text") return `Texto: "${token.value}"`;
  if (token.kind === "invalid") return token.raw;
  const campo = CAMPOS[token.field];
  const valores = token.values.map((v) =>
    campo.tipo === "entidade" ? (nomeDaEntidade?.(token.field, v) ?? v) : v,
  );
  return `${campo.rotulo} ${token.operator} ${valores.join(", ")}`;
}

/* ==========================================================================
   parseQuery
   ========================================================================== */

/* --------------------------------------------------------------------------
   Lexer
   --------------------------------------------------------------------------
   Feito à mão em vez de `split(/\s+/)` por três motivos, todos vindos de como
   as pessoas realmente digitam:
     1. `projeto = "Portal E-commerce"` tem espaço DENTRO do valor;
     2. `severidade=HIGH`, `severidade= HIGH` e `severidade = HIGH` são a mesma
        coisa — o operador pode estar colado de um lado, do outro, ou solto;
     3. a vírgula separa valores e precisa sobreviver à fatia.
   Um `split` por espaço perde as três.
   -------------------------------------------------------------------------- */

type Lexema =
  | { t: "palavra"; v: string; citada: boolean }
  | { t: "op"; v: string }
  | { t: "virgula" }
  | { t: "aspas-abertas"; v: string };

const CHAR_OPERADOR = new Set(["=", "!", "~", ":"]);

function lexar(input: string): Lexema[] {
  const saida: Lexema[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const fim = input.indexOf(char, i + 1);
      if (fim === -1) {
        // Aspas abertas: o resto da entrada é o valor inacabado. Isto é estado
        // NORMAL durante a digitação, não erro de quem usa — por isso vira um
        // token com motivo, e não uma exceção.
        saida.push({ t: "aspas-abertas", v: input.slice(i) });
        return saida;
      }
      saida.push({ t: "palavra", v: input.slice(i + 1, fim), citada: true });
      i = fim + 1;
      continue;
    }

    if (char === ",") {
      saida.push({ t: "virgula" });
      i += 1;
      continue;
    }

    if (CHAR_OPERADOR.has(char)) {
      if (char === "!" && input[i + 1] === "=") {
        saida.push({ t: "op", v: "!=" });
        i += 2;
        continue;
      }
      if (char === "!") {
        // `!` sozinho não é operador nosso — segue como palavra
        saida.push({ t: "palavra", v: char, citada: false });
        i += 1;
        continue;
      }
      saida.push({ t: "op", v: char });
      i += 1;
      continue;
    }

    let fim = i;
    while (fim < input.length) {
      const c = input[fim]!;
      if (/\s/.test(c) || c === "," || c === '"' || c === "'" || (CHAR_OPERADOR.has(c) && c !== "!")) break;
      if (c === "!" && input[fim + 1] === "=") break;
      fim += 1;
    }
    saida.push({ t: "palavra", v: input.slice(i, fim), citada: false });
    i = fim;
  }

  return saida;
}

/* --------------------------------------------------------------------------
   parseQuery
   -------------------------------------------------------------------------- */

/**
 * Transforma a entrada crua em tokens.
 *
 * Nunca lança. Cada erro vira um token `invalid` com motivo em PT-BR, pronto
 * pra virar o texto do chip vermelho.
 */
export function parseQuery(input: string): QueryToken[] {
  if (!input || !input.trim()) return [];

  const lexemas = lexar(input);
  const tokens: QueryToken[] = [];
  const textoLivre: string[] = [];
  let i = 0;

  /** Só o que pode ser NOME de campo: palavra sem aspas seguida de operador. */
  const abreExpressao = (pos: number): boolean => {
    const atual = lexemas[pos];
    const proximo = lexemas[pos + 1];
    return atual?.t === "palavra" && !atual.citada && proximo?.t === "op";
  };

  while (i < lexemas.length) {
    const lexema = lexemas[i]!;

    if (lexema.t === "aspas-abertas") {
      tokens.push({ kind: "invalid", raw: lexema.v, reason: "aspas não fechadas" });
      i += 1;
      continue;
    }

    // vírgula ou operador soltos: ruído de digitação, ignorados em silêncio
    if (lexema.t === "virgula" || lexema.t === "op") {
      i += 1;
      continue;
    }

    // `AND` explícito é separador, não texto de busca
    if (!lexema.citada && normalizar(lexema.v) === "and") {
      i += 1;
      continue;
    }

    if (!abreExpressao(i)) {
      textoLivre.push(lexema.v);
      i += 1;
      continue;
    }

    const campoBruto = lexema.v;
    const operadorBruto = (lexemas[i + 1] as { v: string }).v;
    i += 2;

    // Lista de valores: palavra (vírgula palavra)*
    const values: string[] = [];
    let aspasAbertas = false;
    while (i < lexemas.length) {
      const atual = lexemas[i];
      if (atual?.t === "aspas-abertas") {
        aspasAbertas = true;
        values.push(atual.v);
        i += 1;
        break;
      }
      if (atual?.t !== "palavra") break;
      values.push(atual.v);
      i += 1;
      if (lexemas[i]?.t === "virgula") {
        i += 1;
        continue;
      }
      break;
    }

    const field = APELIDOS[normalizar(campoBruto)];
    // `:` é sinônimo de `=` porque é o que se digita em toda outra barra de
    // busca do mundo; normalizamos para `=` na saída.
    const operator: OperadorFiltro = operadorBruto === "!=" ? "!=" : operadorBruto === "~" ? "~" : "=";
    const raw = `${campoBruto} ${operadorBruto} ${values.join(", ")}`.trim();

    // Aspas abertas no VALOR invalidam a expressão inteira: o valor ainda está
    // sendo digitado, então aplicá-lo pela metade filtraria por um texto que
    // ninguém pediu.
    if (aspasAbertas) {
      tokens.push({ kind: "invalid", raw, reason: "aspas não fechadas" });
      continue;
    }

    if (!field) {
      tokens.push({ kind: "invalid", raw, reason: `campo desconhecido: "${campoBruto}"` });
      continue;
    }

    const definicao = CAMPOS[field];

    // Campo de texto absorve o resto da frase até a próxima expressão:
    // `titulo ~ sql injection` é uma busca por "sql injection", não uma busca
    // por "sql" seguida da palavra solta "injection".
    if (definicao.tipo === "texto") {
      while (i < lexemas.length && !abreExpressao(i)) {
        const atual = lexemas[i]!;
        if (atual.t !== "palavra") break;
        if (!atual.citada && normalizar(atual.v) === "and") break;
        values.push(atual.v);
        i += 1;
      }
    }

    if (operator === "~" && definicao.tipo !== "texto") {
      tokens.push({ kind: "invalid", raw, reason: `o operador ~ só vale para texto, não para ${definicao.rotulo}` });
      continue;
    }
    if (operator === "!=" && definicao.tipo === "texto") {
      tokens.push({ kind: "invalid", raw, reason: "busca por texto não aceita !=" });
      continue;
    }
    if (values.length === 0) {
      tokens.push({ kind: "invalid", raw, reason: `${definicao.rotulo} sem valor` });
      continue;
    }

    if (definicao.tipo === "enum") {
      const permitidos = definicao.valores!;
      const normalizados: string[] = [];
      const invalido = values.find((v) => {
        const achado = permitidos.find((p) => normalizar(p) === normalizar(v));
        if (achado) normalizados.push(achado);
        return !achado;
      });
      if (invalido !== undefined) {
        // ⚠️ Um valor ruim invalida a expressão INTEIRA. Descartar só ele
        // mostraria a lista filtrada por HIGH sem avisar que a outra metade do
        // que a pessoa pediu não valeu — resultado errado sem nenhum sinal.
        tokens.push({
          kind: "invalid",
          raw,
          reason: `"${invalido}" não é ${definicao.rotulo} válida (use ${permitidos.join(", ")})`,
        });
        continue;
      }
      tokens.push({ kind: "filter", field, operator, values: normalizados, raw });
      continue;
    }

    if (definicao.tipo === "numero") {
      const numero = Number(values[0]);
      if (operator !== "=" || values.length !== 1 || !Number.isInteger(numero) || numero < 0 || numero > 100) {
        tokens.push({ kind: "invalid", raw, reason: `${definicao.rotulo} deve ser um inteiro entre 0 e 100` });
        continue;
      }
      tokens.push({ kind: "filter", field, operator, values: [String(numero)], raw });
      continue;
    }

    // Entidade e texto guardam o valor como veio. A resolução nome → id é da
    // interface (ver o ⚠️ do cabeçalho); aqui só sai o que foi digitado.
    const finais = definicao.tipo === "texto" ? [values.join(" ")] : values;
    tokens.push({ kind: "filter", field, operator, values: finais, raw });
  }

  if (textoLivre.length > 0) {
    const value = textoLivre.join(" ");
    tokens.push({ kind: "text", value, raw: value });
  }

  return tokens;
}

/* ==========================================================================
   Sugestões — o que completar na posição do cursor
   ========================================================================== */

/**
 * Onde o cursor está, em termos da gramática.
 *
 * `inicio` é onde o pedaço já digitado começa — é o que a aplicação da
 * sugestão substitui. Sem ele, aceitar uma sugestão depois de digitar "sev"
 * produziria "sevseveridade".
 */
export type ContextoDeSugestao =
  | { tipo: "campo"; prefixo: string; inicio: number }
  | { tipo: "valor"; field: FilterField; prefixo: string; inicio: number };

/** Anda para trás a partir de um valor até achar o campo da expressão. */
function campoDaExpressao(lex: Lexema[], iDoValor: number): FilterField | null {
  for (let i = iDoValor; i >= 0; i -= 1) {
    if (lex[i]!.t !== "op") continue;
    const anterior = lex[i - 1];
    if (anterior?.t !== "palavra") return null;
    return APELIDOS[normalizar(anterior.v)] ?? null;
  }
  return null;
}

/**
 * Decide o que sugerir na posição do cursor.
 *
 * Trabalha sobre o texto ANTES do cursor, que é o que determina o contexto —
 * o que vem depois é de outra expressão e não muda o que se está digitando
 * agora. Nunca lança, pelo mesmo motivo do `parseQuery`: isto roda a cada
 * tecla e a cada movimento de cursor.
 */
export function analisarContexto(input: string, cursor: number = input.length): ContextoDeSugestao {
  const antes = input.slice(0, Math.max(0, Math.min(cursor, input.length)));
  const lex = lexar(antes);
  const n = lex.length;
  const terminaComEspaco = antes === "" || /\s$/.test(antes);

  const inicioDoPrefixo = (prefixo: string) => antes.length - prefixo.length;

  if (n === 0) return { tipo: "campo", prefixo: "", inicio: antes.length };

  const ultimo = lex[n - 1]!;

  const semPrefixo = { prefixo: "", inicio: antes.length } as const;

  // `campo =` ou `campo = a,` — o próximo pedaço é um valor, ainda vazio
  if (ultimo.t === "op" || ultimo.t === "virgula") {
    const field = campoDaExpressao(lex, n - 1);
    return field ? { tipo: "valor", field, ...semPrefixo } : { tipo: "campo", ...semPrefixo };
  }

  // Palavra seguida de espaço = pedaço terminado; o cursor começou o próximo,
  // que é sempre uma expressão nova — `severidade = HIGH ` pede um campo, não
  // um segundo valor (para isso a pessoa digita a vírgula).
  if (ultimo.t !== "palavra" || terminaComEspaco) return { tipo: "campo", ...semPrefixo };

  const anterior = lex[n - 2];
  if (anterior?.t === "op" || anterior?.t === "virgula") {
    const field = campoDaExpressao(lex, n - 2);
    if (field) return { tipo: "valor", field, prefixo: ultimo.v, inicio: inicioDoPrefixo(ultimo.v) };
  }

  return { tipo: "campo", prefixo: ultimo.v, inicio: inicioDoPrefixo(ultimo.v) };
}

/**
 * Aplica uma sugestão, devolvendo o texto novo e onde o cursor deve ficar.
 *
 * Escolher um CAMPO já emenda ` = `, porque ninguém escolhe "severidade" para
 * parar ali — o passo seguinte é sempre o valor, e a caixa de sugestões
 * continua aberta mostrando os valores daquele campo. Escolher um VALOR emenda
 * um espaço, deixando a expressão fechada e pronta para a próxima.
 */
export function aplicarSugestao(
  input: string,
  contexto: ContextoDeSugestao,
  valor: string,
): { texto: string; cursor: number } {
  const emendado = contexto.tipo === "campo" ? `${valor} = ` : `${citar(valor)} `;
  const antes = input.slice(0, contexto.inicio);
  const depois = input.slice(contexto.inicio + contexto.prefixo.length);
  const texto = antes + emendado + depois;
  return { texto, cursor: (antes + emendado).length };
}

/** Campos que já estão presentes na expressão — para não sugerir duas vezes. */
export function camposUsados(input: string): FilterField[] {
  return parseQuery(input)
    .filter((t): t is Extract<QueryToken, { kind: "filter" }> => t.kind === "filter")
    .map((t) => t.field);
}

/* ==========================================================================
   tokens → URLSearchParams
   ========================================================================== */

/** Um id é um `cuid()`: começa com `c` e tem 25 caracteres alfanuméricos. */
const RE_ID = /^c[a-z0-9]{20,30}$/i;

/**
 * Monta os parâmetros da API a partir dos tokens.
 *
 * REGRAS
 *   - token `invalid` NÃO entra. Um filtro que a pessoa escreveu errado não
 *     pode silenciosamente virar "sem filtro" na requisição — a tela mostra o
 *     chip em erro, e o resultado exibido é o do filtro que de fato foi aplicado.
 *   - `!=` vira o complemento do conjunto. A API não tem operador de negação, e
 *     não precisa ter: `status != CLOSED` é exatamente `status in (OPEN,
 *     IN_PROGRESS, FIXED)`. Fazer a negação aqui mantém o backend com um
 *     vocabulário só.
 *   - entidade que não é id é descartada — quem não resolveu não vai à API.
 *   - `titulo ~ x` e texto livre alimentam o mesmo `search`; se houver os dois,
 *     ganham juntos, separados por espaço.
 */
export function tokensToParams(tokens: QueryToken[]): URLSearchParams {
  const params = new URLSearchParams();
  const acumulado: Record<string, string[]> = {};
  const buscas: string[] = [];

  for (const token of tokens) {
    if (token.kind === "invalid") continue;
    if (token.kind === "text") {
      buscas.push(token.value);
      continue;
    }

    const definicao = CAMPOS[token.field];

    if (definicao.tipo === "texto") {
      buscas.push(...token.values);
      continue;
    }

    let values = token.values;

    if (token.operator === "!=") {
      if (definicao.tipo !== "enum") continue; // já barrado no parse, defensivo
      values = definicao.valores!.filter((v) => !token.values.includes(v));
      if (values.length === 0) continue; // negou tudo — filtro vazio, não filtro nenhum
    }

    if (definicao.tipo === "entidade") {
      values = values.filter((v) => RE_ID.test(v));
      if (values.length === 0) continue;
    }

    acumulado[definicao.param] = [...(acumulado[definicao.param] ?? []), ...values];
  }

  for (const [param, values] of Object.entries(acumulado)) {
    // vírgula, a mesma serialização que `use-filtros-metricas.ts` já usa na URL
    params.set(param, [...new Set(values)].join(","));
  }
  if (buscas.length > 0) params.set("search", buscas.join(" "));

  return params;
}

/* ==========================================================================
   URLSearchParams → tokens
   ========================================================================== */

/**
 * Reconstrói os tokens a partir da URL — é o que faz um link compartilhado
 * abrir com os chips certos.
 *
 * ⚠️ Só volta como `=`: a informação de que o usuário digitou `!=` se perde na
 * ida (virou o complemento). Isso é de propósito e é o que mantém a URL como
 * fonte única da verdade — o estado que a URL carrega é o filtro REAL, não a
 * frase que o gerou. O chip mostra "status = OPEN, IN_PROGRESS, FIXED", que é
 * o que de fato está sendo aplicado.
 */
export function paramsToTokens(params: URLSearchParams): QueryToken[] {
  const tokens: QueryToken[] = [];

  for (const [field, definicao] of Object.entries(CAMPOS) as [FilterField, DefinicaoDeCampo][]) {
    if (definicao.tipo === "texto") continue;
    const bruto = params.get(definicao.param);
    if (!bruto) continue;
    const values = bruto.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) continue;
    tokens.push({ kind: "filter", field, operator: "=", values, raw: `${field} = ${values.join(", ")}` });
  }

  const search = params.get("search");
  if (search) tokens.push({ kind: "text", value: search, raw: search });

  return tokens;
}

/* ==========================================================================
   tokens → string
   ========================================================================== */

/** Precisa de aspas? (espaço ou vírgula dentro do valor confundiria o parser) */
const precisaDeAspas = (valor: string) => /[\s,"']/.test(valor);
const citar = (valor: string) => (precisaDeAspas(valor) ? `"${valor.replace(/"/g, "")}"` : valor);

/**
 * Serializa tokens de volta para a linguagem da barra.
 *
 * 🎯 REDONDO: `parseQuery(tokensToString(parseQuery(x)))` produz os mesmos
 * tokens que `parseQuery(x)`. É o que permite editar um chip e devolver o
 * texto pro campo sem perder nada. Coberto por teste.
 */
export function tokensToString(tokens: QueryToken[]): string {
  const partes: string[] = [];

  for (const token of tokens) {
    if (token.kind === "invalid") {
      partes.push(token.raw);
      continue;
    }
    if (token.kind === "text") {
      partes.push(token.value);
      continue;
    }
    partes.push(`${token.field} ${token.operator} ${token.values.map(citar).join(", ")}`);
  }

  return partes.join(" ");
}
