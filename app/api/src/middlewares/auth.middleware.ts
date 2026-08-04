/**
 * auth.middleware.ts
 *
 * Middleware Express que:
 * 1. Extrai o header "Authorization: Bearer <token>"
 * 2. Valida o access token
 * 3. Popula req.user com { userId, role }
 * 4. Chama next() se válido, ou responde 401 se inválido
 *
 * Uso:
 *   router.use(authMiddleware)  // protege todas as rotas a partir daqui
 */

import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type JwtPayload } from "../utils/jwt.util";

// Aumenta o tipo Request do Express pra incluir nosso payload
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("Authorization");

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Token ausente ou mal formado" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ code: "INVALID_TOKEN", message: "Token inválido ou expirado" });
  }
}
