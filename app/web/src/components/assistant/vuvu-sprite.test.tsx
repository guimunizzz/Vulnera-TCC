/**
 * Confere olhares, estados e interrupção do player para não animar contra as preferências.
 * Usa o atlas local e relógio controlado; consumido pelo Vitest sem API externa.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantMascot } from "./assistant-mascot";
import { vuvuCanLook, vuvuFrame, vuvuLookFrame } from "./vuvu-sprite";

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
});
