/**
 * risk-acceptance.service.ts
 *
 * O workflow formal de aceite de risco (CP-4 — docs/DECISIONS.md D10).
 *
 * ==========================================================================
 * AS QUATRO REGRAS QUE NÃO SE NEGOCIAM
 * ==========================================================================
 *
 * 1. A VULNERABILITY NUNCA MUDA. Nenhum caminho deste service escreve em
 *    `Vulnerability.status`, `severityFinal` ou `vrsScore`. O finding continua
 *    tecnicamente aberto enquanto o risco é aceito — é o que distingue
 *    "decidimos conviver" de "está resolvido". O aceite influencia o SLA por
 *    LEITURA (estado ACCEPTED) e, no fim da pausa, por um deslocamento de
 *    prazo que é aritmética, não mudança de estado do finding.
 *
 * 2. SEGREGAÇÃO DE FUNÇÃO. `requestedById !== reviewedById`, sempre,
 *    inclusive para ADMIN. Quem pede não assina. Sem isso "aprovação" é só um
 *    campo a mais no formulário.
 *
 * 3. `companyRole` VEM DO BANCO, NUNCA DO JWT. O token carrega só
 *    {userId, role} (CLAUDE.md §8); um refresh desatualizado não pode
 *    conceder alçada de OWNER. Mesma razão do `companyId`.
 *
 * 4. IMUTÁVEL DEPOIS DA DECISÃO. Não existe update de `reason`,
 *    `businessJustification`, `reviewNote` ou `expiresAt`. Estender prazo é
 *    pedir de novo; encerrar antes é revogar. É o que fecha o vetor
 *    "expiração manipulável".
 *
 * ==========================================================================
 * EXPIRAÇÃO PREGUIÇOSA (sem scheduler — ADR-030)
 * ==========================================================================
 * Não há cron no projeto e não vamos criar um. Um APPROVED com `expiresAt` no
 * passado é LIDO como EXPIRED em qualquer caminho; a primeira escrita que
 * perceber consolida com `updateMany` condicional. Como o WHERE carrega
 * `status = 'APPROVED' AND expiresAt < now`, duas requisições concorrentes
 * produzem um `count: 1` e um `count: 0` — e só quem alterou a linha grava o
 * AuditLog. É o que impede evento duplicado sob concorrência.
 *
 * RBAC (D10)
 *   solicitar         ADMIN · CLIENT OWNER · PENTESTER membro do projeto
 *   aprovar/rejeitar  ADMIN · CLIENT OWNER da empresa — NUNCA PENTESTER
 *   revogar           ADMIN · CLIENT OWNER da empresa
 *   ver               quem já podia ver o finding
 */

import type { RiskAcceptanceRepository } from "../repositories/risk-acceptance.repository";
import type { EscopoDeAcesso, VulnerabilityRepository } from "../repositories/vulnerability.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import {
  isAcceptanceActive,
  RISK_ACCEPTANCE_FIELD_LIMITS,
  RISK_ACCEPTANCE_MAX_DAYS,
  RiskAcceptanceEntity,
  type ApproveRiskAcceptanceDTO,
  type CreateRiskAcceptanceDTO,
  type RejectRiskAcceptanceDTO,
  type RevokeRiskAcceptanceDTO,
  type RiskAcceptance,
} from "../models/risk-acceptance.model";
import { DIA_MS, shiftSlaCycle } from "../utils/sla.util";
import type { UserRole } from "../models/user.model";
import type { Vulnerability } from "@prisma/client";

interface Actor {
  userId: string;
  role: UserRole;
}

