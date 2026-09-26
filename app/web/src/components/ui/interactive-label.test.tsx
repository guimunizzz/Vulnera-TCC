import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InteractiveLabel } from "./interactive-label";
import { instalarMatchMedia } from "../../test/setup";

afterEach(() => { vi.useRealTimers(); instalarMatchMedia(); });

it("keeps the accessible name and icon intact during decoding and restores the text", () => {
  vi.useFakeTimers();
  const action = vi.fn();
  render(<button onClick={action}><InteractiveLabel>Entrar na plataforma</InteractiveLabel><svg data-testid="icon" aria-hidden="true" /></button>);
  const button = screen.getByRole("button", { name: "Entrar na plataforma" });
  fireEvent.pointerEnter(button);
  vi.advanceTimersByTime(50);
  expect(button).toHaveAccessibleName("Entrar na plataforma");
  expect(screen.getByTestId("icon")).toBeInTheDocument();
  expect(button.querySelector("[data-decoding]")).not.toBeNull();
  vi.advanceTimersByTime(1000);
  expect(button.querySelector("[data-decoding]")).toBeNull();
  fireEvent.click(button);
  expect(action).toHaveBeenCalledOnce();
});

it("cancels on pointer exit and unmount without leaving an animation loop", () => {
  vi.useFakeTimers();
  const { unmount } = render(<button><InteractiveLabel>Criar conta</InteractiveLabel></button>);
  const button = screen.getByRole("button", { name: "Criar conta" });
  fireEvent.pointerEnter(button);
  fireEvent.pointerLeave(button);
  expect(button.querySelector("[data-decoding]")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.pointerEnter(button);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not animate reduced-motion or busy controls", () => {
  instalarMatchMedia(["prefers-reduced-motion"]);
  const { rerender } = render(<button><InteractiveLabel>Entrar</InteractiveLabel></button>);
  fireEvent.pointerEnter(screen.getByRole("button"));
  expect(document.querySelector("[data-decoding]")).toBeNull();
  instalarMatchMedia();
  rerender(<button aria-busy="true"><InteractiveLabel key="busy">Entrar</InteractiveLabel></button>);
  fireEvent.pointerEnter(screen.getByRole("button"));
  expect(document.querySelector("[data-decoding]")).toBeNull();
});
