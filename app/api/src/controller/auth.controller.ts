/**
 * auth.controller.ts
 *
 * Adapta HTTP → AuthService.
 * Validação MANUAL com if (sem Zod/class-validator).
 */

import type { Request, Response } from "express";
import type { AuthService } from "../service/auth.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, password } = req.body ?? {};

      // ---- validação manual ----
      if (!name || typeof name !== "string" || name.trim().length < 3) {
        res.status(400).json({ code: "INVALID_NAME", message: "Nome precisa ter pelo menos 3 caracteres" });
        return;
      }
      if (!email || typeof email !== "string") {
        res.status(400).json({ code: "MISSING_EMAIL", message: "Email é obrigatório" });
        return;
      }
      if (!EMAIL_REGEX.test(email)) {
        res.status(400).json({ code: "INVALID_EMAIL", message: "Formato de email inválido" });
        return;
      }
      if (!password || typeof password !== "string") {
        res.status(400).json({ code: "MISSING_PASSWORD", message: "Senha é obrigatória" });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ code: "WEAK_PASSWORD", message: "Senha precisa ter no mínimo 8 caracteres" });
        return;
      }
      // ---- fim validação ----

      const result = await this.service.register({ name: name.trim(), email, password });
      res.status(201).json(result);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "EMAIL_ALREADY_EXISTS") {
        res.status(409).json({ code: msg, message: "Email já cadastrado" });
        return;
      }
      console.error("[auth.register] erro inesperado:", err);
      res.status(500).json({ code: "INTERNAL_ERROR", message: "Erro interno" });
    }
  };

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
