/**
 * sla-monitor.repository.ts
 *
 * Única camada do monitor de SLA que toca o Prisma (vulnerabilidades e destinatários).
 * Sem regra de negócio: quem decide quem avisa e quando é o SlaMonitorService.
 * As notificações já enviadas ficam no NotificationRepository (a tabela é dele).
 */

import type { PrismaClient } from "@prisma/client";
import { SLA_ACTIVE_STATUSES } from "../utils/sla.util";

/** O que o monitor precisa de uma vulnerabilidade com prazo na janela ou já vencida. */
export interface VulnerabilidadeComPrazo {
  id: string;
  title: string;
  severityFinal: string;
  slaDueAt: Date;
  companyId: string;
  projectId: string;
}

export class SlaMonitorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Vulnerabilidades com o relógio correndo (OPEN ou IN_PROGRESS), com prazo até `limite`
   * (inclui as já vencidas) e SEM aceite de risco vigente. O aceite vigente é o mesmo
   * critério de `sla.util.ts` (APPROVED e `expiresAt` no futuro): ele pausa o SLA, então
   * o estado vira ACCEPTED e não há o que avisar.
   */
  async vulnerabilidadesComPrazoAte(agora: Date, limite: Date): Promise<VulnerabilidadeComPrazo[]> {
    const linhas = await this.prisma.vulnerability.findMany({
      where: {
        status: { in: [...SLA_ACTIVE_STATUSES] },
        slaDueAt: { lte: limite },
        riskAcceptances: { none: { status: "APPROVED", expiresAt: { gt: agora } } },
      },
      select: { id: true, title: true, severityFinal: true, slaDueAt: true, companyId: true, projectId: true },
      orderBy: { slaDueAt: "asc" },
    });
    // `lte` já deixa de fora o prazo NULL no SQL; o filtro aqui só estreita o tipo.
    return linhas.filter((v): v is VulnerabilidadeComPrazo => v.slaDueAt !== null);
  }

  /**
   * Quem recebe avisos de um achado (mesmo critério de ADMIN e CLIENT da Threat Intel),
   * mas PENTESTER só se for MEMBRO DO PROJETO do achado: a Threat Intel aceita qualquer
   * projeto da empresa, aqui o aviso é mais restrito de propósito.
   */
  async destinatariosDoAchado(companyId: string, projectId: string): Promise<string[]> {
    const linhas = await this.prisma.user.findMany({
      where: {
        deactivatedAt: null,
        OR: [
          { role: "ADMIN" },
          { role: "CLIENT", companyId },
          { role: "PENTESTER", projectMembers: { some: { projectId } } },
        ],
      },
      select: { id: true },
    });
    return linhas.map((l) => l.id);
  }
}
