/**
 * auth.controller.ts
 *
 * Adapta HTTP → AuthService.
 * Validação MANUAL com if (sem Zod/class-validator).
 */

import type { Request, Response } from "express";
import type { AuthService } from "../services/auth.service";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        res.status(400).json({ code: "MISSING_CREDENTIALS", message: "Email e senha são obrigatórios" });
        return;
      }
      const result = await this.service.login({ email, password });
      res.status(200).json(result);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "INVALID_CREDENTIALS") {
        res.status(401).json({ code: msg, message: "Email ou senha incorretos" });
        return;
      }
      console.error("[auth.login] erro inesperado:", err);
      res.status(500).json({ code: "INTERNAL_ERROR", message: "Erro interno" });
    }
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body ?? {};
      if (!refreshToken || typeof refreshToken !== "string") {
        res.status(400).json({ code: "MISSING_REFRESH_TOKEN", message: "refreshToken é obrigatório" });
        return;
      }
      const result = await this.service.refresh(refreshToken);
      res.status(200).json(result);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "INVALID_TOKEN") {
        res.status(401).json({ code: msg, message: "Refresh token inválido ou revogado" });
        return;
      }
      console.error("[auth.refresh] erro inesperado:", err);
      res.status(500).json({ code: "INTERNAL_ERROR", message: "Erro interno" });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body ?? {};
      if (!refreshToken || typeof refreshToken !== "string") {
        res.status(400).json({ code: "MISSING_REFRESH_TOKEN", message: "refreshToken é obrigatório" });
        return;
      }
      await this.service.logout(refreshToken);
      res.status(204).send();
    } catch (err) {
      console.error("[auth.logout] erro inesperado:", err);
      res.status(500).json({ code: "INTERNAL_ERROR", message: "Erro interno" });
    }
  };
}
