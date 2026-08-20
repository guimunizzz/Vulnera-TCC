import type { Request, Response } from "express";
import type { ProjectMemberService } from "../services/project-member.service";
import type { AddProjectMemberDTO } from "../models/project-member.model";

export class ProjectMemberController {
  constructor(private readonly service: ProjectMemberService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = req.params.projectId as string;
      const actor = req.user!;
      const members = await this.service.list(actor, projectId);
      return res.status(200).json(members.map((m) => m.toResponse()));
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ProjectMemberController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async add(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = req.params.projectId as string;
      const body = req.body as Partial<AddProjectMemberDTO>;

      if (!body.userId || typeof body.userId !== "string") {
        return res.status(400).json({ error: "INVALID_USER_ID" });
      }

      const member = await this.service.add(projectId, body.userId);
      return res.status(201).json(member.toResponse());
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "USER_NOT_FOUND") return res.status(404).json({ error: "USER_NOT_FOUND" });
      if (error.message === "USER_NOT_PENTESTER") return res.status(400).json({ error: "USER_NOT_PENTESTER" });
      if (error.message === "MEMBER_ALREADY_EXISTS") return res.status(409).json({ error: "MEMBER_ALREADY_EXISTS" });
      console.error("ProjectMemberController.add", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async remove(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = req.params.projectId as string;
      const userId = req.params.userId as string;
      await this.service.remove(projectId, userId);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "MEMBER_NOT_FOUND") return res.status(404).json({ error: "MEMBER_NOT_FOUND" });
      console.error("ProjectMemberController.remove", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
