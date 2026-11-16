/**
 * Confere reações apenas a resultados finais, com isolamento de sessão e falhas preservadas.
 * Consumido pelo Vitest; executa o cache real de mutations sem chamadas de rede.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanceledError } from "axios";
import { beginAssistantFeedback, subscribeAssistantFeedback } from "./assistant-feedback";
import { createQueryClient } from "./query-client";

const cleanups: Array<() => void> = [];
beforeEach(() => { vi.spyOn(document, "hidden", "get").mockReturnValue(false); });
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.restoreAllMocks(); });

describe("Resultados locais para a Vuvu", () => {
  it("não entrega resultado antigo após trocar de sessão ou desmontar", () => {
    const first = vi.fn();
    const leave = subscribeAssistantFeedback(first);
    const pending = beginAssistantFeedback();
    leave();
    const second = vi.fn();
    cleanups.push(subscribeAssistantFeedback(second));
    pending("report-ready");
    expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
    beginAssistantFeedback()("report-ready");
    expect(second).toHaveBeenCalledExactlyOnceWith("report-ready");
  });

  it("não exibe resultado atrasado de aba oculta e não propaga erro da decoração", () => {
    const receive = vi.fn(() => { throw new Error("Falha visual"); });
    cleanups.push(subscribeAssistantFeedback(receive));
    const result = beginAssistantFeedback();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    result("report-ready"); expect(receive).not.toHaveBeenCalled();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    expect(() => result("operation-error")).not.toThrow();
  });

  it("reage ao erro final de uma ação sem substituir seu tratamento ou repetir a gravação", async () => {
    const receive = vi.fn(); cleanups.push(subscribeAssistantFeedback(receive));
    const client = createQueryClient(); cleanups.push(() => client.clear());
    const failure = new Error("Operação rejeitada");
    const save = vi.fn().mockRejectedValue(failure); const onError = vi.fn();
    const mutation = client.getMutationCache().build(client, { mutationFn: save, onError });
    await expect(mutation.execute(undefined)).rejects.toBe(failure);
    expect(save).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledExactlyOnceWith("operation-error");
  });

  it("ignora cancelamento e não confunde sucesso de ação comum com relatório pronto", async () => {
    const receive = vi.fn(); cleanups.push(subscribeAssistantFeedback(receive));
    const client = createQueryClient(); cleanups.push(() => client.clear());
    const cancel = client.getMutationCache().build(client, { mutationFn: async () => { throw new CanceledError(); } });
    await expect(cancel.execute(undefined)).rejects.toBeInstanceOf(CanceledError);
    const save = client.getMutationCache().build(client, { mutationFn: async () => "salvo" });
    await save.execute(undefined); expect(receive).not.toHaveBeenCalled();
  });

  it("isola uma mutation que termina depois do início da próxima sessão", async () => {
    const first = vi.fn(); const leave = subscribeAssistantFeedback(first);
    let fail!: (error: Error) => void;
    const client = createQueryClient(); cleanups.push(() => client.clear());
    const mutation = client.getMutationCache().build(client, { mutationFn: () => new Promise((_, reject) => { fail = reject; }) });
    const pending = mutation.execute(undefined).catch(() => {});
    await vi.waitFor(() => expect(fail).toBeTypeOf("function"));
    leave(); const second = vi.fn(); cleanups.push(subscribeAssistantFeedback(second));
    fail(new Error("Término antigo")); await pending;
    expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
  });
});
