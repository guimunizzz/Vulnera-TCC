/**
 * threat-intel.repository.ts
 *
 * Persistência da Threat Intel (ADR-053) além do inventário: catálogo global de
 * avisos, casamentos com o inventário (por empresa), execuções da
 * sincronização e quem recebe as notificações. Única camada com Prisma aqui.
 *
 * MULTI-TENANT
 * `ThreatAdvisory` é global (dado público, sem dono). `ThreatMatch` é da
 * empresa: toda leitura de casamento recebe `companyId`.
 */

import type { Prisma, PrismaClient, ThreatAdvisory, ThreatMatch, TechAsset, ThreatSyncRun, DastTriageStatus } from "@prisma/client";
import type { AvisoNormalizado, EntradaKev } from "../utils/threat-intel.util";

export type CasamentoCompleto = ThreatMatch & {
  advisory: ThreatAdvisory;
  asset: TechAsset;
  triagedBy: { name: string } | null;
  promotedVulnerability: { id: string; projectId: string; status: string } | null;
};

export interface FiltroCasamentos {
  companyId: string;
  triagem?: DastTriageStatus[];
  apenasKev?: boolean;
  severidades?: string[];
  incluirPreexistentes?: boolean;
  assetId?: string;
}

export interface NovoCasamento {
  companyId: string;
  assetId: string;
  advisoryId: string;
  versionConfirmed: boolean;
  preexisting: boolean;
  fixedVersion: string | null;
  kevNotifiedAt: Date | null;
}

const INCLUDE_CASAMENTO = {
  advisory: true,
  asset: true,
  triagedBy: { select: { name: true } },
  promotedVulnerability: { select: { id: true, projectId: true, status: true } },
} as const;

