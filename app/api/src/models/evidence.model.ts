/**
 * evidence.model.ts
 *
 * Anexo de prova de uma Vulnerability (RN — upload seguro, ver
 * services/evidence.service.ts). filePath é detalhe interno de servidor e
 * NUNCA aparece no DTO de resposta — download só acontece pelo endpoint
 * autenticado GET /vulnerabilities/:vulnId/evidences/:evidenceId, que
 * resolve o caminho no service depois de checar acesso à company.
 */

import type { Evidence as PrismaEvidence } from "@prisma/client";

export type Evidence = PrismaEvidence;

export type EvidenceResponseDTO = {
  id: string;
  vulnerabilityId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  proof: string;
  uploadedBy: string;
  createdAt: string;
};

export class EvidenceEntity {
  constructor(private readonly data: Evidence) {}

  toResponse(): EvidenceResponseDTO {
    return {
      id: this.data.id,
      vulnerabilityId: this.data.vulnerabilityId,
      fileName: this.data.fileName,
      originalName: this.data.originalName,
      mimeType: this.data.mimeType,
      sizeBytes: this.data.sizeBytes,
      proof: this.data.proof,
      uploadedBy: this.data.uploadedBy,
      createdAt: this.data.createdAt.toISOString(),
    };
  }
}
