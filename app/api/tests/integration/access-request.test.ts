/**
 * Fundação e hardening 1.1 da Issue #51 contra MySQL real e isolado.
 * Valida lifecycle, reserva, rotação e concorrência com expectativas independentes;
 * consumido pelo Jest, sem HTTP novo, envio de e-mail ou criação de User por convite.
 */
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma.database";
import {
  ACCESS_REQUEST_STATUSES, AccessRequestEntity, normalizeAccessRequestEmail,
  type AccessRequest, type AccessRequestStatus, type CreateAccessRequestDTO,
} from "../../src/models/access-request.model";
import { accessTokenDeadline, type AccessTokenPurpose } from "../../src/models/access-token.model";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { EmailVerificationTokenRepository } from "../../src/repositories/email-verification-token.repository";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { generateAccessToken, hashAccessToken } from "../../src/utils/access-token.util";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";

const requests = new AccessRequestRepository(prisma);
const verifications = new EmailVerificationTokenRepository(prisma);
const invitations = new AccessInvitationRepository(prisma);
const INPUT = { name: "Solicitante", email: "request@empresa.local", companyName: "Empresa declarada" };
const PASSWORD = "Legacy-password-51";
const DAY = 86_400_000;
const STATES = ["PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED", "ACTIVATED"] as const;
// Oráculo explícito: nunca importar a tabela de transições para decidir a expectativa.
const ALLOWED = new Set([
  "PENDING_EMAIL_VERIFICATION>PENDING_REVIEW", "PENDING_EMAIL_VERIFICATION>EXPIRED",
  "PENDING_REVIEW>APPROVED", "PENDING_REVIEW>REJECTED", "PENDING_REVIEW>EXPIRED",
  "APPROVED>ACTIVATED", "APPROVED>EXPIRED",
]);

async function create(dto: CreateAccessRequestDTO = INPUT, now = new Date()): Promise<AccessRequest> {
  const row = await requests.createIfEmailAvailable(dto, now);
  expect(row).not.toBeNull();
  return row!;
}
async function reviewer(email = "admin@vulnera.local") {
  const row = await seedUser({ name: "Admin existente", email, password: PASSWORD, role: "ADMIN" });
  return { userId: row.id, role: "ADMIN" as const };
}
type Reviewer = Awaited<ReturnType<typeof reviewer>>;
async function move(row: AccessRequest, status: AccessRequestStatus, actor?: Reviewer, now = new Date()) {
  expect(await requests.transitionIfCurrent(row.id, new AccessRequestEntity(row).transitionTo(status, actor, "Motivo registrado", now))).toBe(true);
  return (await requests.findById(row.id))!;
}
async function approved(email = INPUT.email, actor?: Reviewer) {
  return move(await move(await create({ ...INPUT, email }), "PENDING_REVIEW"), "APPROVED", actor ?? await reviewer());
}
async function scenario(kind: AccessTokenPurpose) {
  const parent = kind === "INVITATION" ? await approved() : await create();
  const repo = kind === "INVITATION" ? invitations : verifications;
  const now = new Date();
  const tokenHash = generateAccessToken().tokenHash;
  const slot = await repo.createIfEligible({ accessRequestId: parent.id, tokenHash, expiresAt: new Date(now.getTime() + 60_000) }, now);
  expect(slot).not.toBeNull();
  return { parent, repo, slot: slot!, now };
}
function rotateData(slot: { accessRequestId: string; tokenHash: string; revokedAt: Date | null }, now: Date, tokenHash = generateAccessToken().tokenHash) {
  return { accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash, expectedRevokedAt: slot.revokedAt, tokenHash, expiresAt: new Date(now.getTime() + 60_000) };
}

