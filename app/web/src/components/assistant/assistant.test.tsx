/**
 * Verifica decisões do chat e da sentinela: nenhum envio implícito, sessão isolada e modais respeitados.
 * Consumido pelo Vitest/Testing Library; o gateway HTTP é simulado, sem Gemini real.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthenticatedLayout } from "../layout/authenticated-layout";
import { useAuthStore } from "../../store/auth.store";
import { assistantApi } from "../../lib/api/assistant.api";
import { assistantBounds } from "./use-assistant-motion";
import type { AuthResponse, UserRole } from "../../types/auth.types";
import type { AssistantChatResponse } from "../../types/assistant.types";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("../../lib/api/assistant.api", () => ({ assistantApi: { chat: vi.fn() } }));
vi.mock("../../motion/use-motion", () => ({ useMotion: () => ({ reduzido: motionPreference.reduced }) }));

function session(id = "client-a", role: UserRole = "CLIENT"): AuthResponse {
  return { accessToken: "synthetic-access", refreshToken: "synthetic-refresh", user: {
    id, role, name: "Conta fictícia", email: "ficticia@test.local", companyId: "company-a", createdAt: "2026-10-23T00:00:00Z",
  } };
}

function Page() {
  const location = useLocation();
  return <main><p data-testid="current-route">{location.pathname}</p><Link to="/projects/project-private?secret=target">Ir para projeto</Link><Link to="/applications">Ir para aplicações</Link></main>;
}

function mount(role: UserRole = "CLIENT", route = "/dashboard") {
  useAuthStore.getState().setAuth(session("client-a", role));
  return render(<MemoryRouter initialEntries={[route]}><Routes>
    <Route element={<AuthenticatedLayout />}><Route path="*" element={<Page />} /></Route>
  </Routes></MemoryRouter>);
}

async function open() {
  fireEvent.click(await screen.findByRole("button", { name: "Abrir Assistente Vulnera" }));
  return screen.findByRole("dialog", { name: "Assistente Vulnera" });
}

function submit(question = "Como solicito uma análise?") {
  fireEvent.change(screen.getByRole("textbox", { name: "Sua pergunta" }), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
}

const localResponse: AssistantChatResponse = { message: "1. Abra Aplicações.\n2. Selecione Solicitar análise.", source: "local", actions: [{ id: "applications", label: "Abrir aplicações" }] };
const responseText = /1\. Abra Aplicações\.\s*2\. Selecione Solicitar análise\./;

beforeEach(() => {
  vi.clearAllMocks();
  motionPreference.reduced = false;
  Object.defineProperty(window, "innerWidth", { value: 1_024, writable: true, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 768, writable: true, configurable: true });
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  vi.mocked(assistantApi.chat).mockResolvedValue(localResponse);
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.useRealTimers();
});

describe("Assistente autenticado", () => {
  it("não chama a API na montagem, abertura, sugestão, digitação, refoco ou navegação", async () => {
    mount();
    expect(await screen.findByTestId("assistant-root")).toBeInTheDocument();
    await open();
    fireEvent.click(screen.getByRole("button", { name: "O que posso fazer nesta tela?" }));
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveValue("O que posso fazer nesta tela?");
    fireEvent.change(screen.getByRole("textbox", { name: "Sua pergunta" }), { target: { value: "Ainda digitando" } });
    fireEvent.focus(window);
    fireEvent.click(screen.getByRole("link", { name: "Ir para projeto" }));
    expect(screen.getAllByTestId("assistant-root")).toHaveLength(1);
    expect(assistantApi.chat).not.toHaveBeenCalled();
  });

  it("captura a tela no envio e preserva resposta/conversa ao navegar durante a espera", async () => {
    let resolve!: (response: AssistantChatResponse) => void;
    vi.mocked(assistantApi.chat).mockReturnValue(new Promise((done) => { resolve = done; }));
    mount();
    await open();
    submit();
    fireEvent.click(screen.getByRole("link", { name: "Ir para projeto" }));
    await act(async () => resolve(localResponse));
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assistantApi.chat).mock.calls[0][0]).toEqual({ question: "Como solicito uma análise?", screen: "dashboard", history: [] });
    expect(screen.getByText(responseText)).toBeInTheDocument();
    expect(screen.getByText("Ajuda local")).toBeInTheDocument();
    expect(screen.getAllByText("Sobre: Dashboard")).toHaveLength(2);
    submit("E os relatórios?");
    expect(vi.mocked(assistantApi.chat).mock.calls[1][0]).toMatchObject({ screen: "project-detail", history: [
      { role: "user", content: "Como solicito uma análise?" }, { role: "assistant", content: localResponse.message },
    ] });
  });

  it("não duplica envio antes do próximo render e não repete falhas automaticamente", async () => {
    let reject!: (reason: unknown) => void;
    vi.mocked(assistantApi.chat).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    mount();
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "Sua pergunta" }), { target: { value: "Como uso o painel?" } });
    const form = screen.getByRole("button", { name: "Enviar pergunta" }).closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("network")));
    expect(screen.getByRole("alert")).toHaveTextContent("enviar novamente quando quiser");
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveValue("Como uso o painel?");
    expect(screen.getByRole("button", { name: "Enviar pergunta" })).toBeEnabled();
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("usa somente rótulos/destinos controlados e filtra ações por perfil, inclusive forjadas", async () => {
    vi.mocked(assistantApi.chat).mockResolvedValue({ message: "Orientação segura <script>nunca executar</script>", source: "gemini", actions: [
      { id: "projects", label: "Excluir tudo" }, { id: "dast", label: "Abrir DAST" },
      { id: "__proto__", label: "Ataque" }, { id: "https://outside.test", label: "Sair da plataforma" },
    ] } as unknown as AssistantChatResponse);
    mount("CLIENT");
    await open();
    submit();
    const action = await screen.findByRole("button", { name: "Abrir projetos" });
    expect(screen.queryByRole("button", { name: "Abrir DAST" })).not.toBeInTheDocument();
    expect(screen.queryByText("Excluir tudo")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelector("script")).toBeNull();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    fireEvent.click(action);
    expect(screen.getByTestId("current-route")).toHaveTextContent("/projects");
  });

  it.each(["CLIENT", "ADMIN", "PENTESTER"] as const)("mantém ações autorizadas de %s", async (role) => {
    vi.mocked(assistantApi.chat).mockResolvedValue({ ...localResponse, actions: [
      { id: "applications", label: "Inventado" }, { id: "dast", label: "Inventado" }, { id: "playbooks", label: "Inventado" },
    ] });
    mount(role);
    await open();
    submit();
    await screen.findByRole("button", { name: "Abrir playbooks" });
    expect(!!screen.queryByRole("button", { name: "Abrir aplicações" })).toBe(role !== "PENTESTER");
    expect(!!screen.queryByRole("button", { name: "Abrir DAST" })).toBe(role !== "CLIENT");
  });

  it.each(["logout", "switch", "same-login"] as const)("cancela e descarta resposta tardia após %s", async (change) => {
    let resolve!: (response: AssistantChatResponse) => void;
    vi.mocked(assistantApi.chat).mockReturnValue(new Promise((done) => { resolve = done; }));
    mount();
    await open();
    submit();
    const signal = vi.mocked(assistantApi.chat).mock.calls[0][1];
    act(() => {
      if (change === "logout") useAuthStore.getState().clearAuth();
      else useAuthStore.getState().setAuth(session(change === "switch" ? "client-b" : "client-a"));
    });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(localResponse));
    expect(screen.queryByText(responseText)).not.toBeInTheDocument();
    if (change !== "logout") {
      await open();
      expect(screen.getByText("Olá! Posso explicar as telas e os processos do Vulnera.")).toBeInTheDocument();
    } else expect(screen.queryByTestId("assistant-root")).not.toBeInTheDocument();
  });

  it("preserva conversa em rotação de token/atualização de perfil e não persiste histórico", async () => {
    mount();
    await open();
    submit();
    await screen.findByText(responseText);
    act(() => {
      const current = useAuthStore.getState();
      current.setTokens("rotated", "rotated-refresh");
      current.updateUser({ ...current.user!, name: "Nome atualizado" }, current.user!);
    });
    expect(screen.getByText(responseText)).toBeInTheDocument();
    expect(localStorage.getItem("vulnera-auth")).not.toContain("sessionVersion");
    expect(localStorage.getItem("vulnera-auth")).not.toContain("Abra Aplicações");
  });

  it("limpa e cancela uma pergunta em andamento sem deixar resposta reaparecer", async () => {
    let resolve!: (response: AssistantChatResponse) => void;
    vi.mocked(assistantApi.chat).mockReturnValue(new Promise((done) => { resolve = done; }));
    mount();
    await open();
    submit();
    fireEvent.click(screen.getByRole("button", { name: "Limpar conversa" }));
    expect(vi.mocked(assistantApi.chat).mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolve(localResponse));
    expect(screen.queryByText(responseText)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Enviar pergunta" })).toBeDisabled();
  });

  it("fecha com Escape, devolve foco e preserva a conversa ao reabrir", async () => {
    mount();
    const panel = await open();
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveFocus();
    submit();
    await screen.findByText(responseText);
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Assistente Vulnera" })).toHaveFocus();
    await open();
    expect(screen.getByText(responseText)).toBeInTheDocument();
  });

  it("fecha com Escape durante espera mesmo com foco fora do painel", async () => {
    vi.mocked(assistantApi.chat).mockReturnValue(new Promise(() => {}));
    mount();
    await open();
    submit();
    screen.getByRole("link", { name: "Ir para projeto" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Assistente Vulnera" })).toHaveFocus();
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("exibe espera 429 recuperável sem agendar repetição", async () => {
    vi.mocked(assistantApi.chat).mockRejectedValue({ isAxiosError: true, response: { status: 429, data: { retryAfterSeconds: 12 }, headers: {} } });
    mount();
    await open();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Aguarde 12 segundos");
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("recusa resposta inválida como erro recuperável", async () => {
    vi.mocked(assistantApi.chat).mockResolvedValue({ message: "", source: "gemini", actions: [] });
    mount();
    await open();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível obter a orientação");
    expect(screen.getByRole("button", { name: "Enviar pergunta" })).toBeEnabled();
  });
});

describe("Movimento e overlays", () => {
  it("pausa por hover, foco, preferência manual, chat e aba oculta", async () => {
    mount();
    const mascot = await screen.findByTestId("assistant-mascot");
    fireEvent.mouseEnter(mascot);
    expect(mascot).toHaveAttribute("data-pause-reasons", "hover");
    fireEvent.mouseLeave(mascot);
    const launcher = screen.getByRole("button", { name: "Abrir Assistente Vulnera" });
    fireEvent.focus(launcher);
    expect(mascot.getAttribute("data-pause-reasons")).toContain("focus");
    fireEvent.blur(launcher);
    fireEvent.click(screen.getByRole("button", { name: "Pausar movimento" }));
    expect(mascot.getAttribute("data-pause-reasons")).toContain("manual");
    fireEvent.click(screen.getByRole("button", { name: "Retomar movimento" }));
    await open();
    expect(mascot.getAttribute("data-pause-reasons")).toContain("chat");
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(mascot.getAttribute("data-pause-reasons")).toContain("hidden");
    expect(assistantApi.chat).not.toHaveBeenCalled();
  });

  it("respeita modal já aberto na montagem e um modal aberto depois", async () => {
    const modal = document.createElement("section");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    mount();
    const root = await screen.findByTestId("assistant-root");
    expect(root).toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: "Abrir Assistente Vulnera" })).not.toBeInTheDocument();
    modal.remove();
    await waitFor(() => expect(root).not.toHaveAttribute("hidden"));
    const parent = root.parentElement!;
    parent.setAttribute("inert", "");
    await waitFor(() => expect(root).toHaveAttribute("hidden"));
    parent.removeAttribute("inert");
    await waitFor(() => expect(root).not.toHaveAttribute("hidden"));
    expect(assistantApi.chat).not.toHaveBeenCalled();
  });

  it("fica estático com movimento reduzido e recalcula limites em viewport estreita", async () => {
    motionPreference.reduced = true;
    mount();
    const mascot = await screen.findByTestId("assistant-mascot");
    expect(mascot).toHaveAttribute("data-motion", "static");
    expect(mascot.getAttribute("data-pause-reasons")).toContain("reduced");
    window.innerWidth = 320;
    window.innerHeight = 568;
    fireEvent(window, new Event("resize"));
    expect(mascot.getAttribute("data-pause-reasons")).toContain("compact");
    expect(assistantBounds(320, 568)).toEqual({ right: 188, bottom: 464, top: 128, middle: 60 });
    expect(assistantBounds(320, 140).bottom).toBe(36);
    expect(assistantApi.chat).not.toHaveBeenCalled();
  });

  it("não chama a API durante o passeio autônomo e limpa seus timers", async () => {
    vi.useFakeTimers();
    const view = mount();
    await act(async () => {});
    const mascot = screen.getByTestId("assistant-mascot");
    act(() => vi.advanceTimersByTime(3_000));
    expect(mascot).toHaveAttribute("data-motion", "moving");
    expect(assistantApi.chat).not.toHaveBeenCalled();
    view.unmount();
    const remaining = vi.getTimerCount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(vi.getTimerCount()).toBeLessThanOrEqual(remaining);
  });

  it("oferece campo e controles acessíveis sem transformar o painel em modal", async () => {
    mount();
    const panel = await open();
    expect(panel).not.toHaveAttribute("aria-modal", "true");
    expect(within(panel).getByRole("log", { name: "Conversa com o assistente" })).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveAttribute("maxlength", "1000");
    expect(screen.getByRole("button", { name: "Limpar conversa" })).toHaveAccessibleName();
  });
});
