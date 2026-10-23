/**
 * planilha.ts
 *
 * Monta o .xlsx de findings: abas Resumo, Findings, Dashboard, Acompanhamento
 * e Auxiliar (oculta). Escreve num ARQUIVO temporário com o writer em streaming
 * do ExcelJS; os gráficos nativos entram depois, em `injetor.ts`.
 *
 * ==========================================================================
 * DECISÕES QUE PARECEM ARBITRÁRIAS E NÃO SÃO
 * ==========================================================================
 * • Resumo é a PRIMEIRA aba mas só precisa do total (contado antes) — não de
 *   nenhum agregado. Dashboard e Acompanhamento vêm DEPOIS de Findings porque
 *   dependem dos números acumulados enquanto as linhas passavam.
 *
 * • Os intervalos de dados (`f_Sev`, `f_Status`…) são NOMES DEFINIDOS que
 *   apontam para a extensão exata gravada. As fórmulas leem `f_Sev`, não
 *   `Findings!$C$2:$C$50001`: legível, e um único lugar a ajustar. Nomes são
 *   gravados no fim do arquivo, então a extensão real (contada linha a linha)
 *   é a que vale — mesmo que o total divirja do contado antes.
 *
 * • "Data de referência" (`data_ref`) é UMA célula do Resumo. Toda idade e todo
 *   SLA apontam para ela. Padrão: a data da geração, como VALOR fixo — o
 *   arquivo bate com a tela e é reproduzível. TODAY() é volátil: o mesmo
 *   arquivo mostraria números diferentes a cada dia, e o do dia da geração
 *   nunca mais seria reproduzível. Quem quer acompanhamento vivo troca a
 *   célula por =HOJE().
 *
 * • Top 10 de ativos SEM UNIQUE/FILTER (não portáveis): a aba Auxiliar lista
 *   os 50 ativos mais frequentes (nomes como valor); contagem, desempate e
 *   ranking são fórmulas (SUMPRODUCT, LARGE, INDEX/MATCH). Trade-off: se o
 *   usuário RENOMEAR um ativo na aba Findings, o novo nome não entra no
 *   ranking — a lista de nomes é um retrato.
 *   A contagem usa `SUMPRODUCT(--(f_Ativo=nome))` e não COUNTIF: COUNTIF trata
 *   `*`, `?` e `~` como curingas e `=`/`>`/`<` no início como operador, e nome
 *   de aplicação é texto livre.
 *
 * • Acompanhamento carrega ID e título como VALOR, não fórmula: `INDEX/MATCH`
 *   em 50 mil linhas por 50 mil seria ~2,5 bilhões de comparações, e
 *   `=Findings!A2` quebraria no primeiro filtro/ordenação da aba de dados.
 *
 * • Toda fórmula leva o resultado EM CACHE (ver `agregados.ts`).
 * ==========================================================================
 */

import fs from "node:fs";
import * as ExcelJS from "exceljs";
import type { FindingsExportRow } from "../../models/findings-export.model";
import {
  Agregados,
  MAX_ATIVOS_AUXILIAR,
  diasEmAberto,
  situacaoSla,
} from "./agregados";
import type { GraficoNativo } from "./graficos";
import {
  PRIORIDADES,
  ROTULO_ORIGEM,
  ROTULO_PRIORIDADE,
  ROTULO_SEVERIDADE,
  ROTULO_SLA,
  ROTULO_STATUS,
  ROTULOS_ABERTOS,
  ROTULOS_RESOLVIDOS,
  SEVERIDADES_ROTULADAS,
  STATUS_ROTULADOS,
  rotuloOwasp,
} from "./rotulos";
import {
  COR,
  COR_GRAFICO_SEVERIDADE,
  COR_GRAFICO_STATUS,
  COR_SEVERIDADE,
  COR_SLA,
  COR_STATUS,
  FONTE,
} from "./tema";
import { alturaDeLinha, prepararTexto } from "./texto";
import { dataDoDia, diaSP, relogioSP } from "./tempo";

/* ==========================================================================
   Contrato
   ========================================================================== */

export interface LinhaDeFiltro {
  rotulo: string;
  valor: string;
}

export interface ContextoDoResumo {
  geradoEm: Date;
  geradoPor: string;
  perfil: string;
  filtros: LinhaDeFiltro[];
  ordenacao: string;
  limite: number;
}

export interface EntradaDaPlanilha {
  lotes: AsyncIterable<FindingsExportRow[]>;
  /** Contagem feita ANTES de ler — alimenta o Resumo. */
  total: number;
  resumo: ContextoDoResumo;
  /** Arquivo temporário onde o ExcelJS escreve. */
  caminho: string;
  /** Aborta a leitura quando o cliente desiste. */
  sinal?: AbortSignal;
}

export interface SaidaDaPlanilha {
  linhas: number;
  /** Quantas células de texto foram truncadas (e marcadas no próprio texto). */
  camposTruncados: number;
  /** Aba (parte do zip) que recebe o desenho dos gráficos. */
  abaDoDashboard: string;
  graficos: GraficoNativo[];
  agregados: Agregados;
}

/** Nome das abas — as fórmulas e o injetor dependem deles. */
export const ABA = {
  resumo: "Resumo",
  findings: "Findings",
  dashboard: "Dashboard",
  acompanhamento: "Acompanhamento",
  auxiliar: "Auxiliar",
} as const;

/** `sheetN.xml` do Dashboard: é a TERCEIRA aba adicionada (ver a ordem em `montarPlanilha`). */
export const PARTE_DO_DASHBOARD = "xl/worksheets/sheet3.xml";

/** Alerta padrão de "Vencendo" no Acompanhamento, em dias corridos. */
export const ALERTA_DIAS_PADRAO = 7;

/* ==========================================================================
   Estilos
   ========================================================================== */

type Estilo = Partial<ExcelJS.Style>;

const argb = (rgb: string): { argb: string } => ({ argb: `FF${rgb}` });
const fundo = (rgb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: argb(rgb), bgColor: argb(rgb) });
const linhaFina = (rgb: string = COR.borda): Partial<ExcelJS.Border> => ({ style: "thin", color: argb(rgb) });
const bordas = (rgb?: string): Partial<ExcelJS.Borders> => ({
  top: linhaFina(rgb),
  left: linhaFina(rgb),
  bottom: linhaFina(rgb),
  right: linhaFina(rgb),
});
const fonte = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FONTE, size: 10, color: argb(COR.texto), ...extra });

const ESTILO_CABECALHO: Estilo = {
  font: fonte({ bold: true, color: argb(COR.branco) }),
  fill: fundo(COR.marinho),
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
  border: bordas(COR.marinho),
};

