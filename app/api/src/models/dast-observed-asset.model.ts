/**
 * dast-observed-asset.model.ts
 *
 * Forma pública de um ativo observado pelos sensores de descoberta (IP,
 * porta, tecnologia, subdomínio) — o que o CyberGraph desenha além dos
 * endpoints. Sem id interno nem scanId: a rota já é do scan.
 */

import type { DastAssetKind, DastObservedAsset } from "@prisma/client";

export interface DastObservedAssetResponseDTO {
  kind: DastAssetKind;
  value: string;
  parentValue: string | null;
  sensorKey: string;
  metadata: Record<string, unknown> | null;
}

export function toObservedAssetResponse(asset: DastObservedAsset): DastObservedAssetResponseDTO {
  return {
    kind: asset.kind,
    value: asset.value,
    parentValue: asset.parentValue,
    sensorKey: asset.sensorKey,
    metadata: (asset.metadata as Record<string, unknown> | null) ?? null,
  };
}
