/**
 * Protege o fluxo "só escolher o alvo": o scan real exige a autorização marcada
 * (sem tráfego involuntário), trocar o alvo derruba a autorização, a
 * demonstração nunca vira scan real, e os erros da API chegam legíveis.
 * Consumidor: suíte Vitest do frontend; API inteiramente mockada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { DastPage } from "./dast-page";

const api = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), getStatus: vi.fn() }));
vi.mock("../lib/api/dast.api", () => ({ dastApi: api }));
vi.mock("../lib/api/users.api", () => ({ usersApi: { list: async () => [] } }));

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([]);
  api.create.mockResolvedValue({ id: "new-scan" });
  api.getStatus.mockResolvedValue({ dockerAvailable: true, runningCount: 0, queuedCount: 0, maxConcurrent: 1, queued: [], running: [], alerts: [] });
});

async function openForm(targetUrl = "https://example.com/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><DastPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getAllByRole("button", { name: "Nova análise" })[0]);
  fireEvent.change(screen.getByLabelText(/URL do alvo/), { target: { value: targetUrl } });
}

function erroDaApi(status: number, data: object): AxiosError {
  return new AxiosError("falha", "ERR_BAD_REQUEST", undefined, undefined, { status, data } as AxiosResponse);
}

describe("DAST — nova análise", () => {
  it("só inicia com a autorização marcada, e inicia como scan real", async () => {
    await openForm();
    const iniciar = screen.getByRole("button", { name: "Iniciar análise" });
    expect(iniciar).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    expect(iniciar).toBeEnabled();
    fireEvent.click(iniciar);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ targetUrl: "https://example.com/", mode: "REAL", confirmedRealScan: true }));
  });

  it("trocar o alvo derruba a autorização dada para o anterior", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    fireEvent.change(screen.getByLabelText(/URL do alvo/), { target: { value: "https://outro.test/" } });
    expect(screen.getByRole("checkbox", { name: /Tenho autorização/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Iniciar análise" })).toBeDisabled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("demonstração não pede autorização e nunca vira scan real", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: /Ver demonstração/ }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ targetUrl: "https://example.com/", mode: "SIMULATED", confirmedRealScan: false }));
  });

  it("aceita alvo de rede privada e recusa URL com credencial", async () => {
    await openForm("http://192.168.0.1:5173/");
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    expect(screen.getByRole("button", { name: "Iniciar análise" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/URL do alvo/), { target: { value: "https://user:senha@example.com/" } });
    expect(screen.getByText(/sem usuário e senha/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar análise" })).toBeDisabled();
  });

  it("mostra mensagem legível para alvo já em análise e para limite de requisições", async () => {
    api.create.mockRejectedValueOnce(erroDaApi(409, { error: "SCAN_ALREADY_RUNNING_FOR_TARGET" }));
    await openForm();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar análise" }));
    expect(await screen.findByText(/Já existe uma análise em andamento para esse alvo/)).toBeInTheDocument();

    api.create.mockRejectedValueOnce(erroDaApi(429, { code: "RATE_LIMITED", retryAfterSeconds: 42 }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar análise" }));
    expect(await screen.findByText(/Tente novamente em 42 s/)).toBeInTheDocument();
  });
});
