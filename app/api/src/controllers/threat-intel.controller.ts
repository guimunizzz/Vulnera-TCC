/**
 * threat-intel.controller.ts
 *
 * HTTP da Threat Intel (ADR-053): lê query/body, chama o service e traduz os
 * códigos de erro da aplicação para status. Sem regra de negócio.
 */

import type { Request, Response } from "express";
import type { ThreatIntelService } from "../services/threat-intel/threat-intel.service";

const STATUS_BY_ERROR: Record<string, number> = {
  MISSING_COMPANY_ID: 400,
  INVALID_STATUS: 400,
  INVALID_TECH_KIND: 400,
  INVALID_ECOSYSTEM: 400,
  MISSING_PACKAGE_NAME: 400,
  INVALID_PACKAGE_NAME: 400,
  INVALID_CPE_PART: 400,
  MISSING_CPE_PRODUCT: 400,
  INVALID_CPE_PRODUCT: 400,
  INVALID_VERSION: 400,
  INVALID_SEARCH: 400,
  INVALID_TRIAGE_STATUS: 400,
  MISSING_TRIAGE_STATUS: 400,
  INVALID_TRIAGE_NOTE: 400,
  INVALID_SEVERITY: 400,
  INVALID_DAYS: 400,
  MISSING_PROJECT_ID: 400,
  MISSING_TITLE: 400,
  MISSING_DESCRIPTION: 400,
  MISSING_OWASP_CATEGORY: 400,
  INVALID_OWASP_CATEGORY: 400,
  MISSING_CVSS_VECTOR: 400,
  INVALID_CVSS_VECTOR: 400,
  FORBIDDEN: 403,
  COMPANY_NOT_FOUND: 404,
  TECH_ASSET_NOT_FOUND: 404,
  THREAT_MATCH_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  TECH_ASSET_ALREADY_EXISTS: 409,
  TECH_ASSET_ALREADY_CONFIRMED: 409,
  TECH_ASSET_NOT_SUGGESTED: 409,
  FINDING_ALREADY_PROMOTED: 409,
  // A busca de CPE depende do NVD; quando ele não responde, a tela oferece digitar à mão.
  CPE_SEARCH_UNAVAILABLE: 503,
};

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const sim = (v: unknown) => v === "true" || v === "1";

export class ThreatIntelController {
  constructor(private readonly service: ThreatIntelService) {}

  private async responder(res: Response, onde: string, fn: () => Promise<unknown>, status = 200): Promise<Response> {
    try {
      const corpo = await fn();
      return corpo === undefined ? res.status(204).send() : res.status(status).json(corpo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const s = STATUS_BY_ERROR[message];
      if (s) return res.status(s).json({ error: message });
      console.error(`ThreatIntelController.${onde}`, error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  companies = (req: Request, res: Response) => this.responder(res, "companies", () => this.service.empresasVisiveis(req.user!));
  overview = (req: Request, res: Response) => this.responder(res, "overview", () => this.service.resumo(req.user!, texto(req.query.companyId)));

  listAssets = (req: Request, res: Response) =>
    this.responder(res, "listAssets", () => this.service.listarAtivos(req.user!, texto(req.query.companyId), texto(req.query.status)));
  addAsset = (req: Request, res: Response) =>
    this.responder(res, "addAsset", () => this.service.adicionarAtivo(req.user!, texto(req.body?.companyId), req.body ?? {}), 201);
  removeAsset = (req: Request, res: Response) =>
    this.responder(res, "removeAsset", async () => {
      await this.service.removerAtivo(req.user!, req.params.id as string);
      return undefined;
    });
  confirmAsset = (req: Request, res: Response) => this.responder(res, "confirmAsset", () => this.service.confirmarSugestao(req.user!, req.params.id as string));
  dismissAsset = (req: Request, res: Response) => this.responder(res, "dismissAsset", () => this.service.descartarSugestao(req.user!, req.params.id as string));
  confirmAll = (req: Request, res: Response) => this.responder(res, "confirmAll", () => this.service.confirmarTodas(req.user!, texto(req.body?.companyId)));
  searchProducts = (req: Request, res: Response) =>
    this.responder(res, "searchProducts", () => this.service.buscarProdutos(req.user!, texto(req.query.companyId), texto(req.query.q)));

  listMatches = (req: Request, res: Response) =>
    this.responder(res, "listMatches", () =>
      this.service.listarCasamentos(req.user!, texto(req.query.companyId), {
        triagem: texto(req.query.triage),
        kev: sim(req.query.kev) || undefined,
        severidade: texto(req.query.severity),
        preexistentes: req.query.preexisting === "false" ? false : undefined,
        assetId: texto(req.query.assetId),
      }),
    );
  triage = (req: Request, res: Response) =>
    this.responder(res, "triage", () => this.service.triar(req.user!, req.params.id as string, { triageStatus: req.body?.triageStatus, note: req.body?.note }));
  promotionDraft = (req: Request, res: Response) => this.responder(res, "promotionDraft", () => this.service.rascunhoDePromocao(req.user!, req.params.id as string));
  promote = (req: Request, res: Response) =>
    this.responder(
      res,
      "promote",
      () =>
        this.service.promover(req.user!, req.params.id as string, {
          projectId: texto(req.body?.projectId),
          title: req.body?.title,
          description: req.body?.description,
          owaspCategory: req.body?.owaspCategory,
          cvssVector: req.body?.cvssVector,
          recommendation: req.body?.recommendation,
        }),
      201,
    );

  feed = (req: Request, res: Response) =>
    this.responder(res, "feed", () =>
      this.service.feed(req.user!, texto(req.query.companyId), {
        dias: req.query.days !== undefined ? Number(req.query.days) : undefined,
        kev: sim(req.query.kev) || undefined,
        severidade: texto(req.query.severity),
      }),
    );

  syncStatus = (req: Request, res: Response) => this.responder(res, "syncStatus", () => this.service.execucoes(req.user!, texto(req.query.companyId)));
  syncNow = (req: Request, res: Response) => this.responder(res, "syncNow", () => this.service.sincronizarAgora(req.user!), 202);
}
