/**
 * require-role.middleware.ts
 *
 * Middleware Express de autorização por role. Roda DEPOIS do authMiddleware
 * (que popula req.user) e barra a request com 403 se o role não estiver na
 * lista permitida. Ownership fino (qual empresa é dona do registro) não é
 * responsabilidade deste middleware — isso fica no service.
 *
 * Uso:
 *   router.post("/", authMiddleware, requireRole("ADMIN"), handler)
 */

import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../models/user.model";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    next();
  };
}