describe("AccessRequest — Etapas 0, 1 e 1.1", () => {
  beforeEach(cleanDatabase);

  it("persiste pedido/evento anônimo, sem identidade, Company, Subscription ou JWT", async () => {
    const now = new Date(), row = await create({ ...INPUT, phone: "11999999999" }, now);
    expect(row).toMatchObject({ ...INPUT, phone: "11999999999", activeEmail: INPUT.email, status: "PENDING_EMAIL_VERIFICATION", emailVerifiedAt: null });
    expect(row.expiresAt.getTime() - now.getTime()).toBe(7 * DAY);
    expect(await requests.findEvents(row.id)).toMatchObject([{ actorId: null, fromStatus: null, toStatus: "PENDING_EMAIL_VERIFICATION" }]);
    expect(await Promise.all([prisma.user.count(), prisma.company.count(), prisma.subscription.count(), prisma.refreshToken.count(), prisma.auditLog.count()])).toEqual([0, 0, 0, 0, 0]);
  });

  it.each([
    ["  Pessoa+Demo@Empresa.COM  ", "pessoa+demo@empresa.com"],
    ["\tPessoa.Silva@Empresa.com\n", "pessoa.silva@empresa.com"],
  ])("normaliza %j sem remover pontos ou aliases", async (input, email) => {
    expect(normalizeAccessRequestEmail(input)).toBe(email);
    expect(await create({ ...INPUT, email: input })).toMatchObject({ email, activeEmail: email });
    expect((await requests.findActiveByEmail(input))?.email).toBe(email);
  });

  const equivalents = [
    ["Pessoa@Empresa.local", "pessoa@empresa.local"],
    ["pessoa@empresa.local", "péssoa@empresa.local"],
    ["strasse@empresa.local", "straße@empresa.local"],
    ["café@empresa.local", "cafe\u0301@empresa.local"],
  ];
  it.each(equivalents)("reserva aplica a equivalência MySQL de %s e %s", async (first, second) => {
    const row = await create({ ...INPUT, email: first });
    await expect(create({ ...INPUT, email: second })).rejects.toMatchObject({ code: "P2002" });
    expect((await requests.findActiveByEmail(second))?.id).toBe(row.id);
    expect(await prisma.accessRequestEvent.count()).toBe(1);
  });

  it.each(equivalents)("User existente bloqueia nova solicitação equivalente: %s / %s", async (first, second) => {
    const legacy = await seedUser({ name: "Conta existente", email: first, password: PASSWORD, role: "CLIENT" });
    expect(await requests.createIfEmailAvailable({ ...INPUT, email: " " + second + " " })).toBeNull();
    expect(await prisma.accessRequest.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: legacy.id } })).toEqual(legacy);
  });

  it("aliases distintos permanecem distintos", async () => {
    await create({ ...INPUT, email: "pessoa@empresa.local" });
    await create({ ...INPUT, email: "pessoa+demo@empresa.local" });
    expect(await prisma.accessRequest.count()).toBe(2);
  });

  it("reservas concorrentes equivalentes têm um único vencedor no índice", async () => {
    const results = await Promise.allSettled([
      create({ ...INPUT, email: "  PESSOA@EMPRESA.LOCAL " }),
      create({ ...INPUT, email: "péssoa@empresa.local" }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "P2002" } });
    expect(await prisma.accessRequest.count()).toBe(1);
    expect(await prisma.accessRequestEvent.count()).toBe(1);
  });

  it("declara exatamente os seis estados esperados", () => expect(ACCESS_REQUEST_STATUSES).toEqual(STATES));

  it.each(STATES.flatMap(from => STATES.map(to => [from, to] as const)))("matriz independente: %s → %s", async (from, to) => {
    const row = { ...await create(), status: from };
    const entity = new AccessRequestEntity(row);
    const now = to === "EXPIRED" ? row.expiresAt : new Date();
    if (ALLOWED.has(from + ">" + to)) {
      expect(entity.transitionTo(to, { userId: "ator-interno", role: "ADMIN" }, undefined, now)).toMatchObject({ fromStatus: from, toStatus: to });
    } else {
      expect(() => entity.transitionTo(to, { userId: "ator-interno", role: "ADMIN" }, undefined, now)).toThrow("INVALID_STATUS_TRANSITION");
    }
  });

  it.each(["CLIENT", "PENTESTER", undefined] as const)("revisão recusa ator %s", async role => {
    const row = await move(await create(), "PENDING_REVIEW");
    for (const to of ["APPROVED", "REJECTED"] as const) {
      expect(() => new AccessRequestEntity(row).transitionTo(to, role ? { userId: "ator", role } : undefined)).toThrow("FORBIDDEN");
    }
  });

  it("aplica 30 dias de revisão e 7 dias de aprovação sem criar conta", async () => {
    const initial = await create(), verifiedAt = new Date();
    const pending = await move(initial, "PENDING_REVIEW", undefined, verifiedAt);
    expect(pending.expiresAt.getTime() - verifiedAt.getTime()).toBe(30 * DAY);
    const actor = await reviewer(), reviewedAt = new Date();
    const row = await move(pending, "APPROVED", actor, reviewedAt);
    expect(row.expiresAt.getTime() - reviewedAt.getTime()).toBe(7 * DAY);
    expect(await prisma.user.count()).toBe(1);
    await expect(create()).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejeição libera reserva e preserva pedidos, atores e motivos anteriores", async () => {
    const actor = await reviewer();
    for (let i = 0; i < 2; i++) {
      const row = await move(await move(await create(), "PENDING_REVIEW"), "REJECTED", actor);
      expect(row).toMatchObject({ activeEmail: null, rejectionReason: "Motivo registrado", reviewedById: actor.userId });
      expect(await requests.findEvents(row.id)).toHaveLength(3);
    }
    const next = await create();
    expect((await requests.findHistoryByEmail(INPUT.email)).map(r => r.status)).toEqual(["REJECTED", "REJECTED", "PENDING_EMAIL_VERIFICATION"]);
    expect((await requests.findActiveByEmail(INPUT.email))?.id).toBe(next.id);
  });

  it.each(["PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED"] as const)("expira %s somente no prazo, libera reserva e mantém histórico", async status => {
    let row = status === "APPROVED" ? await approved() : await create();
    if (status === "PENDING_REVIEW") row = await move(row, "PENDING_REVIEW");
    expect(() => new AccessRequestEntity(row).transitionTo("EXPIRED", undefined, undefined, new Date(row.expiresAt.getTime() - 1))).toThrow("ACCESS_REQUEST_NOT_EXPIRED");
    expect(() => new AccessRequestEntity(row).transitionTo(status === "APPROVED" ? "ACTIVATED" : status === "PENDING_REVIEW" ? "REJECTED" : "PENDING_REVIEW", undefined, undefined, row.expiresAt)).toThrow("ACCESS_REQUEST_EXPIRED");
    const due = await requests.findExpiredReservations(row.expiresAt);
    expect(due.map(r => r.id)).toContain(row.id);
    const expired = await move(row, "EXPIRED", undefined, row.expiresAt);
    expect(expired).toMatchObject({ status: "EXPIRED", activeEmail: null });
    await expect(prisma.accessRequest.update({ where: { id: row.id }, data: { activeEmail: row.email } })).rejects.toThrow();
    expect(expired.expiresAt).toEqual(row.expiresAt);
    expect((await requests.findEvents(row.id)).at(-1)).toMatchObject({ fromStatus: status, toStatus: "EXPIRED", actorId: null });
    await create(INPUT, new Date(row.expiresAt.getTime() + 1));
    expect(await requests.findHistoryByEmail(INPUT.email)).toHaveLength(2);
  });

  it("ACTIVATED libera a reserva sem criar User ou afirmar ativação completa", async () => {
    const row = await approved(), before = await prisma.user.count();
    const activated = await move(row, "ACTIVATED");
    expect(activated.activeEmail).toBeNull();
    await expect(prisma.accessRequest.update({ where: { id: row.id }, data: { activeEmail: row.email } })).rejects.toThrow();
    expect(await prisma.user.count()).toBe(before);
    expect((await requests.findEvents(row.id)).at(-1)).toMatchObject({ fromStatus: "APPROVED", toStatus: "ACTIVATED", actorId: null });
    await create();
  });

  it("snapshot histórico ACTIVATED não bloqueia nova tentativa após exclusão da conta antiga", async () => {
    // Fixtures de contas preexistentes; nenhuma criação de User pelo fluxo de convite.
    const legacy = await seedUser({ name: "Conta anterior", email: INPUT.email, password: PASSWORD, role: "CLIENT" });
    const actor = await reviewer(), now = new Date();
    await prisma.accessRequest.create({ data: {
      ...INPUT, status: "ACTIVATED", activeEmail: null, createdAt: new Date(now.getTime() - DAY), updatedAt: now,
      expiresAt: new Date(now.getTime() + DAY), emailVerifiedAt: now, reviewedAt: now, reviewedById: actor.userId,
    } });
    expect(await requests.createIfEmailAvailable(INPUT)).toBeNull();
    await prisma.user.delete({ where: { id: legacy.id } });
    await create();
    expect(await prisma.user.count()).toBe(1);
    expect(await requests.findHistoryByEmail(INPUT.email)).toHaveLength(2);
  });

  it("decisões concorrentes incompatíveis produzem uma mudança e um evento", async () => {
    const row = await move(await create(), "PENDING_REVIEW");
    const actorA = await reviewer(), actorB = await reviewer("admin2@vulnera.local");
    const results = await Promise.all([
      requests.transitionIfCurrent(row.id, new AccessRequestEntity(row).transitionTo("APPROVED", actorA)),
      requests.transitionIfCurrent(row.id, new AccessRequestEntity(row).transitionTo("REJECTED", actorB)),
    ]);
    expect([...results].sort()).toEqual([false, true]);
    expect(await requests.findEvents(row.id)).toHaveLength(3);
  });

  it("erro da trilha reverte transição e prazo", async () => {
    const row = await move(await create(), "PENDING_REVIEW");
    const dto = new AccessRequestEntity(row).transitionTo("APPROVED", await reviewer());
    await expect(requests.transitionIfCurrent(row.id, { ...dto, reason: "inválido na aprovação" })).rejects.toThrow();
    expect(await requests.findById(row.id)).toEqual(row);
    expect(await requests.findEvents(row.id)).toHaveLength(2);
  });

  it("rollback reverte expiração, liberação e criação da tentativa seguinte", async () => {
    const row = await create();
    await expect(requests.transaction(async scoped => {
      expect(await scoped.requests.transitionIfCurrent(row.id, new AccessRequestEntity(row).transitionTo("EXPIRED", undefined, undefined, row.expiresAt))).toBe(true);
      expect(await scoped.requests.createIfEmailAvailable(INPUT, row.expiresAt)).not.toBeNull();
      throw new Error("ROLLBACK");
    })).rejects.toThrow("ROLLBACK");
    expect(await requests.findById(row.id)).toEqual(row);
    expect(await requests.findHistoryByEmail(INPUT.email)).toHaveLength(1);
    expect(await requests.findEvents(row.id)).toHaveLength(1);
  });

  it.each([
    { activeEmail: null }, { activeEmail: "outro@empresa.local" }, { status: "UNKNOWN" },
    { status: "pending_email_verification" }, { status: "PENDING_EMAIL_VERIFICATION " },
    { email: "UPPER@empresa.local", activeEmail: "UPPER@empresa.local" },
    { email: " request@empresa.local", activeEmail: " request@empresa.local" },
    { status: "PENDING_REVIEW" }, { status: "REJECTED", activeEmail: null },
    { status: "ACTIVATED", activeEmail: null }, { status: "EXPIRED", activeEmail: null },
  ])("CHECKs recusam escrita inconsistente: %j", async patch => {
    const now = new Date();
    await expect(prisma.accessRequest.create({ data: { ...INPUT, activeEmail: INPUT.email, expiresAt: new Date(now.getTime() + DAY), ...patch } })).rejects.toThrow();
    expect(await prisma.accessRequest.count()).toBe(0);
  });

  it("FKs impedem órfãos e remoção de pedido ou revisor histórico", async () => {
    const row = await approved();
    const orphan = { accessRequestId: "ausente", tokenHash: generateAccessToken().tokenHash, expiresAt: new Date(Date.now() + 60_000) };
    await expect(prisma.emailVerificationToken.create({ data: orphan })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.accessInvitation.create({ data: orphan })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.accessRequestEvent.create({ data: { accessRequestId: "ausente", toStatus: "PENDING_EMAIL_VERIFICATION" } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.accessRequest.delete({ where: { id: row.id } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.user.delete({ where: { id: row.reviewedById! } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.auditLog.create({ data: { actorId: "visitante", entityType: "AccessRequest", entityId: row.id, action: "CREATE" } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("convite só pode ser emitido após aprovação; verificação só antes da confirmação", async () => {
    const row = await create(), now = new Date();
    const data = { accessRequestId: row.id, tokenHash: generateAccessToken().tokenHash, expiresAt: new Date(now.getTime() + 60_000) };
    expect(await invitations.createIfEligible(data, now)).toBeNull();
    await move(row, "PENDING_REVIEW");
    expect(await verifications.createIfEligible(data, now)).toBeNull();
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: armazena hash, limita slot e garante unicidade/formato", async kind => {
    const { parent, repo, slot, now } = await scenario(kind), secret = generateAccessToken();
    expect(secret.token).toHaveLength(43);
    expect(Buffer.from(secret.token, "base64url")).toHaveLength(32);
    expect(hashAccessToken(secret.token)).toBe(secret.tokenHash);
    expect(slot).not.toHaveProperty("token");
    await expect(repo.createIfEligible({ accessRequestId: parent.id, tokenHash: secret.tokenHash, expiresAt: new Date(now.getTime() + 60_000) }, now)).rejects.toMatchObject({ code: "P2002" });
    const actor = parent.reviewedById ? { userId: parent.reviewedById, role: "ADMIN" as const } : undefined;
    const other = kind === "INVITATION" ? await approved("other@empresa.local", actor) : await create({ ...INPUT, email: "other@empresa.local" });
    const expiry = new Date(Date.now() + 60_000);
    await expect(repo.createIfEligible({ accessRequestId: other.id, tokenHash: slot.tokenHash, expiresAt: expiry })).rejects.toMatchObject({ code: "P2002" });
    await expect(repo.createIfEligible({ accessRequestId: other.id, tokenHash: "segredo-bruto", expiresAt: expiry })).rejects.toThrow();
    expect(await repo.createIfEligible({ accessRequestId: "ausente", tokenHash: secret.tokenHash, expiresAt: expiry })).toBeNull();
    expect(await repo.createIfEligible({ accessRequestId: other.id, tokenHash: secret.tokenHash, expiresAt: now }, now)).toBeNull();
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: consumo concorrente, expiração e replay", async kind => {
    const { repo, slot } = await scenario(kind);
    expect(await repo.consumeIfAvailable(slot.tokenHash, slot.expiresAt)).toBe(false);
    expect(await repo.consumeIfAvailable(slot.tokenHash, new Date(slot.expiresAt.getTime() + 1))).toBe(false);
    const now = new Date(), results = await Promise.all([repo.consumeIfAvailable(slot.tokenHash, now), repo.consumeIfAvailable(slot.tokenHash, now)]);
    expect([...results].sort()).toEqual([false, true]);
    expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
    expect(await repo.rotateIfAvailable(rotateData(slot, now), now)).toBe(false);
    expect(await repo.revokeIfAvailable({ accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash }, now)).toBe(false);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: CHECKs do banco impedem datas inválidas e uso junto com revogação", async kind => {
    const { repo, slot } = await scenario(kind), before = new Date(slot.issuedAt.getTime() - 1);
    const write = (data: { issuedAt?: Date; expiresAt?: Date; usedAt?: Date; revokedAt?: Date }) => kind === "INVITATION"
      ? prisma.accessInvitation.update({ where: { id: slot.id }, data })
      : prisma.emailVerificationToken.update({ where: { id: slot.id }, data });
    for (const patch of [
      { issuedAt: new Date(slot.createdAt.getTime() - 1) }, { expiresAt: slot.issuedAt },
      { usedAt: before }, { revokedAt: before }, { usedAt: slot.issuedAt, revokedAt: slot.issuedAt },
    ]) {
      await expect(write(patch)).rejects.toThrow();
      expect(await repo.findByHash(slot.tokenHash)).toEqual(slot);
    }
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: rotação concorrente invalida hash antigo e preserva prazo do pedido", async kind => {
    const { parent, repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1);
    const a = rotateData(slot, now), b = rotateData(slot, now);
    const results = await Promise.all([repo.rotateIfAvailable(a, now), repo.rotateIfAvailable(b, now)]);
    expect([...results].sort()).toEqual([false, true]);
    expect(await repo.findByHash(slot.tokenHash)).toBeNull();
    expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
    const winner = await repo.findByHash(a.tokenHash) ?? await repo.findByHash(b.tokenHash);
    expect(winner).toMatchObject({ id: slot.id, issuedAt: now, createdAt: slot.createdAt, revokedAt: null });
    expect((await requests.findById(parent.id))?.expiresAt).toEqual(parent.expiresAt);
    expect(await repo.consumeIfAvailable(winner!.tokenHash, new Date(now.getTime() + 1))).toBe(true);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: rotação versus consumo tem um vencedor", async kind => {
    const { repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1), dto = rotateData(slot, now);
    const results = await Promise.all([repo.rotateIfAvailable(dto, now), repo.consumeIfAvailable(slot.tokenHash, now)]);
    expect([...results].sort()).toEqual([false, true]);
    if (results[0]) {
      expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
      expect(await repo.consumeIfAvailable(dto.tokenHash, new Date(now.getTime() + 1))).toBe(true);
    } else {
      expect(await repo.findByHash(dto.tokenHash)).toBeNull();
      expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
    }
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: revogação concorre com rotação sem ser desfeita por comando antigo", async kind => {
    const { repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1);
    const dto = rotateData(slot, now);
    const results = await Promise.all([
      repo.revokeIfAvailable({ accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash }, now),
      repo.rotateIfAvailable(dto, now),
    ]);
    expect([...results].sort()).toEqual([false, true]);
    expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
    if (results[0]) {
      const revoked = (await repo.findByHash(slot.tokenHash))!;
      expect(revoked.revokedAt).toEqual(now);
      expect(await repo.rotateIfAvailable(dto, now)).toBe(false);
      const next = rotateData(revoked, new Date(now.getTime() + 1));
      expect(await repo.rotateIfAvailable(next, new Date(now.getTime() + 1))).toBe(true);
    }
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: revogação versus consumo e replay", async kind => {
    const { repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1);
    const results = await Promise.all([
      repo.revokeIfAvailable({ accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash }, now),
      repo.consumeIfAvailable(slot.tokenHash, now),
    ]);
    expect([...results].sort()).toEqual([false, true]);
    expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
    expect(await repo.revokeIfAvailable({ accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash }, now)).toBe(false);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: rollback de rotação, revogação e consumo", async kind => {
    const { repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1);
    for (const operation of ["rotate", "revoke", "consume"] as const) {
      await expect(requests.transaction(async scoped => {
        const bound = kind === "INVITATION" ? scoped.invitations : scoped.verificationTokens;
        const changed = operation === "rotate" ? await bound.rotateIfAvailable(rotateData(slot, now), now)
          : operation === "revoke" ? await bound.revokeIfAvailable({ accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash }, now)
          : await bound.consumeIfAvailable(slot.tokenHash, now);
        expect(changed).toBe(true);
        throw new Error("ROLLBACK");
      })).rejects.toThrow("ROLLBACK");
      expect(await repo.findByHash(slot.tokenHash)).toEqual(slot);
    }
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: rejeita hash repetido, janela inválida e prazos além do pedido", async kind => {
    const { parent, repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1);
    expect(await repo.rotateIfAvailable(rotateData(slot, now, slot.tokenHash), now)).toBe(false);
    expect(await repo.rotateIfAvailable({ ...rotateData(slot, now), expiresAt: new Date(parent.expiresAt.getTime() + 1) }, now)).toBe(false);
    expect(await repo.rotateIfAvailable({ ...rotateData(slot, now), expiresAt: now }, now)).toBe(false);
    const late = new Date(parent.expiresAt.getTime() - 1000), bounded = accessTokenDeadline(kind, parent.expiresAt, late);
    expect(bounded).toEqual(parent.expiresAt);
    const tooLong = new Date(now.getTime() + (kind === "VERIFICATION" ? 3_600_001 : 48 * 3_600_000 + 1));
    expect(await repo.rotateIfAvailable({ ...rotateData(slot, now), expiresAt: tooLong }, now)).toBe(false);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: pedido vencido impede emissão/rotação/consumo e encerramento revoga o slot", async kind => {
    const { parent, repo, slot } = await scenario(kind), due = parent.expiresAt;
    expect(await repo.rotateIfAvailable(rotateData(slot, due), due)).toBe(false);
    expect(await repo.consumeIfAvailable(slot.tokenHash, due)).toBe(false);
    await move(parent, "EXPIRED", undefined, due);
    expect((await repo.findByHash(slot.tokenHash))?.revokedAt).toEqual(due);
    expect(await repo.createIfEligible({ accessRequestId: parent.id, tokenHash: generateAccessToken().tokenHash, expiresAt: new Date(due.getTime() + 60_000) }, due)).toBeNull();
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: token vencido não expira pedido e admite reemissão na janela válida", async kind => {
    const { parent, repo, slot } = await scenario(kind), now = new Date(slot.expiresAt.getTime() + 1);
    expect(() => new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, now)).toThrow("ACCESS_REQUEST_NOT_EXPIRED");
    expect(await repo.rotateIfAvailable(rotateData(slot, now), now)).toBe(true);
    expect((await requests.findById(parent.id))?.expiresAt).toEqual(parent.expiresAt);
  });

  it("solicitação antiga abandonada é recuperada por encerramento e nova reserva na mesma transação", async () => {
    const now = new Date(), row = await create(INPUT, new Date(now.getTime() - 8 * DAY));
    await expect(create()).rejects.toMatchObject({ code: "P2002" });
    await requests.transaction(async scoped => {
      const active = (await scoped.requests.findActiveByEmail(INPUT.email))!;
      expect(await scoped.requests.transitionIfCurrent(active.id, new AccessRequestEntity(active).transitionTo("EXPIRED", undefined, undefined, now))).toBe(true);
      expect(await scoped.requests.createIfEmailAvailable(INPUT, now)).not.toBeNull();
    });
    expect((await requests.findById(row.id))?.status).toBe("EXPIRED");
    expect(await requests.findHistoryByEmail(INPUT.email)).toHaveLength(2);
  });

  it("CAS recusa encerramento antecipado mesmo com DTO construído fora da entidade", async () => {
    const row = await create();
    const dto = new AccessRequestEntity(row).transitionTo("EXPIRED", undefined, undefined, row.expiresAt);
    expect(await requests.transitionIfCurrent(row.id, { ...dto, occurredAt: new Date(row.expiresAt.getTime() - 1) })).toBe(false);
    expect(await requests.findById(row.id)).toEqual(row);
    expect(await requests.findEvents(row.id)).toHaveLength(1);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: falha no evento terminal reverte reserva, estado e revogação automática", async kind => {
    const { parent, repo, slot } = await scenario(kind);
    const dto = new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, parent.expiresAt);
    await expect(requests.transitionIfCurrent(parent.id, { ...dto, reason: "inválido no evento de expiração" })).rejects.toThrow();
    expect(await requests.findById(parent.id)).toEqual(parent);
    expect(await repo.findByHash(slot.tokenHash)).toEqual(slot);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: colisão de hash durante rotação preserva o slot anterior", async kind => {
    const { parent, repo, slot } = await scenario(kind);
    const actor = parent.reviewedById ? { userId: parent.reviewedById, role: "ADMIN" as const } : undefined;
    const other = kind === "INVITATION" ? await approved("other@empresa.local", actor) : await create({ ...INPUT, email: "other@empresa.local" });
    const now = new Date(), occupied = generateAccessToken().tokenHash;
    expect(await repo.createIfEligible({ accessRequestId: other.id, tokenHash: occupied, expiresAt: new Date(now.getTime() + 60_000) }, now)).not.toBeNull();
    await expect(repo.rotateIfAvailable(rotateData(slot, now, occupied), now)).rejects.toMatchObject({ code: "P2002" });
    expect(await repo.findByHash(slot.tokenHash)).toEqual(slot);
    expect(await repo.consumeIfAvailable(slot.tokenHash, new Date())).toBe(true);
  });

  it.each(["VERIFICATION", "INVITATION"] as const)("%s: reemissão após revogação exige leitura do estado atual", async kind => {
    const { repo, slot } = await scenario(kind), now = new Date(slot.issuedAt.getTime() + 1);
    expect(await repo.revokeIfAvailable({ accessRequestId: slot.accessRequestId, expectedTokenHash: slot.tokenHash }, now)).toBe(true);
    expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
    expect(await repo.rotateIfAvailable(rotateData(slot, now), now)).toBe(false);
    const revoked = (await repo.findByHash(slot.tokenHash))!, next = rotateData(revoked, now);
    expect(await repo.rotateIfAvailable(next, now)).toBe(true);
    expect(await repo.consumeIfAvailable(next.tokenHash, now)).toBe(true);
    expect(await repo.consumeIfAvailable(slot.tokenHash, now)).toBe(false);
  });

  it("pedido sem token permite preparação posterior e pedido abandonado pode ser encerrado", async () => {
    const row = await create();
    expect(await prisma.emailVerificationToken.count()).toBe(0);
    const now = new Date(row.createdAt.getTime() + DAY);
    expect(await verifications.createIfEligible({ accessRequestId: row.id, tokenHash: generateAccessToken().tokenHash, expiresAt: new Date(now.getTime() + 60_000) }, now)).not.toBeNull();
    await move(row, "EXPIRED", undefined, row.expiresAt);
    await create(INPUT, row.expiresAt);
  });

  it("falha de CAS posterior ao consumo permite rollback explícito do conjunto", async () => {
    const { parent, slot } = await scenario("VERIFICATION"), now = new Date();
    const dto = new AccessRequestEntity(parent).transitionTo("PENDING_REVIEW", undefined, undefined, now);
    await expect(requests.transaction(async scoped => {
      expect(await scoped.verificationTokens.consumeIfAvailable(slot.tokenHash, now)).toBe(true);
      const changed = await scoped.requests.transitionIfCurrent(parent.id, { ...dto, expectedExpiresAt: new Date(parent.expiresAt.getTime() - 1) });
      if (!changed) throw new Error("CAS_FAILED");
    })).rejects.toThrow("CAS_FAILED");
    expect((await verifications.findByHash(slot.tokenHash))?.usedAt).toBeNull();
    expect(await requests.findById(parent.id)).toEqual(parent);
    expect(await requests.findEvents(parent.id)).toHaveLength(1);
  });

  it.each(["ADMIN", "PENTESTER", "CLIENT"] as const)("mantém login e dados da conta antiga %s sem AccessRequest", async role => {
    const legacy = await seedUser({ name: "Conta existente", email: "legacy@empresa.local", password: PASSWORD, role });
    await create();
    const res = await request(app).post("/api/auth/login").send({ email: legacy.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: legacy.id, role });
    expect(res.body.accessToken).toBeDefined();
    expect(await prisma.user.findUnique({ where: { id: legacy.id } })).toEqual(legacy);
  });

  it("não monta endpoints de solicitação ou ativação", async () => {
    for (const path of ["/api/access-requests", "/api/access-requests/verify-email", "/api/account-activation/activate"]) {
      expect((await request(app).post(path).send(INPUT)).status).toBe(404);
    }
  });
});