const FMT_DATA = "dd/mm/yyyy";
const FMT_DATA_HORA = "dd/mm/yyyy hh:mm";

/** Estilo da formatação condicional (dxf). Fundo vai em fg e bg: o Excel lê `bgColor` em preenchimento sólido. */
function dxf(c: { fundo: string; texto: string }, negrito = false): Partial<ExcelJS.Style> {
  return { fill: fundo(c.fundo), font: { color: argb(c.texto), bold: negrito } };
}

function regrasIguais(valores: Record<string, { fundo: string; texto: string }>, prioridadeInicial: number, negritoEm: string[] = []) {
  return Object.entries(valores).map(([valor, cor], i) => ({
    type: "cellIs" as const,
    operator: "equal" as const,
    formulae: [`"${valor}"`],
    priority: prioridadeInicial + i,
    style: dxf(cor, negritoEm.includes(valor)),
  }));
}

/** Letra de coluna (1 = A). */
function letra(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/**
 * `dataValidations` existe no writer em streaming (o PoC do spike provou), mas o
 * d.ts do ExcelJS só o declara no Worksheet em memória.
 */
function validar(ws: ExcelJS.Worksheet, intervalo: string, v: ExcelJS.DataValidation): void {
  (ws as unknown as { dataValidations: { add(a: string, v: ExcelJS.DataValidation): void } }).dataValidations.add(intervalo, v);
}

/**
 * Devolve o controle ao event loop. O gerador é CPU-bound e roda na MESMA thread que atende a API toda:
 * sem cessões, 50 mil linhas seguidas travariam as outras requisições por vários segundos. O lote do
 * banco já cede entre um lote e outro; este cuida do trabalho que não tem `await` (o corpo do Acompanhamento).
 */
const ceder = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
/** A cada quantas linhas cedemos o event loop. */
const CEDER_A_CADA = 500;

/** `"C12"` → `{ coluna: 3, linha: 12 }`. */
function analisarRef(ref: string): { coluna: number; linha: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Referência de célula inválida: ${ref}`);
  let coluna = 0;
  for (const ch of m[1]!) coluna = coluna * 26 + (ch.charCodeAt(0) - 64);
  return { coluna, linha: Number(m[2]) };
}

/** Valor de célula com resultado em cache — fórmula que o LibreOffice/Online mostram sem recalcular. */
function formula(f: string, resultado: number | string): ExcelJS.CellFormulaValue {
  return { formula: f, result: resultado };
}

/* ==========================================================================
   Montador de abas pequenas (Resumo, Dashboard, Acompanhamento-topo, Auxiliar)
   ========================================================================== */

/**
 * Abas pequenas são descritas célula a célula e gravadas de uma vez. O
 * estilo vai no master ANTES de mesclar (o ExcelJS copia o estilo do master
 * para as demais células da mesclagem no momento do merge).
 */
class Montador {
  private readonly celulas = new Map<string, { valor?: ExcelJS.CellValue; estilo?: Estilo }>();
  private readonly mesclagens: string[] = [];
  private readonly alturas = new Map<number, number>();

  constructor(private readonly ws: ExcelJS.Worksheet) {}

  set(ref: string, valor: ExcelJS.CellValue | undefined, estilo?: Estilo): this {
    this.celulas.set(ref, { valor, estilo });
    return this;
  }

  /** Estilo numa faixa inteira (bordas/fundo de um card mesclado). O que já foi definido na célula vence. */
  faixa(de: string, ate: string, estilo: Estilo): this {
    const a = analisarRef(de);
    const b = analisarRef(ate);
    for (let r = a.linha; r <= b.linha; r++) {
      for (let c = a.coluna; c <= b.coluna; c++) {
        const ref = `${letra(c)}${r}`;
        const atual = this.celulas.get(ref);
        this.celulas.set(ref, { valor: atual?.valor, estilo: { ...estilo, ...atual?.estilo } });
      }
    }
    return this;
  }

  mesclar(intervalo: string): this {
    this.mesclagens.push(intervalo);
    return this;
  }

  altura(linha: number, pontos: number): this {
    this.alturas.set(linha, pontos);
    return this;
  }

  /**
   * Grava as células descritas. `fechar = false` deixa a aba aberta para quem
   * quiser acrescentar linhas depois (o corpo do Acompanhamento): as linhas
   * tocadas aqui são confirmadas em ordem crescente, como o streaming exige.
   */
  async gravar(fechar = true): Promise<void> {
    const linhasTocadas = new Set<number>();
    for (const [ref, { valor, estilo }] of this.celulas) {
      const cell = this.ws.getCell(ref);
      if (valor !== undefined) cell.value = valor;
      if (estilo) cell.style = estilo;
      linhasTocadas.add(analisarRef(ref).linha);
    }
    for (const m of this.mesclagens) this.ws.mergeCells(m);
    for (const [linha, pontos] of this.alturas) {
      this.ws.getRow(linha).height = pontos;
      linhasTocadas.add(linha);
    }
    if (fechar) {
      await this.ws.commit();
    } else {
      for (const linha of [...linhasTocadas].sort((x, y) => x - y)) this.ws.getRow(linha).commit();
    }
  }
}

/* ==========================================================================
   Orquestração
   ========================================================================== */

export async function montarPlanilha(e: EntradaDaPlanilha): Promise<SaidaDaPlanilha> {
  const refDia = diaSP(e.resumo.geradoEm);
  const agregados = new Agregados(refDia);

  const saida = fs.createWriteStream(e.caminho);
  const fim = new Promise<void>((resolve, reject) => {
    saida.on("close", resolve);
    saida.on("error", reject);
  });
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: saida, useStyles: true, useSharedStrings: false });
  wb.creator = "Vulnera";
  wb.created = new Date(e.resumo.geradoEm);

  // Ordem das abas = ordem dos `addWorksheet`. PARTE_DO_DASHBOARD depende dela.
  await escreverResumo(wb, e.resumo, e.total, refDia);
  const { linhas, camposTruncados, ultimaLinha } = await escreverFindings(wb, e, agregados);
  const graficos = await escreverDashboard(wb, agregados);
  await escreverAcompanhamento(wb, agregados);
  const periodos = agregados.periodos();
  await escreverAuxiliar(wb, agregados, periodos.periodos);

  // Nomes definidos: gravados no fim do arquivo, com a extensão real.
  const ult = Math.max(2, ultimaLinha);
  wb.definedNames.add(`${ABA.resumo}!$B$8`, "data_ref");
  wb.definedNames.add(`${ABA.findings}!$A$2:$A$${ult}`, "f_ID");
  wb.definedNames.add(`${ABA.findings}!$C$2:$C$${ult}`, "f_Sev");
  wb.definedNames.add(`${ABA.findings}!$D$2:$D$${ult}`, "f_Status");
  wb.definedNames.add(`${ABA.findings}!$E$2:$E$${ult}`, "f_Ativo");
  wb.definedNames.add(`${ABA.findings}!$S$2:$S$${ult}`, "f_Detectado");

  await wb.commit();
  await fim;

  return { linhas, camposTruncados, abaDoDashboard: PARTE_DO_DASHBOARD, graficos, agregados };
}

/* ==========================================================================
   Aba 0 — Resumo
   ========================================================================== */

async function escreverResumo(wb: ExcelJS.stream.xlsx.WorkbookWriter, r: ContextoDoResumo, total: number, refDia: number): Promise<void> {
  const ws = wb.addWorksheet(ABA.resumo, {
    properties: { tabColor: argb(COR.marinho) },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: "&LVulnera&RPágina &P de &N" },
  });
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 64;
  ws.getColumn(3).width = 54;

  const m = new Montador(ws);
  const rotulo: Estilo = { font: fonte({ bold: true }), fill: fundo(COR.marinhoClaro), border: bordas(), alignment: { vertical: "middle" } };
  const valor: Estilo = { font: fonte(), border: bordas(), alignment: { vertical: "middle", wrapText: true, horizontal: "left" } };
  const secao: Estilo = { ...ESTILO_CABECALHO, alignment: { horizontal: "left", vertical: "middle" } };

  m.set("A1", "Vulnera — Exportação de findings", { font: fonte({ size: 18, bold: true, color: argb(COR.marinho) }) }).mesclar("A1:C1").altura(1, 34);
  m.set("A2", "Retrato dos findings no momento da geração, respeitando o seu perfil e o seu escopo.", {
    font: fonte({ color: argb(COR.textoSuave), italic: true }),
  }).mesclar("A2:C2");

  m.set("A4", "Informações da exportação", secao).faixa("A4", "C4", secao).mesclar("A4:C4").altura(4, 22);

  const info: Array<[number, string, ExcelJS.CellValue, Estilo?]> = [
    [5, "Gerado em", relogioSP(r.geradoEm), { numFmt: FMT_DATA_HORA }],
    [6, "Gerado por", prepararTexto(r.geradoPor).texto, undefined],
    [7, "Perfil", r.perfil, undefined],
    // Entrada do usuário: fundo amarelo e destravada (a aba não é protegida, mas o padrão visual é o do Acompanhamento).
    [8, "Data de referência", dataDoDia(refDia), { numFmt: FMT_DATA, fill: fundo(COR.entrada), protection: { locked: false } }],
    [9, "Registros exportados", formula("COUNTA(f_ID)", total), { numFmt: "#,##0" }],
    [10, "Limite por exportação", r.limite, { numFmt: "#,##0" }],
  ];
  for (const [linha, nome, v, extra] of info) {
    m.set(`A${linha}`, nome, rotulo).set(`B${linha}`, v, { ...valor, ...extra });
  }
  m.set("C8", "Base de toda idade e de todo SLA. Para acompanhamento vivo, troque por =HOJE().", {
    font: fonte({ color: argb(COR.textoSuave), italic: true, size: 9 }),
    alignment: { wrapText: true, vertical: "middle" },
  });

  m.set("A12", "Filtros aplicados", secao).faixa("A12", "C12", secao).mesclar("A12:C12").altura(12, 22);
  m.set("A13", "Filtro", { ...rotulo, alignment: { horizontal: "center", vertical: "middle" } });
  m.set("B13", "Valor", { ...rotulo, alignment: { horizontal: "center", vertical: "middle" } });
  let linha = 14;
  const filtros = r.filtros.length > 0 ? r.filtros : [{ rotulo: "—", valor: "Nenhum filtro aplicado: todos os findings que o seu perfil pode ver." }];
  for (const f of [...filtros, { rotulo: "Ordenação", valor: r.ordenacao }]) {
    const t = prepararTexto(f.valor);
    m.set(`A${linha}`, prepararTexto(f.rotulo).texto, rotulo);
    m.set(`B${linha}`, t.texto, { ...valor, ...(t.perigoso ? { numFmt: "@" } : {}) });
    m.altura(linha, alturaDeLinha([{ texto: t.texto, largura: 64 }], { minima: 18, maxima: 90 }));
    linha += 1;
  }

  linha += 1;
  m.set(`A${linha}`, "Como ler este arquivo", secao).faixa(`A${linha}`, `C${linha}`, secao).mesclar(`A${linha}:C${linha}`).altura(linha, 22);
  const notas = [
    "Aberto = status Aberto + Em andamento. Resolvido = Corrigido + Fechado.",
    "Idades e prazos usam dias corridos, contados até a Data de referência acima (valor fixo da geração).",
    "Os números do Dashboard são fórmulas sobre a aba Findings: se você editar os dados, eles se recalculam. A aba Auxiliar (oculta) apoia o ranking de ativos.",
    "Na aba Acompanhamento, as células amarelas são para você preencher; as demais ficam protegidas (sem senha) para não quebrar as fórmulas. A proteção impede ORDENAR a tabela — use os filtros.",
    "Texto acima de 32.700 caracteres é truncado com o marcador “[… truncado: N caracteres omitidos]”. Valores que começam com = + - @ são gravados como texto.",
    "Datas e horas no fuso America/Sao_Paulo.",
    "Esta exportação respeita o seu perfil e o seu escopo: nunca contém findings que você não veria na tela.",
  ];
  for (const nota of notas) {
    linha += 1;
    m.set(`A${linha}`, `• ${nota}`, { font: fonte(), alignment: { wrapText: true, vertical: "top" } }).mesclar(`A${linha}:C${linha}`);
    m.altura(linha, alturaDeLinha([{ texto: nota, largura: 148 }], { minima: 18, maxima: 60 }));
  }

  await m.gravar();
}

/* ==========================================================================
   Aba 1 — Findings
   ========================================================================== */

type TipoDeColuna = "texto" | "decimal" | "inteiro" | "data" | "dataHora";

interface Coluna {
  chave: string;
  cabecalho: string;
  largura: number;
  tipo: TipoDeColuna;
  quebra?: boolean;
  centro?: boolean;
}

const COLUNAS_FINDINGS: Coluna[] = [
  { chave: "id", cabecalho: "ID", largura: 27, tipo: "texto" },
  { chave: "titulo", cabecalho: "Título", largura: 46, tipo: "texto", quebra: true },
  { chave: "sev", cabecalho: "Severidade", largura: 13, tipo: "texto", centro: true },
  { chave: "status", cabecalho: "Status", largura: 15, tipo: "texto", centro: true },
  { chave: "ativo", cabecalho: "Ativo (aplicação)", largura: 24, tipo: "texto", quebra: true },
  { chave: "projeto", cabecalho: "Projeto", largura: 26, tipo: "texto", quebra: true },
  { chave: "empresa", cabecalho: "Empresa", largura: 22, tipo: "texto", quebra: true },
  { chave: "owasp", cabecalho: "OWASP Top 10", largura: 36, tipo: "texto", quebra: true },
  { chave: "cvss", cabecalho: "CVSS", largura: 8, tipo: "decimal", centro: true },
  { chave: "sevCvss", cabecalho: "Severidade (CVSS)", largura: 15, tipo: "texto", centro: true },
  { chave: "vrs", cabecalho: "VRS", largura: 7, tipo: "inteiro", centro: true },
  { chave: "prioridade", cabecalho: "Prioridade (VRS)", largura: 15, tipo: "texto", centro: true },
  { chave: "sla", cabecalho: "Situação do SLA", largura: 22, tipo: "texto", centro: true },
  { chave: "prazo", cabecalho: "Prazo do SLA", largura: 17, tipo: "dataHora", centro: true },
  { chave: "aceite", cabecalho: "Aceite de risco", largura: 12, tipo: "texto", centro: true },
  { chave: "responsavel", cabecalho: "Responsável", largura: 22, tipo: "texto", quebra: true },
  { chave: "origem", cabecalho: "Origem", largura: 11, tipo: "texto", centro: true },
  { chave: "cwe", cabecalho: "CWE", largura: 11, tipo: "texto", centro: true },
  { chave: "detectado", cabecalho: "Detectado em", largura: 17, tipo: "dataHora", centro: true },
  { chave: "atualizado", cabecalho: "Atualizado em", largura: 17, tipo: "dataHora", centro: true },
  { chave: "descricao", cabecalho: "Descrição", largura: 60, tipo: "texto", quebra: true },
  { chave: "impacto", cabecalho: "Impacto", largura: 46, tipo: "texto", quebra: true },
  { chave: "recomendacao", cabecalho: "Recomendação", largura: 50, tipo: "texto", quebra: true },
];

const FORMATO_POR_TIPO: Record<TipoDeColuna, string | undefined> = {
  texto: undefined,
  decimal: "0.0",
  inteiro: "0",
  data: FMT_DATA,
  dataHora: FMT_DATA_HORA,
};

async function escreverFindings(
  wb: ExcelJS.stream.xlsx.WorkbookWriter,
  e: EntradaDaPlanilha,
  agregados: Agregados,
): Promise<{ linhas: number; camposTruncados: number; ultimaLinha: number }> {
  const ws = wb.addWorksheet(ABA.findings, {
    properties: { tabColor: argb(COR.marinho) },
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" },
    headerFooter: { oddFooter: "&LVulnera — Findings&RPágina &P de &N" },
  });

  ws.columns = COLUNAS_FINDINGS.map((c) => ({
    header: c.cabecalho,
    key: c.chave,
    width: c.largura,
    style: {
      font: fonte(),
      border: bordas(),
      alignment: { vertical: "top", wrapText: Boolean(c.quebra), horizontal: c.centro ? "center" : "left" },
      ...(FORMATO_POR_TIPO[c.tipo] ? { numFmt: FORMATO_POR_TIPO[c.tipo] } : {}),
    },
  }));

  const cabecalho = ws.getRow(1);
  cabecalho.height = 32;
  cabecalho.eachCell((cell) => Object.assign(cell, { style: ESTILO_CABECALHO }));
  cabecalho.commit();

  let linhas = 0;
  let camposTruncados = 0;
  const larguraDe = (chave: string): number => COLUNAS_FINDINGS.find((c) => c.chave === chave)!.largura;

  for await (const lote of e.lotes) {
    if (e.sinal?.aborted) throw new Error("EXPORT_ABORTED");
    for (const f of lote) {
      if (linhas > 0 && linhas % CEDER_A_CADA === 0) await ceder();
      agregados.registrar(f);
      linhas += 1;

      const textos: Record<string, ReturnType<typeof prepararTexto>> = {};
      const txt = (chave: string, v: string | null | undefined): string => {
        const t = prepararTexto(v);
        if (t.truncado) camposTruncados += 1;
        textos[chave] = t;
        return t.texto;
      };

      const valores = [
        txt("id", f.id),
        txt("titulo", f.title),
        ROTULO_SEVERIDADE[f.severityFinal] ?? f.severityFinal,
        ROTULO_STATUS[f.status] ?? f.status,
        txt("ativo", f.applicationName),
        txt("projeto", f.projectName),
        txt("empresa", f.companyName),
        rotuloOwasp(f.owaspCategory),
        f.cvssScore ?? null,
        ROTULO_SEVERIDADE[f.severityCalculated] ?? f.severityCalculated,
        f.vrsScore ?? null,
        f.vrsBand ? (ROTULO_PRIORIDADE[f.vrsBand] ?? f.vrsBand) : null,
        ROTULO_SLA[f.slaState] ?? f.slaState,
        f.slaDueAt ? relogioSP(f.slaDueAt) : null,
        f.hasActiveRiskAcceptance ? "Sim" : "Não",
        txt("responsavel", f.assigneeName),
        ROTULO_ORIGEM[f.sourceType] ?? f.sourceType,
        txt("cwe", f.cweId),
        relogioSP(f.createdAt),
        relogioSP(f.updatedAt),
        txt("descricao", f.description),
        txt("impacto", f.impact),
        txt("recomendacao", f.recommendation),
      ];

      const row = ws.addRow(valores);
      // Texto que o Excel leria como fórmula numa edição: formato TEXTO, dado intacto (ver texto.ts).
      COLUNAS_FINDINGS.forEach((c, i) => {
        if (textos[c.chave]?.perigoso) row.getCell(i + 1).numFmt = "@";
      });
      row.height = alturaDeLinha(
        ["titulo", "ativo", "projeto", "empresa", "responsavel", "descricao", "impacto", "recomendacao"].map((c) => ({
          texto: textos[c]?.texto ?? "",
          largura: larguraDe(c),
        })),
      );
      row.commit();
    }
  }

  const ultimaLinha = linhas + 1;
  const ult = Math.max(2, ultimaLinha);
  ws.autoFilter = `A1:${letra(COLUNAS_FINDINGS.length)}${ult}`;

  // Prioridade: severidade, status e SLA ganham da zebra (que vem por último).
  ws.addConditionalFormatting({ ref: `C2:C${ult}`, rules: regrasIguais(COR_SEVERIDADE, 1, ["Crítica"]) });
  ws.addConditionalFormatting({ ref: `J2:J${ult}`, rules: regrasIguais(COR_SEVERIDADE, 6, ["Crítica"]) });
  ws.addConditionalFormatting({ ref: `D2:D${ult}`, rules: regrasIguais(COR_STATUS, 11) });
  ws.addConditionalFormatting({ ref: `M2:M${ult}`, rules: regrasIguais(COR_SLA, 15) });
  ws.addConditionalFormatting({
    ref: `A2:${letra(COLUNAS_FINDINGS.length)}${ult}`,
    rules: [{ type: "expression", formulae: ["MOD(ROW(),2)=0"], priority: 99, style: { fill: fundo(COR.zebra) } }],
  });

  await ws.commit();
  return { linhas, camposTruncados, ultimaLinha };
}

/* ==========================================================================
   Aba 2 — Dashboard
   ========================================================================== */

/** Onde ficam as tabelas de apoio (abaixo da área impressa) — os cards e gráficos apontam para estas células. */
export const DASH = {
  sevCab: 36,
  sevIni: 37,
  statusCab: 44,
  statusIni: 45,
  topCab: 50,
  topIni: 51,
  // O ExcelJS só antepõe `$` à coluna: "A$1:P$34" vira `$A$1:$P$34`, a forma que o Excel grava.
  areaImpressa: "A$1:P$34",
} as const;

async function escreverDashboard(wb: ExcelJS.stream.xlsx.WorkbookWriter, a: Agregados): Promise<GraficoNativo[]> {
  const ws = wb.addWorksheet(ABA.dashboard, {
    properties: { tabColor: argb("2E7D32") },
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      printArea: DASH.areaImpressa,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: "&LVulnera — Dashboard&RPágina &P de &N" },
  });
  for (let c = 1; c <= 16; c++) ws.getColumn(c).width = 10.7;

  const m = new Montador(ws);
  const refAtivos = (col: string) => `${ABA.auxiliar}!$${col}$2:$${col}$${Math.max(2, Math.min(a.ativosOrdenados().length, MAX_ATIVOS_AUXILIAR) + 1)}`;

  m.set("A1", "Dashboard de findings", { font: fonte({ size: 20, bold: true, color: argb(COR.marinho) }) }).mesclar("A1:L1").altura(1, 34);
  m.set("A2", "Os números são fórmulas sobre a aba Findings — o mesmo recorte exportado.", {
    font: fonte({ italic: true, color: argb(COR.textoSuave) }),
  }).mesclar("A2:L2");

  /* ---- Cards ------------------------------------------------------------ */
  const card = (
    rotuloRef: string,
    valorRef: string,
    ate: string,
    titulo: string,
    valor: ExcelJS.CellValue,
    opts: { fundo?: string; texto?: string; fmt?: string } = {},
  ): void => {
    const fundoCard = opts.fundo ?? COR.marinhoClaro;
    const txt = opts.texto ?? COR.marinho;
    m.set(rotuloRef, titulo, { font: fonte({ size: 9, bold: true, color: argb(txt) }), fill: fundo(fundoCard), alignment: { horizontal: "center", vertical: "middle" }, border: bordas() });
    m.faixa(rotuloRef, `${ate}${rotuloRef.replace(/[A-Z]+/, "")}`, { fill: fundo(fundoCard), border: bordas() });
    m.set(valorRef, valor, {
      font: fonte({ size: 22, bold: true, color: argb(txt) }),
      fill: fundo(fundoCard),
      alignment: { horizontal: "center", vertical: "middle" },
      border: bordas(),
      ...(opts.fmt ? { numFmt: opts.fmt } : {}),
    });
    m.faixa(valorRef, `${ate}${valorRef.replace(/[A-Z]+/, "")}`, { fill: fundo(fundoCard), border: bordas() });
    m.mesclar(`${rotuloRef}:${ate}${rotuloRef.replace(/[A-Z]+/, "")}`);
    m.mesclar(`${valorRef}:${ate}${valorRef.replace(/[A-Z]+/, "")}`);
  };

  const sevRef = (i: number) => `$B$${DASH.sevIni + i}`;
  const abertos = a.abertos;
  const resolvidos = a.resolvidos;
  const total = a.total;
  const fAbertos = ROTULOS_ABERTOS.map((s) => `COUNTIF(f_Status,"${s}")`).join("+");
  const fResolvidos = ROTULOS_RESOLVIDOS.map((s) => `COUNTIF(f_Status,"${s}")`).join("+");

  m.altura(4, 18).altura(5, 40).altura(7, 18).altura(8, 40);
  card("A4", "A5", "B", "TOTAL DE FINDINGS", formula("COUNTA(f_ID)", total));
  SEVERIDADES_ROTULADAS.forEach((s, i) => {
    const colunas: Array<[string, string]> = [["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"], ["K", "L"]];
    const [ini, fimCol] = colunas[i]!;
    const cor = COR_SEVERIDADE[s.rotulo]!;
    card(`${ini}4`, `${ini}5`, fimCol, s.rotulo.toUpperCase(), formula(sevRef(i), a.porSeveridade[s.rotulo] ?? 0), { fundo: cor.fundo, texto: cor.texto });
  });
  card("M4", "M5", "N", "ABERTOS", formula(fAbertos, abertos));
  card("O4", "O5", "P", "RESOLVIDOS", formula(fResolvidos, resolvidos));

  const pctAbertos = total === 0 ? 0 : abertos / total;
  const pctResolvidos = total === 0 ? 0 : resolvidos / total;
  card("A7", "A8", "B", "% ABERTOS", formula("IF($A$5=0,0,$M$5/$A$5)", pctAbertos), { fmt: "0.0%" });
  card("C7", "C8", "D", "% RESOLVIDOS", formula("IF($A$5=0,0,$O$5/$A$5)", pctResolvidos), { fmt: "0.0%" });
  const idadeFormula =
    "IF($M$5=0,0,(" +
    ROTULOS_ABERTOS.map((s) => `SUMPRODUCT((f_Status="${s}")*(data_ref-INT(f_Detectado)))`).join("+") +
    ")/$M$5)";
  card("E7", "E8", "H", "IDADE MÉDIA DOS ABERTOS (DIAS)", formula(idadeFormula, a.idadeMediaAbertos()), { fmt: "0.0" });
  card("I7", "I8", "J", "DATA DE REFERÊNCIA", formula("data_ref", a.refDia), { fmt: FMT_DATA });
  m.set("K7", "Aberto = Aberto + Em andamento · Resolvido = Corrigido + Fechado. Idade em dias corridos até a data de referência.", {
    font: fonte({ size: 9, italic: true, color: argb(COR.textoSuave) }),
    alignment: { wrapText: true, vertical: "middle" },
  }).mesclar("K7:P8");

  /* ---- Tabelas de apoio (alimentam os gráficos) -------------------------- */
  const cab: Estilo = { ...ESTILO_CABECALHO };
  const cel: Estilo = { font: fonte(), border: bordas(), alignment: { vertical: "middle" } };
  const num: Estilo = { ...cel, alignment: { horizontal: "right", vertical: "middle" } };

  m.set(`A${DASH.sevCab - 1}`, "Dados dos gráficos", { font: fonte({ size: 12, bold: true, color: argb(COR.marinho) }) });

  m.set(`A${DASH.sevCab}`, "Severidade", cab).set(`B${DASH.sevCab}`, "Qtde", cab).set(`C${DASH.sevCab}`, "% do total", cab);
  SEVERIDADES_ROTULADAS.forEach((s, i) => {
    const r = DASH.sevIni + i;
    const n = a.porSeveridade[s.rotulo] ?? 0;
    m.set(`A${r}`, s.rotulo, cel).set(`B${r}`, formula(`COUNTIF(f_Sev,A${r})`, n), num);
    m.set(`C${r}`, formula(`IF($B$${DASH.sevIni + 5}=0,0,B${r}/$B$${DASH.sevIni + 5})`, total === 0 ? 0 : n / total), { ...num, numFmt: "0.0%" });
  });
  const rTotalSev = DASH.sevIni + 5;
  m.set(`A${rTotalSev}`, "Total", { ...cel, font: fonte({ bold: true }) }).set(`B${rTotalSev}`, formula(`SUM(B${DASH.sevIni}:B${rTotalSev - 1})`, total), { ...num, font: fonte({ bold: true }) });

  m.set(`A${DASH.statusCab}`, "Status", cab).set(`B${DASH.statusCab}`, "Qtde", cab).set(`C${DASH.statusCab}`, "Grupo", cab);
  STATUS_ROTULADOS.forEach((s, i) => {
    const r = DASH.statusIni + i;
    m.set(`A${r}`, s.rotulo, cel).set(`B${r}`, formula(`COUNTIF(f_Status,A${r})`, a.porStatus[s.rotulo] ?? 0), num).set(`C${r}`, s.grupo, cel);
  });

  const top = a.ativosOrdenados();
  const refNomes = refAtivos("A");
  const refChaves = refAtivos("B");
  m.set(`A${DASH.topCab}`, "#", cab).set(`B${DASH.topCab}`, "Ativo", cab).faixa(`B${DASH.topCab}`, `E${DASH.topCab}`, cab).mesclar(`B${DASH.topCab}:E${DASH.topCab}`).set(`F${DASH.topCab}`, "Qtde", cab);
  const topResolvido: Array<{ nome: string; n: number }> = [];
  for (let k = 1; k <= 10; k++) {
    const r = DASH.topIni + k - 1;
    const ativo = top[k - 1];
    topResolvido.push({ nome: ativo?.nome ?? "", n: ativo?.n ?? 0 });
    m.set(`A${r}`, k, { ...cel, alignment: { horizontal: "center", vertical: "middle" } });
    m.set(`B${r}`, formula(`IFERROR(INDEX(${refNomes},MATCH(LARGE(${refChaves},A${r}),${refChaves},0)),"")`, ativo ? prepararTexto(ativo.nome).texto : ""), cel);
    m.faixa(`B${r}`, `E${r}`, cel).mesclar(`B${r}:E${r}`);
    m.set(`F${r}`, formula(`IF(B${r}="",0,SUMPRODUCT(--(f_Ativo=B${r})))`, ativo?.n ?? 0), num);
  }

  /* ---- Gráficos ---------------------------------------------------------- */
  const periodos = a.periodos();
  const nomeDaAba = ABA.dashboard;
  const graficos: GraficoNativo[] = [
    {
      tipo: "colunas",
      titulo: "Findings por severidade",
      nomeDaSerie: "Findings",
      refCategorias: `${nomeDaAba}!$A$${DASH.sevIni}:$A$${DASH.sevIni + 4}`,
      categorias: SEVERIDADES_ROTULADAS.map((s) => s.rotulo),
      refValores: `${nomeDaAba}!$B$${DASH.sevIni}:$B$${DASH.sevIni + 4}`,
      valores: SEVERIDADES_ROTULADAS.map((s) => a.porSeveridade[s.rotulo] ?? 0),
      corPorPonto: COR_GRAFICO_SEVERIDADE,
      ancora: { colunaInicio: 0, linhaInicio: 9, colunaFim: 8, linhaFim: 20 },
    },
    {
      tipo: "colunas",
      titulo: "Findings por status",
      nomeDaSerie: "Findings",
      refCategorias: `${nomeDaAba}!$A$${DASH.statusIni}:$A$${DASH.statusIni + 3}`,
      categorias: STATUS_ROTULADOS.map((s) => s.rotulo),
      refValores: `${nomeDaAba}!$B$${DASH.statusIni}:$B$${DASH.statusIni + 3}`,
      valores: STATUS_ROTULADOS.map((s) => a.porStatus[s.rotulo] ?? 0),
      corPorPonto: COR_GRAFICO_STATUS,
      ancora: { colunaInicio: 8, linhaInicio: 9, colunaFim: 16, linhaFim: 20 },
    },
  ];
  if (top.length > 0) {
    // O gráfico cobre só as linhas que TÊM ativo: com 7 ativos, um intervalo fixo de 10 desenharia três
    // barras vazias, com rótulo "0" e sem nome. A tabela continua com as 10 linhas (as fórmulas as preenchem).
    const nTop = Math.min(10, top.length);
    graficos.push({
      tipo: "barras",
      titulo: "Top 10 ativos com mais findings",
      nomeDaSerie: "Findings",
      refCategorias: `${nomeDaAba}!$B$${DASH.topIni}:$B$${DASH.topIni + nTop - 1}`,
      categorias: topResolvido.slice(0, nTop).map((t) => prepararTexto(t.nome).texto),
      refValores: `${nomeDaAba}!$F$${DASH.topIni}:$F$${DASH.topIni + nTop - 1}`,
      valores: topResolvido.slice(0, nTop).map((t) => t.n),
      corUnica: COR.marinho,
      ancora: { colunaInicio: 0, linhaInicio: 21, colunaFim: 8, linhaFim: 33 },
    });
  }
  if (periodos.periodos.length > 0) {
    const ate = periodos.periodos.length + 1;
    graficos.push({
      tipo: "colunas",
      titulo: `Findings detectados por ${periodos.granularidade === "semana" ? "semana" : "mês"}${periodos.truncado ? ` (últimos ${periodos.periodos.length})` : ""}`,
      nomeDaSerie: "Detectados",
      refCategorias: `${ABA.auxiliar}!$E$2:$E$${ate}`,
      categorias: periodos.periodos.map((p) => p.rotulo),
      refValores: `${ABA.auxiliar}!$G$2:$G$${ate}`,
      valores: periodos.periodos.map((p) => p.n),
      corUnica: "4A90D9",
      ancora: { colunaInicio: 8, linhaInicio: 21, colunaFim: 16, linhaFim: 33 },
    });
  }

  // Sem senha: protege as fórmulas contra o clique acidental; o gráfico e os cards não precisam de edição.
  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
  await m.gravar();
  return graficos;
}

/* ==========================================================================
   Aba 3 — Acompanhamento
   ========================================================================== */

export const ACOMP = { cabecalho: 5, primeira: 6 } as const;

async function escreverAcompanhamento(wb: ExcelJS.stream.xlsx.WorkbookWriter, a: Agregados): Promise<void> {
  const ws = wb.addWorksheet(ABA.acompanhamento, {
    properties: { tabColor: argb("F28C28") },
    views: [{ state: "frozen", ySplit: ACOMP.cabecalho }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${ACOMP.cabecalho}:${ACOMP.cabecalho}`,
    },
    headerFooter: { oddFooter: "&LVulnera — Acompanhamento&RPágina &P de &N" },
  });

  // A–D valores fixos; E–J entrada; K–L calculadas.
  const colunas: Array<{ cab: string; w: number; tipo: "fixa" | "entrada" | "calculada"; fmt?: string; quebra?: boolean; centro?: boolean }> = [
    { cab: "ID", w: 27, tipo: "fixa" },
    { cab: "Título", w: 46, tipo: "fixa", quebra: true },
    { cab: "Severidade", w: 13, tipo: "fixa", centro: true },
    { cab: "Detectado em", w: 17, tipo: "fixa", fmt: FMT_DATA_HORA, centro: true },
    { cab: "Responsável", w: 22, tipo: "entrada", quebra: true },
    { cab: "Status de remediação", w: 20, tipo: "entrada", centro: true },
    { cab: "Prazo (SLA)", w: 15, tipo: "entrada", fmt: FMT_DATA, centro: true },
    { cab: "Data de resolução", w: 17, tipo: "entrada", fmt: FMT_DATA, centro: true },
    { cab: "Prioridade", w: 14, tipo: "entrada", centro: true },
    { cab: "Comentários / Evidência", w: 50, tipo: "entrada", quebra: true },
    { cab: "Dias em aberto", w: 13, tipo: "calculada", fmt: "0", centro: true },
    { cab: "Situação do SLA", w: 19, tipo: "calculada", centro: true },
  ];
  colunas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.w;
  });

  const n = a.acompanhamento.length;
  const ult = ACOMP.primeira + Math.max(n, 1) - 1;
  const rngStatus = `F${ACOMP.primeira}:F${ult}`;
  const rngSituacao = `L${ACOMP.primeira}:L${ult}`;
  const alerta = `$E$3`;

  /* ---- Topo: título + mini-resumo + parâmetro ---------------------------- */
  const m = new Montador(ws);
  const cartao: Estilo = { font: fonte({ size: 16, bold: true, color: argb(COR.marinho) }), fill: fundo(COR.calculada), border: bordas(), alignment: { horizontal: "center", vertical: "middle" } };
  const cartaoRotulo: Estilo = { font: fonte({ size: 9, bold: true, color: argb(COR.marinho) }), fill: fundo(COR.marinhoClaro), border: bordas(), alignment: { horizontal: "center", vertical: "middle", wrapText: true } };

  m.set("A1", "Acompanhamento de remediação", { font: fonte({ size: 16, bold: true, color: argb(COR.marinho) }) }).mesclar("A1:D1").altura(1, 28);
  m.set("E1", "Células amarelas: preencha. As demais são calculadas e protegidas.", { font: fonte({ size: 9, italic: true, color: argb(COR.textoSuave) }), alignment: { vertical: "middle", wrapText: true } }).mesclar("E1:J1");
  m.altura(2, 26).altura(3, 30);

  const em = a.acompanhamento.filter((l) => l.status === "Em andamento").length;
  const res = a.acompanhamento.filter((l) => l.status === "Corrigido" || l.status === "Fechado").length;
  const venc = a.acompanhamento.filter((l) => situacaoSla(l, a.refDia, ALERTA_DIAS_PADRAO) === "Vencido").length;
  const dados = (col: string) => `${col}${ACOMP.primeira}:${col}${ult}`;

  m.set("A2", "Total de findings", cartaoRotulo).set("A3", formula(`COUNTA(${dados("A")})`, n), cartao);
  m.set("B2", "Em andamento", cartaoRotulo).set("B3", formula(`COUNTIF(${rngStatus},"Em andamento")`, em), cartao);
  m.set("C2", "Resolvidos", cartaoRotulo).set("C3", formula(`COUNTIF(${rngStatus},"Corrigido")+COUNTIF(${rngStatus},"Fechado")`, res), cartao);
  m.set("D2", "Vencidos", cartaoRotulo).set("D3", formula(`COUNTIF(${rngSituacao},"Vencido")`, venc), { ...cartao, font: fonte({ size: 16, bold: true, color: argb("9B1C1C") }) });
  m.set("E2", "Alerta de vencimento (dias)", { ...cartaoRotulo, fill: fundo(COR.entrada) }).set("E3", ALERTA_DIAS_PADRAO, {
    ...cartao,
    fill: fundo(COR.entrada),
    protection: { locked: false },
  });
  m.set("F2", "“Vencendo” = faltam até N dias para o prazo.", { font: fonte({ size: 9, italic: true, color: argb(COR.textoSuave) }), alignment: { vertical: "middle", wrapText: true } }).mesclar("F2:J2");
  await m.gravar(false);

  /* ---- Cabeçalho ---------------------------------------------------------- */
  const estiloDe = (c: (typeof colunas)[number]): Estilo => ({
    font: fonte(),
    border: bordas(),
    alignment: { vertical: "top", wrapText: Boolean(c.quebra), horizontal: c.centro ? "center" : "left" },
    ...(c.fmt ? { numFmt: c.fmt } : {}),
    ...(c.tipo === "entrada" ? { fill: fundo(COR.entrada), protection: { locked: false } } : {}),
    ...(c.tipo === "calculada" ? { fill: fundo(COR.calculada) } : {}),
  });
  // Estilo célula a célula, com os MESMOS objetos para todas as linhas. Medido (A/B intercalado, 50 mil
  // linhas, mesma máquina): definir o estilo na COLUNA e deixar as células herdarem custou ~50% mais CPU
  // (65–80 s contra 42–55 s) — o ExcelJS copia o estilo da coluna a cada célula criada.
  const estilos = colunas.map(estiloDe);

  const cab = ws.getRow(ACOMP.cabecalho);
  cab.height = 34;
  colunas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.cab;
    // Cabeçalho âmbar = coluna para preencher; marinho = fixa ou calculada.
    cell.style = { ...ESTILO_CABECALHO, ...(c.tipo === "entrada" ? { fill: fundo("B45309"), border: bordas("B45309") } : {}) };
  });
  cab.commit();

  /* ---- Linhas -------------------------------------------------------------- */
  for (const [idx, l] of a.acompanhamento.entries()) {
    if (idx > 0 && idx % CEDER_A_CADA === 0) await ceder();
    const r = ACOMP.primeira + idx;
    const id = prepararTexto(l.id);
    const titulo = prepararTexto(l.titulo);
    const resp = prepararTexto(l.responsavel);
    const diasFormula = `IF(H${r}<>"",MAX(0,INT(H${r})-INT(D${r})),MAX(0,data_ref-INT(D${r})))`;
    const situacaoFormula =
      `IF(G${r}="","Sem prazo",IF(H${r}<>"",IF(INT(H${r})<=INT(G${r}),"No prazo","Vencido"),` +
      `IF(OR(F${r}="Corrigido",F${r}="Fechado"),"Resolvido s/ data",IF(data_ref>INT(G${r}),"Vencido",` +
      `IF(INT(G${r})-data_ref<=${alerta},"Vencendo","No prazo")))))`;

    const row = ws.getRow(r);
    const valores: ExcelJS.CellValue[] = [
      id.texto,
      titulo.texto,
      l.severidade,
      l.detectado,
      resp.texto || null,
      l.status,
      l.prazo,
      l.resolucao,
      l.prioridade || null,
      null,
      formula(diasFormula, diasEmAberto(l.detectado, l.resolucao, a.refDia)),
      formula(situacaoFormula, situacaoSla(l, a.refDia, ALERTA_DIAS_PADRAO)),
    ];
    valores.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.style = estilos[i]!;
    });
    if (id.perigoso) row.getCell(1).numFmt = "@";
    if (titulo.perigoso) row.getCell(2).numFmt = "@";
    if (resp.perigoso) row.getCell(5).numFmt = "@";
    row.height = alturaDeLinha(
      [
        { texto: titulo.texto, largura: 46 },
        { texto: resp.texto, largura: 22 },
      ],
      { minima: 18, maxima: 90 },
    );
    row.commit();
  }

  /* ---- Validação, formatação condicional, filtro e proteção ---------------- */
  const p = ACOMP.primeira;
  validar(ws, `F${p}:F${ult}`, {
    type: "list",
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Status inválido",
    error: "Escolha um dos status da lista.",
    formulae: [`"${STATUS_ROTULADOS.map((s) => s.rotulo).join(",")}"`],
  });
  validar(ws, `I${p}:I${ult}`, {
    type: "list",
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Prioridade inválida",
    error: "Escolha uma das prioridades da lista.",
    formulae: [`"${PRIORIDADES.join(",")}"`],
  });
  for (const col of ["G", "H"]) {
    validar(ws, `${col}${p}:${col}${ult}`, {
      type: "date",
      operator: "greaterThan",
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Data inválida",
      error: "Informe uma data válida (dd/mm/aaaa).",
      formulae: [36526], // 01/01/2000
    });
  }
  validar(ws, "E3", {
    type: "whole",
    operator: "between",
    allowBlank: false,
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Valor inválido",
    error: "Informe um número inteiro de dias entre 0 e 365.",
    formulae: [0, 365],
  });

  ws.addConditionalFormatting({ ref: `C${p}:C${ult}`, rules: regrasIguais(COR_SEVERIDADE, 1, ["Crítica"]) });
  ws.addConditionalFormatting({ ref: rngStatus, rules: regrasIguais(COR_STATUS, 6) });
  ws.addConditionalFormatting({ ref: rngSituacao, rules: regrasIguais(COR_SLA, 10, ["Vencido"]) });

  ws.autoFilter = `A${ACOMP.cabecalho}:L${ult}`;
  // Sem senha: protege só contra o clique acidental. Filtro e largura de coluna seguem livres;
  // ORDENAR não — o Excel recusa ordenar um intervalo com células bloqueadas.
  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, formatColumns: true, formatRows: true });
  await ws.commit();
}

