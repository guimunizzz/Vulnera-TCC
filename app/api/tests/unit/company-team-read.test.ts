/**
 * Contratos defensivos de leitura e gestão da equipe com identidades fictícias.
 * Não acessa banco, rede ou SMTP; prova políticas, revalidação e projeção mínima.
 * Consumido pelo Jest unitário e pela regressão da wave B2B.
 */
import type { Request, Response } from "express";
import type { User } from "../../src/models/user.model";
import type { AccessDatabaseClient } from "../../src/repositories/access-transaction.repository";
import { CompanyInvitationRepository } from "../../src/repositories/company-invitation.repository";
import type { UserRepository } from "../../src/repositories/user.repository";
import { CompanyInvitationService } from "../../src/services/company-invitation.service";
import { CompanyInvitationController } from "../../src/controllers/company-invitation.controller";

const now = new Date("2026-11-27T12:00:00Z");
function identity(id: string, companyId: string | null, companyRole: string | null, extra: Partial<User> = {}): User {
  return { id, name: id, email: `${id}@example.test`, role: "CLIENT", companyId, companyRole,
    deactivatedAt: null, sessionVersion: 0, password: "fixture-hash", expoPushToken: null,
    legacyOnboardingAllowed: false, createdAt: now, updatedAt: now, ...extra };
}

function fixture() {
  const identities = [identity("owner-alpha", "alpha", "OWNER"), identity("member-alpha", "alpha", "MEMBER"),
    identity("owner-beta", "beta", "OWNER"), identity("member-beta", "beta", "MEMBER"),
    identity("disabled-alpha", "alpha", "MEMBER", { deactivatedAt: now })];
  const users = {
    findById: jest.fn(async (id: string) => identities.find(user => user.id === id) ?? null),
    lockById: jest.fn(async (id: string) => identities.find(user => user.id === id) ?? null),
    markDeactivated: jest.fn(async () => undefined),
  };
  const invitations = {
    lockCompany: jest.fn(async (id: string) => ({ id, name: `Empresa ${id}`, cnpj: "fixture-private" })),
    listActiveTeamMembers: jest.fn(async (companyId: string) => identities.filter(user => user.companyId === companyId && !user.deactivatedAt)),
    listActiveMembers: jest.fn(async (companyId: string) => identities.filter(user => user.companyId === companyId && !user.deactivatedAt)),
    recordAudit: jest.fn(async () => undefined),
    transactionWithRetry: jest.fn(),
  };
  const refreshTokens = { revokeAllForUser: jest.fn(async () => 1) };
  invitations.transactionWithRetry.mockImplementation(operation => operation({ invitations, users, refreshTokens }));
  const limiter = { consumeManagement: jest.fn(() => ({ allowed: true, remaining: 9, retryAfterSeconds: 0, resetAfterSeconds: 60, limit: 10 })) };
  const email = jest.fn(() => { throw new Error("UNEXPECTED_SMTP"); });
  const service = new CompanyInvitationService(invitations as unknown as CompanyInvitationRepository,
    users as unknown as UserRepository, limiter, email, { clock: () => now });
  return { identities, users, invitations, refreshTokens, limiter, email, service };
}