export class ThreatIntelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ==========================================================================
  // Catálogo de avisos
  // ==========================================================================

  /**
   * Grava avisos. Regras de precedência: o NVD é a fonte oficial da nota da
   * CVE — um aviso do OSV para uma CVE que já veio do NVD só acrescenta aliases.
   * KEV e EPSS nunca são sobrescritos aqui (têm passo próprio). Devolve quantos
   * avisos eram novos.
   */
  async gravarAvisos(avisos: AvisoNormalizado[], kev: Map<string, EntradaKev>): Promise<number> {
    if (avisos.length === 0) return 0;
    const unicos = [...new Map(avisos.map((a) => [a.id, a])).values()];
    const existentes = new Map(
      (await this.prisma.threatAdvisory.findMany({ where: { id: { in: unicos.map((a) => a.id) } }, select: { id: true, source: true, aliases: true, modifiedAt: true } })).map((e) => [e.id, e]),
    );

    const novos = unicos.filter((a) => !existentes.has(a.id));
    if (novos.length > 0) {
      await this.prisma.threatAdvisory.createMany({
        data: novos.map((a) => ({ ...this.colunas(a), ...this.colunasKev(kev.get(a.id)) })),
        skipDuplicates: true,
      });
    }

    for (const a of unicos) {
      const atual = existentes.get(a.id);
      if (!atual) continue;
      const aliases = [...new Set([...(Array.isArray(atual.aliases) ? (atual.aliases as string[]) : []), ...a.aliases])];
      if (a.source === "OSV" && atual.source === "NVD") {
        await this.prisma.threatAdvisory.update({ where: { id: a.id }, data: { aliases } });
        continue;
      }
      const mudou = !atual.modifiedAt || !a.modifiedAt || a.modifiedAt.getTime() !== atual.modifiedAt.getTime() || atual.source === "KEV";
      if (mudou) await this.prisma.threatAdvisory.update({ where: { id: a.id }, data: { ...this.colunas(a), aliases } });
    }
    return novos.length;
  }

  private colunas(a: AvisoNormalizado) {
    return {
      id: a.id,
      aliases: a.aliases,
      source: a.source,
      title: a.title,
      description: a.description,
      cvssScore: a.cvssScore,
      cvssVersion: a.cvssVersion,
      cvssVector: a.cvssVector,
      severity: a.severity,
      cweId: a.cweId,
      publishedAt: a.publishedAt,
      modifiedAt: a.modifiedAt,
      references: a.references,
    };
  }

  private colunasKev(e: EntradaKev | undefined) {
    return e ? { kev: true, kevAddedAt: e.adicionadaEm, kevDueDate: e.prazo, kevRansomware: e.ransomware } : {};
  }

  /**
   * Aplica o catálogo KEV: marca as CVEs já conhecidas que entraram nele e cria
   * um aviso mínimo para as adicionadas nos últimos `diasRecentes` (para o feed
   * mostrar "explorada ativamente" mesmo sem o NVD ter respondido). Devolve
   * quantas CVEs conhecidas viraram KEV agora.
   */
  async aplicarKev(entradas: EntradaKev[], diasRecentes: number, agora: Date): Promise<{ marcadas: number; criadas: number }> {
    if (entradas.length === 0) return { marcadas: 0, criadas: 0 };
    const porId = new Map(entradas.map((e) => [e.cveId, e]));
    const aMarcar = await this.prisma.threatAdvisory.findMany({ where: { id: { in: [...porId.keys()] }, kev: false }, select: { id: true } });
    for (const { id } of aMarcar) await this.prisma.threatAdvisory.update({ where: { id }, data: this.colunasKev(porId.get(id)) });

    const corte = new Date(agora.getTime() - diasRecentes * 24 * 3600_000);
    const recentes = entradas.filter((e) => e.adicionadaEm && e.adicionadaEm >= corte);
    let criadas = 0;
    if (recentes.length > 0) {
      const r = await this.prisma.threatAdvisory.createMany({
        data: recentes.map((e) => ({ id: e.cveId, source: "KEV", title: e.nome, description: e.descricao, aliases: [], references: [], ...this.colunasKev(e) })),
        skipDuplicates: true,
      });
      criadas = r.count;
    }
    return { marcadas: aMarcar.length, criadas };
  }

  /** CVEs envolvidas em casamentos cujo EPSS está ausente ou velho. */
  async cvesSemEpssRecente(antesDe: Date, limite: number): Promise<string[]> {
    const linhas = await this.prisma.threatAdvisory.findMany({
      where: { id: { startsWith: "CVE-" }, matches: { some: {} }, OR: [{ epssAt: null }, { epssAt: { lt: antesDe } }] },
      select: { id: true },
      take: limite,
    });
    return linhas.map((l) => l.id);
  }

  async gravarEpss(notas: Map<string, { score: number; percentil: number }>, quando: Date): Promise<void> {
    for (const [id, n] of notas) {
      await this.prisma.threatAdvisory.updateMany({ where: { id }, data: { epssScore: n.score, epssPercentile: n.percentil, epssAt: quando } });
    }
  }

  async avisosPorIds(ids: string[]): Promise<ThreatAdvisory[]> {
    if (ids.length === 0) return [];
    return this.prisma.threatAdvisory.findMany({ where: { id: { in: ids } } });
  }

  // ==========================================================================
  // Casamentos
  // ==========================================================================

  /** Cria os casamentos que ainda não existem (asset + aviso); devolve quantos eram novos. */
  async criarCasamentos(novos: NovoCasamento[]): Promise<number> {
    if (novos.length === 0) return 0;
    const r = await this.prisma.threatMatch.createMany({ data: novos, skipDuplicates: true });
    return r.count;
  }

  async atualizarVersaoCorrigida(assetId: string, advisoryId: string, fixedVersion: string | null): Promise<void> {
    if (!fixedVersion) return;
    await this.prisma.threatMatch.updateMany({ where: { assetId, advisoryId, fixedVersion: null }, data: { fixedVersion } });
  }

  async listarCasamentos(f: FiltroCasamentos): Promise<CasamentoCompleto[]> {
    return this.prisma.threatMatch.findMany({
      where: this.whereCasamentos(f),
      include: INCLUDE_CASAMENTO,
      orderBy: [{ advisory: { kev: "desc" } }, { advisory: { cvssScore: { sort: "desc", nulls: "last" } } }, { createdAt: "desc" }],
      take: 1000,
    });
  }

  private whereCasamentos(f: FiltroCasamentos): Prisma.ThreatMatchWhereInput {
    return {
      companyId: f.companyId,
      ...(f.assetId ? { assetId: f.assetId } : {}),
      ...(f.triagem?.length ? { triageStatus: { in: f.triagem } } : {}),
      ...(f.incluirPreexistentes === false ? { preexisting: false } : {}),
      asset: { status: "CONFIRMED" },
      ...(f.apenasKev || f.severidades?.length
        ? { advisory: { ...(f.apenasKev ? { kev: true } : {}), ...(f.severidades?.length ? { severity: { in: f.severidades } } : {}) } }
        : {}),
    };
  }

  /**
   * Contagens do resumo da empresa: por triagem, críticas/altas em aberto, KEV, novas na semana,
   * abertas por severidade e quantas tecnologias têm alguma CVE em aberto.
   */
  async resumoDeCasamentos(companyId: string): Promise<{
    porTriagem: Record<string, number>;
    kevAbertos: number;
    criticosAbertos: number;
    novosSemana: number;
    abertosPorSeveridade: Record<string, number>;
    tecnologiasAfetadas: number;
  }> {
    const base = { companyId, asset: { status: "CONFIRMED" } };
    const abertos = { ...base, triageStatus: { in: ["NEW", "CONFIRMED"] as DastTriageStatus[] } };
    const semana = new Date(Date.now() - 7 * 24 * 3600_000);
    const [linhas, kevAbertos, criticosAbertos, novosSemana, abertas] = await Promise.all([
      this.prisma.threatMatch.groupBy({ by: ["triageStatus"], where: base, _count: { _all: true } }),
      this.prisma.threatMatch.count({ where: { ...abertos, advisory: { kev: true } } }),
      this.prisma.threatMatch.count({ where: { ...abertos, advisory: { severity: { in: ["CRITICAL", "HIGH"] } } } }),
      this.prisma.threatMatch.count({ where: { ...base, preexisting: false, createdAt: { gte: semana } } }),
      // groupBy do Prisma não agrupa por campo de relação (advisory.severity): lê só as duas colunas.
      // shortcut: agrega em memória; trocar por SQL agrupado se a empresa passar de dezenas de milhares de CVEs abertas.
      this.prisma.threatMatch.findMany({ where: abertos, select: { assetId: true, advisory: { select: { severity: true } } } }),
    ]);
    const abertosPorSeveridade: Record<string, number> = {};
    for (const a of abertas) {
      const s = a.advisory.severity ?? "NONE";
      abertosPorSeveridade[s] = (abertosPorSeveridade[s] ?? 0) + 1;
    }
    return {
      porTriagem: Object.fromEntries(linhas.map((l) => [l.triageStatus, l._count._all])),
      kevAbertos,
      criticosAbertos,
      novosSemana,
      abertosPorSeveridade,
      tecnologiasAfetadas: new Set(abertas.map((a) => a.assetId)).size,
    };
  }

  async buscarCasamento(id: string): Promise<CasamentoCompleto | null> {
    return this.prisma.threatMatch.findUnique({ where: { id }, include: INCLUDE_CASAMENTO });
  }

  async triar(id: string, dados: { triageStatus: DastTriageStatus; triageNote: string | null; triagedById: string; triagedAt: Date }): Promise<CasamentoCompleto> {
    return this.prisma.threatMatch.update({ where: { id }, data: dados, include: INCLUDE_CASAMENTO });
  }

  /** Avisos do inventário confirmado da empresa, para o "afeta você" do feed. */
  async avisosQueAfetam(companyId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const linhas = await this.prisma.threatMatch.findMany({
      where: { companyId, advisoryId: { in: ids }, asset: { status: "CONFIRMED" } },
      select: { advisoryId: true },
      distinct: ["advisoryId"],
    });
    return new Set(linhas.map((l) => l.advisoryId));
  }

  /**
   * Candidatos a notificação: casamento novo ainda não avisado (e não
   * pré-existente) ou aviso que virou KEV sem o evento ter sido tratado. A
   * decisão final é da função pura `eventosQueNotificam`.
   */
  async candidatosANotificar(): Promise<(ThreatMatch & { advisory: ThreatAdvisory; asset: TechAsset })[]> {
    return this.prisma.threatMatch.findMany({
      where: {
        asset: { status: "CONFIRMED" },
        OR: [{ notifiedAt: null, preexisting: false }, { kevNotifiedAt: null, advisory: { kev: true } }],
      },
      include: { advisory: true, asset: true },
      take: 5000,
    });
  }

  async marcarNotificados(ids: string[], quando: Date): Promise<void> {
    if (ids.length) await this.prisma.threatMatch.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: quando } });
  }

  async marcarKevTratado(ids: string[], quando: Date): Promise<void> {
    if (ids.length) await this.prisma.threatMatch.updateMany({ where: { id: { in: ids } }, data: { kevNotifiedAt: quando } });
  }

  // ==========================================================================
  // Feed
  // ==========================================================================

  async feed(desde: Date, filtro: { apenasKev?: boolean; severidades?: string[] }, limite: number): Promise<ThreatAdvisory[]> {
    return this.prisma.threatAdvisory.findMany({
      where: {
        ...(filtro.apenasKev ? { kev: true, kevAddedAt: { gte: desde } } : { OR: [{ publishedAt: { gte: desde } }, { kev: true, kevAddedAt: { gte: desde } }] }),
        ...(filtro.severidades?.length ? { severity: { in: filtro.severidades } } : {}),
      },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { kevAddedAt: { sort: "desc", nulls: "last" } }],
      take: limite,
    });
  }

  // ==========================================================================
  // Execuções da sincronização
  // ==========================================================================

  async iniciarExecucao(trigger: string): Promise<ThreatSyncRun> {
    return this.prisma.threatSyncRun.create({ data: { trigger, status: "RUNNING" } });
  }

  async concluirExecucao(id: string, dados: Prisma.ThreatSyncRunUpdateInput): Promise<ThreatSyncRun> {
    return this.prisma.threatSyncRun.update({ where: { id }, data: dados });
  }

  async execucaoEmAndamento(desde: Date): Promise<ThreatSyncRun | null> {
    return this.prisma.threatSyncRun.findFirst({ where: { status: "RUNNING", startedAt: { gte: desde } }, orderBy: { startedAt: "desc" } });
  }

  /** Execução órfã (processo reiniciado no meio) vira FAILED, como o watchdog do DAST. */
  async encerrarOrfas(antesDe: Date): Promise<number> {
    const r = await this.prisma.threatSyncRun.updateMany({
      where: { status: "RUNNING", startedAt: { lt: antesDe } },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: "interrompida (o servidor reiniciou no meio)" },
    });
    return r.count;
  }

  /** A última execução completa (agendada ou manual) já encerrada — a "saúde das fontes" do cabeçalho. */
  async ultimaExecucaoCompleta(): Promise<ThreatSyncRun | null> {
    return this.prisma.threatSyncRun.findFirst({
      where: { trigger: { in: ["SCHEDULED", "MANUAL"] }, status: { not: "RUNNING" } },
      orderBy: { startedAt: "desc" },
    });
  }

  async ultimasExecucoes(limite: number): Promise<ThreatSyncRun[]> {
    return this.prisma.threatSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: limite });
  }

  /** A última execução de cursor do feed do NVD (onde a janela de publicação parou). */
  async ultimaExecucaoComFeedNvd(): Promise<ThreatSyncRun | null> {
    return this.prisma.threatSyncRun.findFirst({
      where: { status: { in: ["OK", "PARTIAL"] }, trigger: { in: ["SCHEDULED", "MANUAL"] } },
      orderBy: { startedAt: "desc" },
    });
  }

  // ==========================================================================
  // Destinatários (D19.6: "todos")
  // ==========================================================================

  /**
   * Quem recebe a notificação de uma empresa: os ADMIN da plataforma, os CLIENT
   * da empresa e os PENTESTER membros de algum projeto dela.
   */
  async destinatarios(companyId: string): Promise<string[]> {
    const linhas = await this.prisma.user.findMany({
      where: {
        deactivatedAt: null,
        OR: [
          { role: "ADMIN" },
          { role: "CLIENT", companyId },
          { role: "PENTESTER", projectMembers: { some: { project: { companyId } } } },
        ],
      },
      select: { id: true },
    });
    return linhas.map((l) => l.id);
  }

  /** Empresas em que o PENTESTER é membro de algum projeto (o escopo dele na Threat Intel). */
  async empresasDoPentester(userId: string): Promise<{ id: string; name: string }[]> {
    return this.prisma.company.findMany({
      where: { projects: { some: { members: { some: { userId } } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async empresas(ids?: string[]): Promise<{ id: string; name: string }[]> {
    return this.prisma.company.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } });
  }

  async pentesterEhMembroDaEmpresa(userId: string, companyId: string): Promise<boolean> {
    const n = await this.prisma.projectMember.count({ where: { userId, project: { companyId } } });
    return n > 0;
  }
}

