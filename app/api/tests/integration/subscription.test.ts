import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedSubscription } from "../fixtures/subscriptions.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

describe("Subscription (request/pending/current/approve/reject)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // SUB-01
  it("POST /api/subscriptions: usuário sem empresa recebe 404 USER_HAS_NO_COMPANY", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("USER_HAS_NO_COMPANY");

    const onboardingStatus = await request(app)
      .get("/api/subscriptions/onboarding-status")
      .set("Authorization", `Bearer ${token}`);
    expect(onboardingStatus.status).toBe(404);
    expect(onboardingStatus.body.error).toBe("USER_HAS_NO_COMPANY");
  });

  // SUB-02
  it("POST /api/subscriptions cria PENDING_APPROVAL e grava AuditLog SUBSCRIPTION_REQUESTED", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING_APPROVAL");
    expect(res.body.companyId).toBe(company.id);

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Subscription", entityId: res.body.id },
    });
    expect(log?.action).toBe("SUBSCRIPTION_REQUESTED");
    expect(log?.actorId).toBe(client.id);
  });

  it("POST /api/subscriptions é idempotente sob retry concorrente do mesmo plano", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const client = await seedUser({
      name: "Client", email: "client-retry@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const responses = await Promise.all([
      request(app).post("/api/subscriptions").set("Authorization", `Bearer ${token}`).send({ planId: plan.id }),
      request(app).post("/api/subscriptions").set("Authorization", `Bearer ${token}`).send({ planId: plan.id }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect(await prisma.subscription.count({ where: { companyId: company.id, status: "PENDING_APPROVAL" } })).toBe(1);
    expect(await prisma.auditLog.count({
      where: { companyId: company.id, entityType: "Subscription", action: "SUBSCRIPTION_REQUESTED" },
    })).toBe(1);
  });

  it("POST /api/subscriptions não substitui uma pendência existente por outro plano", async () => {
    const basic = await seedPlan({ name: "BASIC" });
    const pro = await seedPlan({ name: "PRO" });
    const company = await seedCompany({ name: "Acme", planId: basic.id });
    const client = await seedUser({
      name: "Client", email: "client-plan-conflict@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const first = await request(app).post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`).send({ planId: basic.id });
    const retryWithOtherPlan = await request(app).post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`).send({ planId: pro.id });

    expect(first.status).toBe(201);
    expect(retryWithOtherPlan.status).toBe(409);
    expect(retryWithOtherPlan.body.error).toBe("SUBSCRIPTION_REQUEST_ALREADY_PENDING");
    expect(await prisma.subscription.count({ where: { companyId: company.id } })).toBe(1);
  });

  it("GET onboarding-status distingue NONE, PENDING e ACTIVE sem mudar /current", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const otherCompany = await seedCompany({ name: "Outra empresa", planId: plan.id });
    await seedSubscription({ companyId: otherCompany.id, planId: plan.id, status: "PENDING_APPROVAL" });
    const admin = await seedUser({ name: "Admin", email: "admin-status@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const owner = await seedUser({
      name: "Owner", email: "owner-status@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const member = await seedUser({
      name: "Member", email: "member-status@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "MEMBER",
    });
    const ownerToken = await loginAs(app, owner.email, PASSWORD);
    const memberToken = await loginAs(app, member.email, PASSWORD);
    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const statusUrl = "/api/subscriptions/onboarding-status";

    const none = await request(app).get(statusUrl).set("Authorization", `Bearer ${ownerToken}`);
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ status: "NEEDS_ONBOARDING", subscription: null });
    const forgedTenant = await request(app).get(statusUrl).query({ companyId: otherCompany.id })
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(forgedTenant.status).toBe(200);
    expect(forgedTenant.body).toEqual({ status: "NEEDS_ONBOARDING", subscription: null });
    const memberStatus = await request(app).get(statusUrl).set("Authorization", `Bearer ${memberToken}`);
    expect(memberStatus.status).toBe(403);
    expect(memberStatus.body.error).toBe("FORBIDDEN");

    const beforeRequest = await request(app).get("/api/subscriptions/current").set("Authorization", `Bearer ${ownerToken}`);
    expect(beforeRequest.status).toBe(404);
    expect(beforeRequest.body.error).toBe("SUBSCRIPTION_NOT_FOUND");

    const requested = await request(app).post("/api/subscriptions")
      .set("Authorization", `Bearer ${ownerToken}`).send({ planId: plan.id });
    const pending = await request(app).get(statusUrl).set("Authorization", `Bearer ${ownerToken}`);
    expect(pending.body).toMatchObject({
      status: "PENDING_APPROVAL",
      subscription: { id: requested.body.id, companyId: company.id, planId: plan.id },
    });
    const currentPending = await request(app).get("/api/subscriptions/current").set("Authorization", `Bearer ${ownerToken}`);
    expect(currentPending.status).toBe(404);

    const approved = await request(app).post(`/api/subscriptions/${requested.body.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approved.status).toBe(200);
    const active = await request(app).get(statusUrl).set("Authorization", `Bearer ${ownerToken}`);
    expect(active.body).toMatchObject({ status: "ACTIVE", subscription: { id: requested.body.id } });
    const currentActive = await request(app).get("/api/subscriptions/current").set("Authorization", `Bearer ${ownerToken}`);
    expect(currentActive.status).toBe(200);
    expect(currentActive.body.id).toBe(requested.body.id);
  });

  // SUB-03 — regra de ouro no request
  it("POST /api/subscriptions: company já com ACTIVE não pode pedir outra (409)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ALREADY_HAS_ACTIVE_SUBSCRIPTION");
  });

  // SUB-04
  it("GET /api/subscriptions/pending é admin-only e lista as pendentes", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const sub = await seedSubscription({ companyId: company.id, planId: plan.id });

    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientToken = await loginAs(app, client.email, PASSWORD);

    const asClient = await request(app).get("/api/subscriptions/pending").set("Authorization", `Bearer ${clientToken}`);
    expect(asClient.status).toBe(403);

    const asAdmin = await request(app).get("/api/subscriptions/pending").set("Authorization", `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toHaveLength(1);
    expect(asAdmin.body[0].id).toBe(sub.id);
  });

  // Dashboard admin (Fase 6) — GET /api/subscriptions/active é admin-only e só lista ACTIVE
  it("GET /api/subscriptions/active é admin-only e lista só as com status ACTIVE", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const activeCompany = await seedCompany({ name: "Acme Ativa", planId: plan.id });
    const pendingCompany = await seedCompany({ name: "Beta Pendente", planId: plan.id });
    await seedSubscription({ companyId: activeCompany.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    await seedSubscription({ companyId: pendingCompany.id, planId: plan.id, status: "PENDING_APPROVAL" });

    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: activeCompany.id,
      companyRole: "OWNER",
    });
    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientToken = await loginAs(app, client.email, PASSWORD);

    const asClient = await request(app).get("/api/subscriptions/active").set("Authorization", `Bearer ${clientToken}`);
    expect(asClient.status).toBe(403);

    const asAdmin = await request(app).get("/api/subscriptions/active").set("Authorization", `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toHaveLength(1);
    expect(asAdmin.body[0].companyId).toBe(activeCompany.id);
    expect(asAdmin.body[0].status).toBe("ACTIVE");
  });

  // SUB-05 — approve + regra de ouro revalidada
  it("POST /:id/approve ativa a subscription; uma 2ª pendente da mesma company é barrada mesmo já tendo passado no request", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const subA = await seedSubscription({ companyId: company.id, planId: plan.id });
    const subB = await seedSubscription({ companyId: company.id, planId: plan.id });

    const adminToken = await loginAs(app, admin.email, PASSWORD);

    const approveA = await request(app)
      .post(`/api/subscriptions/${subA.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approveA.status).toBe(200);
    expect(approveA.body.status).toBe("ACTIVE");
    expect(approveA.body.startDate).not.toBeNull();

    const logApprove = await prisma.auditLog.findFirst({
      where: { entityType: "Subscription", entityId: subA.id, action: "SUBSCRIPTION_APPROVED" },
    });
    expect(logApprove?.actorId).toBe(admin.id);

    // regra de ouro revalidada no approve — subB não pode ser aprovada
    const approveB = await request(app)
      .post(`/api/subscriptions/${subB.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approveB.status).toBe(409);
    expect(approveB.body.error).toBe("ALREADY_HAS_ACTIVE_SUBSCRIPTION");

    // reaprovar subA (já ACTIVE) é transição inválida
    const reapproveA = await request(app)
      .post(`/api/subscriptions/${subA.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(reapproveA.status).toBe(400);
    expect(reapproveA.body.error).toBe("INVALID_STATUS_TRANSITION");
  });

  // SUB-06
  it("POST /:id/reject: só ADMIN, apenas em PENDING_APPROVAL, grava AuditLog", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const sub = await seedSubscription({ companyId: company.id, planId: plan.id });

    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientToken = await loginAs(app, client.email, PASSWORD);

    const rejectAsClient = await request(app)
      .post(`/api/subscriptions/${sub.id}/reject`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(rejectAsClient.status).toBe(403);

    const rejectAsAdmin = await request(app)
      .post(`/api/subscriptions/${sub.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(rejectAsAdmin.status).toBe(200);
    expect(rejectAsAdmin.body.status).toBe("REJECTED");

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Subscription", entityId: sub.id, action: "SUBSCRIPTION_REJECTED" },
    });
    expect(log?.actorId).toBe(admin.id);

    const rejectAgain = await request(app)
      .post(`/api/subscriptions/${sub.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(rejectAgain.status).toBe(400);
    expect(rejectAgain.body.error).toBe("INVALID_STATUS_TRANSITION");
  });

  // SUB-07
  it("GET /api/subscriptions/current retorna a ACTIVE da company do usuário, ou 404 se não houver", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const noneYet = await request(app).get("/api/subscriptions/current").set("Authorization", `Bearer ${token}`);
    expect(noneYet.status).toBe(404);
    expect(noneYet.body.error).toBe("SUBSCRIPTION_NOT_FOUND");

    const active = await seedSubscription({
      companyId: company.id,
      planId: plan.id,
      status: "ACTIVE",
      startDate: new Date(),
    });

    const found = await request(app).get("/api/subscriptions/current").set("Authorization", `Bearer ${token}`);
    expect(found.status).toBe(200);
    expect(found.body.id).toBe(active.id);
  });
});
