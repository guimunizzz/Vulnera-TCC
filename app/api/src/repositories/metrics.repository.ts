/**
 * metrics.repository.ts
 *
 * O QUE FAZ
 * Toda a agregação das métricas, executada NO BANCO.
 *
 * 🎯 REGRA DESTE ARQUIVO: nada de `findMany` seguido de `.reduce()`.
 * O CP4 é explícito — "nunca puxe todos os findings e agregue em JavaScript".
 * Com 500 findings a diferença é de milissegundos; com 50 mil é a diferença
 * entre um dashboard e um timeout. Aqui só entram `groupBy`, `aggregate`,
 * `count` e `$queryRaw`.
 *
 * QUANDO USO `$queryRaw` E POR QUÊ
 * O Prisma não sabe fazer duas coisas de que precisamos:
 *   1. Agrupar por DIA/SEMANA/MÊS a partir de um `DateTime` (não existe
 *      `groupBy: { createdAt: 'day' }`).
 *   2. Ler dentro do `diffJson` do AuditLog, que é TEXT com JSON.
 * Nos dois casos vai SQL parametrizado (`Prisma.sql` / `$queryRaw` com
 * template tag), nunca concatenação de string — os parâmetros vêm da query
 * string do usuário.
 *
 * ⚠️ FUSO HORÁRIO
 * Toda agregação por período é feita em UTC. O Prisma grava `DateTime` em UTC
 * no MySQL, e `DATE(createdAt)` no MySQL lê o valor cru da coluna — ou seja,
 * já é o dia UTC, sem conversão implícita da sessão. Fixar UTC é o que faz o
 * mesmo dado produzir o mesmo gráfico independentemente de onde a API roda, e
 * é o que torna o teste de fuso determinístico. O frontend exibe as datas na
 * hora local; a fronteira do bucket é UTC. Documentado no ADR-025.
 *
 * QUEM USA
 * `metrics.service.ts`, exclusivamente.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import type { Granularidade } from "../models/metrics.model";

/** Recorte comum a todas as consultas. */
export interface FiltroMetricas {
  applicationId: string;
  de: Date;
  ate: Date;
  /** Filtros opcionais vindos do dashboard (CP6). */
  severidades?: string[];
  status?: string[];
  owasp?: string[];
}

export interface LinhaContagem {
  chave: string;
  total: number;
}

export interface LinhaSerie {
  periodo: string;
  chave: string;
  total: number;
}

export interface RemediacaoBruta {
  severidade: string;
  /** Dias entre `Vulnerability.createdAt` e o primeiro STATUS_CHANGE → FIXED. */
  dias: number;
}

const STATUS_ABERTOS = ["OPEN", "IN_PROGRESS"];
const STATUS_REMEDIADOS = ["FIXED", "CLOSED"];

