/**
 * upload.middleware.ts
 *
 * multer configurado com memoryStorage — o arquivo inteiro fica em Buffer na
 * memória, nunca é gravado em disco pelo multer diretamente. Isso é
 * proposital: a validação de verdade (MIME whitelist + magic number nos
 * primeiros bytes + limite de 10MB) acontece manualmente no EvidenceService,
 * e só depois de aprovado é que o Service escreve o arquivo (renomeado com
 * UUID) em uploads/{companyId}/{vulnId}/.
 *
 * O `limits.fileSize` aqui é só a primeira barreira, pra cortar upload
 * gigante cedo sem gastar memória inteira — quem decide o corte de negócio
 * (400 FILE_TOO_LARGE) é o wrapper abaixo, que traduz o erro do multer pro
 * formato de erro padrão da API (sem middleware de erro global — CLAUDE.md
 * P3, isso é [FUTURO] — por isso o catch é local, aqui mesmo).
 */

import multer from "multer";
import type { NextFunction, Request, Response } from "express";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // O multer corta o STREAM ao passar do limite — não bufferiza os 10MB+1
    // antes de reclamar. Sem isso, um POST de 500MB seria acumulado inteiro
    // em memória antes de qualquer validação.
    fileSize: 10 * 1024 * 1024, // 10MB
    // Um upload = um arquivo. Sem estes limites o multipart aceita quantidade
    // arbitrária de partes/campos, que é DoS barato mesmo com fileSize baixo.
    files: 1,
    fields: 5,
    parts: 10,
  },
});

export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "FILE_TOO_LARGE" });
      return;
    }
    res.status(400).json({ error: "INVALID_FILE_TYPE" });
  });
}
