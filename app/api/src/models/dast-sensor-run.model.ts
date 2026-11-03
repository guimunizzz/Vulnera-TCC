/**
 * dast-sensor-run.model.ts
 *
 * Forma pública do status de um sensor num scan — o que os chips da tela do
 * scan e do CyberGraph mostram. Sem id interno nem scanId: a rota já é do scan.
 */

import type { DastSensorRun, DastSensorStatus } from "@prisma/client";

export interface DastSensorRunResponseDTO {
  sensorKey: string;
  status: DastSensorStatus;
  message: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export function toSensorRunResponse(run: DastSensorRun): DastSensorRunResponseDTO {
  return {
    sensorKey: run.sensorKey,
    status: run.status,
    message: run.message,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt.toISOString(),
    durationMs: run.durationMs,
  };
}
