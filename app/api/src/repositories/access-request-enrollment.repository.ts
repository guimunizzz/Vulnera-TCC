/**
 * Persistência do snapshot comercial que acompanha uma adesão nova.
 * Existe para fixar a oferta escolhida sem alterar pedidos legados; consumido
 * pelos fluxos transacionais de solicitação, aprovação e ativação.
 */
import type { AccessRequestEnrollment, Plan } from "@prisma/client";
import { companyCnpjVariants } from "../utils/cnpj.util";
import { matchesAccessRequestPlanSnapshot } from "../models/access-request.model";
import type { AccessDatabaseClient } from "./access-transaction.repository";

export class AccessRequestEnrollmentRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  findByAccessRequestId(accessRequestId: string): Promise<AccessRequestEnrollment | null> {
    return this.prisma.accessRequestEnrollment.findUnique({ where: { accessRequestId } });
  }

  /** O chamador bloqueia AccessRequest e convite antes do snapshot comercial. */
  async findByAccessRequestIdForUpdate(accessRequestId: string): Promise<AccessRequestEnrollment | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_REQUEST_ENROLLMENT_LOCK_REQUIRES_TRANSACTION");
    }
    const rows = await this.prisma.$queryRaw<Array<{ accessRequestId: string }>>`
      SELECT accessRequestId FROM AccessRequestEnrollment WHERE accessRequestId = ${accessRequestId} FOR UPDATE
    `;
    return rows.length === 0 ? null : this.findByAccessRequestId(accessRequestId);
  }

  /** Captura a oferta enquanto a linha do catálogo está bloqueada. */
  async findPlanForUpdate(planId: string): Promise<Plan | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_REQUEST_PLAN_LOCK_REQUIRES_TRANSACTION");
    }
    return this.readPlanForUpdate(planId);
  }

  async createSnapshot(data: {
    accessRequestId: string;
    companyCnpj: string | null;
    plan: Plan;
  }): Promise<AccessRequestEnrollment> {
    return this.prisma.accessRequestEnrollment.create({
      data: {
        accessRequestId: data.accessRequestId,
        companyCnpj: data.companyCnpj,
        planId: data.plan.id,
        planName: data.plan.name,
        planPrice: data.plan.price,
        planMaxApplications: data.plan.maxApplications,
        planMaxProjects: data.plan.maxProjects,
        planIncludesRemediation: data.plan.includesRemediation,
      },
    });
  }

  async isCurrentActivePlan(enrollment: AccessRequestEnrollment): Promise<boolean> {
    const plan = await this.prisma.plan.findUnique({ where: { id: enrollment.planId } });
    return Boolean(plan?.isActive && matchesAccessRequestPlanSnapshot(enrollment, plan));
  }

  async hasCompanyCnpjConflict(enrollment: AccessRequestEnrollment): Promise<boolean> {
    return enrollment.companyCnpj
      ? this.companyCnpjIsInUse(enrollment.companyCnpj)
      : false;
  }

  /** Revalida sob lock; alterações do catálogo não substituem a oferta aprovada. */
  async assertSnapshotMatchesActivePlan(enrollment: AccessRequestEnrollment): Promise<Plan> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_REQUEST_PLAN_LOCK_REQUIRES_TRANSACTION");
    }
    const plan = await this.readPlanForUpdate(enrollment.planId);
    return this.assertSnapshotMatchesPlan(enrollment, plan);
  }

  /** Compara uma oferta contra o catálogo já lido sob lock pelo fluxo chamador. */
  assertSnapshotMatchesPlan(enrollment: AccessRequestEnrollment, plan: Plan | null): Plan {
    if (!plan) throw new Error("ACCESS_REQUEST_PLAN_NOT_FOUND");
    if (!plan.isActive) throw new Error("ACCESS_REQUEST_PLAN_UNAVAILABLE");
    if (!matchesAccessRequestPlanSnapshot(enrollment, plan)) {
      throw new Error("ACCESS_REQUEST_PLAN_CHANGED");
    }
    return plan;
  }

  async companyCnpjIsInUse(canonicalCnpj: string): Promise<boolean> {
    const company = await this.prisma.company.findFirst({
      where: { cnpj: { in: companyCnpjVariants(canonicalCnpj) } },
      select: { id: true },
    });
    return company !== null;
  }

  async createCompany(data: {
    name: string;
    enrollment: AccessRequestEnrollment;
  }): Promise<{ id: string }> {
    try {
      return await this.prisma.company.create({
        data: {
          name: data.name,
          cnpj: data.enrollment.companyCnpj,
          planId: data.enrollment.planId,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new Error("COMPANY_ALREADY_EXISTS");
      throw error;
    }
  }

  async createActiveSubscription(data: {
    companyId: string;
    ownerId: string;
    reviewedById: string;
    enrollment: AccessRequestEnrollment;
    now: Date;
  }): Promise<{ id: string }> {
    const subscription = await this.prisma.subscription.create({
      data: {
        companyId: data.companyId,
        planId: data.enrollment.planId,
        status: "ACTIVE",
        startDate: data.now,
        approvedBy: data.reviewedById,
      },
      select: { id: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: data.reviewedById,
        companyId: data.companyId,
        entityType: "Subscription",
        entityId: subscription.id,
        action: "SUBSCRIPTION_APPROVED",
        createdAt: data.now,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: data.ownerId,
        companyId: data.companyId,
        entityType: "Company",
        entityId: data.companyId,
        action: "COMPANY_ENROLLED",
        createdAt: data.now,
      },
    });
    return subscription;
  }

  private async readPlanForUpdate(planId: string): Promise<Plan | null> {
    const rows = await this.prisma.$queryRaw<Array<Omit<Plan, "isActive" | "includesRemediation"> & {
      isActive: boolean | number;
      includesRemediation: boolean | number;
    }>>`
      SELECT id, name, maxApplications, maxProjects,
        includesRemediation + 0 AS includesRemediation,
        price, isActive + 0 AS isActive, createdAt
      FROM Plan WHERE id = ${planId} FOR UPDATE
    `;
    const row = rows[0];
    return row ? {
      ...row,
      isActive: Boolean(row.isActive),
      includesRemediation: Boolean(row.includesRemediation),
    } : null;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "code" in error && (error as { code?: unknown }).code === "P2002";
}
