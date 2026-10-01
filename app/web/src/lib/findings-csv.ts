/**
 * findings-csv.ts
 *
 * O QUE FAZ
 * Transforma uma lista de findings em CSV. Funções puras, zero React, zero
 * DOM — quem baixa é o `use-findings-export.ts`.
 *
 * ==========================================================================
 * DUAS ESCOLHAS DE FORMATO QUE PARECEM ERRADAS E NÃO SÃO
 * ==========================================================================
 * 1. **Separador `;`, não `,`.** A vírgula é o padrão do formato, mas o Excel
 *    em português assume `;` e abre um arquivo separado por vírgula com TUDO
 *    numa coluna só. Como este arquivo existe para ser aberto no Excel (é o
 *    que o cliente e a banca vão fazer com ele), o separador segue a
 *    configuração regional, não o nome do formato.
 * 2. **BOM UTF-8 no início.** Sem ele o Excel lê o arquivo como ANSI e
 *    "Injeção" vira "InjeÃ§Ã£o". Três bytes invisíveis resolvem; qualquer
 *    outra ferramenta ignora o BOM.
 *
 * ⚠️ PREFIXO CONTRA INJEÇÃO DE FÓRMULA
 * Célula que começa com `=`, `+`, `-` ou `@` é interpretada como FÓRMULA pelo
 * Excel e pelo Sheets. Um finding intitulado `=cmd|'/c calc'!A0` — e títulos
 * de finding são texto que veio de fora — viraria execução na máquina de quem
 * abre. É a classe CSV injection / formula injection, e num produto de
 * SEGURANÇA exportar essa vulnerabilidade seria constrangedor. Toda célula de
 * texto é prefixada com aspa simples quando começa com um desses caracteres.
 * ==========================================================================
 *
 * QUEM USA
 * `hooks/use-findings-export.ts`.
 */

import { ROTULO_SEVERIDADE, type Severidade } from "../components/ui/badge";
import { OWASP_LABELS, type FindingListItem, type OwaspCategory } from "../types/vulnerability.types";

/** Separador e fim de linha — CRLF porque é o que a RFC 4180 pede. */
const SEPARADOR = ";";
const QUEBRA = "\r\n";
const BOM = "﻿";

const ROTULO_STATUS: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  FIXED: "Corrigido",
  CLOSED: "Fechado",
};

/** Caracteres que o Excel/Sheets tratam como início de fórmula. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Escapa uma célula.
 *
 * Ordem importa: primeiro neutraliza fórmula, depois envolve em aspas. Fazer
 * ao contrário deixaria a aspa simples fora do campo citado.
 */
export function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  let texto = String(valor);
  if (INICIO_DE_FORMULA.test(texto)) texto = `'${texto}`;
  if (texto.includes(SEPARADOR) || texto.includes('"') || /[\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** As colunas do arquivo, na ordem. */
export const COLUNAS_CSV = [
  { cabecalho: "ID", valor: (f: FindingListItem) => f.id },
  { cabecalho: "Título", valor: (f: FindingListItem) => f.title },
  {
    cabecalho: "Severidade",
    valor: (f: FindingListItem) => ROTULO_SEVERIDADE[f.severityFinal as Severidade] ?? f.severityFinal,
  },
  { cabecalho: "Severidade (código)", valor: (f: FindingListItem) => f.severityFinal },
  {
    cabecalho: "Severidade calculada pelo CVSS",
    valor: (f: FindingListItem) => f.severityCalculated,
  },
  {
    // Vírgula decimal: o mesmo motivo do separador `;` — é o que o Excel
    // pt-BR entende como número em vez de texto.
    cabecalho: "Score CVSS",
    valor: (f: FindingListItem) => (f.cvssScore === null ? "" : f.cvssScore.toFixed(1).replace(".", ",")),
  },
  { cabecalho: "Status", valor: (f: FindingListItem) => ROTULO_STATUS[f.status] ?? f.status },
  { cabecalho: "OWASP", valor: (f: FindingListItem) => f.owaspCategory },
  {
    cabecalho: "Categoria OWASP",
    valor: (f: FindingListItem) => OWASP_LABELS[f.owaspCategory as OwaspCategory] ?? "",
  },
  { cabecalho: "Projeto", valor: (f: FindingListItem) => f.projectName },
  { cabecalho: "Aplicação", valor: (f: FindingListItem) => f.applicationName },
  { cabecalho: "Empresa", valor: (f: FindingListItem) => f.companyName },
  {
    cabecalho: "Criado em",
    valor: (f: FindingListItem) => new Date(f.createdAt).toLocaleString("pt-BR"),
  },
  { cabecalho: "Criado em (ISO)", valor: (f: FindingListItem) => f.createdAt },
] as const;

/**
 * Monta o conteúdo do arquivo.
 *
 * A severidade aparece DUAS vezes — por extenso ("Crítica") e como código
 * ("CRITICAL") — de propósito: a primeira é para quem lê a planilha, a segunda
 * é para quem filtra ou dá `VLOOKUP` nela. Mesma ideia na data.
 */
export function montarCsv(findings: FindingListItem[]): string {
  const linhas = [
    COLUNAS_CSV.map((c) => celula(c.cabecalho)).join(SEPARADOR),
    ...findings.map((f) => COLUNAS_CSV.map((c) => celula(c.valor(f))).join(SEPARADOR)),
  ];
  return BOM + linhas.join(QUEBRA) + QUEBRA;
}

/**
 * Nome do arquivo, com a data e uma marca de que houve recorte.
 *
 * O sufixo `-filtrado` existe para quem baixa duas vezes no mesmo dia não
 * confundir a exportação completa com um recorte — dois arquivos com o mesmo
 * nome na pasta de downloads viram `(1)` e ninguém lembra qual é qual.
 */
export function nomeDoArquivo(comFiltro: boolean, agora = new Date()): string {
  const data = agora.toISOString().slice(0, 10);
  return `findings-vulnera-${data}${comFiltro ? "-filtrado" : "-completo"}.csv`;
}
