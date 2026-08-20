import type { Plan as PrismaPlan } from "@prisma/client";

// === TYPE ===================================================================
export type Plan = PrismaPlan;

// === DTOs ===================================================================
export type CreatePlanDTO = {
  name: string;
  maxApplications: number;
  maxProjects: number;
  includesRemediation: boolean;
  price: number;
};

export type UpdatePlanDTO = Partial<CreatePlanDTO>;

export type PlanResponseDTO = {
  id: string;
  name: string;
  maxApplications: number;
  maxProjects: number;
  includesRemediation: boolean;
  price: number;
  isActive: boolean;
  createdAt: string;
};

// === ENTITY =================================================================
export class PlanEntity {
  constructor(private readonly data: Plan) {}

  toResponse(): PlanResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      maxApplications: this.data.maxApplications,
      maxProjects: this.data.maxProjects,
      includesRemediation: this.data.includesRemediation,
      price: Number(this.data.price),
      isActive: this.data.isActive,
      createdAt: this.data.createdAt.toISOString(),
    };
  }

  allowsMoreApplications(currentCount: number): boolean {
    return currentCount < this.data.maxApplications;
  }
}
