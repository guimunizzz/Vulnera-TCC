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
const agenda = vi.hoisted(() => ({ painel: vi.fn() }));
vi.mock("../lib/api/dast-schedules.api", () => ({ dastSchedulesApi: agenda }));

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([]);
  agenda.painel.mockResolvedValue({ runsSchedules: true, canCreate: true, schedules: [] });
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

describe("DAST — próximos scans agendados (ADR-056)", () => {
  const base = { hour: 3, minute: 0, timezone: "America/Sao_Paulo", mode: "SIMULATED", enabled: true, dayOfWeek: 1, frequency: "WEEKLY" };
  const renderizar = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><DastPage /></MemoryRouter></QueryClientProvider>);
  };

  it("lista os próximos disparos em ordem, incluindo agendamento só por URL", async () => {
    agenda.painel.mockResolvedValue({
      runsSchedules: true,
      canCreate: true,
      schedules: [
        { ...base, id: "b", application: { name: "Portal" }, url: "https://portal.example.com", nextRunAt: "2030-01-02T06:00:00Z" },
        { ...base, id: "a", application: null, url: "https://solto.example.com/x", nextRunAt: "2030-01-01T06:00:00Z", mode: "REAL" },
        { ...base, id: "c", application: { name: "Pausado" }, url: "https://p.example.com", nextRunAt: null, enabled: false },
      ],
    });
    renderizar();
    const lista = await screen.findByRole("list", { name: "Próximos disparos" });
    const itens = Array.from(lista.querySelectorAll("li")).map((li) => li.textContent ?? "");
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatch(/solto\.example\.com.*REAL.*Toda segunda às 03:00/);
    expect(itens[1]).toMatch(/Portal/);
    expect(screen.getByRole("link", { name: "Ver agendamentos" })).toHaveAttribute("href", "/agendamentos");
  });

  it("avisa quando o motor de agendamento está desligado e convida a agendar quando não há nenhum", async () => {
    agenda.painel.mockResolvedValue({ runsSchedules: false, canCreate: true, schedules: [{ ...base, id: "a", application: null, url: "https://x.example.com", nextRunAt: null }] });
    renderizar();
    expect(await screen.findByText(/motor de agendamento está desligado/)).toBeInTheDocument();
  });

  it("sem agendamentos, oferece agendar", async () => {
    renderizar();
    expect(await screen.findByRole("link", { name: "Agendar um scan" })).toHaveAttribute("href", "/agendamentos");
  });
});
