/**
 * filas-page.test.tsx — painel de filas do ADMIN (ADR-056) com a API mockada:
 * contagens e falhas por fila, "Tentar de novo" chamando a API, o aviso do
 * motor em memória, erro e vazio.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../../design/theme-provider";
import { ToastProvider } from "../../components/ui/toast";
import { FilasPage } from "./filas-page";
import type { FilaPainel, PainelFilas } from "../../types/queue-admin.types";

const api = vi.hoisted(() => ({
  painel: vi.fn(),
  reprocessar: vi.fn(),
}));
vi.mock("../../lib/api/queue-admin.api", () => ({ queueAdminApi: api }));

function fila(over: Partial<FilaPainel> = {}): FilaPainel {
  return {
    name: "dast-scan",
    label: "Scans DAST",
    counts: { waiting: 2, active: 1, delayed: 0, completed: 9, failed: 1 },
    failed: [
      {
        id: "job-1",
        name: "scan",
        failedReason: "Falha ao conectar no alvo",
        attemptsMade: 1,
        finishedOn: "2026-11-18T12:00:00.000Z",
        data: '{"scanId":"s1"}',
      },
    ],
    ...over,
  };
}

const painelBullmq = (queues: FilaPainel[]): PainelFilas => ({ driver: "bullmq", queues });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/admin/filas"]}>
            <FilasPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.painel.mockResolvedValue(painelBullmq([fila()]));
  api.reprocessar.mockResolvedValue({ fila: "dast-scan", jobId: "job-1" });
});

describe("Página de filas", () => {
  it("renderiza as contagens e a falha de cada fila, com o rótulo em português", async () => {
    renderPage();
    const cartao = await screen.findByRole("region", { name: "Scans DAST" });

    expect(within(cartao).getByText("Esperando").closest("div")).toHaveTextContent("2");
    expect(within(cartao).getByText("Rodando").closest("div")).toHaveTextContent("1");
    expect(within(cartao).getByText("Agendados").closest("div")).toHaveTextContent("0");
    expect(within(cartao).getByText("Concluídos").closest("div")).toHaveTextContent("9");
    expect(within(cartao).getByText("Com falha").closest("div")).toHaveTextContent("1");

    expect(within(cartao).getByText("Falha ao conectar no alvo")).toBeInTheDocument();
    expect(within(cartao).getByText(/Tentativas: 1/)).toBeInTheDocument();
    expect(within(cartao).getByText(/job job-1/)).toBeInTheDocument();
  });

  it("'Tentar de novo' chama a API com a fila e o id do job, e avisa o resultado", async () => {
    renderPage();
    const cartao = await screen.findByRole("region", { name: "Scans DAST" });

    fireEvent.click(within(cartao).getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(api.reprocessar).toHaveBeenCalledWith("dast-scan", "job-1"));
    expect(await screen.findByText("Job reenfileirado")).toBeInTheDocument();
    // Depois do sucesso a query é invalidada: o painel é pedido de novo.
    await waitFor(() => expect(api.painel.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("com o motor em memória, explica que não há fila persistente e não mostra cartões", async () => {
    api.painel.mockResolvedValue({ driver: "memory", queues: [] } satisfies PainelFilas);
    renderPage();

    expect(await screen.findByText(/QUEUE_DRIVER=memory/)).toBeInTheDocument();
    expect(screen.getByText("Motor de filas em memória")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scans DAST" })).not.toBeInTheDocument();
  });

  it("erro ao carregar: mostra a mensagem e a ação de tentar de novo", async () => {
    api.painel.mockRejectedValue(new Error("Network Error"));
    renderPage();
    expect(await screen.findByText("Não foi possível carregar as filas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("fila sem falhas mostra o estado vazio, sem botão de tentar de novo", async () => {
    api.painel.mockResolvedValue(painelBullmq([fila({ failed: [] })]));
    renderPage();
    const cartao = await screen.findByRole("region", { name: "Scans DAST" });
    expect(within(cartao).getByText("Nenhuma falha recente nesta fila.")).toBeInTheDocument();
    expect(within(cartao).queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });
});
