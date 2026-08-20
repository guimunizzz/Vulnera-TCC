import type { PrismaClient } from "@prisma/client";
import type { Evidence } from "../models/evidence.model";

export interface CreateEvidenceData {
  vulnerabilityId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  proof: string;
  uploadedBy: string;
}

export class EvidenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Evidence | null> {
    return this.prisma.evidence.findUnique({ where: { id } });
  }

  async findByVulnerability(vulnerabilityId: string): Promise<Evidence[]> {
    return this.prisma.evidence.findMany({ where: { vulnerabilityId }, orderBy: { createdAt: "desc" } });
  }

  async create(data: CreateEvidenceData): Promise<Evidence> {
    return this.prisma.evidence.create({ data });
  }
}
