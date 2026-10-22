import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import {
  ExportDataChangedError,
  ExportLimitExceededError,
  type ArquivoGerado,
  type FindingsExportService,
} from "../services/findings-export.service";
import { parseVulnerabilityQuery } from "../utils/vulnerability-query.util";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class FindingsExportController {
  constructor(private readonly service: FindingsExportService) {}

  /**
   * GET /api/vulnerabilities/export.xlsx — exporta, como planilha Excel, o
   * MESMO recorte que `GET /api/vulnerabilities` devolveria.
   *
   * Aceita os mesmos filtros, busca e ordenação da listagem (parse
   * compartilhado: `utils/vulnerability-query.util.ts`). `page` e `pageSize`
   * são ignorados — exportar é levar o recorte INTEIRO, não uma página.
   * Escopo por papel (ADMIN / CLIENT da empresa / PENTESTER membro) é imposto
   * pelo service, nunca pelo cliente.
   *
   * Erros que podem ocorrer antes do primeiro byte viram status HTTP:
   * 400 filtro inválido · 403/404 projeto · 422 acima do limite · 409 o
   * recorte mudou durante a geração · 429 rate limit.
   */
  async exportXlsx(req: Request, res: Response): Promise<void> {
    // Cliente desistiu (aba fechada, cancelou): para de ler do banco.
    const cancelamento = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) cancelamento.abort();
    });

    let arquivo: ArquivoGerado | undefined;
    try {
      const parsed = parseVulnerabilityQuery(req.query);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const preparo = await this.service.preparar(req.user!, parsed.query);
      arquivo = await this.service.gerar(req.user!, preparo, cancelamento.signal);

      res.status(200);
      // `attachment` também deduz o Content-Type pela extensão; o explícito vem depois só para fixar.
      res.attachment(arquivo.nomeArquivo);
      res.setHeader("Content-Type", XLSX_MIME);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");

      await pipeline(arquivo.stream, res);
    } catch (error: any) {
      if (res.headersSent) {
        // Já começou a entregar: não dá mais para trocar o status. Derruba a conexão
        // para o cliente ver a falha em vez de guardar um arquivo truncado.
        console.error("FindingsExportController.exportXlsx (durante o envio)", error);
        res.destroy(error);
        return;
      }
      if (error?.message === "EXPORT_ABORTED") return; // ninguém está ouvindo
      if (error instanceof ExportLimitExceededError) {
        res.status(422).json({ error: "EXPORT_LIMIT_EXCEEDED", limit: error.limite, total: error.total });
        return;
      }
      if (error instanceof ExportDataChangedError) {
        res.status(409).json({ error: "EXPORT_DATA_CHANGED" });
        return;
      }
      if (error?.message === "PROJECT_NOT_FOUND") {
        res.status(404).json({ error: "PROJECT_NOT_FOUND" });
        return;
      }
      if (error?.message === "FORBIDDEN") {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
      }
      console.error("FindingsExportController.exportXlsx", error);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    } finally {
      await arquivo?.limpar();
    }
  }
}
