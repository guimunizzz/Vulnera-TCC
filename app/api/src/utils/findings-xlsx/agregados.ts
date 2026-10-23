/**
 * agregados.ts
 *
 * Os números do Dashboard e da aba Acompanhamento, calculados NO SERVIDOR,
 * linha a linha, enquanto os findings passam em streaming.
 *
 * POR QUE CALCULAR SE A PLANILHA TEM FÓRMULAS
 * Toda fórmula é gravada COM O RESULTADO EM CACHE. Sem ele, o LibreOffice, o
 * Excel Online e os visualizadores de prévia mostram 0 ou vazio — eles só
 * recalculam quando o usuário edita. (Medido no spike: arquivo com cache não
 * é recalculado na abertura.) A fórmula continua lá, viva, para quando o
 * usuário editar a aba Findings; o cache é o que aparece antes disso.
 *
 * E é este módulo que torna testável o critério "os números do Dashboard
 * batem com a aba Findings": o teste lê o cache e confere contra as linhas.
 *
 * ⚠️ `situacaoSla` e `diasEmAberto` ESPELHAM, caractere por caractere de
 * lógica, as fórmulas da aba Acompanhamento (ver `planilha.ts`). Se uma
 * mudar, a outra muda junto — senão o cache diverge do que o Excel recalcula.
 */

import type { FindingsExportRow } from "../../models/findings-export.model";
import { ROTULO_PRIORIDADE, ROTULO_SEVERIDADE, ROTULO_STATUS, SEVERIDADES_ROTULADAS, STATUS_ROTULADOS, ehAberto, mesCurto } from "./rotulos";
import { dataDoDia, diaDaSemana, diaSP, relogioSP, serialExcel, soData } from "./tempo";

/** Quantos ativos a aba Auxiliar lista (o top 10 sai deles) — limita o custo dos COUNTIF. */
export const MAX_ATIVOS_AUXILIAR = 50;
/** Teto de períodos no gráfico de evolução. */
export const MAX_PERIODOS = 36;
/** Findings detectados em até este número de dias agrupam por SEMANA; acima, por MÊS. */
export const LIMITE_SEMANAL_DIAS = 90;

export interface LinhaDeAcompanhamento {
  id: string;
  titulo: string;
  severidade: string;
  /** Relógio SP, com hora. */
  detectado: Date;
  responsavel: string;
  status: string;
  /** Só data (meia-noite SP). */
  prazo: Date | null;
  resolucao: Date | null;
  prioridade: string;
}

export interface Periodo {
  inicio: number;
  /** Exclusivo. */
  fim: number;
  rotulo: string;
  n: number;
}

export interface AtivoContado {
  nome: string;
  n: number;
}

/* --------------------------------------------------------------------------
   Espelhos das fórmulas do Acompanhamento
   -------------------------------------------------------------------------- */

/** `=IF(H<>"",MAX(0,INT(H)-INT(D)),MAX(0,data_ref-INT(D)))` */
export function diasEmAberto(detectado: Date, resolucao: Date | null, refDia: number): number {
  const ini = Math.floor(serialExcel(detectado));
  const fim = resolucao ? Math.floor(serialExcel(resolucao)) : refDia;
  return Math.max(0, fim - ini);
}

export const SITUACOES_SLA = ["Sem prazo", "No prazo", "Vencendo", "Vencido", "Resolvido s/ data"] as const;

/**
 * Situação do SLA de UMA linha do Acompanhamento. Mesma árvore da fórmula:
 * sem prazo → sem prazo; com data de resolução compara resolução × prazo;
 * resolvido sem data não afirma nada além disso; aberto compara a data de
 * referência com o prazo, com a janela de alerta em dias corridos.
 */
export function situacaoSla(
  l: Pick<LinhaDeAcompanhamento, "prazo" | "resolucao" | "status">,
  refDia: number,
  alertaDias: number,
): (typeof SITUACOES_SLA)[number] {
  if (!l.prazo) return "Sem prazo";
  const prazo = Math.floor(serialExcel(l.prazo));
  if (l.resolucao) return Math.floor(serialExcel(l.resolucao)) <= prazo ? "No prazo" : "Vencido";
  if (l.status === "Corrigido" || l.status === "Fechado") return "Resolvido s/ data";
  if (refDia > prazo) return "Vencido";
  if (prazo - refDia <= alertaDias) return "Vencendo";
  return "No prazo";
}

/* --------------------------------------------------------------------------
   Acumulador
   -------------------------------------------------------------------------- */

