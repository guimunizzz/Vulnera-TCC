/**
 * exposure-graph.model.ts
 *
 * O QUE FAZ
 * Tipos e DTOs do Exposure Graph (Cadeias de Exposição, D8 em
 * docs/DECISIONS.md): a postura de uma company projetada como grafo —
 * empresa → aplicações → categorias OWASP e principais achados abertos.
 *
 * NOME DO PRODUTO
 * "Exposure Graph" / "Cadeias de Exposição". Nunca "Attack Path": o Vulnera
 * não coleta topologia, identidades nem permissões efetivas, então não pode
 * afirmar caminho de ataque (D8).
 *
 * POR QUE NÃO HÁ ENTIDADE PRISMA
 * Mesmo motivo de `metrics.model.ts`: é uma PROJEÇÃO calculada na hora a
 * partir de `Application` e `Vulnerability`. Sem graph database (D8).
 *
 * QUEM USA
 * `exposure-graph.service.ts` (monta o DTO), `exposure-graph.controller.ts`
 * (devolve) e o front que desenha o grafo e o mapa 3D.
 */

/** Severidades que entram no grafo. `NONE` (CVSS 0) fica fora — ver o service. */
export const SEVERIDADES_DO_GRAFO = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type SeveridadeDoGrafo = (typeof SEVERIDADES_DO_GRAFO)[number];

export interface PrincipalAbertaDTO {
  id: string;
  title: string;
  severityFinal: SeveridadeDoGrafo;
  status: string;
  owaspCategory: string;
}

export interface CategoriaDoGrafoDTO {
  owaspCategory: string;
  abertas: number;
  piorSeveridade: SeveridadeDoGrafo;
}

export interface AplicacaoDoGrafoDTO {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
  abertas: Record<SeveridadeDoGrafo, number>;
  totalAbertas: number;
  totalResolvidas: number;
  /** Pior severidade entre as abertas; `null` quando não há nenhuma aberta. */
  piorSeveridade: SeveridadeDoGrafo | null;
  /** Só categorias com abertas > 0. */
  categorias: CategoriaDoGrafoDTO[];
  /** Até 5 abertas, da mais grave para a mais antiga. */
  principais: PrincipalAbertaDTO[];
}

export interface ExposureGraphDTO {
  companyId: string;
  geradoEm: string;
  aplicacoes: AplicacaoDoGrafoDTO[];
}
