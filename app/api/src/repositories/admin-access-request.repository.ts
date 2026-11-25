/**
 * Consulta a fila administrativa de AccessRequest com projeções explícitas.
 * Existe para separar leituras HTTP do repository transacional do domínio;
 * é consumido somente pelo AdminAccessRequestQueryService.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { AccessRequestStatus } from "../models/access-request.model";
import type { AdminAccessRequestEventRaw, AdminAccessRequestRaw } from "../models/admin-access-request.model";

const ACCESS_REQUEST_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  companyName: true,
  phone: true,
  status: true,
  expiresAt: true,
  emailVerifiedAt: true,
  reviewedAt: true,
  reviewedById: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccessRequestSelect;

const ACCESS_REQUEST_DETAIL_SELECT = {
  ...ACCESS_REQUEST_LIST_SELECT,
  invitation: { select: { issuedAt: true, expiresAt: true, usedAt: true, revokedAt: true } },
} satisfies Prisma.AccessRequestSelect;

const ACCESS_REQUEST_EVENT_SELECT = {
  id: true,
  eventType: true,
  actorId: true,
  fromStatus: true,
  toStatus: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.AccessRequestEventSelect;

export type AdminAccessRequestListQuery = {
  page: number;
  pageSize: number;
  status: AccessRequestStatus;
};

export type AdminAccessRequestPaginationQuery = {
  page: number;
  pageSize: number;
};

export type AdminAccessRequestRepositoryPage<T> = {
  items: T[];
  total: number;
};

export class AdminAccessRequestQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: AdminAccessRequestListQuery): Promise<AdminAccessRequestRepositoryPage<AdminAccessRequestRaw>> {
    const where = { status: query.status };
    const [items, total] = await Promise.all([
      this.prisma.accessRequest.findMany({
        where,
        select: ACCESS_REQUEST_LIST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.accessRequest.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<AdminAccessRequestRaw | null> {
    return this.prisma.accessRequest.findUnique({
      where: { id },
      select: ACCESS_REQUEST_DETAIL_SELECT,
    });
  }

  async findEvents(
    accessRequestId: string,
    query: AdminAccessRequestPaginationQuery,
  ): Promise<AdminAccessRequestRepositoryPage<AdminAccessRequestEventRaw>> {
    const where = { accessRequestId };
    const [items, total] = await Promise.all([
      this.prisma.accessRequestEvent.findMany({
        where,
        select: ACCESS_REQUEST_EVENT_SELECT,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.accessRequestEvent.count({ where }),
    ]);
    return { items, total };
  }
}
