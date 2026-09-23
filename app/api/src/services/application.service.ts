/**
 * application.service.ts
 *
 * Regra crítica (RN03 + RN07) no create(): a company precisa de uma
 * Subscription ACTIVE, e o número de applications ativas não pode estourar
 * plan.maxApplications. companyId nunca vem do DTO — é sempre resolvido a
 * partir do actor autenticado.
 *
 * ==========================================================================
 * CONTEXTO DE RISCO (CP-1 — Exposure & Remediation, docs/DECISIONS.md D2)
 * ==========================================================================
 * `environment`, `criticality`, `internetFacing` e `dataSensitivity` deixam
 * de ser "campos da aplicação" e viram FATORES DE RISCO: alimentam o VRS de
 * todos os findings daquela app. Isso cria um vetor de manipulação óbvio —
 * rebaixar o contexto para esvaziar o score e limpar o dashboard sem corrigir
 * nada. A regra que fecha esse vetor é assimétrica de propósito:
 *
 *   SUBIR risco   (MEDIUM→HIGH, false→true, HOMOL→PROD…)  → ADMIN ou CLIENT OWNER
 *   DESCER risco  (CRITICAL→LOW, true→false, PROD→DEV…)   → SÓ ADMIN
 *   CLIENT MEMBER → não altera contexto de risco (não ganha poder novo)
 *   PENTESTER     → read-only em Application, como sempre
 *
 * Subir é conservador e não precisa de trava; descer é a ação que esconde
 * problema. Toda mudança — em qualquer direção — vai pro AuditLog como
 * RISK_CONTEXT_CHANGED com antes/depois, porque a visibilidade é o segundo
 * controle: um rebaixamento legítimo tem rastro, um ilegítimo também.
 *
 * Os campos NÃO-risco (name, url, techStack, description, businessOwner,
 * technicalOwner) seguem a autorização de sempre: ADMIN, ou CLIENT da company.
 *
 * ⚠️ `companyRole` é lido do BANCO, nunca do JWT. O token carrega só
 * {userId, role} (CLAUDE.md §8) — um refresh desatualizado não pode conceder
 * alçada de OWNER. Mesma razão pela qual `companyId` também vem do banco.
 */

import type { ApplicationRepository } from "../repositories/application.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { SubscriptionRepository } from "../repositories/subscription.repository";
import type { PlanRepository } from "../repositories/plan.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import {
  ApplicationEntity,
  classificarMudancaDeContexto,
  RISK_CONTEXT_FIELDS,
  type CreateApplicationDTO,
  type UpdateApplicationDTO,
} from "../models/application.model";
import type { Application, User } from "@prisma/client";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/**
 * Gancho para o CP-3: quem quiser recalcular o VRS dos findings quando o
 * contexto muda se registra aqui. O ApplicationService não conhece
 * Vulnerability (P1: cada camada só conhece a de baixo) — ele só avisa.
 * Devolve quantos findings foram recalculados, que entra na auditoria.
 */
export type RiskContextChangedHook = (application: Application) => Promise<number>;

export class ApplicationService {
  private onRiskContextChanged: RiskContextChangedHook | null = null;

  constructor(
    private readonly repository: ApplicationRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /** Registra o recálculo de VRS (CP-3). Só a factory chama. */
  setRiskContextChangedHook(hook: RiskContextChangedHook): void {
    this.onRiskContextChanged = hook;
  }

  async list(actor: Actor): Promise<ApplicationEntity[]> {
    if (actor.role === "ADMIN") {
      return (await this.repository.findAll()).map((a) => new ApplicationEntity(a));
    }
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (!user?.companyId) return [];
      return (await this.repository.findByCompany(user.companyId)).map((a) => new ApplicationEntity(a));
    }
    // PENTESTER não gerencia applications diretamente nesta fase
    throw new Error("FORBIDDEN");
  }

  async getById(actor: Actor, id: string): Promise<ApplicationEntity> {
    const application = await this.repository.findById(id);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    await this.assertCanAccess(actor, application);
    return new ApplicationEntity(application);
  }

  async create(actor: Actor, dto: CreateApplicationDTO): Promise<ApplicationEntity> {
    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId) throw new Error("USER_HAS_NO_COMPANY");

    // RN07 — projeto (e por extensão, o catálogo pago de applications) exige assinatura ativa
    const activeSubscription = await this.subscriptionRepository.findActiveByCompany(user.companyId);
    if (!activeSubscription) throw new Error("NO_ACTIVE_SUBSCRIPTION");

