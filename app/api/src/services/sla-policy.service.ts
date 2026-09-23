/**
 * sla-policy.service.ts
 *
 * Regras de negócio da política de SLA (CP-2).
 *
 * ==========================================================================
 * TRÊS OPERAÇÕES, E O QUE CADA UMA NÃO FAZ
 * ==========================================================================
 *
 * resolveFor(companyId)  — a política que VALE para a empresa: a dela, se
 *                          tiver; senão a padrão do produto; senão a janela
 *                          hardcoded DEFAULT_SLA_WINDOW. Nunca devolve null.
 *
 * upsert(...)            — "alterar" a política = desativar a atual e criar
 *                          uma versão nova. NÃO toca em nenhuma Vulnerability:
 *                          quem já tem prazo mantém o prazo (é o que impede
 *                          "consertar" um estouro afrouxando a regra).
 *
 * applyToOpen(...)       — a exceção EXPLÍCITA: ADMIN manda recalcular o prazo
 *                          dos findings OPEN/IN_PROGRESS da empresa com a
 *                          política ativa, mantendo o slaStartedAt de cada um.
 *                          Auditado como SLA_POLICY_APPLIED com a contagem.
 *                          Nunca toca FIXED/CLOSED (D1: não inventar
 *                          conformidade histórica).
 *
 * RBAC (docs/DECISIONS.md): ver política — ADMIN qualquer, CLIENT a própria;
 * definir — ADMIN qualquer, CLIENT OWNER a própria; reaplicar — só ADMIN.
 * PENTESTER não alcança nada aqui. `companyRole` é lido do banco, não do JWT.
 */

import type { SlaPolicyRepository } from "../repositories/sla-policy.repository";
import type { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { CompanyRepository } from "../repositories/company.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import {
  DEFAULT_SLA_WINDOW,
  SLA_DAYS_MAX,
  SLA_DAYS_MIN,
  SlaPolicyEntity,
  type SlaPolicy,
  type UpsertSlaPolicyDTO,
} from "../models/sla-policy.model";
import { computeSlaCycle, shiftSlaCycle, type SlaWindow } from "../utils/sla.util";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/** O que `resolveFor` devolve: a janela E de onde ela veio (para o slaPolicyId do finding). */
export interface ResolvedSlaPolicy {
  window: SlaWindow;
  /** null quando caiu no DEFAULT_SLA_WINDOW hardcoded (banco sem política padrão). */
  policyId: string | null;
  source: "COMPANY" | "PRODUCT_DEFAULT" | "HARDCODED";
}

export class SlaPolicyService {
  constructor(
    private readonly repository: SlaPolicyRepository,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly userRepository: UserRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /**
   * A política que vale para a empresa agora. É o que todo caminho que
   * CALCULA um prazo (criar finding, promover DAST, reabrir, recalcular)
   * chama — por isso nunca devolve null: sem política nenhuma, vale a janela
   * padrão em código, e o finding fica com slaPolicyId null (rastreável).
   */
  async resolveFor(companyId: string): Promise<ResolvedSlaPolicy> {
    const own = await this.repository.findActiveByCompany(companyId);
    if (own) return { window: new SlaPolicyEntity(own).window(), policyId: own.id, source: "COMPANY" };

    const def = await this.repository.findDefault();
    if (def) return { window: new SlaPolicyEntity(def).window(), policyId: def.id, source: "PRODUCT_DEFAULT" };

    return { window: DEFAULT_SLA_WINDOW, policyId: null, source: "HARDCODED" };
  }

  /** GET — a política vigente para a empresa (a dela ou a padrão), com o RBAC de leitura. */
  async getForCompany(actor: Actor, companyId: string): Promise<SlaPolicyEntity> {
    await this.assertCanView(actor, companyId);
    const own = await this.repository.findActiveByCompany(companyId);
    if (own) return new SlaPolicyEntity(own);
    const def = await this.repository.findDefault();
    if (def) return new SlaPolicyEntity(def);
    // Sem nada no banco: devolve a janela hardcoded como se fosse a padrão,
    // com id vazio — a UI mostra os números e sabe que ninguém os definiu.
    return new SlaPolicyEntity({
      id: "",
      companyId: null,
      name: "Padrão do produto",
      ...DEFAULT_SLA_WINDOW,
      isActive: true,
      createdBy: "system",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as SlaPolicy);
  }

  /** Histórico de versões da empresa — para a tela de configuração mostrar o que já valeu. */
  async history(actor: Actor, companyId: string): Promise<SlaPolicyEntity[]> {
    await this.assertCanView(actor, companyId);
    return (await this.repository.findAllByCompany(companyId)).map((p) => new SlaPolicyEntity(p));
  }

  /**
   * PUT — versiona: desativa a ativa e cria a nova. NÃO recalcula finding
   * nenhum (ver cabeçalho). Auditado como SlaPolicy/CREATE com a versão
   * anterior no diff, para a trilha contar "de 7 para 5 dias em HIGH".
   */
  async upsert(actor: Actor, companyId: string, dto: UpsertSlaPolicyDTO): Promise<SlaPolicyEntity> {
    await this.assertCanDefine(actor, companyId);
    validarJanela(dto);

    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const { anterior, created } = await this.repository.replaceActiveForCompany(companyId, {
      companyId,
      name: dto.name?.trim() || `Política de ${company.name}`,
      criticalDays: dto.criticalDays,
      highDays: dto.highDays,
      mediumDays: dto.mediumDays,
      lowDays: dto.lowDays,
      createdBy: actor.userId,
    });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId,
      entityType: "SlaPolicy",
      entityId: created.id,
      action: anterior ? "UPDATE" : "CREATE",
      diffJson: JSON.stringify({
        from: anterior ? new SlaPolicyEntity(anterior).window() : null,
        to: new SlaPolicyEntity(created).window(),
        supersedes: anterior?.id ?? null,
      }),
    });

    return new SlaPolicyEntity(created);
  }

