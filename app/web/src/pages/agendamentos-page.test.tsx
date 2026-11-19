/**
 * agendamentos-page.test.tsx — página /agendamentos (ADR-056) com a API mockada:
 * lista em português, aviso do motor desligado, recorte do CLIENT (só leitura,
 * sem link para o DAST) e o formulário completo (autorizar o alvo e criar um
 * agendamento semanal sem nunca ver cron).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { ToastProvider } from "../components/ui/toast";
import { AgendamentosPage } from "./agendamentos-page";
import { useAuthStore } from "../store/auth.store";
import { marcarTourVisto } from "../lib/tour";
import type { AgendamentoVisivel, AlvoDast, PainelAgendamentos } from "../types/dast-schedule.types";

const api = vi.hoisted(() => ({
  criarPorUrl: vi.fn(),
  painel: vi.fn(),
  alvos: vi.fn(),
  autorizar: vi.fn(),
  revogar: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  remover: vi.fn(),
  rodarAgora: vi.fn(),
  historico: vi.fn(),
}));
vi.mock("../lib/api/dast-schedules.api", () => ({ dastSchedulesApi: api }));

function agendamento(over: Partial<AgendamentoVisivel> = {}): AgendamentoVisivel {
  return {
    id: "s1",
    kind: "APPLICATION",
    url: "https://portal.example.com",
    targetUrl: null,
    applicationId: "app1",
    companyId: "c1",
    projectId: "p1",
    mode: "SIMULATED",
    frequency: "WEEKLY",
    hour: 3,
    minute: 0,
    dayOfWeek: 1,
    timezone: "America/Sao_Paulo",
    enabled: true,
    createdById: "u",
    lastRunAt: "2026-11-17T06:00:00Z",
    lastScanId: "scan9",
    lastOutcome: "STARTED",
    createdAt: "2026-11-10T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
    application: { id: "app1", name: "Portal do Cliente", url: "https://portal.example.com", companyName: "TechNova", active: true },
    projectName: "Pentest Portal",
    authorization: { until: "2026-12-31T23:59:00Z", host: "portal.example.com", problem: null },
    nextRunAt: "2026-11-24T06:00:00Z",
    canEdit: true,
    ...over,
  };
}

const painel = (over: Partial<PainelAgendamentos> = {}): PainelAgendamentos => ({ runsSchedules: true, canCreate: true, schedules: [agendamento()], ...over });

const alvoSemAutorizacao: AlvoDast = {
  applicationId: "app2",
  name: "Loja Online",
  url: "https://loja.example.com",
  companyName: "TechNova",
  authorization: { applicationId: "app2", authorizedAt: null, authorizedById: null, until: null, host: null, currentHost: "loja.example.com", problem: "AUTHORIZATION_MISSING", canEdit: true },
  projects: [{ id: "p2", name: "Pentest Loja" }],
  projectRequired: true,
};

function renderPage(role: "ADMIN" | "PENTESTER" | "CLIENT" = "ADMIN") {
  useAuthStore.setState({ user: { id: "u", name: "U", email: "u@x", role } as never });
  // O tour abre sozinho na primeira visita; aqui ele atrapalharia o foco dos testes.
  marcarTourVisto("agendamentos-lista", "u", "pulado");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/agendamentos"]}>
            <Routes>
              <Route path="/agendamentos" element={<AgendamentosPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.painel.mockResolvedValue(painel());
  api.alvos.mockResolvedValue([alvoSemAutorizacao]);
});

describe("Página de agendamentos", () => {
  it("mostra o agendamento em português: quando, próximo disparo, autorização e última execução", async () => {
    renderPage();
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    expect(within(cartao).getByText("Toda segunda às 03:00")).toBeInTheDocument();
    expect(within(cartao).getByText("horário de Brasília")).toBeInTheDocument();
    expect(within(cartao).getByText(/Próximo: /)).toBeInTheDocument();
    expect(within(cartao).getByText(/Autorizado até/)).toBeInTheDocument();
    expect(within(cartao).getByText("Scan iniciado")).toBeInTheDocument();
    expect(within(cartao).getByRole("link", { name: "Ver scan" })).toHaveAttribute("href", "/dast/scans/scan9");
    expect(within(cartao).getByText("SIMULADO")).toBeInTheDocument();
    // Nada de cron na tela.
    expect(screen.queryByText(/\* \*/)).not.toBeInTheDocument();
  });

  it("avisa quando o motor de fila não executa agendamentos", async () => {
    api.painel.mockResolvedValue(painel({ runsSchedules: false }));
    renderPage();
    expect(await screen.findByText("Os agendamentos não estão disparando")).toBeInTheDocument();
    expect(screen.getByText(/o motor de agendamento está desligado/)).toBeInTheDocument();
  });

  it("CLIENT só lê: sem criar, editar, pausar nem link para o DAST", async () => {
    api.painel.mockResolvedValue(painel({ canCreate: false, schedules: [agendamento({ canEdit: false })] }));
    renderPage("CLIENT");
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    expect(screen.queryByRole("button", { name: /Novo agendamento/ })).not.toBeInTheDocument();
    expect(within(cartao).queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(within(cartao).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(cartao).queryByRole("link", { name: "Ver scan" })).not.toBeInTheDocument();
  });

  it("estado vazio convida a criar o primeiro", async () => {
    api.painel.mockResolvedValue(painel({ schedules: [] }));
    renderPage();
    expect(await screen.findByText("Nenhum agendamento ainda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar o primeiro agendamento" })).toBeInTheDocument();
  });

  it("pausar chama a API com enabled=false", async () => {
    api.atualizar.mockResolvedValue({});
    renderPage();
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    fireEvent.click(within(cartao).getByRole("switch"));
    await waitFor(() => expect(api.atualizar).toHaveBeenCalledWith("s1", { enabled: false }));
  });

  it("formulário: autoriza o alvo e cria um agendamento semanal, com prévia em português", async () => {
    // Depois de autorizar, a lista de alvos volta com a autorização vigente.
    api.autorizar.mockResolvedValue({});
    api.criar.mockResolvedValue({ id: "novo" });
    renderPage("PENTESTER");
    fireEvent.click(await screen.findByRole("button", { name: /Novo agendamento/ }));

    const dialogo = await screen.findByRole("dialog");
    const aplicacao = await within(dialogo).findByLabelText(/Aplicação/);
    await within(dialogo).findByRole("option", { name: /Loja Online/ });
    fireEvent.change(aplicacao, { target: { value: "app2" } });

    // Sem autorização: o botão de criar fica bloqueado e explica o porquê.
    expect(within(dialogo).getByText(/ainda não tem autorização de teste registrada/)).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Criar agendamento" })).toBeDisabled();
    expect(within(dialogo).getByText(/registre a autorização do alvo/)).toBeInTheDocument();

    api.alvos.mockResolvedValue([{ ...alvoSemAutorizacao, authorization: { ...alvoSemAutorizacao.authorization, problem: null, until: "2026-12-19T23:59:00Z", host: "loja.example.com" } }]);
    fireEvent.click(within(dialogo).getByRole("checkbox", { name: /autorizou os testes/ }));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar autorização" }));
    await waitFor(() => expect(api.autorizar).toHaveBeenCalledWith("app2", expect.any(String)));
    expect(await within(dialogo).findByText(/Autorizado para testes até/)).toBeInTheDocument();

    // Projeto único do PENTESTER já vem escolhido.
    expect(within(dialogo).getByRole("combobox", { name: /^Projeto/ })).toHaveValue("p2");

    fireEvent.click(within(dialogo).getByRole("button", { name: "quarta" }));
    fireEvent.click(within(dialogo).getByRole("button", { name: /Noite · 22:00/ }));
    expect(within(dialogo).getByText("Vai rodar: Toda quarta às 22:00 (horário de Brasília)")).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar agendamento" }));
    await waitFor(() =>
      expect(api.criar).toHaveBeenCalledWith("app2", {
        frequency: "WEEKLY",
        hour: 22,
        minute: 0,
        dayOfWeek: 3,
        timezone: "America/Sao_Paulo",
        mode: "SIMULATED",
        projectId: "p2",
      }),
    );
  });

  it("modo Real exige confirmação antes de criar", async () => {
    api.alvos.mockResolvedValue([{ ...alvoSemAutorizacao, authorization: { ...alvoSemAutorizacao.authorization, problem: null, until: "2026-12-19T23:59:00Z" } }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Novo agendamento/ }));
    const dialogo = await screen.findByRole("dialog");
    await within(dialogo).findByRole("option", { name: /Loja Online/ });
    fireEvent.change(within(dialogo).getByLabelText(/Aplicação/), { target: { value: "app2" } });
    fireEvent.click(within(dialogo).getByRole("radio", { name: /Real/ }));
    expect(within(dialogo).getByRole("button", { name: "Criar agendamento" })).toBeDisabled();
    fireEvent.click(within(dialogo).getByRole("checkbox", { name: /scan real está autorizado/ }));
    expect(within(dialogo).getByRole("button", { name: "Criar agendamento" })).toBeEnabled();
  });

  it("só uma URL: sem aplicação nem projeto, exige URL válida e a confirmação de autorização", async () => {
    api.criarPorUrl.mockResolvedValue({ id: "u1" });
    renderPage("PENTESTER");
    fireEvent.click(await screen.findByRole("button", { name: /Novo agendamento/ }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Só uma URL" }));
    expect(within(dialogo).queryByRole("combobox", { name: /Aplicação/ })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("combobox", { name: /^Projeto/ })).not.toBeInTheDocument();
    // Sem o passo do projeto, a numeração não pula: Quando é o 2, Modo é o 3.
    expect(within(dialogo).getByRole("region", { name: "Quando rodar" })).toHaveTextContent(/^2/);
    expect(within(dialogo).getByRole("region", { name: "Modo" })).toHaveTextContent(/^3/);

    const url = within(dialogo).getByLabelText(/URL do alvo/);
    fireEvent.change(url, { target: { value: "ftp://nao-serve" } });
    expect(within(dialogo).getByText(/Use um endereço completo/)).toBeInTheDocument();
    fireEvent.change(url, { target: { value: "https://alvo-solto.example.com" } });
    expect(within(dialogo).getByRole("button", { name: "Criar agendamento" })).toBeDisabled();

    fireEvent.click(within(dialogo).getByRole("checkbox", { name: /autorização do responsável para testar esta URL/ }));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Todo dia" }));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar agendamento" }));
    await waitFor(() =>
      expect(api.criarPorUrl).toHaveBeenCalledWith({
        frequency: "DAILY",
        hour: 3,
        minute: 0,
        dayOfWeek: null,
        timezone: "America/Sao_Paulo",
        targetUrl: "https://alvo-solto.example.com",
        mode: "SIMULATED",
        confirmedAuthorization: true,
      }),
    );
    expect(api.criar).not.toHaveBeenCalled();
  });

  it("agendamento só por URL aparece com o host, o selo e a autorização confirmada por quem criou", async () => {
    api.painel.mockResolvedValue(
      painel({
        schedules: [
          agendamento({ id: "u1", kind: "URL", url: "https://alvo-solto.example.com/login", targetUrl: "https://alvo-solto.example.com/login", application: null, applicationId: null, companyId: null, projectId: null, projectName: null, authorization: null }),
        ],
      }),
    );
    renderPage();
    const cartao = await screen.findByRole("article", { name: /alvo-solto\.example\.com/ });
    expect(within(cartao).getByText("Só URL")).toBeInTheDocument();
    expect(within(cartao).getByText("Confirmada por quem criou")).toBeInTheDocument();
    expect(within(cartao).getByText(/visível a todo o time de segurança/)).toBeInTheDocument();
  });

  it("Rodar agora chama a API e mostra o desfecho em português, com link para o scan", async () => {
    api.rodarAgora.mockResolvedValue({ outcome: "STARTED", scanId: "scan77" });
    renderPage();
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    fireEvent.click(within(cartao).getByRole("button", { name: "Rodar agora" }));
    await waitFor(() => expect(api.rodarAgora).toHaveBeenCalledWith("s1"));
    // "Scan iniciado" também é o último desfecho do cartão (fixture), então o aviso se identifica pela descrição.
    expect(await screen.findByText("Portal do Cliente — Toda segunda às 03:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver scan" })).toBeInTheDocument();
  });

  it("Rodar agora com agendamento pausado avisa que não rodou, sem link", async () => {
    api.rodarAgora.mockResolvedValue({ outcome: "DISABLED", scanId: null });
    renderPage();
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    fireEvent.click(within(cartao).getByRole("button", { name: "Rodar agora" }));
    expect(await screen.findByText("Não rodou: estava pausado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver scan" })).not.toBeInTheDocument();
  });

  it("Histórico carrega ao abrir, lista as execuções e mostra o diff contra a anterior", async () => {
    api.historico.mockResolvedValue([
      { id: "scan2", status: "COMPLETED", simulated: true, createdAt: "2026-11-17T06:00:00Z", finishedAt: "2026-11-17T06:05:00Z", alertsHigh: 1, alertsMedium: 2, alertsLow: 0, alertsInfo: 0, diff: { novos: 2, resolvidos: 1, persistentes: 4 } },
      { id: "scan1", status: "FAILED", simulated: false, createdAt: "2026-11-10T06:00:00Z", finishedAt: null, alertsHigh: 0, alertsMedium: 0, alertsLow: 0, alertsInfo: 0, diff: null },
    ]);
    renderPage();
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    expect(api.historico).not.toHaveBeenCalled();

    fireEvent.click(within(cartao).getByRole("button", { name: "Histórico" }));
    await waitFor(() => expect(api.historico).toHaveBeenCalledWith("s1"));
    const lista = await within(cartao).findByRole("list", { name: "Últimas execuções" });
    const linhas = within(lista).getAllByRole("listitem");
    expect(linhas).toHaveLength(2);
    expect(within(linhas[0]).getByText("Concluído")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("Alto 1 · Médio 2 · Baixo 0 · Info 0")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("↗ 2 novos · ↘ 1 resolvidos")).toBeInTheDocument();
    expect(within(linhas[0]).getByRole("link", { name: /Ver scan de/ })).toHaveAttribute("href", "/dast/scans/scan2");
    expect(within(linhas[1]).getByText("Falhou")).toBeInTheDocument();
    expect(within(linhas[1]).queryByText(/novos/)).not.toBeInTheDocument();
  });

  it("CLIENT lê o histórico, mas sem Rodar agora e sem links para o DAST", async () => {
    api.painel.mockResolvedValue(painel({ canCreate: false, schedules: [agendamento({ canEdit: false })] }));
    api.historico.mockResolvedValue([
      { id: "scan2", status: "COMPLETED", simulated: true, createdAt: "2026-11-17T06:00:00Z", finishedAt: null, alertsHigh: 0, alertsMedium: 0, alertsLow: 0, alertsInfo: 0, diff: { novos: 0, resolvidos: 0, persistentes: 0 } },
    ]);
    renderPage("CLIENT");
    const cartao = await screen.findByRole("article", { name: /Portal do Cliente/ });
    expect(within(cartao).queryByRole("button", { name: "Rodar agora" })).not.toBeInTheDocument();
    fireEvent.click(within(cartao).getByRole("button", { name: "Histórico" }));
    const lista = await within(cartao).findByRole("list", { name: "Últimas execuções" });
    expect(within(lista).getByText("↗ 0 novos · ↘ 0 resolvidos")).toBeInTheDocument();
    expect(within(lista).queryByRole("link")).not.toBeInTheDocument();
  });
});
