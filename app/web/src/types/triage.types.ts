/**
 * triage.types.ts — contrato de GET /api/triage/inbox (ADR-062).
 */

export type FonteDeTriagem = "DAST" | "CODIGO" | "THREAT_INTEL";
export type SeveridadeDaCaixa = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface ItemDaCaixa {
  fonte: FonteDeTriagem;
  /** Alvo do PATCH .../triage da fonte. */
  id: string;
  titulo: string;
  severidade: SeveridadeDaCaixa;
  contexto: string;
  detalhe: string | null;
  criadoEm: string;
  link: string;
  companyId: string | null;
}

export interface CaixaDeTriagem {
  geradoEm: string;
  porFonte: Record<FonteDeTriagem, number>;
  total: number;
  itens: ItemDaCaixa[];
}
