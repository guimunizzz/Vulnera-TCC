/**
 * vrs-badge.tsx
 *
 * O QUE FAZ
 * Mostra o Vulnera Risk Score (CP-3) de um finding: o NÚMERO (0–100) e a
 * FAIXA em texto — "77 · Urgente". Nunca só cor: a faixa é a palavra, e a
 * cor é reforço para quem enxerga.
 *
 * O NÚMERO VEM DO BANCO. Nada é recalculado aqui; o backend grava score e
 * explicação juntos (`vrsFactors`), e a UI só desenha. Com `factors`, o
 * `title` lista as parcelas — a explicação completa, em tabela, fica no
 * detalhe do finding.
 *
 * ⚠️ NÃO é o "Risco acumulado da aplicação" do dashboard (Σ cvss²/10 por
 * app). São métricas diferentes; os rótulos são diferentes de propósito.
 *
 * QUEM USA
 * `findings-table.tsx` (coluna), `finding-detail-page.tsx` (bloco) e o card
 * do Kanban (CP-7).
 */

import { Badge, type TomBadge } from "../ui/badge";
import { VRS_BAND_LABELS, type VrsBand, type VrsBreakdownInfo } from "../../types/vulnerability.types";

const TOM: Record<VrsBand, TomBadge> = {
  IMEDIATO: "perigo",
  URGENTE: "atencao",
  PLANEJADO: "acento",
  MONITORAR: "neutro",
};

const NOME_FATOR: Record<VrsBreakdownInfo["factors"][number]["name"], string> = {
  criticality: "Criticidade",
  environment: "Ambiente",
  internetFacing: "Exposição",
  dataSensitivity: "Dado",
};

/** "CVSS 9.8 → 59 · Criticidade CRITICAL +15 · …" — o resumo que vai no `title`. Local: só componente é exportado (react-refresh). */
function resumoDosFatores(f: VrsBreakdownInfo): string {
  const partes = [`CVSS ${f.cvss.toFixed(1)} → ${f.basePoints}`];
  for (const x of f.factors) partes.push(`${NOME_FATOR[x.name]} ${String(x.value)} +${x.points}`);
  return partes.join(" · ");
}

export interface VrsBadgeProps {
  score: number | null;
  band: VrsBand | null;
  factors?: VrsBreakdownInfo | null;
  className?: string;
}

export function VrsBadge({ score, band, factors, className }: VrsBadgeProps) {
  if (score == null || band == null) {
    return (
      <Badge tom="neutro" className={["normal-case", className].filter(Boolean).join(" ")}>
        <span title="Sem CVSS — sem prioridade calculada">VRS —</span>
      </Badge>
    );
  }
  return (
    <Badge tom={TOM[band]} className={["normal-case", className].filter(Boolean).join(" ")}>
      <span title={factors ? resumoDosFatores(factors) : `Prioridade ${VRS_BAND_LABELS[band]}`}>
        <span className="font-mono" data-numeric>
          {score}
        </span>
        {" · "}
        {VRS_BAND_LABELS[band]}
      </span>
    </Badge>
  );
}
