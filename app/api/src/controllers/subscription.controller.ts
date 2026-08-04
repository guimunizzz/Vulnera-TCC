/**
 * subscription.controller.ts
 *
 * Endpoints autenticados de Subscription. request()/current() usam a
 * company do próprio usuário (req.user); listPending()/approve()/reject()
 * são admin-only (gate de role fica na rota via requireRole).
 */

import type { Request, Response } from "express";
import type { SubscriptionService } from "../services/subscription.service";
import type { CreateSubscriptionDTO } from "../models/subscription.model";

export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  async request(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<CreateSubscriptionDTO>;

      if (!body.planId || typeof body.planId !== "string") {
        return res.status(400).json({ error: "INVALID_PLAN_ID" });
      }

      const actor = req.user!;
      const subscription = await this.service.request(actor, { planId: body.planId });
      return res.status(201).json(subscription.toResponse());
    } catch (error: any) {
      if (error.message === "USER_HAS_NO_COMPANY") {
        return res.status(404).json({ error: "USER_HAS_NO_COMPANY" });
      }
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      if (error.message === "ALREADY_HAS_ACTIVE_SUBSCRIPTION") {
        return res.status(409).json({ error: "ALREADY_HAS_ACTIVE_SUBSCRIPTION" });
      }
      console.error("SubscriptionController.request", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async listPending(req: Request, res: Response): Promise<Response> {
    try {
      const subscriptions = await this.service.listPending();
      return res.status(200).json(subscriptions.map((s) => s.toResponse()));
    } catch (error) {
      console.error("SubscriptionController.listPending", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async current(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const subscription = await this.service.getCurrent(actor);
      return res.status(200).json(subscription.toResponse());
    } catch (error: any) {
      if (error.message === "USER_HAS_NO_COMPANY") {
        return res.status(404).json({ error: "USER_HAS_NO_COMPANY" });
      }
      if (error.message === "SUBSCRIPTION_NOT_FOUND") {
        return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
      }
      console.error("SubscriptionController.current", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async approve(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const actor = req.user!;
      const subscription = await this.service.approve(actor.userId, id);
      return res.status(200).json(subscription.toResponse());
    } catch (error: any) {
      if (error.message === "SUBSCRIPTION_NOT_FOUND") {
        return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
      }
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return res.status(400).json({ error: "INVALID_STATUS_TRANSITION" });
      }
      if (error.message === "ALREADY_HAS_ACTIVE_SUBSCRIPTION") {
        return res.status(409).json({ error: "ALREADY_HAS_ACTIVE_SUBSCRIPTION" });
      }
      console.error("SubscriptionController.approve", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async reject(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const actor = req.user!;
      const subscription = await this.service.reject(actor.userId, id);
      return res.status(200).json(subscription.toResponse());
    } catch (error: any) {
      if (error.message === "SUBSCRIPTION_NOT_FOUND") {
        return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
      }
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return res.status(400).json({ error: "INVALID_STATUS_TRANSITION" });
      }
      console.error("SubscriptionController.reject", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