export class Agregados {
  total = 0;
  abertos = 0;
  resolvidos = 0;
  /** Soma das idades (dias corridos) dos abertos — a média sai de `somaIdadeAbertos / abertos`. */
  somaIdadeAbertos = 0;
  readonly porSeveridade: Record<string, number> = Object.fromEntries(SEVERIDADES_ROTULADAS.map((s) => [s.rotulo, 0]));
  readonly porStatus: Record<string, number> = Object.fromEntries(STATUS_ROTULADOS.map((s) => [s.rotulo, 0]));
  readonly acompanhamento: LinhaDeAcompanhamento[] = [];
  /** dia SP (serial) → quantos findings foram detectados nele. */
  private readonly porDia = new Map<number, number>();
  /** chave minúscula → ativo. O Excel compara texto sem diferenciar caixa, o cache também. */
  private readonly ativos = new Map<string, AtivoContado>();

  constructor(readonly refDia: number) {}

  registrar(l: FindingsExportRow): void {
    this.total += 1;

    const rotuloSev = ROTULO_SEVERIDADE[l.severityFinal] ?? l.severityFinal;
    this.porSeveridade[rotuloSev] = (this.porSeveridade[rotuloSev] ?? 0) + 1;
    const rotuloStatus = ROTULO_STATUS[l.status] ?? l.status;
    this.porStatus[rotuloStatus] = (this.porStatus[rotuloStatus] ?? 0) + 1;

    const dia = diaSP(l.createdAt);
    if (ehAberto(l.status)) {
      this.abertos += 1;
      this.somaIdadeAbertos += this.refDia - dia;
    } else {
      this.resolvidos += 1;
    }
    this.porDia.set(dia, (this.porDia.get(dia) ?? 0) + 1);

    const chave = l.applicationName.toLowerCase();
    const ativo = this.ativos.get(chave);
    if (ativo) ativo.n += 1;
    else this.ativos.set(chave, { nome: l.applicationName, n: 1 });

    this.acompanhamento.push({
      id: l.id,
      titulo: l.title,
      severidade: rotuloSev,
      detectado: relogioSP(l.createdAt),
      responsavel: l.assigneeName ?? "",
      status: rotuloStatus,
      prazo: l.slaDueAt ? soData(l.slaDueAt) : null,
      resolucao: l.resolvedAt ? soData(l.resolvedAt) : null,
      prioridade: l.vrsBand ? (ROTULO_PRIORIDADE[l.vrsBand] ?? "") : "",
    });
  }

  idadeMediaAbertos(): number {
    return this.abertos === 0 ? 0 : this.somaIdadeAbertos / this.abertos;
  }

  /** Ativos por quantidade (desc) e nome (asc) — a ordem determinística do ranking. */
  ativosOrdenados(max: number = MAX_ATIVOS_AUXILIAR): AtivoContado[] {
    return [...this.ativos.values()]
      .sort((a, b) => b.n - a.n || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0))
      .slice(0, max);
  }

  /**
   * Períodos do gráfico de evolução. Semanal (começando na segunda) quando
   * tudo cabe em `LIMITE_SEMANAL_DIAS`; senão mensal. Passou de `MAX_PERIODOS`,
   * ficam os MAIS RECENTES e `truncado` avisa — o título do gráfico diz isso.
   */
  periodos(): { granularidade: "semana" | "mes"; periodos: Periodo[]; truncado: boolean } {
    if (this.porDia.size === 0) return { granularidade: "mes", periodos: [], truncado: false };

    const dias = [...this.porDia.keys()];
    const minDia = Math.min(...dias);
    const maxDia = Math.max(...dias);
    const semanal = maxDia - minDia + 1 <= LIMITE_SEMANAL_DIAS;

    const inicioDe = (dia: number): number => {
      if (semanal) return dia - ((diaDaSemana(dia) + 6) % 7);
      const d = dataDoDia(dia);
      return Math.floor(serialExcel(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))));
    };
    const proximo = (inicio: number): number => {
      if (semanal) return inicio + 7;
      const d = dataDoDia(inicio);
      return Math.floor(serialExcel(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))));
    };
    const rotulo = (inicio: number): string => {
      const d = dataDoDia(inicio);
      const dois = (n: number) => String(n).padStart(2, "0");
      return semanal
        ? `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}`
        : `${mesCurto(d.getUTCMonth())}/${String(d.getUTCFullYear()).slice(2)}`;
    };

    const lista: Periodo[] = [];
    for (let ini = inicioDe(minDia); ini <= maxDia; ini = proximo(ini)) {
      const fim = proximo(ini);
      let n = 0;
      for (const [dia, q] of this.porDia) if (dia >= ini && dia < fim) n += q;
      lista.push({ inicio: ini, fim, rotulo: rotulo(ini), n });
    }

    const truncado = lista.length > MAX_PERIODOS;
    return { granularidade: semanal ? "semana" : "mes", periodos: truncado ? lista.slice(-MAX_PERIODOS) : lista, truncado };
  }
}
