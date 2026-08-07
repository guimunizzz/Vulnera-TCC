import type { Request, Response } from "express";
import type { EvidenceService } from "../services/evidence.service";

export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const vulnId = req.params.vulnId as string;
      const actor = req.user!;
      const evidences = await this.service.list(actor, vulnId);
      return res.status(200).json(evidences.map((e) => e.toResponse()));
    } catch (error: any) {
      if (error.message === "VULNERABILITY_NOT_FOUND") {
        return res.status(404).json({ error: "VULNERABILITY_NOT_FOUND" });
      }
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("EvidenceController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async upload(req: Request, res: Response): Promise<Response> {
    try {
      const vulnId = req.params.vulnId as string;
      // uploadSingleFile (multer) já rodou antes desta rota — se não tiver
      // req.file, o cliente não anexou nenhum arquivo no campo "file".
      if (!req.file) return res.status(400).json({ error: "MISSING_FILE" });

      const actor = req.user!;
      const proof = typeof req.body?.proof === "string" ? req.body.proof : "";

      const evidence = await this.service.upload(
        actor,
        vulnId,
        { buffer: req.file.buffer, originalname: req.file.originalname },
        proof,
      );
      return res.status(201).json(evidence.toResponse());
    } catch (error: any) {
      if (error.message === "VULNERABILITY_NOT_FOUND") {
        return res.status(404).json({ error: "VULNERABILITY_NOT_FOUND" });
      }
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "INVALID_FILE_TYPE") return res.status(400).json({ error: "INVALID_FILE_TYPE" });
      if (error.message === "FILE_TOO_LARGE") return res.status(400).json({ error: "FILE_TOO_LARGE" });
      console.error("EvidenceController.upload", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async download(req: Request, res: Response): Promise<Response | void> {
    try {
      const evidenceId = req.params.evidenceId as string;
      const actor = req.user!;
      const { absolutePath, fileName, mimeType } = await this.service.getFileForDownload(actor, evidenceId);
      res.setHeader("Content-Type", mimeType);
      return res.download(absolutePath, fileName);
    } catch (error: any) {
      if (error.message === "EVIDENCE_NOT_FOUND") return res.status(404).json({ error: "EVIDENCE_NOT_FOUND" });
      if (error.message === "VULNERABILITY_NOT_FOUND") {
        return res.status(404).json({ error: "VULNERABILITY_NOT_FOUND" });
      }
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("EvidenceController.download", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
