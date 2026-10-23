/**
 * texto.ts
 *
 * Tudo que vira texto de célula passa por aqui. Três defesas, nesta ordem:
 *
 * 1. **Caracteres que o XML proíbe.** Saída de scanner traz NUL, ESC e afins;
 *    o XML 1.0 não admite esses caracteres e o Excel responde com "encontramos
 *    um problema… reparar?". São REMOVIDOS (não há como representá-los).
 *
 *    Quebras de linha CRLF/CR são normalizadas para LF (a do Excel).
 *
 * 2. **Limite de 32.767 caracteres por célula** (limite do formato, não do
 *    produto). Texto maior é cortado em `LIMITE_UTIL` e termina com um marcador
 *    EXPLÍCITO — "[… truncado: N caracteres omitidos]" — nunca em silêncio.
 *    O corte não parte um par substituto (emoji) ao meio.
 *
 * 3. **Injeção de fórmula.** Valor que começa com `=`, `+`, `-`, `@`, TAB, CR
 *    ou LF é sinalizado em `perigoso`; o gerador grava essas células com o
 *    formato TEXTO (`@`). Efeito sobre o dado: NENHUM — o conteúdo continua
 *    idêntico, sem aspa visível. O que muda é que o Excel passa a tratar a
 *    célula como texto mesmo se alguém editar e der Enter (que é quando
 *    `=cmd|…` viraria fórmula). Na planilha o valor já é gravado como STRING,
 *    nunca como fórmula; o formato texto cobre a edição posterior.
 *    ⚠️ Não protege quem exporta a aba para CSV e reabre — risco conhecido do
 *    formato CSV, fora do que um xlsx consegue impedir.
 */

/** Limite de caracteres por célula do formato XLSX. */
export const LIMITE_CELULA = 32_767;
/** Onde cortamos — deixa folga para o marcador de truncamento caber no limite. */
export const LIMITE_UTIL = 32_700;

/** Controles C0 (exceto TAB, LF, CR), mais U+FFFE/U+FFFF — ilegais em XML 1.0. */
// eslint-disable-next-line no-control-regex
const ILEGAIS_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
/** Substituto (surrogate) sem par: UTF-16 inválido que o XML também rejeita. */
const SUBSTITUTO_SOLTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const INICIO_DE_FORMULA = /^[=+\-@\t\r\n]/;

export interface TextoDeCelula {
  texto: string;
  /** Começa com caractere que o Excel trataria como fórmula — gravar com formato texto. */
  perigoso: boolean;
  truncado: boolean;
}

/** Qualquer caractere que as limpezas abaixo tocariam. Texto sem eles pula direto para o teste de tamanho. */
// eslint-disable-next-line no-control-regex
const PRECISA_LIMPAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF\r]/;

export function prepararTexto(valor: string | null | undefined): TextoDeCelula {
  if (valor == null || valor === "") return { texto: "", perigoso: false, truncado: false };

  if (valor.length <= LIMITE_UTIL && !PRECISA_LIMPAR.test(valor)) {
    return { texto: valor, perigoso: INICIO_DE_FORMULA.test(valor), truncado: false };
  }

  // CRLF e CR viram LF: é a quebra de linha de célula do Excel, e o XML a normalizaria de qualquer jeito
  // (um leitor devolveria LF) — fazer aqui deixa o resultado igual em todos os leitores.
  let texto = valor.replace(ILEGAIS_XML, "").replace(SUBSTITUTO_SOLTO, "").replace(/\r\n?/g, "\n");

  let truncado = false;
  if (texto.length > LIMITE_UTIL) {
    let corte = LIMITE_UTIL;
    // Não deixa um par substituto pela metade na fronteira do corte.
    const ultimo = texto.charCodeAt(corte - 1);
    if (ultimo >= 0xd800 && ultimo <= 0xdbff) corte -= 1;
    const omitidos = texto.length - corte;
    texto = `${texto.slice(0, corte)}\n[… truncado: ${omitidos.toLocaleString("pt-BR")} caracteres omitidos]`;
    truncado = true;
  }

  return { texto, perigoso: INICIO_DE_FORMULA.test(texto), truncado };
}

/** Escapa texto para dentro de XML (título de gráfico, rótulos em cache). */
export function escaparXml(valor: string): string {
  return valor
    .replace(ILEGAIS_XML, "")
    .replace(SUBSTITUTO_SOLTO, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Estima a altura de linha (pt) para texto com quebra automática.
 *
 * O Excel até recalcularia sozinho, mas o LibreOffice e os visualizadores
 * online não — a célula ficaria com o texto amontoado sobre a linha de baixo
 * (visto no spike). Altura explícita dá o mesmo resultado em todos.
 * `caracteresPorLinha` ≈ largura da coluna × 1,2 (Calibri 10 é mais estreita
 * que a unidade de largura, medida em Calibri 11).
 */
export function alturaDeLinha(
  textos: ReadonlyArray<{ texto: string; largura: number }>,
  opcoes: { minima: number; maxima: number; porLinha?: number } = { minima: 18, maxima: 160 },
): number {
  const porLinha = opcoes.porLinha ?? 13;
  let linhas = 1;
  for (const { texto, largura } of textos) {
    if (!texto) continue;
    const cpl = Math.max(1, Math.floor(largura * 1.2));
    let soma = 0;
    for (const trecho of texto.split("\n")) soma += Math.max(1, Math.ceil(trecho.length / cpl));
    if (soma > linhas) linhas = soma;
  }
  return Math.min(opcoes.maxima, Math.max(opcoes.minima, linhas * porLinha + 4));
}
