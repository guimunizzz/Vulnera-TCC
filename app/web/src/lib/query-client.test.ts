/**
 * query-client.test.ts
 *
 * O QUE FAZ: exercita consultas reais com os defaults compartilhados do app.
 * POR QUE EXISTE: a navegação deve aguardar um limite temporário da API sem
 * exigir outro clique, e reaproveitar dados recentes entre montagens.
 * QUEM CONSOME: suíte Vitest do frontend e validação do cliente de consultas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryObserver,
  type QueryObserverResult,
} from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, CanceledError } from "axios";
import { queryClient } from "./query-client";

const clients: QueryClient[] = [];
const subscriptions: Array<() => void> = [];

function createClient(): QueryClient {
  // Cada cenário tem cache próprio, mas usa a política entregue ao app real.
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  client.mount();
  clients.push(client);
  return client;
}

function httpError(status: number, data: unknown = {}, headers: Record<string, string> = {}): AxiosError {
  return new AxiosError("Falha HTTP", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
    status,
    statusText: "Falha HTTP",
    data,
    headers,
    config: { headers: new AxiosHeaders() },
  });
}

function observe(client: QueryClient, queryFn: () => Promise<string[]>, key = "navigation") {
  const observer = new QueryObserver(client, { queryKey: [key], queryFn });
  const states: Array<QueryObserverResult<string[], Error>> = [];
  const unsubscribe = observer.subscribe((state) => states.push(state));
  subscriptions.push(unsubscribe);
  return { observer, states, unsubscribe };
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});

afterEach(() => {
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  clients.splice(0).forEach((client) => {
    client.clear();
    client.unmount();
  });
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe("Navegação com a política global de consultas", () => {
  it("NAV-ASYNC-01 — espera o 429 de seis segundos carregando e recupera sem clique", async () => {
    const load = vi.fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(httpError(429, { code: "RATE_LIMITED", retryAfterSeconds: 6 }))
      .mockResolvedValue(["Projeto carregado"]);
    const { observer, states } = observe(createClient(), load);

    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isLoading).toBe(true);
    expect(observer.getCurrentResult().isError).toBe(false);

    await vi.advanceTimersByTimeAsync(6_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isLoading).toBe(true);
    expect(observer.getCurrentResult().isError).toBe(false);

    await vi.advanceTimersByTimeAsync(251);
    expect(load).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual(["Projeto carregado"]);
    expect(observer.getCurrentResult().isSuccess).toBe(true);
    expect(states.some((state) => state.isError)).toBe(false);
  });

  it("NAV-ASYNC-02 — voltar à tela reaproveita o cache recente e revalida após expirar", async () => {
    const client = createClient();
    const load = vi.fn<() => Promise<string[]>>().mockResolvedValue(["Projeto carregado"]);
    const first = observe(client, load);
    await settle();
    first.unsubscribe();

    await vi.advanceTimersByTimeAsync(10_000);
    const returning = observe(client, load);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(returning.observer.getCurrentResult().data).toEqual(["Projeto carregado"]);
    expect(returning.observer.getCurrentResult().isFetching).toBe(false);
    returning.unsubscribe();

    await vi.advanceTimersByTimeAsync(21_000);
    observe(client, load);
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([403, 404])("NAV-ASYNC-03 — HTTP %i chega ao erro sem repetir acesso inválido", async (status) => {
    const load = vi.fn<() => Promise<string[]>>().mockRejectedValue(httpError(status));
    const { observer } = observe(createClient(), load);
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(observer.getCurrentResult().isFetching).toBe(false);
  });

  it("NAV-ASYNC-04 — o indicador offline do navegador não pausa o acesso à API local", async () => {
    onlineManager.setOnline(false);
    const load = vi.fn<() => Promise<string[]>>().mockResolvedValue(["API local disponível"]);
    const { observer } = observe(createClient(), load);
    await settle();

    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data).toEqual(["API local disponível"]);
    expect(observer.getCurrentResult().fetchStatus).toBe("idle");
  });

  it("NAV-ASYNC-05 — falha transitória de rede tem recuperação limitada", async () => {
    const load = vi.fn<() => Promise<string[]>>()
      .mockRejectedValue(new AxiosError("Sem conexão", AxiosError.ERR_NETWORK));
    const { observer } = observe(createClient(), load);
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(load).toHaveBeenCalledTimes(3);
    expect(observer.getCurrentResult().isError).toBe(true);
  });

  it("NAV-ASYNC-06 — cancelar uma consulta não dispara outra tentativa", async () => {
    const load = vi.fn<() => Promise<string[]>>().mockRejectedValue(new CanceledError("Navegação cancelada"));
    const { observer } = observe(createClient(), load);
    await settle();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isError).toBe(true);
  });

  it("NAV-ASYNC-07 — não repete automaticamente uma gravação rejeitada", async () => {
    const client = createClient();
    const save = vi.fn<() => Promise<string>>()
      .mockRejectedValue(httpError(429, { retryAfterSeconds: 6 }));
    const mutation = client.getMutationCache().build(client, { mutationFn: save });
    const failed = mutation.execute(undefined).catch((error: unknown) => error);

    await settle();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await failed).toBeInstanceOf(AxiosError);
    expect(save).toHaveBeenCalledTimes(1);
    expect(mutation.state.status).toBe("error");
  });

  it("NAV-ASYNC-08 — um limite com espera longa mostra recuperação manual", async () => {
    const load = vi.fn<() => Promise<string[]>>()
      .mockRejectedValue(httpError(429, { retryAfterSeconds: 31 }));
    const { observer } = observe(createClient(), load);
    await settle();
    await vi.advanceTimersByTimeAsync(32_000);

    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isError).toBe(true);
  });

  it.each([500, 502, 503, 504])("NAV-ASYNC-09 — HTTP %i transitório recupera automaticamente", async (status) => {
    const load = vi.fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(httpError(status))
      .mockResolvedValue(["Servidor recuperado"]);
    const { observer } = observe(createClient(), load);
    await settle();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(load).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual(["Servidor recuperado"]);
  });

  it.each(["segundos", "data"])("NAV-ASYNC-10 — respeita Retry-After em %s quando o JSON não informa a espera", async (format) => {
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const header = format === "segundos" ? "6" : "Thu, 01 Oct 2026 12:00:06 GMT";
    const load = vi.fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(httpError(429, {}, { "retry-after": header }))
      .mockResolvedValue(["Servidor disponível"]);
    const { observer } = observe(createClient(), load);
    await settle();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isLoading).toBe(true);

    await vi.advanceTimersByTimeAsync(251);
    expect(load).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual(["Servidor disponível"]);
  });
});