export class MetricsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /* ======================================================================
     Cláusula WHERE compartilhada
     ====================================================================== */

  /**
   * Monta o `where` do Prisma a partir do filtro.
   *
   * `applicationId` vem SEMPRE primeiro e nunca é opcional: é a garantia de
   * isolamento. O service já validou que o ator pode ver esta aplicação; aqui
   * o filtro é a segunda barreira.
   */
  private where(f: FiltroMetricas): Prisma.VulnerabilityWhereInput {
    return {
      applicationId: f.applicationId,
      createdAt: { gte: f.de, lte: f.ate },
      ...(f.severidades?.length ? { severityFinal: { in: f.severidades } } : {}),
      ...(f.status?.length ? { status: { in: f.status } } : {}),
      ...(f.owasp?.length ? { owaspCategory: { in: f.owasp } } : {}),
    };
  }

  /* ======================================================================
     Contagens
     ====================================================================== */

  async contarTotal(f: FiltroMetricas): Promise<number> {
    return this.prisma.vulnerability.count({ where: this.where(f) });
  }

  /** Findings ABERTOS agrupados por severidade final. */
  async contarAbertosPorSeveridade(f: FiltroMetricas): Promise<LinhaContagem[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["severityFinal"],
      where: { ...this.where(f), status: { in: STATUS_ABERTOS } },
      _count: { _all: true },
    });
    return linhas.map((l) => ({ chave: l.severityFinal, total: l._count._all }));
  }

  async contarPorStatus(f: FiltroMetricas): Promise<LinhaContagem[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["status"],
      where: this.where(f),
      _count: { _all: true },
    });
    return linhas.map((l) => ({ chave: l.status, total: l._count._all }));
  }

  async contarPorCategoriaOwasp(f: FiltroMetricas): Promise<LinhaContagem[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["owaspCategory"],
      where: this.where(f),
      _count: { _all: true },
      orderBy: { _count: { owaspCategory: "desc" } },
    });
    return linhas.map((l) => ({ chave: l.owaspCategory, total: l._count._all }));
  }

  async contarRemediados(f: FiltroMetricas): Promise<number> {
    return this.prisma.vulnerability.count({
      where: { ...this.where(f), status: { in: STATUS_REMEDIADOS } },
    });
  }

  /* ======================================================================
     Risk score
     ====================================================================== */

  /**
   * Soma de `cvssScore²/10` sobre os findings ABERTOS — a fórmula do
   * `metrics.model.ts`, executada no banco.
   *
   * Vai em SQL porque o Prisma não expõe expressão aritmética em `aggregate`:
   * o `_sum` só soma a coluna crua. A alternativa seria trazer todos os
   * `cvssScore` e somar em JS, que é exatamente o que este arquivo proíbe.
   */
  async somarRiskScore(f: FiltroMetricas): Promise<number> {
    const linhas = await this.prisma.$queryRaw<{ risco: number | null }[]>`
      SELECT COALESCE(SUM(POW(cvssScore, 2) / 10), 0) AS risco
      FROM Vulnerability
      WHERE applicationId = ${f.applicationId}
        AND createdAt >= ${f.de}
        AND createdAt <= ${f.ate}
        AND status IN ('OPEN', 'IN_PROGRESS')
        AND cvssScore IS NOT NULL
    `;
    const bruto = Number(linhas[0]?.risco ?? 0);
    return Math.round(bruto * 100) / 100;
  }

  /* ======================================================================
     Aging — dívida de segurança
     ====================================================================== */

  /**
   * Findings ABERTOS agrupados por faixa de idade.
   *
   * A idade é medida contra `agora`, não contra o fim do período: um finding
   * aberto há 90 dias continua tendo 90 dias hoje, mesmo que o filtro mostre
   * só a última semana. Medir contra o fim da janela faria a dívida "sumir"
   * ao encurtar o período, que é o oposto do que a métrica existe para dizer.
   */
  async contarAgingDeAbertos(f: FiltroMetricas, agora: Date): Promise<Record<string, number>> {
    const linhas = await this.prisma.$queryRaw<{ faixa: string; total: bigint }[]>`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(DAY, createdAt, ${agora}) < 7  THEN 'ate7Dias'
          WHEN TIMESTAMPDIFF(DAY, createdAt, ${agora}) < 30 THEN 'de7A30Dias'
          WHEN TIMESTAMPDIFF(DAY, createdAt, ${agora}) < 90 THEN 'de30A90Dias'
          ELSE 'mais90Dias'
        END AS faixa,
        COUNT(*) AS total
      FROM Vulnerability
      WHERE applicationId = ${f.applicationId}
        AND createdAt >= ${f.de}
        AND createdAt <= ${f.ate}
        AND status IN ('OPEN', 'IN_PROGRESS')
      GROUP BY faixa
    `;
    const saida: Record<string, number> = {};
    for (const l of linhas) saida[l.faixa] = Number(l.total);
    return saida;
  }

  /**
   * Findings críticos abertos há mais de N dias — usado pelos insights.
   * Devolve a contagem, não a lista: o insight só precisa do número, e trazer
   * as linhas seria puxar dado que ninguém vai ler.
   */
  async contarCriticosAntigos(applicationId: string, dias: number, agora: Date): Promise<number> {
    const linhas = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total
      FROM Vulnerability
      WHERE applicationId = ${applicationId}
        AND severityFinal = 'CRITICAL'
        AND status IN ('OPEN', 'IN_PROGRESS')
        AND TIMESTAMPDIFF(DAY, createdAt, ${agora}) > ${dias}
    `;
    return Number(linhas[0]?.total ?? 0);
  }

  /* ======================================================================
     MTTR — reconstruído do AuditLog
     ====================================================================== */

  /**
   * Tempo até a PRIMEIRA remediação de cada finding, em dias.
   *
   * COMO FUNCIONA
   * Junta `Vulnerability` com o `AuditLog` da própria vulnerabilidade, filtra
   * `action = 'STATUS_CHANGE'` e lê o destino dentro do `diffJson`
   * (`{"from":"...","to":"FIXED"}`). `MIN(createdAt)` pega a PRIMEIRA transição
   * para FIXED — se o finding foi reaberto e corrigido de novo, o que conta é
   * quanto tempo levou da primeira vez.
   *
   * ⚠️ `JSON_VALID` antes de `JSON_EXTRACT`: o `diffJson` é uma coluna TEXT
   * compartilhada por todas as ações auditadas, e o MySQL aborta a query
   * inteira se `JSON_EXTRACT` receber texto que não é JSON. O guarda evita que
   * uma entrada malformada de outra ação derrube o cálculo do MTTR.
   *
   * ⚠️ Só enxerga o que o AuditLog registrou. Findings anteriores à Fase 5 não
   * têm trilha e ficam de fora — ver o aviso em `metrics.model.ts`.
   */
  async listarTemposDeRemediacao(f: FiltroMetricas): Promise<RemediacaoBruta[]> {
    const linhas = await this.prisma.$queryRaw<{ severidade: string; dias: number }[]>`
      SELECT
        v.severityFinal AS severidade,
        TIMESTAMPDIFF(HOUR, v.createdAt, MIN(a.createdAt)) / 24 AS dias
      FROM Vulnerability v
      INNER JOIN AuditLog a
        ON a.entityId = v.id
       AND a.entityType = 'Vulnerability'
       AND a.action = 'STATUS_CHANGE'
       AND JSON_VALID(a.diffJson)
       AND JSON_UNQUOTE(JSON_EXTRACT(a.diffJson, '$.to')) = 'FIXED'
      WHERE v.applicationId = ${f.applicationId}
        AND v.createdAt >= ${f.de}
        AND v.createdAt <= ${f.ate}
      GROUP BY v.id, v.severityFinal, v.createdAt
    `;
    return linhas.map((l) => ({ severidade: l.severidade, dias: Number(l.dias) }));
  }

  /**
   * Findings que foram marcados FIXED e voltaram para OPEN — taxa de
   * reabertura. Conta vulnerabilidades DISTINTAS que têm as duas transições.
   */
  async contarReaberturas(f: FiltroMetricas): Promise<number> {
    const linhas = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(DISTINCT v.id) AS total
      FROM Vulnerability v
      WHERE v.applicationId = ${f.applicationId}
        AND v.createdAt >= ${f.de}
        AND v.createdAt <= ${f.ate}
        AND EXISTS (
          SELECT 1 FROM AuditLog a
          WHERE a.entityId = v.id AND a.entityType = 'Vulnerability' AND a.action = 'STATUS_CHANGE'
            AND JSON_VALID(a.diffJson)
            AND JSON_UNQUOTE(JSON_EXTRACT(a.diffJson, '$.to')) = 'FIXED'
        )
        AND EXISTS (
          SELECT 1 FROM AuditLog a2
          WHERE a2.entityId = v.id AND a2.entityType = 'Vulnerability' AND a2.action = 'STATUS_CHANGE'
            AND JSON_VALID(a2.diffJson)
            AND JSON_UNQUOTE(JSON_EXTRACT(a2.diffJson, '$.from')) = 'FIXED'
            AND JSON_UNQUOTE(JSON_EXTRACT(a2.diffJson, '$.to')) = 'OPEN'
        )
    `;
    return Number(linhas[0]?.total ?? 0);
  }

  /* ======================================================================
     Série temporal
     ====================================================================== */

  /**
   * Expressão SQL que trunca um `DateTime` ao início do período.
   *
   * Não é interpolação de dado do usuário: `granularidade` é validada no
   * controller contra uma lista fechada, e o valor devolvido aqui é uma
   * constante literal escolhida por `switch`. Ainda assim vai como
   * `Prisma.sql` (e não string crua) para que o resto da query continue
   * parametrizado.
   */
  private truncar(coluna: string, g: Granularidade): Prisma.Sql {
    // `DATE_FORMAT` devolve string já no formato que o frontend consome.
    // Semana: `%x-%v` é a semana ISO (segunda a domingo), não a americana.
    switch (g) {
      case "month":
        return Prisma.raw(`DATE_FORMAT(${coluna}, '%Y-%m-01')`);
      case "week":
        return Prisma.raw(`DATE_FORMAT(DATE_SUB(${coluna}, INTERVAL WEEKDAY(${coluna}) DAY), '%Y-%m-%d')`);
      case "day":
      default:
        return Prisma.raw(`DATE_FORMAT(${coluna}, '%Y-%m-%d')`);
    }
  }

  /** Findings CRIADOS por período, quebrados por severidade. */
  async serieDeCriados(f: FiltroMetricas, g: Granularidade): Promise<LinhaSerie[]> {
    const periodo = this.truncar("v.createdAt", g);
    const linhas = await this.prisma.$queryRaw<{ periodo: string; chave: string; total: bigint }[]>`
      SELECT ${periodo} AS periodo, v.severityFinal AS chave, COUNT(*) AS total
      FROM Vulnerability v
      WHERE v.applicationId = ${f.applicationId}
        AND v.createdAt >= ${f.de}
        AND v.createdAt <= ${f.ate}
      GROUP BY periodo, v.severityFinal
      ORDER BY periodo ASC
    `;
    return linhas.map((l) => ({ periodo: l.periodo, chave: l.chave, total: Number(l.total) }));
  }

  /**
   * Findings RESOLVIDOS por período.
   *
   * A data usada é a do AuditLog (quando a transição para FIXED aconteceu), e
   * não a `createdAt` do finding — senão a série de resolvidos seria só a
   * série de criados deslocada, e o gráfico "criados × resolvidos" não diria
   * nada.
   */
  async serieDeResolvidos(f: FiltroMetricas, g: Granularidade): Promise<LinhaSerie[]> {
    const periodo = this.truncar("t.resolvidoEm", g);
    const linhas = await this.prisma.$queryRaw<{ periodo: string; total: bigint }[]>`
      SELECT ${periodo} AS periodo, COUNT(*) AS total
      FROM (
        SELECT v.id, MIN(a.createdAt) AS resolvidoEm
        FROM Vulnerability v
        INNER JOIN AuditLog a
          ON a.entityId = v.id
         AND a.entityType = 'Vulnerability'
         AND a.action = 'STATUS_CHANGE'
         AND JSON_VALID(a.diffJson)
         AND JSON_UNQUOTE(JSON_EXTRACT(a.diffJson, '$.to')) = 'FIXED'
        WHERE v.applicationId = ${f.applicationId}
        GROUP BY v.id
      ) t
      WHERE t.resolvidoEm >= ${f.de} AND t.resolvidoEm <= ${f.ate}
      GROUP BY periodo
      ORDER BY periodo ASC
    `;
    return linhas.map((l) => ({ periodo: l.periodo, chave: "resolvidos", total: Number(l.total) }));
  }

  /* ======================================================================
     Comparativo entre aplicações da company
     ====================================================================== */

  /**
   * Uma linha por aplicação ATIVA da company, com tudo o que o comparativo
   * precisa, em UMA query.
   *
   * A alternativa seria N+1: listar aplicações e chamar `summary` para cada.
   * Com 5 aplicações são 5×6 = 30 idas ao banco para desenhar uma tabela.
   */
  async compararAplicacoesDaCompany(
    companyId: string,
    de: Date,
    ate: Date,
  ): Promise<
    {
      applicationId: string;
      applicationName: string;
      total: bigint;
      abertos: bigint;
      remediados: bigint;
      criticosAbertos: bigint;
      risco: number | null;
    }[]
  > {
    return this.prisma.$queryRaw`
      SELECT
        app.id   AS applicationId,
        app.name AS applicationName,
        COUNT(v.id) AS total,
        SUM(CASE WHEN v.status IN ('OPEN','IN_PROGRESS') THEN 1 ELSE 0 END) AS abertos,
        SUM(CASE WHEN v.status IN ('FIXED','CLOSED') THEN 1 ELSE 0 END) AS remediados,
        SUM(CASE WHEN v.status IN ('OPEN','IN_PROGRESS') AND v.severityFinal = 'CRITICAL' THEN 1 ELSE 0 END) AS criticosAbertos,
        COALESCE(SUM(CASE WHEN v.status IN ('OPEN','IN_PROGRESS') AND v.cvssScore IS NOT NULL
                          THEN POW(v.cvssScore, 2) / 10 ELSE 0 END), 0) AS risco
      FROM Application app
      LEFT JOIN Vulnerability v
        ON v.applicationId = app.id
       AND v.createdAt >= ${de}
       AND v.createdAt <= ${ate}
      WHERE app.companyId = ${companyId}
        AND app.isActive = true
      GROUP BY app.id, app.name
      ORDER BY risco DESC
    `;
  }

  /** MTTR geral (todas as severidades) por aplicação — complementa o comparativo. */
  async mttrPorAplicacaoDaCompany(companyId: string, de: Date, ate: Date): Promise<{ applicationId: string; dias: number }[]> {
    const linhas = await this.prisma.$queryRaw<{ applicationId: string; dias: number }[]>`
      SELECT t.applicationId, AVG(t.dias) AS dias
      FROM (
        SELECT v.applicationId, TIMESTAMPDIFF(HOUR, v.createdAt, MIN(a.createdAt)) / 24 AS dias
        FROM Vulnerability v
        INNER JOIN AuditLog a
          ON a.entityId = v.id
         AND a.entityType = 'Vulnerability'
         AND a.action = 'STATUS_CHANGE'
         AND JSON_VALID(a.diffJson)
         AND JSON_UNQUOTE(JSON_EXTRACT(a.diffJson, '$.to')) = 'FIXED'
        WHERE v.companyId = ${companyId}
          AND v.createdAt >= ${de}
          AND v.createdAt <= ${ate}
        GROUP BY v.id, v.applicationId, v.createdAt
      ) t
      GROUP BY t.applicationId
    `;
    return linhas.map((l) => ({ applicationId: l.applicationId, dias: Number(l.dias) }));
  }

  /**
   * Data do finding mais antigo da aplicação — usada quando o período pedido é
   * "tudo". Sem isso, "tudo" precisaria de uma data inicial arbitrária.
   */
  async dataDoPrimeiroFinding(applicationId: string): Promise<Date | null> {
    const linha = await this.prisma.vulnerability.aggregate({
      where: { applicationId },
      _min: { createdAt: true },
    });
    return linha._min.createdAt ?? null;
  }

  /** Último dia SEM nenhum finding crítico criado — alimenta o insight positivo. */
  async diasSemCriticoNovo(applicationId: string, agora: Date): Promise<number | null> {
    const linha = await this.prisma.vulnerability.aggregate({
      where: { applicationId, severityFinal: "CRITICAL" },
      _max: { createdAt: true },
    });
    const ultimo = linha._max.createdAt;
    if (!ultimo) return null;
    return Math.floor((agora.getTime() - ultimo.getTime()) / 86_400_000);
  }
}
