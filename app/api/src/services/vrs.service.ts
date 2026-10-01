/**
 * vrs.service.ts — recálculo em lote do Vulnera Risk Score (CP-3)
 *
 * O QUE FAZ
 * Quando o CONTEXTO DE RISCO de uma aplicação muda (criticidade, ambiente,
 * exposição, sensibilidade — CP-1), o VRS de todos os findings dela muda
 * junto. Este service faz isso: percorre os findings da app, recalcula e
 * grava. Devolve quantos recalculou, que vai para o AuditLog
 * RISK_CONTEXT_CHANGED como `vrsRecalculated`.
 *
 * POR QUE UM SERVICE SEPARADO
 * O ApplicationService não pode conhecer Vulnerability (P1: cada camada só
 * conhece a de baixo, e os dois são pares). Ele expõe um gancho
 * (`setRiskContextChangedHook`) e a factory pluga este service nele — o
 * acoplamento fica num lugar só, visível, em vez de o ApplicationService
 * importar o VulnerabilityRepository por dentro.
 *
 * TODOS OS STATUS, DE PROPÓSITO
 * Inclui FIXED/CLOSED. O VRS não tem tempo dentro; o de um finding fechado
 * refletir o contexto ATUAL é consistente, e evita a listagem mostrar um
 * número velho ao lado de um novo para a mesma aplicação (docs/DECISIONS.md
 * D3: "não deixar score stale silenciosamente").
 *
 * SEM FILA, SEM JOB
 * Com o volume atual (dezenas de findings por app) é um UPDATE por linha,
 * síncrono, dentro da mesma request que mudou o contexto. Se um dia forem
 * milhares, vira processamento em blocos — hoje seria otimização prematura.
 *
 * QUEM USA
 * `factories/application.factory.ts` (gancho) e `prisma/backfill-vrs.ts`.
 */

import type { Application } from "@prisma/client";
import type { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { calcularVrs } from "../utils/vrs.util";

export class VrsService {
  constructor(private readonly vulnerabilityRepository: VulnerabilityRepository) {}

  /** Recalcula o VRS de todos os findings da aplicação. Devolve a contagem. */
  async recomputeForApplication(application: Application): Promise<number> {
    const findings = await this.vulnerabilityRepository.findAllByApplication(application.id);
    const agora = new Date();
    let recalculados = 0;
    for (const v of findings) {
      const r = calcularVrs(
        {
          cvssScore: v.cvssScore,
          criticality: application.criticality,
          environment: application.environment,
          internetFacing: application.internetFacing,
          dataSensitivity: application.dataSensitivity,
        },
        agora,
      );
      await this.vulnerabilityRepository.updateVrs(v.id, {
        vrsScore: r?.score ?? null,
        vrsFactors: r ? JSON.stringify(r.breakdown) : null,
        vrsComputedAt: agora,
      });
      recalculados++;
    }
    return recalculados;
  }
}
