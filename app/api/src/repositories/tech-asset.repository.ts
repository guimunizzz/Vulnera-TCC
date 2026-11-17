/**
 * tech-asset.repository.ts
 *
 * Persistência do inventário de tecnologias da empresa (Threat Intel, ADR-053).
 * Única camada que fala com o Prisma sobre `TechAsset`. Todas as consultas de
 * leitura por empresa recebem `companyId` — o service já decidiu qual empresa o
 * ator pode ver; aqui é a segunda barreira.
 */

import type { Prisma, PrismaClient, TechAsset } from "@prisma/client";

export interface NovoAtivo {
  companyId: string;
  kind: string;
  ecosystem?: string | null;
  packageName?: string | null;
  cpePart?: string | null;
  cpeVendor?: string | null;
  cpeProduct?: string | null;
  version: string | null;
  displayName: string;
  status: string;
  source: string;
  sourceRef?: string | null;
  identityKey: string;
  createdById?: string | null;
  confirmedAt?: Date | null;
}

export type AtivoComContagem = TechAsset & { _count: { matches: number } };

export class TechAssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(companyId: string, status: string[]): Promise<AtivoComContagem[]> {
    return this.prisma.techAsset.findMany({
      where: { companyId, status: { in: status } },
      include: { _count: { select: { matches: true } } },
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
    });
  }

  async contarPorStatus(companyId: string): Promise<Record<string, number>> {
    const linhas = await this.prisma.techAsset.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } });
    return Object.fromEntries(linhas.map((l) => [l.status, l._count._all]));
  }

  async buscarPorId(id: string): Promise<TechAsset | null> {
    return this.prisma.techAsset.findUnique({ where: { id } });
  }

  async buscarPorIdentidade(companyId: string, identityKey: string): Promise<TechAsset | null> {
    return this.prisma.techAsset.findUnique({ where: { companyId_identityKey: { companyId, identityKey } } });
  }

  async criar(dados: NovoAtivo): Promise<TechAsset> {
    return this.prisma.techAsset.create({ data: dados });
  }

  /** Sugestões em lote; a chave única (empresa + identidade) descarta o que já existe em qualquer status. */
  async criarSugestoes(dados: NovoAtivo[]): Promise<number> {
    if (dados.length === 0) return 0;
    const r = await this.prisma.techAsset.createMany({ data: dados, skipDuplicates: true });
    return r.count;
  }

  async atualizar(id: string, dados: Prisma.TechAssetUpdateInput): Promise<TechAsset> {
    return this.prisma.techAsset.update({ where: { id }, data: dados });
  }

  async remover(id: string): Promise<void> {
    await this.prisma.techAsset.delete({ where: { id } });
  }

  async confirmarSugestoes(companyId: string, agora: Date): Promise<string[]> {
    const pendentes = await this.prisma.techAsset.findMany({ where: { companyId, status: "SUGGESTED" }, select: { id: true } });
    if (pendentes.length === 0) return [];
    await this.prisma.techAsset.updateMany({
      where: { id: { in: pendentes.map((p) => p.id) } },
      data: { status: "CONFIRMED", confirmedAt: agora },
    });
    return pendentes.map((p) => p.id);
  }

  /** Confirmados de TODAS as empresas — a sincronização agrupa por identidade e consulta uma vez. */
  async confirmados(ids?: string[]): Promise<TechAsset[]> {
    return this.prisma.techAsset.findMany({ where: { status: "CONFIRMED", ...(ids ? { id: { in: ids } } : {}) } });
  }

  /** Aplicações ativas com URL — o fingerprint do DAST só sugere para a empresa dona do host escaneado. */
  async aplicacoesComUrl(): Promise<{ companyId: string; url: string }[]> {
    const linhas = await this.prisma.application.findMany({ where: { isActive: true, url: { not: null } }, select: { companyId: true, url: true } });
    return linhas.flatMap((l) => (l.url ? [{ companyId: l.companyId, url: l.url }] : []));
  }

  async marcarSincronizados(ids: string[], quando: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.techAsset.updateMany({ where: { id: { in: ids } }, data: { lastSyncedAt: quando } });
  }
}
