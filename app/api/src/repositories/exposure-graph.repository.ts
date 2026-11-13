/**
 * exposure-graph.repository.ts
 *
 * O QUE FAZ
 * Toda a leitura do Exposure Graph. Cinco consultas, NÚMERO FIXO, qualquer que
 * seja o tamanho da company: aplicações, abertas por severidade, resolvidas,
 * categorias abertas e principais abertas. Nada de N+1 — o service junta tudo
 * em memória, sobre resultados já agregados pelo banco.
 *
 * ISOLAMENTO
 * Toda consulta de `Vulnerability` filtra por `companyId` além de
 * `applicationId`. O segundo filtro é a barreira de tenancy: mesmo que um
 * `applicationId` de outra company chegasse aqui, não casaria.
 *
 * QUEM USA
 * `exposure-graph.service.ts`, exclusivamente.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { SEVERIDADES_DO_GRAFO } from "../models/exposure-graph.model";

const STATUS_ABERTOS = ["OPEN", "IN_PROGRESS"];
const STATUS_RESOLVIDOS = ["FIXED", "CLOSED"];
const SEVERIDADES = [...SEVERIDADES_DO_GRAFO];

export interface AplicacaoBrutaDoGrafo {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
}

export interface LinhaAbertasPorAplicacao {
  applicationId: string;
  severityFinal: string;
  total: number;
}

export interface LinhaResolvidasPorAplicacao {
  applicationId: string;
  total: number;
}

export interface LinhaCategoriaAberta {
  applicationId: string;
  owaspCategory: string;
  severityFinal: string;
  total: number;
}

export interface LinhaPrincipalAberta {
  id: string;
  title: string;
  severityFinal: string;
  status: string;
  owaspCategory: string;
  applicationId: string;
  createdAt: Date;
}

export class ExposureGraphRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Só as ativas: a app desativada (RN04, soft delete) não aparece no grafo. */
  async listarAplicacoesAtivas(companyId: string): Promise<AplicacaoBrutaDoGrafo[]> {
    return this.prisma.application.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        url: true,
        environment: true,
        criticality: true,
        internetFacing: true,
        dataSensitivity: true,
      },
    });
  }

  /** Abertas por aplicação e severidade. `NONE` fica de fora pela cláusula `in`. */
  async contarAbertasPorAplicacao(companyId: string, applicationIds: string[]): Promise<LinhaAbertasPorAplicacao[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["applicationId", "severityFinal"],
      where: {
        companyId,
        applicationId: { in: applicationIds },
        status: { in: STATUS_ABERTOS },
        severityFinal: { in: SEVERIDADES },
      },
      _count: { _all: true },
    });
    return linhas.map((l) => ({ applicationId: l.applicationId, severityFinal: l.severityFinal, total: l._count._all }));
  }

  async contarResolvidasPorAplicacao(companyId: string, applicationIds: string[]): Promise<LinhaResolvidasPorAplicacao[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["applicationId"],
      where: {
        companyId,
        applicationId: { in: applicationIds },
        status: { in: STATUS_RESOLVIDOS },
      },
      _count: { _all: true },
    });
    return linhas.map((l) => ({ applicationId: l.applicationId, total: l._count._all }));
  }

  /** Abertas por aplicação, categoria OWASP e severidade — a matéria-prima das categorias. */
  async contarCategoriasAbertas(companyId: string, applicationIds: string[]): Promise<LinhaCategoriaAberta[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["applicationId", "owaspCategory", "severityFinal"],
      where: {
        companyId,
        applicationId: { in: applicationIds },
        status: { in: STATUS_ABERTOS },
        severityFinal: { in: SEVERIDADES },
      },
      _count: { _all: true },
    });
    return linhas.map((l) => ({
      applicationId: l.applicationId,
      owaspCategory: l.owaspCategory,
      severityFinal: l.severityFinal,
      total: l._count._all,
    }));
  }

  /**
   * Até `limitePorAplicacao` abertas por aplicação, numa query só.
   *
   * O Prisma não ordena por uma ordem customizada de severidade (string ordena
   * alfabeticamente: HIGH viria antes de CRITICAL), então a ordenação e o corte
   * por aplicação são feitos com `ROW_NUMBER()` no MySQL 8. O mesmo critério
   * (severidade, depois mais antiga) é reaplicado no service para a saída.
   *
   * ⚠️ `applicationIds` não pode ser vazio: `Prisma.join([])` lança. O service
   * já devolve antes de chamar quando a company não tem aplicações ativas.
   */
  async listarPrincipaisAbertas(
    companyId: string,
    applicationIds: string[],
    limitePorAplicacao: number,
  ): Promise<LinhaPrincipalAberta[]> {
    return this.prisma.$queryRaw<LinhaPrincipalAberta[]>`
      SELECT t.id, t.title, t.severityFinal, t.status, t.owaspCategory, t.applicationId, t.createdAt
      FROM (
        SELECT
          v.id, v.title, v.severityFinal, v.status, v.owaspCategory, v.applicationId, v.createdAt,
          ROW_NUMBER() OVER (
            PARTITION BY v.applicationId
            ORDER BY
              CASE v.severityFinal WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
              v.createdAt ASC,
              v.id ASC
          ) AS posicao
        FROM Vulnerability v
        WHERE v.companyId = ${companyId}
          AND v.applicationId IN (${Prisma.join(applicationIds)})
          AND v.status IN ('OPEN', 'IN_PROGRESS')
          AND v.severityFinal IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
      ) t
      WHERE t.posicao <= ${limitePorAplicacao}
    `;
  }
}
