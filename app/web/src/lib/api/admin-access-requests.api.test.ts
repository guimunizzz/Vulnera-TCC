/**
 * O que faz: valida métodos, rotas e parâmetros do cliente administrativo.
 * Por que existe: evita desvios entre a interface e o contrato HTTP aprovado.
 * Quem consome: suíte focal do módulo de solicitações de acesso.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./client", () => ({ apiClient: { get, post } }));
import { adminAccessRequestsApi } from "./admin-access-requests.api";
beforeEach(() => { vi.clearAllMocks(); });
describe("adminAccessRequestsApi", () => {
  it("lista com paginação/filtro e retorna data", async () => {
    const response = { items: [], total: 0, page: 2, pageSize: 20 };
    get.mockResolvedValue({ data: response });
    await expect(adminAccessRequestsApi.list({ page: 2, pageSize: 20, status: "PENDING_REVIEW" })).resolves.toEqual(response);
    expect(get).toHaveBeenCalledWith("/admin/access-requests", { params: { page: 2, pageSize: 20, status: "PENDING_REVIEW" } });
  });
  it("codifica ids no detalhe e histórico", async () => {
    get.mockResolvedValue({ data: {} });
    await adminAccessRequestsApi.get("abc/def");
    await adminAccessRequestsApi.events("abc/def", { page: 3, pageSize: 20 });
    expect(get).toHaveBeenNthCalledWith(1, "/admin/access-requests/abc%2Fdef");
    expect(get).toHaveBeenNthCalledWith(2, "/admin/access-requests/abc%2Fdef/events", { params: { page: 3, pageSize: 20 } });
  });
  it("envia as três decisões e mantém a resposta de entrega", async () => {
    const sent = { request: { id: "r1", status: "APPROVED" }, invitationDelivery: "DELIVERY_FAILED" };
    post.mockResolvedValue({ data: sent });
    await expect(adminAccessRequestsApi.approve("r1")).resolves.toEqual(sent);
    await adminAccessRequestsApi.reject("r1", { reason: "Duplicado" });
    await adminAccessRequestsApi.resendInvitation("r1");
    expect(post).toHaveBeenNthCalledWith(1, "/admin/access-requests/r1/approve", {});
    expect(post).toHaveBeenNthCalledWith(2, "/admin/access-requests/r1/reject", { reason: "Duplicado" });
    expect(post).toHaveBeenNthCalledWith(3, "/admin/access-requests/r1/resend-invitation", {});
  });
  it("propaga erros Axios sem expor ou transformar payload", async () => {
    const failure = { response: { status: 429, data: { error: "ACCESS_INVITATION_COOLDOWN" } } };
    post.mockRejectedValue(failure);
    await expect(adminAccessRequestsApi.resendInvitation("r1")).rejects.toBe(failure);
  });
});
