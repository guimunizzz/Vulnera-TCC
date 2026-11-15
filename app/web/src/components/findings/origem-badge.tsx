/**
 * origem-badge.tsx
 *
 * Selo da origem do finding (DAST, SAST, SCA ou Manual) — a marca da visão
 * unificada. Texto sempre visível (nunca só cor) e a descrição no `title`.
 * Origem desconhecida (valor novo vindo da API) aparece crua, sem quebrar.
 */

import { Badge } from "../ui/badge";
import { SOURCE_TYPE_DESCRICOES, SOURCE_TYPE_LABELS, type SourceType } from "../../types/vulnerability.types";

export function OrigemBadge({ sourceType }: { sourceType: string | null | undefined }) {
  if (!sourceType) return null;
  const conhecido = sourceType in SOURCE_TYPE_LABELS;
  const rotulo = conhecido ? SOURCE_TYPE_LABELS[sourceType as SourceType] : sourceType;
  return (
    <Badge
      tom={sourceType === "MANUAL" ? "neutro" : "acento"}
      title={conhecido ? SOURCE_TYPE_DESCRICOES[sourceType as SourceType] : undefined}
      aria-label={`Origem: ${rotulo}`}
    >
      {rotulo}
    </Badge>
  );
}