describe("leitura minimizada da equipe", () => {
  it.each(["owner-alpha", "member-alpha", "owner-beta", "member-beta"])("%s consulta somente sua empresa e nomes/papéis", async actorId => {
    const f = fixture();
    const companyId = actorId.endsWith("alpha") ? "alpha" : "beta";
    const response = await f.service.readTeam({ userId: actorId });
    expect(response).toEqual({ company: { id: companyId, name: `Empresa ${companyId}` }, members: [
      { id: `owner-${companyId}`, name: `owner-${companyId}`, companyRole: "OWNER" },
      { id: `member-${companyId}`, name: `member-${companyId}`, companyRole: "MEMBER" },
    ] });
    expect(f.invitations.listActiveTeamMembers).toHaveBeenCalledWith(companyId);
    expect(f.users.lockById).toHaveBeenCalledWith(actorId);
    expect(f.invitations.lockCompany.mock.invocationCallOrder[0]).toBeLessThan(f.users.lockById.mock.invocationCallOrder[0]);
    expect(f.invitations.listActiveMembers).not.toHaveBeenCalled();
    expect(f.limiter.consumeManagement).not.toHaveBeenCalled();
    expect(f.email).not.toHaveBeenCalled();
  });

  it.each([
    ["sem identidade", null],
    ["desativado", identity("actor", "alpha", "MEMBER", { deactivatedAt: now })],
    ["sem empresa", identity("actor", null, "MEMBER")],
    ["empresa vazia", identity("actor", "", "MEMBER")],
    ["sem papel empresarial", identity("actor", "alpha", null)],
    ["papel empresarial desconhecido", identity("actor", "alpha", "ADMIN")],
    ["ADMIN", identity("actor", "alpha", "OWNER", { role: "ADMIN" })],
    ["PENTESTER", identity("actor", "alpha", "MEMBER", { role: "PENTESTER" })],
  ] as const)("nega leitura a %s antes de consultar a equipe", async (_label, user) => {
    const f = fixture();
    f.users.findById.mockResolvedValue(user);
    await expect(f.service.readTeam({ userId: "actor" })).rejects.toThrow("FORBIDDEN");
    expect(f.invitations.transactionWithRetry).not.toHaveBeenCalled();
    expect(f.invitations.listActiveTeamMembers).not.toHaveBeenCalled();
  });

  it.each([
    ["desativação", { deactivatedAt: now }], ["troca de empresa", { companyId: "beta" }],
    ["perda de papel", { companyRole: null }], ["troca de perfil", { role: "PENTESTER" }],
  ] as const)("revalida %s depois do lock", async (_label, changes) => {
    const f = fixture();
    f.users.lockById.mockResolvedValue(identity("member-alpha", "alpha", "MEMBER", changes));
    await expect(f.service.readTeam({ userId: "member-alpha" })).rejects.toThrow("FORBIDDEN");
    expect(f.invitations.listActiveTeamMembers).not.toHaveBeenCalled();
  });

  it("aplica filtro de tenant, identidade ativa e projeção mínima no repository", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new CompanyInvitationRepository({ user: { findMany } } as unknown as AccessDatabaseClient);
    await repository.listActiveTeamMembers("alpha");
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: "alpha", role: "CLIENT", companyRole: { in: ["OWNER", "MEMBER"] }, deactivatedAt: null },
      select: { id: true, name: true, companyRole: true }, orderBy: { createdAt: "asc" },
    });
  });

  it("controller transmite somente a identidade autenticada ao contrato de leitura", async () => {
    const f = fixture();
    const read = jest.spyOn(f.service, "readTeam");
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await new CompanyInvitationController(f.service).readTeam({ user: { userId: "member-alpha" }, query: { companyId: "beta" } } as unknown as Request, response as unknown as Response);
    expect(read).toHaveBeenCalledWith({ userId: "member-alpha" });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ company: { id: "alpha", name: "Empresa alpha" } }));
  });
});

describe("separação de consulta e gestão", () => {
  it.each(["member-alpha", "member-beta"])("%s permanece sem convites, histórico, dados administrativos ou mutações", async userId => {
    const f = fixture();
    const actor = { userId };
    for (const operation of [
      () => f.service.listMembers(actor), () => f.service.listInvitations(actor), () => f.service.listInvitationHistory(actor),
      () => f.service.createInvitation(actor, { name: "Fictício", email: "fixture@example.test" }),
      () => f.service.resendInvitation(actor, "fixture-invitation"), () => f.service.revokeInvitation(actor, "fixture-invitation"),
      () => f.service.deactivateMember(actor, "fixture-user"),
    ]) await expect(operation()).rejects.toThrow("FORBIDDEN");
    expect(f.invitations.transactionWithRetry).not.toHaveBeenCalled();
    expect(f.limiter.consumeManagement).not.toHaveBeenCalled();
    expect(f.email).not.toHaveBeenCalled();
  });

  it("preserva a consulta administrativa e a desativação com revogação pelo OWNER", async () => {
    const f = fixture();
    const actor = { userId: "owner-alpha" };
    const members = await f.service.listMembers(actor);
    expect(members.map(member => member.email)).toEqual(["owner-alpha@example.test", "member-alpha@example.test"]);
    await f.service.deactivateMember(actor, "member-alpha");
    expect(f.users.markDeactivated).toHaveBeenCalledWith("member-alpha", now);
    expect(f.refreshTokens.revokeAllForUser).toHaveBeenCalledWith("member-alpha", now);
    expect(f.invitations.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ companyId: "alpha", action: "DEACTIVATE" }));
  });

  it("preserva o OWNER e recusa desativar integrantes de outra empresa", async () => {
    const f = fixture();
    for (const target of ["owner-alpha", "member-beta"]) {
      await expect(f.service.deactivateMember({ userId: "owner-alpha" }, target)).rejects.toThrow("COMPANY_MEMBER_NOT_FOUND");
    }
    expect(f.users.markDeactivated).not.toHaveBeenCalled();
    expect(f.refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});
