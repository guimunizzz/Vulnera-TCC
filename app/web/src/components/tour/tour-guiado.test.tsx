/**
 * Tour guiado (ADR-052): abre sozinho só na primeira vez (por usuário),
 * "Pular tour" e Esc encerram e lembram, "Ver tour" repete, passo sem alvo
 * na tela é pulado, e sem nenhum alvo o tour não conta como visto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TourGuiado, BotaoVerTour, type PassoTour } from "./tour-guiado";
import { useTourAutomatico } from "./use-tour-automatico";
import { useAuthStore } from "../../store/auth.store";
import { chaveDoTour, limparToursEmMemoria } from "../../lib/tour";

const PASSOS: PassoTour[] = [
  { alvo: '[data-tour="a"]', titulo: "Passo A", texto: "Texto A" },
  { alvo: '[data-tour="inexistente"]', titulo: "Passo fantasma", texto: "Não deve aparecer" },
  { alvo: '[data-tour="b"]', titulo: "Passo B", texto: "Texto B" },
];

function Tela({ alvos = true, pronto = true }: { alvos?: boolean; pronto?: boolean }) {
  const tour = useTourAutomatico("teste", pronto);
  return (
    <div>
      {alvos && (
        <>
          <div data-tour="a">alvo A</div>
          <div data-tour="b">alvo B</div>
        </>
      )}
      <BotaoVerTour aoClicar={tour.abrir} />
      <TourGuiado passos={PASSOS} aberto={tour.aberto} aoFechar={tour.fechar} />
    </div>
  );
}

const retanguloOriginal = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  limparToursEmMemoria();
  useAuthStore.setState({ accessToken: "t", refreshToken: "r", user: { id: "u1", name: "U", email: "u@x.test", role: "PENTESTER", companyId: null, companyRole: null, createdAt: "2026-11-13T00:00:00Z" } });
  // jsdom não faz layout: só os elementos marcados como alvo ganham tamanho.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const alvo = this.hasAttribute("data-tour");
    return { x: 10, y: 10, top: 10, left: 10, width: alvo ? 120 : 0, height: alvo ? 40 : 0, right: 130, bottom: 50, toJSON: () => ({}) } as DOMRect;
  };
});

afterEach(() => {
  vi.useRealTimers();
  Element.prototype.getBoundingClientRect = retanguloOriginal;
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

const esperarAbrir = () => act(() => vi.advanceTimersByTime(700));

describe("Tour guiado", () => {
  it("abre na primeira visita, pula o passo sem alvo e conclui", () => {
    render(<Tela />);
    esperarAbrir();
    expect(screen.getByRole("dialog", { name: "Passo A" })).toBeInTheDocument();
    expect(screen.getByText("Tour · 1 de 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("dialog", { name: "Passo B" })).toBeInTheDocument();
    expect(screen.queryByText("Passo fantasma")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("dialog", { name: "Passo A" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(chaveDoTour("teste", "u1"))).toBe("concluido");
  });

  it("Pular tour encerra e não abre de novo para o mesmo usuário", () => {
    const { unmount } = render(<Tela />);
    esperarAbrir();
    fireEvent.click(screen.getByRole("button", { name: "Pular tour" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(chaveDoTour("teste", "u1"))).toBe("pulado");
    unmount();

    render(<Tela />);
    esperarAbrir();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Esc pula; outro usuário no mesmo navegador ainda vê o tour", () => {
    const { unmount } = render(<Tela />);
    esperarAbrir();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    useAuthStore.setState({ user: { id: "u2", name: "Outro", email: "o@x.test", role: "ADMIN", companyId: null, companyRole: null, createdAt: "2026-11-13T00:00:00Z" } });
    render(<Tela />);
    esperarAbrir();
    expect(screen.getByRole("dialog", { name: "Passo A" })).toBeInTheDocument();
  });

  it("Ver tour repete depois de visto", () => {
    localStorage.setItem(chaveDoTour("teste", "u1"), "concluido");
    render(<Tela />);
    esperarAbrir();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver tour" }));
    expect(screen.getByRole("dialog", { name: "Passo A" })).toBeInTheDocument();
  });

  it("espera a tela ficar pronta e, sem nenhum alvo, não conta como visto", () => {
    const { rerender } = render(<Tela pronto={false} />);
    esperarAbrir();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<Tela pronto alvos={false} />);
    esperarAbrir();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(chaveDoTour("teste", "u1"))).toBeNull();
  });
});
