/**
 * calendario-de-prazos.ts
 *
 * O QUE FAZ
 * Monta o calendário de prazos de SLA (ADR-062): uma grade de semanas (de
 * segunda a domingo), a partir da semana atual, em que cada dia carrega as
 * vulnerabilidades abertas que vencem nele e um "peso" pela severidade — é o
 * que pinta o mapa de calor. O que já venceu vai para uma pilha à parte.
 *
 * POR QUE PESO E NÃO CONTAGEM
 * Três baixas vencendo no mesmo dia pesam menos que uma crítica: o calor
 * mostra onde o prazo DÓI, não onde há mais itens.
 *
 * DATAS
 * Dia é o dia LOCAL de quem olha (o prazo de 23h de terça é terça para quem
 * está em Brasília). Chaves "AAAA-MM-DD" no fuso local.
 *
 * QUEM USA
 * `components/sla/calendario-de-prazos.tsx`. Testado em `calendario-de-prazos.test.ts`.
 */

export interface PrazoAberto {
  id: string;
  title: string;
  severityFinal: string;
  applicationName: string;
  slaDueAt: string;
}

/** Das linhas da busca de achados, as abertas (OPEN/IN_PROGRESS) que têm prazo. */
export function prazosDosAchados(
  achados: ReadonlyArray<{ id: string; title: string; severityFinal: string; applicationName: string; status: string; slaDueAt?: string | null }>,
): PrazoAberto[] {
  return achados
    .filter((f) => (f.status === "OPEN" || f.status === "IN_PROGRESS") && f.slaDueAt)
    .map((f) => ({ id: f.id, title: f.title, severityFinal: f.severityFinal, applicationName: f.applicationName, slaDueAt: f.slaDueAt! }));
}

export interface DiaDoCalendario {
  /** "AAAA-MM-DD" no fuso local. */
  data: string;
  itens: PrazoAberto[];
  peso: number;
  /** 0 (nada) a 4 (o dia mais pesado da grade). */
  nivel: 0 | 1 | 2 | 3 | 4;
  hoje: boolean;
  /** Já passou (antes de hoje) — sem prazos, porque o vencido vai para a pilha. */
  passado: boolean;
}

export interface CalendarioDePrazos {
  /** Semanas da esquerda para a direita; cada uma com 7 dias, de segunda a domingo. */
  semanas: DiaDoCalendario[][];
  vencidos: PrazoAberto[];
  /** Prazos depois do fim da grade (contados, não desenhados). */
  depois: number;
}

const PESO: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const DIA_MS = 86_400_000;

export const chaveLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Meia-noite local da segunda-feira da semana de `d`. */
function segundaDaSemana(d: Date): Date {
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const deslocamento = (inicio.getDay() + 6) % 7; // segunda = 0
  inicio.setDate(inicio.getDate() - deslocamento);
  return inicio;
}

export function montarCalendario(prazos: PrazoAberto[], hoje: Date, semanas = 13): CalendarioDePrazos {
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const chaveDeHoje = chaveLocal(hoje);
  const porDia = new Map<string, PrazoAberto[]>();
  const vencidos: PrazoAberto[] = [];
  const primeiro = segundaDaSemana(hoje);
  const fimDaGrade = new Date(primeiro);
  fimDaGrade.setDate(fimDaGrade.getDate() + semanas * 7);
  let depois = 0;

  for (const p of prazos) {
    const prazo = new Date(p.slaDueAt);
    if (Number.isNaN(prazo.getTime())) continue;
    if (prazo.getTime() < inicioDeHoje) {
      vencidos.push(p);
      continue;
    }
    if (prazo >= fimDaGrade) {
      depois += 1;
      continue;
    }
    const chave = chaveLocal(prazo);
    porDia.set(chave, [...(porDia.get(chave) ?? []), p]);
  }

  const pesoDe = (itens: PrazoAberto[]) => itens.reduce((s, i) => s + (PESO[i.severityFinal] ?? 1), 0);
  const maximo = Math.max(1, ...[...porDia.values()].map(pesoDe));

  const grade: DiaDoCalendario[][] = [];
  const cursor = new Date(primeiro);
  for (let s = 0; s < semanas; s++) {
    const semana: DiaDoCalendario[] = [];
    for (let d = 0; d < 7; d++) {
      const data = chaveLocal(cursor);
      const itens = (porDia.get(data) ?? []).sort((a, b) => (PESO[b.severityFinal] ?? 1) - (PESO[a.severityFinal] ?? 1) || a.slaDueAt.localeCompare(b.slaDueAt));
      const peso = pesoDe(itens);
      semana.push({
        data,
        itens,
        peso,
        nivel: peso === 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil((peso / maximo) * 4))) as 1 | 2 | 3 | 4),
        hoje: data === chaveDeHoje,
        passado: cursor.getTime() < inicioDeHoje,
      });
      cursor.setTime(cursor.getTime() + DIA_MS);
      // Horário de verão: volta para a meia-noite exata.
      cursor.setHours(0, 0, 0, 0);
    }
    grade.push(semana);
  }

  vencidos.sort((a, b) => (PESO[b.severityFinal] ?? 1) - (PESO[a.severityFinal] ?? 1) || a.slaDueAt.localeCompare(b.slaDueAt));
  return { semanas: grade, vencidos, depois };
}
