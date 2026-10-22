/**
 * tempo.ts
 *
 * Datas da planilha. O Excel não tem fuso: guarda a data como um NÚMERO (dias
 * desde 30/12/1899) e mostra exatamente o relógio que está nele. Por isso o
 * gerador converte cada instante UTC para o RELÓGIO DE SÃO PAULO antes de
 * gravar — sem isso, um finding criado às 21h (horário de Brasília) apareceria
 * às 00h do dia seguinte.
 *
 * Convenção: "relógio SP" = um `Date` cujos campos UTC carregam a hora de
 * parede de São Paulo. É o formato que o ExcelJS espera (ele serializa `Date`
 * lendo UTC), então o valor entra na célula sem mais conversão.
 *
 * Dias são CORRIDOS (calendário), nunca úteis — decisão registrada na aba Resumo.
 */

export const FUSO_PLANILHA = "America/Sao_Paulo";

const MS_POR_DIA = 86_400_000;
/** Serial 0 do Excel = 30/12/1899 (já compensa o bug do ano bissexto de 1900). */
const EPOCA_EXCEL_MS = Date.UTC(1899, 11, 30);

const formatador = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_PLANILHA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const MS_POR_HORA = 3_600_000;

/** Distância (ms) entre o relógio de SP e o UTC num instante, perguntada ao Intl. */
function offsetSPComIntl(instanteMs: number): number {
  const p: Record<string, number> = {};
  for (const parte of formatador.formatToParts(new Date(instanteMs))) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  const relogio = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return relogio - Math.floor(instanteMs / 1000) * 1000;
}

/**
 * Cache do offset por HORA CHEIA (chave = horas desde a época).
 *
 * O `Intl` é caro (~11 µs) e a exportação converte umas cinco datas por finding:
 * em 50 mil linhas eram 3 s só nisso. O offset de São Paulo só muda em HORA
 * CHEIA (as transições do horário de verão eram à meia-noite local, 02:00/03:00
 * UTC), então um valor por hora é EXATO — inclusive para datas de antes de 2019,
 * quando ainda havia horário de verão. Findings de um intervalo de anos ocupam
 * no máximo algumas dezenas de milhares de horas distintas.
 */
const offsetPorHora = new Map<number, number>();
const TETO_DO_CACHE = 200_000;

function offsetSP(instanteMs: number): number {
  const hora = Math.floor(instanteMs / MS_POR_HORA);
  let offset = offsetPorHora.get(hora);
  if (offset === undefined) {
    offset = offsetSPComIntl(hora * MS_POR_HORA);
    if (offsetPorHora.size >= TETO_DO_CACHE) offsetPorHora.clear();
    offsetPorHora.set(hora, offset);
  }
  return offset;
}

/** Instante real → relógio de parede de São Paulo (campos UTC do `Date` devolvido). */
export function relogioSP(instante: Date): Date {
  return new Date(instante.getTime() + offsetSP(instante.getTime()));
}

/** Número serial do Excel de um relógio SP (parte fracionária = hora do dia). */
export function serialExcel(relogio: Date): number {
  return (relogio.getTime() - EPOCA_EXCEL_MS) / MS_POR_DIA;
}

/** Dia inteiro (serial sem a hora) em que o instante cai, no calendário de São Paulo. */
export function diaSP(instante: Date): number {
  return Math.floor(serialExcel(relogioSP(instante)));
}

/** Serial inteiro → `Date` à meia-noite (relógio SP), pronto para gravar como data. */
export function dataDoDia(dia: number): Date {
  return new Date(EPOCA_EXCEL_MS + dia * MS_POR_DIA);
}

/** `Date` à meia-noite do dia SP do instante — para colunas que só têm data (prazo, resolução). */
export function soData(instante: Date): Date {
  return dataDoDia(diaSP(instante));
}

/** Dia da semana (0 = domingo) de um serial. */
export function diaDaSemana(dia: number): number {
  return dataDoDia(dia).getUTCDay();
}

/** `AAAA-MM-DD_HHmm` no relógio de SP — o carimbo do nome do arquivo. */
export function carimboDeArquivo(instante: Date): string {
  const r = relogioSP(instante);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${r.getUTCFullYear()}-${dois(r.getUTCMonth() + 1)}-${dois(r.getUTCDate())}_${dois(r.getUTCHours())}${dois(r.getUTCMinutes())}`;
}
