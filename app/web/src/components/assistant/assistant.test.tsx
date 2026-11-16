/**
 * Verifica decisões do chat e da sentinela: nenhum envio implícito, sessão isolada e modais respeitados.
 * Consumido pelo Vitest/Testing Library; o gateway HTTP é simulado, sem Gemini real.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthenticatedLayout } from "../layout/authenticated-layout";
import { useAuthStore } from "../../store/auth.store";
import { assistantApi } from "../../lib/api/assistant.api";
import { assistantBounds } from "./use-assistant-motion";
import { beginAssistantFeedback } from "../../lib/assistant-feedback";
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
  fireEvent.click(await screen.findByRole("button", { name: "Ajuda — abrir Assistente Vulnera" }));
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
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
      this.pointerType = options.pointerType ?? "mouse";
      this.isPrimary = options.isPrimary ?? true;
    }
  });
  vi.mocked(assistantApi.chat).mockResolvedValue(localResponse);
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Assistente autenticado", () => {
  it.each([
    ["/sast-sca", "sast-sca"],
    ["/sast-sca/imports/private-import?secret=value", "code-import-detail"],
    ["/threat-intel?empresa=private-company", "threat-intel"],
    ["/exposure-graph", "exposure-graph"],
  ])("envia somente o contexto normalizado da nova tela %s", async (route, expectedScreen) => {
    mount("ADMIN", route);
    await open();
    submit("O que posso fazer nesta tela?");
    await waitFor(() => expect(assistantApi.chat).toHaveBeenCalledTimes(1));
    expect(vi.mocked(assistantApi.chat).mock.calls[0][0]).toEqual({
      question: "O que posso fazer nesta tela?", screen: expectedScreen, history: [],
    });
  });

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
      expect(screen.getByText("Oi! Eu sou a Vuvu.")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Ajuda — abrir Assistente Vulnera" })).toHaveFocus();
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
    expect(screen.getByRole("button", { name: "Ajuda — abrir Assistente Vulnera" })).toHaveFocus();
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("exibe espera 429 recuperável sem agendar repetição", async () => {
    vi.mocked(assistantApi.chat).mockRejectedValue({ isAxiosError: true, response: { status: 429, data: { retryAfterSeconds: 12 }, headers: {} } });
    mount();
    await open();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Seu texto foi mantido");
    expect(screen.getByText(/Aguarde 12 segundos para enviar/)).toBeInTheDocument();
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("envia por Enter uma única vez, mantém foco e ignora repetição durante a espera", async () => {
    let resolve!: (response: AssistantChatResponse) => void;
    vi.mocked(assistantApi.chat).mockReturnValue(new Promise((done) => { resolve = done; }));
    mount(); await open();
    const input = screen.getByRole("textbox", { name: "Sua pergunta" });
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(/Enter envia.*Shift\+Enter quebra linha/);
    fireEvent.change(input, { target: { value: "quem e vc" } });
    fireEvent.keyDown(input, { key: "Enter", repeat: true });
    expect(assistantApi.chat).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assistantApi.chat).mock.calls[0][0].question).toBe("quem e vc");
    expect(input).toHaveFocus();
    await act(async () => resolve(localResponse));
    expect(input).toHaveValue(""); expect(input).toHaveFocus();
  });

  it("permite Shift+Enter para linha nova e Tab/Enter para o botão de envio", async () => {
    const user = userEvent.setup();
    mount(); await open();
    const input = screen.getByRole("textbox", { name: "Sua pergunta" });
    await user.type(input, "Oi"); await user.keyboard("{Shift>}{Enter}{/Shift}Vuvu");
    expect(input).toHaveValue("Oi\nVuvu"); expect(assistantApi.chat).not.toHaveBeenCalled();
    await user.tab(); expect(screen.getByRole("button", { name: "Enviar pergunta" })).toHaveFocus();
    await user.keyboard("{Enter}"); await screen.findByText(responseText);
    expect(assistantApi.chat).toHaveBeenCalledTimes(1); expect(input).toHaveFocus();
  });

  it("não envia texto vazio nem Enter usado para composição de caracteres", async () => {
    mount(); await open();
    const input = screen.getByRole("textbox", { name: "Sua pergunta" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "Olá" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(assistantApi.chat).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText(responseText); expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("mantém ajuda local utilizável durante a espera do Gemini sem repetir perguntas", async () => {
    mount(); await open();
    vi.mocked(assistantApi.chat).mockResolvedValueOnce({ ...localResponse, providerRetryAfterSeconds: 60 });
    await act(async () => submit());
    expect(screen.getByText(/Nova tentativa com Gemini em 60 segundos/)).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Sua pergunta" });
    fireEvent.change(input, { target: { value: "quem e vc" } });
    expect(screen.getByRole("button", { name: "Enviar pergunta" })).toBeEnabled();
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(assistantApi.chat).toHaveBeenCalledTimes(2);
    expect(assistantApi.chat).toHaveBeenCalledTimes(2);
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

describe("Arraste, surpresa e overlays", () => {
  it("recolhe sem perder conversa, rascunho ou posição e permanece discreta após um evento", async () => {
    mount();
    const mascot = await screen.findByTestId("assistant-mascot");
    const launcher = screen.getByTestId("assistant-launcher");
    fireEvent.keyDown(launcher, { key: "ArrowLeft" });
    await open(); submit(); await screen.findByText(responseText);
    fireEvent.change(screen.getByRole("textbox", { name: "Sua pergunta" }), { target: { value: "Ainda escrevendo" } });
    fireEvent.click(screen.getByRole("button", { name: "Recolher Vuvu" }));
    expect(mascot).toHaveAttribute("hidden"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const restore = screen.getByRole("button", { name: "Mostrar Vuvu" });
    expect(restore).toHaveFocus();
    act(() => beginAssistantFeedback()("report-ready"));
    expect(restore).toBeInTheDocument(); expect(mascot).toHaveAttribute("hidden");
    fireEvent.click(restore); await open();
    expect(screen.getByText(responseText)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveValue("Ainda escrevendo");
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it("reage localmente ao relatório confirmado e ao erro, sem abrir chat ou enviar pergunta", async () => {
    mount();
    const launcher = await screen.findByTestId("assistant-launcher");
    act(() => beginAssistantFeedback()("report-ready"));
    expect(launcher.querySelector(".vuvu-sprite")).toHaveAttribute("data-vuvu-state", "answered");
    act(() => beginAssistantFeedback()("operation-error"));
    expect(launcher.querySelector(".vuvu-sprite")).toHaveAttribute("data-vuvu-state", "error");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(assistantApi.chat).not.toHaveBeenCalled();
  });

  it("não repete a reação de uma resposta antiga ao encerrar a expressão de erro", async () => {
    mount(); await open(); submit(); await screen.findByText(responseText);
    fireEvent.click(screen.getByRole("button", { name: "Fechar assistente" }));
    await waitFor(() => expect(document.getElementById("assistant-panel")).toBeNull());
    vi.useFakeTimers();
    const sprite = screen.getByTestId("assistant-launcher").querySelector(".vuvu-sprite");
    act(() => beginAssistantFeedback()("operation-error"));
    expect(sprite).toHaveAttribute("data-vuvu-state", "error");
    act(() => vi.advanceTimersByTime(2100));
    expect(sprite).not.toHaveAttribute("data-vuvu-state", "answered");
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
  });
  it("não oferece pausa nem passeia por hover, foco ou abertura do chat", async () => {
    mount();
    const mascot = await screen.findByTestId("assistant-mascot");
    fireEvent.mouseEnter(mascot);
    expect(mascot).toHaveAttribute("data-motion", "static");
    fireEvent.mouseLeave(mascot);
    const launcher = screen.getByRole("button", { name: "Ajuda — abrir Assistente Vulnera" });
    fireEvent.focus(launcher);
    expect(mascot).toHaveAttribute("data-motion", "static");
    fireEvent.blur(launcher);
    expect(screen.queryByRole("button", { name: /Pausar movimento|Retomar movimento/ })).not.toBeInTheDocument();
    await open();
    expect(mascot).toHaveAttribute("data-motion", "static");
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
    expect(screen.queryByRole("button", { name: "Ajuda — abrir Assistente Vulnera" })).not.toBeInTheDocument();
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
    expect(assistantBounds(320, 568)).toEqual({ left: 16, right: 192, bottom: 424, top: 16 });
    expect(assistantBounds(320, 140).bottom).toBe(12);
    expect(assistantApi.chat).not.toHaveBeenCalled();
  });

  it("permanece no lugar após um minuto e limpa seus timers", async () => {
    vi.useFakeTimers();
    const view = mount();
    await act(async () => {});
    const mascot = screen.getByTestId("assistant-mascot");
    const position = mascot.style.transform;
    act(() => vi.advanceTimersByTime(60_000));
    expect(mascot).toHaveAttribute("data-motion", "static");
    expect(mascot.style.transform).toBe(position);
    expect(assistantApi.chat).not.toHaveBeenCalled();
    view.unmount();
    const remaining = vi.getTimerCount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(vi.getTimerCount()).toBeLessThanOrEqual(remaining);
  });

  it.each(["mouse", "touch"])("arrasta por %s com animação e não abre chat ao soltar", async (pointerType) => {
    mount();
    const launcher = await screen.findByTestId("assistant-launcher");
    const mascot = screen.getByTestId("assistant-mascot");
    fireEvent.pointerDown(launcher, { pointerId: 1, pointerType, button: 0, clientX: 950, clientY: 680 });
    fireEvent.pointerMove(launcher, { pointerId: 1, pointerType, clientX: 750, clientY: 480 });
    expect(mascot).toHaveAttribute("data-motion", "dragging");
    expect(launcher.querySelector(".vuvu-sprite")).toHaveAttribute("data-vuvu-state", "dragging");
    fireEvent.pointerUp(launcher, { pointerId: 1, pointerType, clientX: 750, clientY: 480 });
    fireEvent.click(launcher, { detail: 1 });
    expect(mascot).toHaveAttribute("data-motion", "static");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(assistantApi.chat).not.toHaveBeenCalled();
    fireEvent.keyDown(launcher, { key: "Enter", shiftKey: true });
    expect(launcher.querySelector(".vuvu-sprite")).toHaveAttribute("data-vuvu-state", "six-seven");
  });

  it("cancela o arraste sem ficar preso e ignora um segundo ponteiro", async () => {
    mount();
    const launcher = await screen.findByTestId("assistant-launcher");
    const mascot = screen.getByTestId("assistant-mascot");
    fireEvent.pointerDown(launcher, { pointerId: 1, button: 0, clientX: 950, clientY: 680 });
    fireEvent.pointerMove(launcher, { pointerId: 2, clientX: 700, clientY: 400 });
    expect(mascot).toHaveAttribute("data-motion", "static");
    fireEvent.pointerMove(launcher, { pointerId: 1, clientX: 700, clientY: 400 });
    fireEvent.pointerCancel(launcher, { pointerId: 1 });
    expect(mascot).toHaveAttribute("data-motion", "static");
    fireEvent.pointerDown(launcher, { pointerId: 3, button: 0, clientX: 700, clientY: 400 });
    fireEvent.pointerMove(launcher, { pointerId: 3, clientX: 600, clientY: 300 });
    expect(mascot).toHaveAttribute("data-motion", "dragging");
    fireEvent(window, new Event("blur"));
    expect(mascot).toHaveAttribute("data-motion", "static");
  });

  it("distingue clique simples, duplo clique e não repete o six seven", async () => {
    vi.useFakeTimers();
    mount();
    await act(async () => {});
    const launcher = screen.getByTestId("assistant-launcher");
    fireEvent.click(launcher, { detail: 1 });
    fireEvent.click(launcher, { detail: 2 });
    fireEvent.doubleClick(launcher);
    expect(launcher.querySelector(".vuvu-sprite")).toHaveAttribute("data-vuvu-state", "six-seven");
    act(() => vi.advanceTimersByTime(2880));
    expect(launcher.querySelector(".vuvu-sprite")).not.toHaveAttribute("data-vuvu-state", "six-seven");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(assistantApi.chat).not.toHaveBeenCalled();
    fireEvent.click(launcher, { detail: 1 });
    act(() => vi.advanceTimersByTime(280));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mantém a surpresa desligada com movimento reduzido e permite abrir ajuda pelo teclado", async () => {
    motionPreference.reduced = true;
    mount();
    const launcher = await screen.findByTestId("assistant-launcher");
    fireEvent.keyDown(launcher, { key: "Enter", shiftKey: true });
    expect(launcher.querySelector(".vuvu-sprite")).not.toHaveAttribute("data-vuvu-state", "six-seven");
    fireEvent.click(launcher, { detail: 0 });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
