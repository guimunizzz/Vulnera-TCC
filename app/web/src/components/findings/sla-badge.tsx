/**
 * sla-badge.tsx
 *
 * O QUE FAZ
 * Mostra o estado do SLA de um finding (CP-2) como um chip com TEXTO:
 * "vence em 2 dias", "vencido há 4 dias", "resolvido no prazo", "risco
 * aceito". A cor é reforço; o texto carrega o sentido — quem não distingue
 * vermelho de verde lê a mesma coisa.
 *
 * O ESTADO VEM DO BACKEND. A tela não recalcula "venceu?" — o backend fixa um
 * "agora" por resposta e deriva o estado com ele (utils/sla.util.ts). A frase
 * sai de `lib/sla-text.ts` (funções puras, testáveis fora do React).
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - `title` com a data absoluta do prazo, para quem quer o dia exato.
 *   - Sem ícone-só: o chip é uma frase.
 *
 * QUEM USA
 * `findings-table.tsx` (coluna), `finding-detail-page.tsx` (bloco) e o card
 * do Kanban (CP-7).
 */

import { Badge, type TomBadge } from "../ui/badge";
import { SLA_STATE_LABELS, type SlaState } from "../../types/vulnerability.types";
import { fraseDoSla } from "../../lib/sla-text";

const TOM: Record<SlaState, TomBadge> = {
  NO_SLA: "neutro",
  ON_TRACK: "sucesso",
  DUE_SOON: "atencao",
  BREACHED: "perigo",
  ACCEPTED: "acento",
  RESOLVED_IN_SLA: "sucesso",
  RESOLVED_LATE: "atencao",
};

export interface SlaBadgeProps {
  state: SlaState;
  remainingMs: number | null;
  /** ISO do prazo — vai no `title`, para quem quer a data absoluta. */
  dueAt?: string | null;
  className?: string;
}

export function SlaBadge({ state, remainingMs, dueAt, className }: SlaBadgeProps) {
  const frase = fraseDoSla(state, remainingMs);
  const prazo = dueAt ? new Date(dueAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  return (
    <Badge tom={TOM[state]} className={["normal-case", className].filter(Boolean).join(" ")}>
      <span title={prazo ? `Prazo: ${prazo}` : SLA_STATE_LABELS[state]}>{frase}</span>
    </Badge>
  );
}
