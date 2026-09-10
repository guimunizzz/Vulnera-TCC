/**
 * dast-triage.controller.ts
 *
 * Adapta HTTP <-> DastTriageService: triagem de finding, promoção pra
 * Vulnerability e comparação entre scans. Mesmo padrão do
 * `dast-scan.controller.ts` — try/catch por método, validação manual com
 * `if`, códigos SCREAMING_SNAKE traduzidos pra status (CLAUDE.md §5.4/§9).
 *
 * Existe separado do `dast-scan.controller.ts` pelo mesmo motivo que o
 * service: aquele é sobre EXECUTAR o scan, este é sobre o que se faz com o
 * resultado. Ver ADR-032.
 */

import type { Request, Response } from "express";
import type { DastTriageService } from "../services/dast-triage.service";

export class DastTriageController {
  constructor(private readonly service: DastTriageService) {}

  async triage(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const findingId = req.params.findingId as string;
      const triageStatus = req.body?.triageStatus;
      if (!triageStatus) return res.status(400).json({ error: "MISSING_TRIAGE_STATUS" });

      const finding = await this.service.triage(actor, findingId, {
        triageStatus,
        note: typeof req.body?.note === "string" ? req.body.note : null,
      });
      return res.status(200).json(finding.toResponse());
    } catch (error: any) {
      if (error.message === "MISSING_TRIAGE_STATUS") return res.status(400).json({ error: "MISSING_TRIAGE_STATUS" });
      if (error.message === "INVALID_TRIAGE_STATUS") return res.status(400).json({ error: "INVALID_TRIAGE_STATUS" });
      if (error.message === "INVALID_TRIAGE_NOTE") return res.status(400).json({ error: "INVALID_TRIAGE_NOTE" });
      if (error.message === "FINDING_NOT_FOUND") return res.status(404).json({ error: "FINDING_NOT_FOUND" });
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastTriageController.triage", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  /** Rascunho do formulário de promoção — só leitura, não cria nada. */
  async getPromotionDraft(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const draft = await this.service.getPromotionDraft(actor, req.params.findingId as string);
      return res.status(200).json(draft);
    } catch (error: any) {
      if (error.message === "FINDING_NOT_FOUND") return res.status(404).json({ error: "FINDING_NOT_FOUND" });
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastTriageController.getPromotionDraft", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async promote(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const vulnerability = await this.service.promote(actor, req.params.findingId as string, {
        projectId: req.body?.projectId,
        title: req.body?.title,
        description: req.body?.description,
        owaspCategory: req.body?.owaspCategory,
        cvssVector: req.body?.cvssVector,
        impact: req.body?.impact,
        recommendation: req.body?.recommendation,
      });
      return res.status(201).json(vulnerability);
    } catch (error: any) {
      const msg = error.message as string;
      if (msg?.startsWith("MISSING_")) return res.status(400).json({ error: msg });
      // calculateCvss lança em vetor malformado — é erro de INPUT do usuário
      // (ele edita o vetor sugerido na tela), então 400 e não 500.
      if (msg === "INVALID_CVSS_VECTOR" || msg?.startsWith("INVALID_")) return res.status(400).json({ error: msg });
      if (msg === "FINDING_NOT_FOUND") return res.status(404).json({ error: "FINDING_NOT_FOUND" });
      if (msg === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (msg === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (msg === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (msg === "FINDING_ALREADY_PROMOTED") return res.status(409).json({ error: "FINDING_ALREADY_PROMOTED" });
      console.error("DastTriageController.promote", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async compare(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const baseScanId = typeof req.query.base === "string" ? req.query.base : "";
      if (!baseScanId) return res.status(400).json({ error: "MISSING_BASE_SCAN_ID" });

      const comparison = await this.service.compare(actor, baseScanId, req.params.id as string);
      return res.status(200).json(comparison);
    } catch (error: any) {
      const msg = error.message as string;
      if (msg === "CANNOT_COMPARE_SCAN_WITH_ITSELF") return res.status(400).json({ error: msg });
      // 422: os dois scans existem e o ator pode vê-los — o pedido é que não
      // faz sentido (alvos diferentes / scan não concluído). Mesma faixa que
      // INVALID_STATUS_TRANSITION no resto do produto (CLAUDE.md §9).
      if (msg === "SCANS_TARGET_MISMATCH" || msg === "SCAN_NOT_COMPLETED") return res.status(422).json({ error: msg });
      if (msg === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (msg === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastTriageController.compare", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async listComparableScans(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const scans = await this.service.listComparableScans(actor, req.params.id as string);
      return res.status(200).json(scans);
    } catch (error: any) {
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastTriageController.listComparableScans", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