/* ==========================================================================
   Aba 4 — Auxiliar (oculta)
   ========================================================================== */

/**
 * Apoio das fórmulas do Dashboard: o ranking de ativos (A:B) e a tabela de
 * evolução por período (D:G). Oculta e protegida — o usuário não precisa
 * dela, e o gráfico de evolução lê daqui (por isso `plotVisOnly=0`).
 */
async function escreverAuxiliar(
  wb: ExcelJS.stream.xlsx.WorkbookWriter,
  a: Agregados,
  periodos: Array<{ inicio: number; fim: number; rotulo: string; n: number }>,
): Promise<void> {
  const ws = wb.addWorksheet(ABA.auxiliar, { state: "hidden", properties: { tabColor: argb("9CA3AF") } });
  [40, 18, 4, 14, 12, 14, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const m = new Montador(ws);
  const cel: Estilo = { font: fonte(), border: bordas() };
  const cab: Estilo = { ...ESTILO_CABECALHO };
  m.set("A1", "Ativo", cab).set("B1", "Chave do ranking", cab).set("D1", "Início", cab).set("E1", "Rótulo", cab).set("F1", "Fim (exclusivo)", cab).set("G1", "Detectados", cab);

  a.ativosOrdenados().forEach((t, i) => {
    const r = i + 2;
    const nome = prepararTexto(t.nome);
    // Desempate determinístico: a posição na lista (já ordenada por qtde e nome) entra como fração.
    m.set(`A${r}`, nome.texto, { ...cel, ...(nome.perigoso ? { numFmt: "@" } : {}) });
    m.set(`B${r}`, formula(`SUMPRODUCT(--(f_Ativo=A${r}))-ROW()/1000000`, t.n - r / 1_000_000), { ...cel, numFmt: "0.000000" });
  });

  periodos.forEach((p, i) => {
    const r = i + 2;
    m.set(`D${r}`, dataDoDia(p.inicio), { ...cel, numFmt: FMT_DATA });
    m.set(`E${r}`, p.rotulo, cel);
    m.set(`F${r}`, dataDoDia(p.fim), { ...cel, numFmt: FMT_DATA });
    m.set(`G${r}`, formula(`COUNTIFS(f_Detectado,">="&D${r},f_Detectado,"<"&F${r})`, p.n), cel);
  });

  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
  await m.gravar();
}
