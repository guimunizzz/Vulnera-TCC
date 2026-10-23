/**
 * Valida autorização administrativa e consultas seguras da fila de acesso.
 * Existe para impedir leitura por contas sem privilégio atual e vazamento de
 * credenciais; é consumido pelo Jest de integração contra o banco descartável.
 */

import express, { type Express } from "express";
import request from "supertest";
import { prisma } from "../../src/database/prisma.database";
import {
  AccessRequestEntity,
  type AccessRequest,
  type AccessRequestStatus,
} from "../../src/models/access-request.model";
import type { AccessRequestAdminActor } from "../../src/models/admin-access-request.model";
import { AccessRequestAdminAuthorizationService } from "../../src/services/access-request-admin-authorization.service";
import { AdminAccessRequestQueryService } from "../../src/services/admin-access-request-query.service";
import { AdminAccessRequestQueryRepository } from "../../src/repositories/admin-access-request.repository";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { makeAccessRequestAdminMiddleware } from "../../src/middlewares/access-request-admin.middleware";
import { generateAccessToken } from "../../src/utils/access-token.util";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";

const requests = new AccessRequestRepository(prisma);
const invitations = new AccessInvitationRepository(prisma);
const queryRepository = new AdminAccessRequestQueryRepository(prisma);
const users = new UserRepository(prisma);
const queryService = (authorization = new AccessRequestAdminAuthorizationService(users)) =>
  new AdminAccessRequestQueryService(queryRepository, authorization);

const BASE = new Date("2026-10-20T12:00:00.000Z");
const PASSWORD = "Etapa4-test-password";
const REQUEST_INPUT = {
  name: "Pessoa solicitante",
  email: "solicitante@empresa.local",
  companyName: "Empresa de teste",
  phone: "+55 11 99999-0000",
};

async function createRequest(index: number, now = new Date(BASE.getTime() + index * 60_000)): Promise<AccessRequest> {
  const created = await requests.createIfEmailAvailable({
    ...REQUEST_INPUT,
    email: `solicitante-${index}@empresa.local`,
  }, now);
  if (!created) throw new Error("FIXTURE_ACCESS_REQUEST_NOT_CREATED");
  return created;
}

async function moveRequest(
  row: AccessRequest,
  status: AccessRequestStatus,
  now: Date,
  actor?: AccessRequestAdminActor,
): Promise<AccessRequest> {
  const transition = new AccessRequestEntity(row).transitionTo(status, actor, "Motivo de teste", now);
  if (!await requests.transitionIfCurrent(row.id, transition)) throw new Error("FIXTURE_ACCESS_REQUEST_TRANSITION_FAILED");
  const updated = await requests.findById(row.id);
  if (!updated) throw new Error("FIXTURE_ACCESS_REQUEST_DISAPPEARED");
  return updated;
}

async function createInStatus(
  index: number,
  status: AccessRequestStatus,
  admin: AccessRequestAdminActor,
): Promise<AccessRequest> {
  let row = await createRequest(index);
  if (status === "PENDING_EMAIL_VERIFICATION") return row;

  const firstTransitionAt = new Date(row.createdAt.getTime() + 1_000);
  if (status === "EXPIRED") return moveRequest(row, status, row.expiresAt);
  row = await moveRequest(row, "PENDING_REVIEW", firstTransitionAt);
  if (status === "PENDING_REVIEW") return row;

  const reviewAt = new Date(firstTransitionAt.getTime() + 1_000);
  if (status === "REJECTED") return moveRequest(row, status, reviewAt, admin);
  row = await moveRequest(row, "APPROVED", reviewAt, admin);
  if (status === "APPROVED") return row;

  return moveRequest(row, "ACTIVATED", new Date(reviewAt.getTime() + 1_000));
}

async function makeAdmin(email = "admin@empresa.local"): Promise<AccessRequestAdminActor> {
  const user = await seedUser({ name: "Administradora", email, password: PASSWORD, role: "ADMIN" });
  return { userId: user.id, role: "ADMIN" };
}

