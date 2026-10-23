/**
 * Revalida no banco o papel do ator que chegou autenticado como ADMIN.
 * Existe para bloquear JWTs de contas rebaixadas ou removidas antes do HTTP;
 * é composto após authRateLimitMiddleware e requireRole("ADMIN").
 */

import type { RequestHandler } from "express";
import type { AccessRequestAdminActor } from "../models/admin-access-request.model";
import type { AccessRequestAdminAuthorizationService } from "../services/access-request-admin-authorization.service";

export function makeAccessRequestAdminMiddleware(
  authorization: Pick<AccessRequestAdminAuthorizationService, "ensureAdmin">,
): RequestHandler {
  return async (req, res, next): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ code: "UNAUTHORIZED" });
      return;
    }

    const actor: AccessRequestAdminActor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    try {
      await authorization.ensureAdmin(actor);
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        res.status(403).json({ code: "FORBIDDEN" });
        return;
      }

      res.status(500).json({ code: "INTERNAL_ERROR" });
      return;
    }

    next();
  };
}