  /**
   * POST /apply — recalcula o prazo dos findings ATIVOS da empresa com a
   * política vigente. Mantém o slaStartedAt de cada um (quem está aberto há
   * 40 dias continua aberto há 40 dias); só a janela muda. Findings sem SLA
   * (slaStartedAt null — anteriores ao backfill) GANHAM um, contado do
   * createdAt: é a mesma regra do backfill (D1).
   *
   * Só ADMIN: é a única operação que reescreve prazos em massa, e é
   * justamente por isso que ela existe separada do PUT.
   */
  async applyToOpen(actor: Actor, companyId: string): Promise<{ recalculated: number; policyId: string | null }> {
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const resolved = await this.resolveFor(companyId);
    const abertos = await this.vulnerabilityRepository.findActiveByCompany(companyId);

    let recalculated = 0;
    for (const v of abertos) {
      const inicio = v.slaStartedAt ?? v.createdAt;
      const ciclo = computeSlaCycle(inicio, resolved.window, v.severityFinal);
      // Reaplicar a política troca a janela, não desfaz a pausa histórica do
      // aceite: o prazo novo precisa carregar todo o tempo já congelado.
      const empurrado = ciclo ? shiftSlaCycle(ciclo, v.slaPausedMs) : null;
      await this.vulnerabilityRepository.updateSla(v.id, {
        slaStartedAt: inicio,
        slaDueAt: empurrado?.slaDueAt ?? null,
        slaDueSoonAt: empurrado?.slaDueSoonAt ?? null,
        slaPausedMs: v.slaPausedMs,
        slaPolicyId: resolved.policyId,
      });
      recalculated++;
    }

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId,
      entityType: "SlaPolicy",
      entityId: resolved.policyId ?? "hardcoded-default",
      action: "SLA_POLICY_APPLIED",
      diffJson: JSON.stringify({ recalculated, window: resolved.window, source: resolved.source }),
    });

    return { recalculated, policyId: resolved.policyId };
  }

  /** ADMIN qualquer; CLIENT só a própria empresa (companyId do BANCO, não do token). */
  private async assertCanView(actor: Actor, companyId: string): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId === companyId) return;
    }
    throw new Error("FORBIDDEN");
  }

  /** ADMIN qualquer; CLIENT OWNER a própria. MEMBER não define prazos (é governança). */
  private async assertCanDefine(actor: Actor, companyId: string): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId === companyId && user.companyRole === "OWNER") return;
    }
    throw new Error("FORBIDDEN");
  }
}

/** Sanidade dos quatro prazos — inteiros entre 1 e 365 dias. */
function validarJanela(dto: UpsertSlaPolicyDTO): void {
  for (const dias of [dto.criticalDays, dto.highDays, dto.mediumDays, dto.lowDays]) {
    if (!Number.isInteger(dias) || dias < SLA_DAYS_MIN || dias > SLA_DAYS_MAX) throw new Error("INVALID_SLA_DAYS");
  }
}
