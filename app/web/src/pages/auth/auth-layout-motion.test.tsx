/**
 * auth-layout-motion.test.tsx
 *
 * Verifica o ciclo de execução do fundo das telas públicas de acesso para
 * evitar trabalho quando ele está invisível, sem remover a revelação suave.
 * Consumidor: suíte Vitest do AuthLayout; o navegador valida a apresentação real.
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthLayout } from "./auth-layout";

// O Framer possui seu próprio RAF. Aqui isolamos apenas o agendamento do
// fundo, preservando uma preferência de movimento que muda durante o teste.
vi.mock("motion/react", async () => {
  const { createElement, useSyncExternalStore } = await import("react");

  function useReducedMotion(): boolean {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    return useSyncExternalStore(
      (notify) => {
        media.addEventListener("change", notify);
        return () => media.removeEventListener("change", notify);
      },
      () => media.matches,
      () => false,
    );
  }

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: {
      div: ({ children, className }: { children: ReactNode; className?: string }) =>
        createElement("div", { className }, children),
    },
    useReducedMotion,
  };
});

function createMedia(query: string) {
  const listeners = new Set<EventListenerOrEventListenerObject>();
  let matches = false;
  const media = {
    media: query,
    get matches() { return matches; },
    onchange: null,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.delete(listener);
    }),
    addListener: vi.fn((listener: EventListener) => listeners.add(listener)),
    removeListener: vi.fn((listener: EventListener) => listeners.delete(listener)),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  return {
    media,
    listeners,
    setMatches(next: boolean) {
      matches = next;
      const event = new Event("change");
      Object.defineProperties(event, { matches: { value: next }, media: { value: query } });
      act(() => {
        for (const listener of Array.from(listeners)) {
          if (typeof listener === "function") listener.call(media, event);
          else listener.handleEvent(event);
        }
      });
    },
  };
}

let hover: ReturnType<typeof createMedia>;
let reduced: ReturnType<typeof createMedia>;
let frames: Map<number, FrameRequestCallback>;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;
let pauseAnimations: ReturnType<typeof vi.fn>;
let unpauseAnimations: ReturnType<typeof vi.fn>;
let pageHidden: boolean;

const originalPause = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, "pauseAnimations");
const originalUnpause = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, "unpauseAnimations");

beforeEach(() => {
  vi.useFakeTimers();
  pageHidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => pageHidden);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => pageHidden ? "hidden" : "visible");

  hover = createMedia("(hover: none)");
  reduced = createMedia("(prefers-reduced-motion: reduce)");
  vi.stubGlobal("matchMedia", vi.fn((query: string) => {
    if (query === hover.media.media) return hover.media;
    if (query === reduced.media.media) return reduced.media;
    throw new Error(`Consulta de mídia inesperada: ${query}`);
  }));

  frames = new Map();
  let nextFrame = 1;
  requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  cancelFrame = vi.fn((id: number) => { frames.delete(id); });
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);

  pauseAnimations = vi.fn();
  unpauseAnimations = vi.fn();
  Object.defineProperty(SVGSVGElement.prototype, "pauseAnimations", { configurable: true, value: pauseAnimations });
  Object.defineProperty(SVGSVGElement.prototype, "unpauseAnimations", { configurable: true, value: unpauseAnimations });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalPause) Object.defineProperty(SVGSVGElement.prototype, "pauseAnimations", originalPause);
  else Reflect.deleteProperty(SVGSVGElement.prototype, "pauseAnimations");
  if (originalUnpause) Object.defineProperty(SVGSVGElement.prototype, "unpauseAnimations", originalUnpause);
  else Reflect.deleteProperty(SVGSVGElement.prototype, "unpauseAnimations");
  vi.useRealTimers();
});

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/login"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<form aria-label="Acesso de teste"><input aria-label="E-mail" /></form>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function movePointer(main: HTMLElement, x: number, y: number, pointerType = "mouse") {
  // O jsdom não oferece PointerEvent completo; definimos as coordenadas no
  // evento nativo para testar o mesmo contrato lido pelo evento do React.
  const event = new Event("pointermove", { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerType: { value: pointerType },
  });
  fireEvent(main, event);
}

function flushFrame() {
  act(() => {
    const callbacks = Array.from(frames.values());
    frames.clear();
    for (const callback of callbacks) callback(16);
  });
}

function setHidden(next: boolean) {
  pageHidden = next;
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
}

function layer(main: HTMLElement, selector: string): HTMLElement {
  const element = main.querySelector<HTMLElement>(selector);
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("Execução do fundo do AuthLayout", () => {
  it("agrupa movimentos em um RAF e grava a última posição somente nas duas camadas decorativas", () => {
    renderLayout();
    const main = screen.getByRole("main");
    const background = layer(main, ".vx-login-background");
    const glow = layer(main, ".vx-login-glow");
    expect(main).toHaveAttribute("data-background-running", "false");

    movePointer(main, 10, 20);
    movePointer(main, 200, 150);
    movePointer(main, 420, 310);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    expect(background.style.getPropertyValue("--login-mouse-x")).toBe("");
    flushFrame();

    for (const decorativeLayer of [background, glow]) {
      expect(decorativeLayer.style.getPropertyValue("--login-mouse-x")).toBe("420px");
      expect(decorativeLayer.style.getPropertyValue("--login-mouse-y")).toBe("310px");
    }
    for (const element of [main, layer(main, ".vx-auth-card"), screen.getByRole("textbox", { name: "E-mail" })]) {
      expect(element.style.getPropertyValue("--login-mouse-x")).toBe("");
      expect(element.style.getPropertyValue("--login-mouse-y")).toBe("");
    }
    expect(main).toHaveAttribute("data-background-running", "true");
    expect(unpauseAnimations).toHaveBeenCalled();
  });

  it("preserva o movimento durante os 550ms de saída e só então pausa o SVG", () => {
    renderLayout();
    const main = screen.getByRole("main");
    movePointer(main, 50, 60);
    flushFrame();
    const pausesBeforeLeave = pauseAnimations.mock.calls.length;

    fireEvent.pointerLeave(main);
    expect(main).toHaveAttribute("data-reveal-active", "false");
    act(() => { vi.advanceTimersByTime(549); });
    expect(main).toHaveAttribute("data-background-running", "true");
    expect(pauseAnimations).toHaveBeenCalledTimes(pausesBeforeLeave);
    act(() => { vi.advanceTimersByTime(1); });
    expect(main).toHaveAttribute("data-background-running", "false");
    expect(pauseAnimations.mock.calls.length).toBeGreaterThan(pausesBeforeLeave);
  });

  it("cancela o RAF ao ativar movimento reduzido e volta a aceitar movimentos quando a preferência muda", () => {
    renderLayout();
    const main = screen.getByRole("main");
    const background = layer(main, ".vx-login-background");
    movePointer(main, 100, 120);
    expect(frames.size).toBe(1);

    reduced.setMatches(true);
    expect(frames.size).toBe(0);
    expect(main).toHaveAttribute("data-background-running", "false");
    movePointer(main, 300, 320);
    expect(frames.size).toBe(0);
    expect(background.style.getPropertyValue("--login-mouse-x")).toBe("");

    reduced.setMatches(false);
    movePointer(main, 400, 420);
    expect(frames.size).toBe(1);
    flushFrame();
    expect(background.style.getPropertyValue("--login-mouse-x")).toBe("400px");
    expect(main).toHaveAttribute("data-background-running", "true");
  });

  it("cancela RAF e fade ao ocultar a página e ignora ponteiros até ela voltar", () => {
    renderLayout();
    const main = screen.getByRole("main");
    movePointer(main, 100, 120);
    setHidden(true);
    expect(main).toHaveAttribute("data-page-visible", "false");
    expect(main).toHaveAttribute("data-background-running", "false");
    expect(frames.size).toBe(0);
    movePointer(main, 200, 220);
    expect(frames.size).toBe(0);

    setHidden(false);
    expect(main).toHaveAttribute("data-page-visible", "true");
    movePointer(main, 300, 320);
    flushFrame();
    fireEvent.pointerLeave(main);
    expect(vi.getTimerCount()).toBe(1);
    setHidden(true);
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(main).toHaveAttribute("data-background-running", "false");
  });

  it("mantém o fundo visível sem hover animado e ignora movimentos de toque", () => {
    hover.setMatches(true);
    renderLayout();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-background-running", "true");
    const pausesBeforeLeave = pauseAnimations.mock.calls.length;

    movePointer(main, 90, 110, "touch");
    expect(requestFrame).not.toHaveBeenCalled();
    expect(layer(main, ".vx-login-background").style.getPropertyValue("--login-mouse-x")).toBe("");
    fireEvent.pointerLeave(main);
    act(() => { vi.advanceTimersByTime(600); });
    expect(main).toHaveAttribute("data-background-running", "true");
    expect(pauseAnimations).toHaveBeenCalledTimes(pausesBeforeLeave);

    hover.setMatches(false);
    act(() => { vi.advanceTimersByTime(550); });
    expect(main).toHaveAttribute("data-background-running", "false");
  });

  it("remove listeners e cancela RAF ou timer pendentes ao desmontar", () => {
    const documentAdds = vi.spyOn(document, "addEventListener");
    const documentRemoves = vi.spyOn(document, "removeEventListener");
    const first = renderLayout();
    movePointer(screen.getByRole("main"), 10, 20);
    expect(frames.size).toBe(1);
    first.unmount();
    expect(frames.size).toBe(0);
    expect(cancelFrame).toHaveBeenCalled();
    expect(hover.listeners.size).toBe(0);
    expect(reduced.listeners.size).toBe(0);

    const visibilityListeners = documentAdds.mock.calls
      .filter(([type]) => type === "visibilitychange")
      .map(([, listener]) => listener);
    expect(visibilityListeners.length).toBeGreaterThan(0);
    for (const listener of visibilityListeners) {
      expect(documentRemoves.mock.calls.some(([type, removed]) => type === "visibilitychange" && removed === listener)).toBe(true);
    }

    const second = renderLayout();
    const main = screen.getByRole("main");
    movePointer(main, 30, 40);
    flushFrame();
    fireEvent.pointerLeave(main);
    expect(vi.getTimerCount()).toBe(1);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(hover.listeners.size).toBe(0);
    expect(reduced.listeners.size).toBe(0);
  });
});