export class RiskAcceptanceService {
  constructor(
    private readonly repository: RiskAcceptanceRepository,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /* ======================================================================
     Leitura
     ====================================================================== */

  /** Histórico completo do finding. Normaliza expirados antes de responder. */
  async listByVulnerability(actor: Actor, vulnerabilityId: string) {
    const vulnerability = await this.vulnerabilityRepository.findById(vulnerabilityId);
    if (!vulnerability) throw new Error("VULNERABILITY_NOT_FOUND");
    await this.assertCanView(actor, vulnerability);

    await this.normalizeExpired(vulnerabilityId);

    const now = new Date();
    const registros = await this.repository.findByVulnerability(vulnerabilityId);
    return registros.map((r) => new RiskAcceptanceEntity(r, now).toResponse());
  }

  /* ======================================================================
     Solicitação
     ====================================================================== */

  async request(actor: Actor, vulnerabilityId: string, dto: CreateRiskAcceptanceDTO) {
    const vulnerability = await this.vulnerabilityRepository.findById(vulnerabilityId);
    if (!vulnerability) throw new Error("VULNERABILITY_NOT_FOUND");
    await this.assertCanRequest(actor, vulnerability);

    validarTexto(dto.reason, RISK_ACCEPTANCE_FIELD_LIMITS.reasonMin, RISK_ACCEPTANCE_FIELD_LIMITS.reasonMax, "INVALID_REASON");
    validarTexto(
      dto.businessJustification,
      RISK_ACCEPTANCE_FIELD_LIMITS.justificationMin,
      RISK_ACCEPTANCE_FIELD_LIMITS.justificationMax,
      "INVALID_BUSINESS_JUSTIFICATION",
    );
    if (dto.compensatingControls != null && dto.compensatingControls.length > RISK_ACCEPTANCE_FIELD_LIMITS.compensatingControlsMax) {
      throw new Error("INVALID_COMPENSATING_CONTROLS");
    }

    const now = new Date();
    if (dto.requestedExpiresAt) {
      if (dto.requestedExpiresAt.getTime() <= now.getTime()) throw new Error("INVALID_EXPIRES_AT");
      if (dto.requestedExpiresAt.getTime() > now.getTime() + RISK_ACCEPTANCE_MAX_DAYS * DIA_MS) {
        throw new Error("INVALID_EXPIRES_AT");
      }
    }

    // Normaliza um APPROVED vencido ANTES de decidir se há conflito: um aceite
    // que já venceu não deve impedir um pedido novo só porque ninguém leu a
    // linha desde então.
    await this.normalizeExpired(vulnerabilityId);
    const created = await this.repository.createIfNoActive({
      vulnerabilityId,
      companyId: vulnerability.companyId, // RN09 — desnormalizado, nunca do cliente
      reason: dto.reason.trim(),
      businessJustification: dto.businessJustification.trim(),
      compensatingControls: dto.compensatingControls?.trim() || null,
      requestedById: actor.userId,
      requestedExpiresAt: dto.requestedExpiresAt ?? null,
    });
    if (!created) throw new Error("RISK_ACCEPTANCE_ALREADY_ACTIVE");

    await this.audit(actor, created, "RISK_ACCEPTANCE_REQUESTED", {
      vulnerabilityId,
      reason: created.reason,
      requestedExpiresAt: created.requestedExpiresAt,
    });

    return this.responseOf(created.id);
  }

  /* ======================================================================
     Decisão
     ====================================================================== */

  async approve(actor: Actor, id: string, dto: ApproveRiskAcceptanceDTO) {
    const { acceptance, vulnerability } = await this.loadForDecision(actor, id);
    if (acceptance.status !== "REQUESTED") throw new Error("INVALID_STATUS_TRANSITION");

    // Segregação de função — vale para ADMIN também.
    if (acceptance.requestedById === actor.userId) throw new Error("CANNOT_APPROVE_OWN_REQUEST");

    const now = new Date();
    if (dto.expiresAt.getTime() <= now.getTime()) throw new Error("INVALID_EXPIRES_AT");
    if (dto.expiresAt.getTime() > now.getTime() + RISK_ACCEPTANCE_MAX_DAYS * DIA_MS) throw new Error("INVALID_EXPIRES_AT");
    // O aprovador pode ENCURTAR o prazo pedido, nunca alongá-lo em silêncio:
    // quem pediu 30 dias não deve descobrir depois que assinaram 300.
    if (acceptance.requestedExpiresAt && dto.expiresAt.getTime() > acceptance.requestedExpiresAt.getTime()) {
      throw new Error("EXPIRES_AT_EXCEEDS_REQUESTED");
    }
    if (dto.reviewNote != null && dto.reviewNote.length > RISK_ACCEPTANCE_FIELD_LIMITS.reviewNoteMax) {
      throw new Error("INVALID_REVIEW_NOTE");
    }

    const count = await this.repository.approve(id, {
      reviewedById: actor.userId,
      reviewedAt: now,
      expiresAt: dto.expiresAt,
      reviewNote: dto.reviewNote?.trim() || null,
    });
    if (count === 0) throw new Error("INVALID_STATUS_TRANSITION"); // alguém decidiu antes

    await this.audit(actor, acceptance, "RISK_ACCEPTANCE_APPROVED", {
      vulnerabilityId: vulnerability.id,
      approvedBy: actor.userId,
      requestedBy: acceptance.requestedById,
      expiresAt: dto.expiresAt,
      reviewNote: dto.reviewNote ?? null,
    });

    return this.responseOf(id);
  }

  async reject(actor: Actor, id: string, dto: RejectRiskAcceptanceDTO) {
    const { acceptance, vulnerability } = await this.loadForDecision(actor, id);
    if (acceptance.status !== "REQUESTED") throw new Error("INVALID_STATUS_TRANSITION");
    if (acceptance.requestedById === actor.userId) throw new Error("CANNOT_APPROVE_OWN_REQUEST");

    validarTexto(dto.reviewNote, 1, RISK_ACCEPTANCE_FIELD_LIMITS.reviewNoteMax, "MISSING_REVIEW_NOTE");

    const now = new Date();
    const count = await this.repository.reject(id, {
      reviewedById: actor.userId,
      reviewedAt: now,
      reviewNote: dto.reviewNote.trim(),
    });
    if (count === 0) throw new Error("INVALID_STATUS_TRANSITION");

    await this.audit(actor, acceptance, "RISK_ACCEPTANCE_REJECTED", {
      vulnerabilityId: vulnerability.id,
      rejectedBy: actor.userId,
      reviewNote: dto.reviewNote,
    });

    return this.responseOf(id);
  }

  /**
   * Revogação — encerra um aceite vigente ANTES do prazo. O tempo que o
   * relógio ficou parado é devolvido ao SLA (ver `encerrarPausa`).
   */
  async revoke(actor: Actor, id: string, dto: RevokeRiskAcceptanceDTO) {
    const { acceptance, vulnerability } = await this.loadForDecision(actor, id);
    if (acceptance.status !== "APPROVED") throw new Error("INVALID_STATUS_TRANSITION");

    validarTexto(
      dto.reason,
      RISK_ACCEPTANCE_FIELD_LIMITS.revokeReasonMin,
      RISK_ACCEPTANCE_FIELD_LIMITS.revokeReasonMax,
      "INVALID_REASON",
    );

    const now = new Date();
    const count = await this.repository.revoke(id, {
      revokedById: actor.userId,
      revokedAt: now,
      revokeReason: dto.reason.trim(),
    });
    if (count === 0) throw new Error("INVALID_STATUS_TRANSITION");

    const pausedMs = await this.encerrarPausa(vulnerability, acceptance, now);

    await this.audit(actor, acceptance, "RISK_ACCEPTANCE_REVOKED", {
      vulnerabilityId: vulnerability.id,
      revokedBy: actor.userId,
      reason: dto.reason,
      pausedMs,
    });

    return this.responseOf(id);
  }

  /* ======================================================================
     Expiração preguiçosa
     ====================================================================== */

  /**
   * Consolida aceites APROVADOS já vencidos de um finding. Devolve quantos
   * foram efetivamente expirados POR ESTA CHAMADA — sob concorrência, o
   * perdedor recebe 0 e não audita nada.
   *
   * Chamado por todo caminho de leitura/escrita que depende do estado do
   * aceite. É barato: a consulta é indexada por `[status, expiresAt]` e, no
   * caso comum (nada vencido), não escreve nada.
   */
  async normalizeExpired(vulnerabilityId: string): Promise<number> {
    const now = new Date();
    const vencidos = await this.repository.findExpiredApproved([vulnerabilityId], now);
    return this.normalizarExpirados(vencidos, now);
  }

  /**
   * Normaliza somente findings no escopo já resolvido do ator.
   *
   * `normalizarExpirados` também busca cada Vulnerability para atualizar a
   * pausa do SLA; a lista inicial, entretanto, já foi limitada por company ou
   * membership, então essa escrita não cruza tenant antes de autorização.
   */
  async normalizeExpiredForScope(scope: EscopoDeAcesso): Promise<number> {
    const now = new Date();
    const vencidos = await this.repository.findExpiredApprovedForScope(scope, now);
    return this.normalizarExpirados(vencidos, now);
  }

  private async normalizarExpirados(vencidos: RiskAcceptance[], now: Date): Promise<number> {
    let expirados = 0;

    for (const ra of vencidos) {
      const count = await this.repository.expire(ra.id, now);
      if (count === 0) continue; // outro request chegou antes — ele audita, não nós

      const vulnerability = await this.vulnerabilityRepository.findById(ra.vulnerabilityId);
      const pausedMs = vulnerability ? await this.encerrarPausa(vulnerability, ra, ra.expiresAt ?? now) : 0;

      await this.auditSystem(ra, "RISK_ACCEPTANCE_EXPIRED", {
        vulnerabilityId: ra.vulnerabilityId,
        expiresAt: ra.expiresAt,
        pausedMs,
      });
      expirados++;
    }
    return expirados;
  }

  /* ======================================================================
     Integração com o SLA (CP-2)
     ====================================================================== */

  /**
   * Fecha a janela de pausa e devolve o tempo ao relógio.
   *
   * O intervalo é `fim - reviewedAt` (a aprovação é o início canônico da
   * pausa). Ele é somado a `slaPausedMs` — que existe para EXPLICAR quanto do
   * prazo veio de pausa — e as duas datas do ciclo são empurradas para frente
   * pelo mesmo tanto. Assim `slaDueAt < agora` continua significando
   * "estourou", sem nenhuma aritmética na leitura.
   *
   * Finding sem SLA não ganha um: `slaDueAt` nulo sai daqui intocado (D1 —
   * não inventar prazo para quem não tem).
   */
  private async encerrarPausa(vulnerability: Vulnerability, acceptance: RiskAcceptance, fim: Date): Promise<number> {
    if (!vulnerability.slaDueAt || !acceptance.reviewedAt) return 0;

    const intervalo = Math.max(0, fim.getTime() - acceptance.reviewedAt.getTime());
    if (intervalo === 0) return 0;

    const empurrado = shiftSlaCycle(
      { slaDueAt: vulnerability.slaDueAt, slaDueSoonAt: vulnerability.slaDueSoonAt },
      intervalo,
    );
    await this.vulnerabilityRepository.updateSla(vulnerability.id, {
      slaDueAt: empurrado.slaDueAt,
      slaDueSoonAt: empurrado.slaDueSoonAt,
      slaPausedMs: vulnerability.slaPausedMs + intervalo,
    });
    return intervalo;
  }

  /* ======================================================================
     Controle de acesso
     ====================================================================== */

  /** Quem pode VER o finding pode ver a história de aceites dele. */
  private async assertCanView(actor: Actor, vulnerability: Vulnerability): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === vulnerability.companyId) return;
      throw new Error("FORBIDDEN");
    }
    const membership = await this.projectMemberRepository.findOne(vulnerability.projectId, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
  }

  /** ADMIN · CLIENT OWNER da empresa · PENTESTER membro do projeto. MEMBER não. */
  private async assertCanRequest(actor: Actor, vulnerability: Vulnerability): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId === vulnerability.companyId && user?.companyRole === "OWNER") return;
      throw new Error("FORBIDDEN");
    }
    const membership = await this.projectMemberRepository.findOne(vulnerability.projectId, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
  }

  /**
   * ADMIN ou CLIENT OWNER da empresa. PENTESTER NUNCA decide — ele é quem
   * encontra o risco; aceitar risco é decisão de quem é dono dele.
   */
  private async assertCanDecide(actor: Actor, vulnerability: Vulnerability): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId === vulnerability.companyId && user?.companyRole === "OWNER") return;
    }
    throw new Error("FORBIDDEN");
  }

  /** Carrega aceite + finding e valida a alçada de decisão de uma vez. */
  private async loadForDecision(actor: Actor, id: string): Promise<{ acceptance: RiskAcceptance; vulnerability: Vulnerability }> {
    const acceptance = await this.repository.findById(id);
    if (!acceptance) throw new Error("RISK_ACCEPTANCE_NOT_FOUND");
    const vulnerability = await this.vulnerabilityRepository.findById(acceptance.vulnerabilityId);
    if (!vulnerability) throw new Error("VULNERABILITY_NOT_FOUND");
    await this.assertCanDecide(actor, vulnerability);
    return { acceptance, vulnerability };
  }

  /* ======================================================================
     Auxiliares
     ====================================================================== */

  private async responseOf(id: string) {
    const fresco = await this.repository.findByIdWithActors(id);
    if (!fresco) throw new Error("RISK_ACCEPTANCE_NOT_FOUND");
    return new RiskAcceptanceEntity(fresco).toResponse();
  }

  private async audit(actor: Actor, ra: RiskAcceptance, action: string, diff: Record<string, unknown>): Promise<void> {
    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: ra.companyId,
      entityType: "RiskAcceptance",
      entityId: ra.id,
      action,
      diffJson: JSON.stringify(diff),
    });
  }

  /**
   * Evento sem ator humano — a expiração acontece pela passagem do tempo.
   * O `actorId` é o solicitante, porque `AuditLog.actorId` tem FK para User e
   * não aceita null; o `diffJson` marca `system: true` para a trilha não
   * sugerir que alguém clicou em algo.
   */
  private async auditSystem(ra: RiskAcceptance, action: string, diff: Record<string, unknown>): Promise<void> {
    await this.auditLogRepository.create({
      actorId: ra.requestedById,
      companyId: ra.companyId,
      entityType: "RiskAcceptance",
      entityId: ra.id,
      action,
      diffJson: JSON.stringify({ ...diff, system: true }),
    });
  }
}

/** Texto obrigatório com mínimo e máximo — mesmo espírito da justificativa de override (RN21). */
function validarTexto(valor: string | undefined | null, min: number, max: number, erro: string): void {
  const limpo = (valor ?? "").trim();
  if (limpo.length < min || limpo.length > max) throw new Error(erro);
}

/** Reexportado para o service de busca decidir o estado ACCEPTED sem duplicar a regra. */
export { isAcceptanceActive };
