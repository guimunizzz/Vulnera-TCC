/**
 * Aplica autorização atual e transforma consultas administrativas em DTOs.
 * Existe para impedir que controllers devolvam linhas Prisma ou segredos;
 * é consumido pela camada HTTP da fila administrativa de AccessRequest.
 */

import type { AccessRequestStatus } from "../models/access-request.model";
import {
  AdminAccessRequestEntity,
  adminAccessRequestEventToResponse,
  type AccessRequestAdminActor,
  type AdminAccessRequestDetailDTO,
  type AdminAccessRequestEventsPageDTO,
  type AdminAccessRequestPageDTO,
} from "../models/admin-access-request.model";
import type {
  AdminAccessRequestPaginationQuery,
  AdminAccessRequestQueryRepository,
} from "../repositories/admin-access-request.repository";
import type { AccessRequestAdminAuthorizationService } from "./access-request-admin-authorization.service";

export type AdminAccessRequestQuery = AdminAccessRequestPaginationQuery & {
  status?: AccessRequestStatus;
};

export class AdminAccessRequestQueryService {
  constructor(
    private readonly repository: AdminAccessRequestQueryRepository,
    private readonly authorization: Pick<AccessRequestAdminAuthorizationService, "ensureAdmin">,
  ) {}

  async list(actor: AccessRequestAdminActor, query: AdminAccessRequestQuery): Promise<AdminAccessRequestPageDTO> {
    await this.authorization.ensureAdmin(actor);

    const status = query.status ?? "PENDING_REVIEW";

    const page = await this.repository.list({ ...query, status });
    return {
      items: page.items.map((item) => new AdminAccessRequestEntity(item).toResponse()),
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(id: string, actor: AccessRequestAdminActor): Promise<AdminAccessRequestDetailDTO> {
    await this.authorization.ensureAdmin(actor);
    const request = await this.repository.findById(id);
    if (!request) throw new Error("ACCESS_REQUEST_NOT_FOUND");
    return new AdminAccessRequestEntity(request).toDetailResponse();
  }

  async events(
    id: string,
    actor: AccessRequestAdminActor,
    query: AdminAccessRequestPaginationQuery,
  ): Promise<AdminAccessRequestEventsPageDTO> {
    await this.authorization.ensureAdmin(actor);

    // Confirma o pedido antes de devolver uma página vazia de eventos inexistentes.
    if (!await this.repository.findById(id)) throw new Error("ACCESS_REQUEST_NOT_FOUND");

    const page = await this.repository.findEvents(id, query);
    return {
      items: page.items.map(adminAccessRequestEventToResponse),
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
