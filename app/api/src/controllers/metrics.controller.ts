/**
 * metrics.controller.ts
 *
 * O QUE FAZ
 * Adapta HTTP ↔ MetricsService: lê e valida a query string, chama o service e
 * traduz o código de erro para status.
 *
 * VALIDAÇÃO
 * Manual com `if`, conforme CLAUDE.md §P3 (zod é `[FUTURO]`). O cuidado extra
 * aqui é que a query string alimenta SQL parametrizado no repository — os
 * valores nunca são concatenados, mas `granularity` e as listas de filtro são
 * checadas contra listas fechadas mesmo assim, para que um valor inesperado
 * vire 400 em vez de um resultado silenciosamente errado.
 *
 * QUEM USA
 * `application.routes.ts` (as três rotas de aplicação) e `company.routes.ts`
 * (o comparativo). Montado pela `metrics.factory.ts`.
 */

import type { Request, Response } from "express";
import type { MetricsService, OpcoesPeriodo } from "../services/metrics.service";
import { MetricsEntity, type Granularidade } from "../models/metrics.model";

const GRANULARIDADES: Granularidade[] = ["day", "week", "month"];
const SEVERIDADES_VALIDAS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
const STATUS_VALIDOS = ["OPEN", "IN_PROGRESS", "FIXED", "CLOSED"];
const OWASP_VALIDAS = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"];

/** Lê `?x=a,b,c` e devolve só os valores permitidos. */
function lerLista(bruto: unknown, permitidos: string[]): string[] | undefined {
  if (typeof bruto !== "string" || bruto.trim() === "") return undefined;
  const itens = bruto
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => permitidos.includes(s));
  return itens.length > 0 ? itens : undefined;
}

/** Lê uma data ISO. Devolve `undefined` para ausente e lança para inválida. */
function lerData(bruto: unknown, campo: string): Date | undefined {
  if (typeof bruto !== "string" || bruto.trim() === "") return undefined;
  const data = new Date(bruto);
  if (Number.isNaN(data.getTime())) throw new Error(`INVALID_${campo}`);
  return data;
}

export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  /** Extrai o recorte comum às três rotas de aplicação. */
  private lerOpcoes(req: Request): OpcoesPeriodo {
    const de = lerData(req.query.from, "FROM");
    const ate = lerData(req.query.to, "TO");
    // Janela invertida é erro de quem chamou, não um resultado vazio: devolver
    // zero findings esconderia um bug do frontend por semanas.
    if (de && ate && de > ate) throw new Error("INVALID_PERIOD");
    return {
      de,
      ate,
      severidades: lerLista(req.query.severity, SEVERIDADES_VALIDAS),
      status: lerLista(req.query.status, STATUS_VALIDOS),
      owasp: lerLista(req.query.owasp, OWASP_VALIDAS),
    };
  }

  /** GET /api/applications/:id/metrics/summary?from=&to=&compare=previous */
  async summary(req: Request, res: Response): Promise<Response> {
    try {
      const opcoes = this.lerOpcoes(req);
      const comparar = req.query.compare === "previous";
      const dados = await this.service.getSummary(req.user!, req.params.id as string, opcoes, comparar);
      return res.status(200).json(new MetricsEntity(dados).toResponse());
    } catch (error: unknown) {
      return this.traduzirErro(error, res, "summary");
    }
  }

  /** GET /api/applications/:id/metrics/timeseries?from=&to=&granularity= */
  async timeseries(req: Request, res: Response): Promise<Response> {
    try {
      const opcoes = this.lerOpcoes(req);
      const bruto = req.query.granularity;
      if (bruto !== undefined && !GRANULARIDADES.includes(bruto as Granularidade)) {
        return res.status(400).json({ error: "INVALID_GRANULARITY" });
      }
      const dados = await this.service.getTimeseries(
        req.user!,
        req.params.id as string,
        opcoes,
        bruto as Granularidade | undefined,
      );
      return res.status(200).json(new MetricsEntity(dados).toResponse());
    } catch (error: unknown) {
      return this.traduzirErro(error, res, "timeseries");
    }
  }

  /** GET /api/applications/:id/metrics/insights */
  async insights(req: Request, res: Response): Promise<Response> {
    try {
      const opcoes = this.lerOpcoes(req);
      const dados = await this.service.getInsights(req.user!, req.params.id as string, opcoes);
      return res.status(200).json(new MetricsEntity(dados).toResponse());
    } catch (error: unknown) {
      return this.traduzirErro(error, res, "insights");
    }
  }

  /** GET /api/companies/me/metrics/comparison */
  async comparison(req: Request, res: Response): Promise<Response> {
    try {
      const opcoes = this.lerOpcoes(req);
      const dados = await this.service.getComparison(req.user!, opcoes);
      return res.status(200).json(new MetricsEntity(dados).toResponse());
    } catch (error: unknown) {
      return this.traduzirErro(error, res, "comparison");
    }
  }

  /** Tradução centralizada — os quatro métodos compartilham o mesmo conjunto. */
  private traduzirErro(error: unknown, res: Response, metodo: string): Response {
    const mensagem = error instanceof Error ? error.message : String(error);

    if (mensagem === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
    if (mensagem === "COMPANY_NOT_FOUND") return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
    // 403 e não 404 para acesso negado: é o padrão do CLAUDE.md §9 e o mesmo
    // das Fases 3-5 (limitação L-04, decidida e registrada no BACKLOG).
    if (mensagem === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
    if (mensagem.startsWith("INVALID_")) return res.status(400).json({ error: mensagem });

    console.error(`MetricsController.${metodo}`, error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