    const plan = await this.planRepository.findById(activeSubscription.planId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    // RN03 — limite de applications pelo plano ativo
    const count = await this.repository.countActiveByCompany(user.companyId);
    if (count >= plan.maxApplications) throw new Error("PLAN_LIMIT_REACHED");

    // Na criação não há "antes" para comparar, então a regra de direção não
    // se aplica — mas CLIENT MEMBER continua sem poder definir os campos de
    // risco NOVOS (D2: não ganha poder administrativo novo). `environment`
    // fica de fora deste check: sempre pôde ser informado na criação por
    // qualquer CLIENT, e barrá-lo agora seria regressão, não regra.
    if (user.role === "CLIENT" && user.companyRole !== "OWNER" && temCampoDeRiscoNovo(dto)) {
      throw new Error("FORBIDDEN");
    }

    const created = await this.repository.create(user.companyId, dto);
    return new ApplicationEntity(created);
  }

  async update(actor: Actor, id: string, dto: UpdateApplicationDTO): Promise<ApplicationEntity> {
    const application = await this.repository.findById(id);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    const user = await this.assertCanAccess(actor, application);

    const antes = new ApplicationEntity(application).riskContext();
    const mudancas = classificarMudancaDeContexto(antes, dto);

    if (mudancas.length > 0) {
      this.assertCanChangeRiskContext(actor, user, mudancas);
    }

    const updated = await this.repository.update(id, dto);

    if (mudancas.length > 0) {
      // O recálculo de VRS (CP-3) acontece ANTES de auditar, porque a
      // quantidade recalculada faz parte do evento — é o que diz "esta
      // mudança rebaixou a prioridade de N findings".
      let vrsRecalculated = 0;
      if (this.onRiskContextChanged) {
        vrsRecalculated = await this.onRiskContextChanged(updated);
      }

      await this.auditLogRepository.create({
        actorId: actor.userId,
        companyId: application.companyId,
        entityType: "Application",
        entityId: id,
        action: "RISK_CONTEXT_CHANGED",
        diffJson: JSON.stringify({
          changes: mudancas,
          before: antes,
          after: new ApplicationEntity(updated).riskContext(),
          vrsRecalculated,
        }),
      });
    }

    return new ApplicationEntity(updated);
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const application = await this.repository.findById(id);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    await this.assertCanAccess(actor, application);
    await this.repository.deactivate(id);
  }

  /**
   * RN16: ADMIN vê/edita qualquer uma; CLIENT só a da própria company.
   * Devolve o User carregado (ou null para ADMIN) para quem precisar do
   * companyRole logo em seguida — evita uma segunda ida ao banco.
   */
  private async assertCanAccess(actor: Actor, application: Application): Promise<User | null> {
    if (actor.role === "ADMIN") return null;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === application.companyId) return user;
    }
    throw new Error("FORBIDDEN");
  }

  /**
   * D2 — quem pode mover o contexto em cada direção.
   *
   * Recebe o User já carregado por assertCanAccess (null = ADMIN). Lança
   * FORBIDDEN com a lista de mudanças recusadas escondida no erro? Não:
   * o código de erro é só FORBIDDEN (§9 do CLAUDE.md); o controller não
   * precisa saber QUAL campo foi recusado, e vazar isso ensinaria a um
   * MEMBER exatamente o que tentar em seguida. O motivo fica no log.
   */
  private assertCanChangeRiskContext(
    actor: Actor,
    user: User | null,
    mudancas: ReturnType<typeof classificarMudancaDeContexto>,
  ): void {
    if (actor.role === "ADMIN") return;

    // Só CLIENT chega aqui (PENTESTER já foi barrado em assertCanAccess).
    if (!user || user.companyRole !== "OWNER") {
      // MEMBER: nenhuma mudança de contexto de risco, em nenhuma direção.
      throw new Error("FORBIDDEN");
    }

    // OWNER: pode subir; descer é só ADMIN.
    const reducoes = mudancas.filter((m) => m.direction === "DECREASE");
    if (reducoes.length > 0) throw new Error("RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN");
  }
}

/**
 * O DTO tenta definir algum dos campos de risco NOVOS do CP-1? (create do
 * CLIENT MEMBER). `environment` não entra — ver comentário no create().
 */
function temCampoDeRiscoNovo(dto: CreateApplicationDTO | UpdateApplicationDTO): boolean {
  return RISK_CONTEXT_FIELDS.filter((f) => f !== "environment").some((f) => dto[f] !== undefined);
}
