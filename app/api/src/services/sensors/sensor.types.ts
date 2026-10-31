/**
 * sensor.types.ts
 *
 * Contrato dos sensores passivos do DAST (spec "Sensores e Security Graph").
 * Cada técnica de coleta é um sensor: roda depois do ZAP, no mesmo job, e
 * devolve um status EXPLÍCITO — "sem dados" nunca pode aparecer como "seguro".
 *
 * Os findings de um sensor saem no mesmo formato dos do ZAP (`CandidateFinding`),
 * com `pluginId` em namespace (`sensor:<key>:<regra>`) e `sensorKey`: assim a
 * fórmula do fingerprint, a deduplicação, a triagem e a promoção não mudam.
 */

import type { DastSensorStatus } from "@prisma/client";
import type { CandidateFinding } from "../dast-findings.service";

export type SensorKey = "zap" | "headers" | "ssl";

export interface SensorContext {
  targetUrl: string;
  /** Scan de demonstração: o sensor devolve dado simulado, rotulado como tal. */
  simulated: boolean;
  /** Abort do watchdog/cancelamento: o sensor desiste junto com o scan. */
  signal?: AbortSignal;
}

export interface SensorResult {
  status: DastSensorStatus;
  message?: string;
  findings: CandidateFinding[];
}

export interface Sensor {
  readonly key: SensorKey;
  run(ctx: SensorContext): Promise<SensorResult>;
}
