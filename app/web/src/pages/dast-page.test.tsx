/**
 * Protege a escolha explícita e a confirmação do scan real para evitar tráfego
 * involuntário. Consumidor: suíte Vitest do frontend; API inteiramente mockada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  fireEvent.click(screen.getAllByRole("button", { name: "Novo scan" })[0]);
  fireEvent.change(screen.getByLabelText(/URL do alvo/), { target: { value: targetUrl } });
}

describe("DAST — escolha do modo", () => {
  it("gera demonstração com modo explícito e sem confirmação real", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Gerar demonstração" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ targetUrl: "https://example.com/", mode: "SIMULATED", confirmedRealScan: false }));
  });

  it("só inicia real após o segundo aviso e autorização marcada", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("radio", { name: /Real — análise passiva/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar para confirmação" }));
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Confirmar scan real" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar e iniciar scan real" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e iniciar scan real" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ targetUrl: "https://example.com/", mode: "REAL", confirmedRealScan: true }));
  });

  it("voltar e alterar o alvo exige nova autorização", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("radio", { name: /Real — análise passiva/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar para confirmação" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.change(screen.getByLabelText(/URL do alvo/), { target: { value: "https://other.test/" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar para confirmação" }));
    expect(screen.getByRole("checkbox", { name: /Tenho autorização/ })).not.toBeChecked();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("aceita alvo de rede privada mantendo a confirmação do scan real", async () => {
    const targetUrl = "http://192.168.0.1:5173/";
    await openForm(targetUrl);
    fireEvent.click(screen.getByRole("radio", { name: /Real — análise passiva/ }));
    const continuar = screen.getByRole("button", { name: "Continuar para confirmação" });
    expect(continuar).toBeEnabled();
    fireEvent.click(continuar);
    expect(api.create).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(targetUrl)).toBeVisible());
    const confirmar = screen.getByRole("button", { name: "Confirmar e iniciar scan real" });
    expect(confirmar).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tenho autorização/ }));
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ targetUrl, mode: "REAL", confirmedRealScan: true }));
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});
