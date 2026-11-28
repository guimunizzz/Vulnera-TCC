/**
 * Confere olhares, estados e interrupção do player para não animar contra as preferências.
 * Usa o atlas local e relógio controlado; consumido pelo Vitest sem API externa.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantMascot } from "./assistant-mascot";
import { vuvuCanLook, vuvuFrame, vuvuLookFrame } from "./vuvu-sprite";
import { smoothVuvuGaze, stableVuvuLook } from "./vuvu-gaze";

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock("../../motion/use-motion", () => ({ useMotion: () => ({ reduzido: preference.reduced }) }));

beforeEach(() => {
  vi.useFakeTimers();
  preference.reduced = false;
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Vuvu em tempo real", () => {
  it.each([
    [0, -100, 9, 0], [100, 0, 9, 4], [0, 100, 10, 0], [-100, 0, 10, 4],
    [100, -100, 9, 2], [100, 100, 9, 6], [-100, 100, 10, 2], [-100, -100, 10, 6],
  ])("olha para a direção do cursor (%i, %i)", (dx, dy, row, column) => {
    expect(vuvuLookFrame(dx, dy)).toEqual({ row, column });
  });

  it("não deixa o olhar sobrescrever o pensamento nem uma reação em andamento", () => {
    expect(vuvuCanLook("thinking", 6000)).toBe(false);
    expect(vuvuCanLook("greeting", 400)).toBe(false);
    expect(vuvuCanLook("greeting", 1200)).toBe(true);
    expect(vuvuCanLook("error", 6000)).toBe(false);
    expect(vuvuFrame("moving", 0, true).row).toBe(2);
    expect(vuvuFrame("moving", 0, false).row).toBe(1);
  });

  it("anima o pensamento, pausa na aba oculta e retoma sem acumular timers", () => {
    const view = render(<AssistantMascot activity="thinking" />);
    const sprite = view.container.querySelector(".vuvu-sprite")!;
    expect(sprite).toHaveAttribute("data-frame", "7:0");
    act(() => vi.advanceTimersByTime(360));
    expect(sprite.getAttribute("data-frame")).not.toBe("7:0");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(sprite).toHaveAttribute("data-frame", "0:0");
    expect(vi.getTimerCount()).toBe(0);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(sprite).toHaveAttribute("data-frame", "7:0");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pausa contextual e movimento reduzido mantêm quadro neutro sem loop", () => {
    const view = render(<AssistantMascot activity="playful" paused />);
    expect(view.container.querySelector(".vuvu-sprite")).toHaveAttribute("data-frame", "0:0");
    expect(vi.getTimerCount()).toBe(0);
    preference.reduced = true;
    view.rerender(<AssistantMascot activity="thinking" />);
    act(() => vi.advanceTimersByTime(5000));
    expect(view.container.querySelector(".vuvu-sprite")).toHaveAttribute("data-frame", "0:0");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("repouso não agenda animação e o six seven usa o atlas de oito poses por 2,88 segundos", () => {
    const view = render(<AssistantMascot />);
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(<AssistantMascot activity="six-seven" />);
    const sprite = view.container.querySelector(".vuvu-sprite")!;
    expect(sprite.querySelector("img")).toHaveAttribute("width", "2048");
    act(() => vi.advanceTimersByTime(840));
    expect(sprite).toHaveAttribute("data-frame", "1:3");
    expect(vuvuCanLook("six-seven", 5000)).toBe(false);
    act(() => vi.advanceTimersByTime(2200));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("mantém a ajuda utilizável se o arquivo de imagem falhar", () => {
    const view = render(<AssistantMascot />);
    fireEvent.error(view.container.querySelector("img")!);
    expect(view.container.querySelector(".vuvu-fallback")).toHaveTextContent("V");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("amortece o percurso e não alterna entre direções com pequenas oscilações na borda", () => {
    const first = smoothVuvuGaze({ x: 100, y: 0 }, { x: 0, y: -100 }, 16);
    expect(first.x).toBeGreaterThan(0); expect(first.x).toBeLessThan(100);
    expect(first.y).toBeLessThan(0); expect(first.y).toBeGreaterThan(-100);
    const up = { row: 9, column: 0 };
    for (const degrees of [10, 12, 11, 14, -14]) {
      const angle = degrees * Math.PI / 180;
      expect(stableVuvuLook({ x: Math.sin(angle) * 100, y: -Math.cos(angle) * 100 }, up)).toEqual(up);
    }
    expect(stableVuvuLook({ x: 100, y: 0 }, up)).toEqual({ row: 9, column: 4 });
  });

  it("mantém o olhar quando o mouse se aproxima do centro e encerra o RAF ao estabilizar", () => {
    const view = render(<AssistantMascot trackPointer />);
    const sprite = view.container.querySelector(".vuvu-sprite")!;
    vi.spyOn(sprite, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
    fireEvent(window, new MouseEvent("pointermove", { clientX: 150, clientY: 50 }));
    act(() => vi.advanceTimersByTime(32));
    expect(sprite).toHaveAttribute("data-frame", "9:4");
    fireEvent(window, new MouseEvent("pointermove", { clientX: 51, clientY: 50 }));
    act(() => vi.advanceTimersByTime(100));
    expect(sprite).toHaveAttribute("data-frame", "9:4");
    fireEvent(window, new MouseEvent("pointermove", { clientX: 50, clientY: -50 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(sprite).toHaveAttribute("data-frame", "9:0");
    expect(vi.getTimerCount()).toBe(0);
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
