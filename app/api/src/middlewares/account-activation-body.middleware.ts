// Limita e sanitiza a leitura JSON exclusiva da ativação de conta.
// Existe para respostas de parser não refletirem tokens, senhas ou payloads.
// Consumido pelo app e pelas rotas públicas de ativação.

import express, { type ErrorRequestHandler } from "express";

export const accountActivationJsonBodyParser = express.json({ limit: "8kb" });

export const accountActivationBodyErrorHandler: ErrorRequestHandler = (error, _req, res, next): void => {
  const parserError = readParserError(error);
  if (!parserError) {
    next(error);
    return;
  }

  if (parserError.status === 413) {
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
    return;
  }
  if (parserError.status === 415) {
    res.status(415).json({ error: "UNSUPPORTED_BODY_ENCODING" });
    return;
  }
  res.status(400).json({ error: "INVALID_BODY" });
};

function readParserError(error: unknown): { status: number } | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; type?: unknown };
  if (candidate.status === 413 && candidate.type === "entity.too.large") return { status: 413 };
  if (candidate.status === 415 && typeof candidate.type === "string") return { status: 415 };
  if (candidate.status === 400 && typeof candidate.type === "string") return { status: 400 };
  return undefined;
}
