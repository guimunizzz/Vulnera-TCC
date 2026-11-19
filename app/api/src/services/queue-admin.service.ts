/**
 * queue-admin.service.ts
 *
 * Painel de filas do ADMIN (ADR-056). Lê as contagens e as falhas pelo
 * contrato `JobQueue` e reprocessa um job com falha. Não toca o Redis
 * diretamente: quem sabe falar com o motor é o adaptador (bullmq ou memory).
 *
 * Só ADMIN chega aqui (o middleware `requireRole("ADMIN")` barra antes). O
 * reprocessamento grava AuditLog depois do sucesso: tentativa recusada não
 * deixa rastro de ação executada.
 */

import type { JobQueue, QueueName, FilaNoPainel, QueueDriver } from "./queue/job-queue";
import { QUEUE_NAMES } from "./queue/job-queue";
import type { AuditLogRepository } from "../repositories/audit-log.repository";

/** Rótulos em português para a tela. Tipado por QueueName: fila nova sem rótulo não compila. */
export const ROTULOS_DAS_FILAS: Record<QueueName, string> = {
  "dast-scan": "Scans DAST",
  "threat-intel": "Threat Intel",
  "dast-schedule": "Agendamentos DAST",
};

export interface FilaNoPainelDTO extends FilaNoPainel {
  label: string;
}

export interface PainelDeFilasDTO {
  driver: QueueDriver;
  queues: FilaNoPainelDTO[];
}

export class QueueAdminService {
  constructor(
    private readonly fila: Pick<JobQueue, "painelDeFilas" | "reprocessarJob">,
    private readonly auditLog: Pick<AuditLogRepository, "create">,
  ) {}

  async painel(): Promise<PainelDeFilasDTO> {
    const painel = await this.fila.painelDeFilas();
    return {
      driver: painel.driver,
      queues: painel.queues.map((f) => ({ ...f, label: ROTULOS_DAS_FILAS[f.name] })),
    };
  }

  async reprocessar(actorId: string, nomeFila: string, jobId: string): Promise<{ fila: QueueName; jobId: string }> {
    const fila = (Object.values(QUEUE_NAMES) as string[]).includes(nomeFila) ? (nomeFila as QueueName) : null;
    if (!fila) throw new Error("INVALID_QUEUE");

    await this.fila.reprocessarJob(fila, jobId);
    await this.auditLog.create({
      actorId,
      companyId: null,
      entityType: "QueueJob",
      entityId: jobId,
      action: "RETRY",
      diffJson: JSON.stringify({ fila }),
    });
    return { fila, jobId };
  }
}
