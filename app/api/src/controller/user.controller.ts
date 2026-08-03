/**
 * user.controller.ts
 *
 * Endpoints autenticados de usuário.
 * Atenção: a rota /me precisa vir ANTES de /:id no router (senão Express
 * casa "me" com o pattern :id).
 */

import type { Request, Response } from "express";
import type { UserService } from "../service/user.service";

export class UserController {
  constructor(private readonly service: UserService) {}

  me = async (req: Request, res: Response): Promise<void> => {
    try {
      const actor = req.user!; // garantido pelo authMiddleware
      const user = await this.service.getById(actor, actor.userId);
      res.status(200).json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const actor = req.user!;
      const users = await this.service.list(actor);
      res.status(200).json(users);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const actor = req.user!;
      const user = await this.service.getById(actor, req.params.id as string);
      res.status(200).json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const actor = req.user!;
      const { name, email } = req.body ?? {};
      const user = await this.service.update(actor, req.params.id as string, { name, email });
      res.status(200).json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const actor = req.user!;
      await this.service.delete(actor, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      this.handleError(err, res);
    }
  };

  private handleError(err: unknown, res: Response): void {
    const msg = (err as Error).message;
    const map: Record<string, number> = {
      USER_NOT_FOUND: 404,
      FORBIDDEN: 403,
      SELF_DELETE_FORBIDDEN: 403,
    };
    if (msg in map) {
      res.status(map[msg]).json({ code: msg });
      return;
    }
    console.error("[user.controller] erro inesperado:", err);
    res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}
