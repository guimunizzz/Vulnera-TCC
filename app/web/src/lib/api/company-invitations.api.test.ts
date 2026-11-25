/** Mantém rotas, payloads e respostas de gestão de equipe sincronizados ao contrato. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const { get, post, deleteRequest, publicPost } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), deleteRequest: vi.fn(), publicPost: vi.fn() }));
vi.mock("./client", () => ({ apiClient: { get, post, delete: deleteRequest } }));
vi.mock("./public-http", () => ({ publicPost }));
import { companyInvitationsApi } from "./company-invitations.api";

beforeEach(() => vi.clearAllMocks());
describe("companyInvitationsApi", () => {
  it("lista membros, convites e histórico append-only", async () => {
    get.mockResolvedValue({ data: [] });
    await companyInvitationsApi.listMembers();
    await companyInvitationsApi.list();
    await companyInvitationsApi.history();
    expect(get).toHaveBeenNthCalledWith(1, "/companies/me/members");
    expect(get).toHaveBeenNthCalledWith(2, "/companies/me/invitations");
    expect(get).toHaveBeenNthCalledWith(3, "/companies/me/invitations/history");
  });
  it("envia convites, reenvia, revoga e desativa usando ids codificados", async () => {
    post.mockResolvedValue({ data: { invitation: {}, delivery: "SENT" } });
    deleteRequest.mockResolvedValue({ data: undefined });
    await companyInvitationsApi.create({ name: "Membro", email: "membro@example.test" });
    await companyInvitationsApi.resend("invite/1");
    await companyInvitationsApi.revoke("invite/1");
    await companyInvitationsApi.deactivateMember("user/1");
    expect(post).toHaveBeenNthCalledWith(1, "/companies/me/invitations", { name: "Membro", email: "membro@example.test" });
    expect(post).toHaveBeenNthCalledWith(2, "/companies/me/invitations/invite%2F1/resend", {});
    expect(deleteRequest).toHaveBeenNthCalledWith(1, "/companies/me/invitations/invite%2F1");
    expect(deleteRequest).toHaveBeenNthCalledWith(2, "/companies/me/members/user%2F1");
  });
  it("mantém ativação pública separada do cliente autenticado", async () => {
    publicPost.mockResolvedValueOnce({ valid: true }).mockResolvedValueOnce(undefined);
    await expect(companyInvitationsApi.validatePublic("team_token")).resolves.toEqual({ valid: true });
    await companyInvitationsApi.activatePublic({ token: "team_token", password: "senha-segura" });
    expect(publicPost).toHaveBeenNthCalledWith(1, "/company-invitations/validate", { token: "team_token" });
    expect(publicPost).toHaveBeenNthCalledWith(2, "/company-invitations/activate", { token: "team_token", password: "senha-segura" });
  });
});
