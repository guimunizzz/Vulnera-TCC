export interface Evidence {
  id: string;
  vulnerabilityId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  proof: string;
  uploadedBy: string;
  createdAt: string;
}
