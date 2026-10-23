/**
 * export.config.ts
 *
 * Configuração da exportação Excel de findings. Existe para que o teto de
 * linhas mude por ambiente sem número solto em controller ou service.
 */

import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";

/** Padrão de produto: acima disto a geração síncrona deixa de ser razoável. */
export const EXPORT_MAX_ROWS_PADRAO = 50_000;

/** Valor inválido (não numérico, ≤ 0, fracionário) cai no padrão — nunca em "sem limite". */
export function loadExportMaxRows(): number {
  const bruto = Number(EnvVar.getOptional(EnvKeys.EXPORT_MAX_ROWS, String(EXPORT_MAX_ROWS_PADRAO)));
  return Number.isInteger(bruto) && bruto > 0 ? bruto : EXPORT_MAX_ROWS_PADRAO;
}
