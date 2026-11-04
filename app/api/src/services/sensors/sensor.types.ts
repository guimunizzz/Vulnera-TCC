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

import type { DastAssetKind, DastSensorStatus } from "@prisma/client";
import type { CandidateFinding } from "../dast-findings.service";

export type SensorKey = "zap" | "headers" | "ssl" | "fingerprint" | "internetdb" | "crtsh";

export interface SensorContext {
  targetUrl: string;
  /** Scan de demonstração: o sensor devolve dado simulado, rotulado como tal. */
  simulated: boolean;
  /** Abort do watchdog/cancelamento: o sensor desiste junto com o scan. */
  signal?: AbortSignal;
  /** Sinal de vida para o watchdog em sensores lentos (fila do NVD). */
  pulso?: () => void;
}

/** Ativo observado (topologia, não achado): IP, porta, tecnologia, subdomínio. */
export interface ObservedAsset {
  kind: DastAssetKind;
  value: string;
  /** A quem o ativo se liga no grafo; null = ao host do alvo. */
  parentValue: string | null;
  metadata?: Record<string, unknown>;
}

export interface SensorResult {
  status: DastSensorStatus;
  message?: string;
  findings: CandidateFinding[];
  assets?: ObservedAsset[];
}

export interface Sensor {
  readonly key: SensorKey;
  run(ctx: SensorContext): Promise<SensorResult>;
}