function guardedApp(
  actor?: AccessRequestAdminActor,
  authorization: Pick<AccessRequestAdminAuthorizationService, "ensureAdmin"> = new AccessRequestAdminAuthorizationService(users),
): Express {
  const app = express();
  if (actor) {
    app.use((req, _res, next) => {
      req.user = actor;
      next();
    });
  }
  app.get("/admin/access-requests", makeAccessRequestAdminMiddleware(authorization), (_req, res) =>
    res.status(200).json({ reached: true }),
  );
  return app;
}

describe("autorização e consultas administrativas de AccessRequest", () => {
  beforeEach(cleanDatabase);

  it("aceita apenas ADMIN ainda existente, nega sessão ausente/rebaixada/removida e não alcança o handler", async () => {
    const admin = await makeAdmin();
    const client = await seedUser({ name: "Cliente", email: "cliente@empresa.local", password: PASSWORD, role: "CLIENT" });
    const pentester = await seedUser({ name: "Pentester", email: "pentester@empresa.local", password: PASSWORD, role: "PENTESTER" });
    const authorization = new AccessRequestAdminAuthorizationService(users);

    await expect(authorization.ensureAdmin(admin)).resolves.toBeUndefined();
    await expect(authorization.ensureAdmin({ userId: client.id, role: "CLIENT" })).rejects.toThrow("FORBIDDEN");
    await expect(authorization.ensureAdmin({ userId: pentester.id, role: "PENTESTER" })).rejects.toThrow("FORBIDDEN");

    await request(guardedApp()).get("/admin/access-requests")
      .expect(401)
      .expect(({ body }) => expect(body).toEqual({ code: "UNAUTHORIZED" }));
    await request(guardedApp({ userId: client.id, role: "CLIENT" })).get("/admin/access-requests")
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ code: "FORBIDDEN" }));
    await request(guardedApp({ userId: pentester.id, role: "PENTESTER" })).get("/admin/access-requests")
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ code: "FORBIDDEN" }));
    await request(guardedApp(admin)).get("/admin/access-requests").expect(200, { reached: true });

    const demoted = await makeAdmin("demoted@empresa.local");
    await prisma.user.update({ where: { id: demoted.userId }, data: { role: "CLIENT" } });
    await expect(authorization.ensureAdmin(demoted)).rejects.toThrow("FORBIDDEN");
    await request(guardedApp(demoted)).get("/admin/access-requests")
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ code: "FORBIDDEN" }));

    const removed = await makeAdmin("removed@empresa.local");
    await prisma.user.delete({ where: { id: removed.userId } });
    await expect(authorization.ensureAdmin(removed)).rejects.toThrow("FORBIDDEN");
    await request(guardedApp(removed)).get("/admin/access-requests")
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ code: "FORBIDDEN" }));

    const databaseFailure = guardedApp(admin, { ensureAdmin: async () => { throw new Error("database unavailable"); } });
    await request(databaseFailure).get("/admin/access-requests")
      .expect(500)
      .expect(({ body }) => expect(body).toEqual({ code: "INTERNAL_ERROR" }));
  });

  it("lista os seis estados, pagina por data/ID e devolve detalhe e eventos sem segredos", async () => {
    const admin = await makeAdmin();
    const service = queryService();

    const pendingReviewOld = await createInStatus(1, "PENDING_REVIEW", admin);
    const pendingReviewNew = await createInStatus(2, "PENDING_REVIEW", admin);
    await createInStatus(3, "PENDING_EMAIL_VERIFICATION", admin);

    const firstPage = await service.list(admin, { page: 1, pageSize: 1 });
    const secondPage = await service.list(admin, { page: 2, pageSize: 1 });
    expect(firstPage).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(firstPage.items.map(item => item.id)).toEqual([pendingReviewNew.id]);
    expect(secondPage.items.map(item => item.id)).toEqual([pendingReviewOld.id]);
    expect(firstPage.items[0]).not.toHaveProperty("activeEmail");
    expect(firstPage.items[0]).not.toHaveProperty("verificationToken");

    const statuses: AccessRequestStatus[] = [
      "PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED", "ACTIVATED",
    ];
    for (const [index, status] of statuses.entries()) {
      await createInStatus(10 + index, status, admin);
      const page = await service.list(admin, { page: 1, pageSize: 10, status });
      const expectedTotal = status === "PENDING_REVIEW" ? 3 : status === "PENDING_EMAIL_VERIFICATION" ? 2 : 1;
      expect(page.total).toBe(expectedTotal);
      expect(page.items.every(item => item.status === status)).toBe(true);
    }

    let detailRequest = await createRequest(30);
    detailRequest = await moveRequest(detailRequest, "PENDING_REVIEW", new Date(detailRequest.createdAt.getTime() + 1_000));
    detailRequest = await moveRequest(detailRequest, "APPROVED", new Date(detailRequest.updatedAt.getTime() + 1_000), admin);
    const issuedAt = new Date(detailRequest.updatedAt.getTime() + 1_000);
    const invitation = await invitations.createIfEligible({
      accessRequestId: detailRequest.id,
      tokenHash: generateAccessToken().tokenHash,
      expiresAt: new Date(issuedAt.getTime() + 60_000),
    }, issuedAt);
    expect(invitation).not.toBeNull();

    const detail = await service.getById(detailRequest.id, admin);
    expect(detail).toMatchObject({
      id: detailRequest.id,
      status: "APPROVED",
      invitation: {
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + 60_000).toISOString(),
        usedAt: null,
        revokedAt: null,
      },
    });
    expect(detail).not.toHaveProperty("activeEmail");
    expect(detail).not.toHaveProperty("tokenHash");
    expect(detail.invitation).not.toHaveProperty("tokenHash");

    const eventsRequest = await createInStatus(31, "ACTIVATED", admin);
    const eventsPageOne = await service.events(eventsRequest.id, admin, { page: 1, pageSize: 2 });
    const eventsPageTwo = await service.events(eventsRequest.id, admin, { page: 2, pageSize: 2 });
    const events = [...eventsPageOne.items, ...eventsPageTwo.items];
    expect(eventsPageOne.total).toBe(4);
    expect(events.map(event => event.toStatus)).toEqual([
      "PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED", "ACTIVATED",
    ]);
    expect(events.map(event => Date.parse(event.createdAt))).toEqual(
      [...events.map(event => Date.parse(event.createdAt))].sort((left, right) => left - right),
    );
    expect(events[0]).not.toHaveProperty("tokenHash");

    await expect(service.getById("missing-access-request", admin)).rejects.toThrow("ACCESS_REQUEST_NOT_FOUND");
    await expect(service.events("missing-access-request", admin, { page: 1, pageSize: 10 }))
      .rejects.toThrow("ACCESS_REQUEST_NOT_FOUND");

    const client = await seedUser({ name: "Cliente sem acesso", email: "sem-acesso@empresa.local", password: PASSWORD, role: "CLIENT" });
    const clientActor: AccessRequestAdminActor = { userId: client.id, role: "CLIENT" };
    const listLookup = jest.spyOn(queryRepository, "list");
    const detailLookup = jest.spyOn(queryRepository, "findById");
    const eventsLookup = jest.spyOn(queryRepository, "findEvents");
    await expect(service.list(clientActor, { page: 1, pageSize: 10 })).rejects.toThrow("FORBIDDEN");
    await expect(service.getById(detailRequest.id, clientActor)).rejects.toThrow("FORBIDDEN");
    await expect(service.events(detailRequest.id, clientActor, { page: 1, pageSize: 10 }))
      .rejects.toThrow("FORBIDDEN");
    expect(listLookup).not.toHaveBeenCalled();
    expect(detailLookup).not.toHaveBeenCalled();
    expect(eventsLookup).not.toHaveBeenCalled();
    listLookup.mockRestore();
    detailLookup.mockRestore();
    eventsLookup.mockRestore();
  });
});
