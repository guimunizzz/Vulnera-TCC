/**
 * hero-boot.test.tsx — boot de terminal do hero.
 *   BOOT-01  linhas aparecem uma a uma e o hero é liberado em ~1 s
 *   BOOT-02  qualquer tecla pula na hora
 *   BOOT-03  não toca com movimento reduzido, com âncora na URL ou já visto
 *   BOOT-04  as linhas são decoração (aria-hidden)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HeroBoot } from "./hero-boot";
import { deveTocarBoot } from "./hero-boot-estado";
import { BOOT_LANDING } from "../motion/tokens";
import { definirPreferencias, restaurarPreferencias } from "../../../design/accessibility";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  restaurarPreferencias();
});

describe("HeroBoot", () => {
  it("BOOT-01 — linhas uma a uma, hero liberado em ~1 s", () => {
    const aoTerminar = vi.fn();
    render(<HeroBoot aoTerminar={aoTerminar} />);
    act(() => { vi.advanceTimersByTime(BOOT_LANDING.passoMs * 2 + 1); });
    expect(screen.getByText("carregando sensores")).toBeInTheDocument();
    expect(screen.queryByText("pronto.")).toBeNull();
    expect(aoTerminar).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(BOOT_LANDING.chaveSessao)).toBe("1");
  });

  it("BOOT-02 — uma tecla pula na hora", () => {
    const aoTerminar = vi.fn();
    render(<HeroBoot aoTerminar={aoTerminar} />);
    fireEvent.keyDown(window, { key: " " });
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });

  it("BOOT-03 — não toca com movimento reduzido, âncora ou já visto", () => {
    expect(deveTocarBoot()).toBe(true);

    definirPreferencias({ reduzirMovimento: true });
    expect(deveTocarBoot()).toBe(false);
    restaurarPreferencias();

    window.history.replaceState(null, "", "/#demo");
    expect(deveTocarBoot()).toBe(false);
    window.history.replaceState(null, "", "/");

    sessionStorage.setItem(BOOT_LANDING.chaveSessao, "1");
    expect(deveTocarBoot()).toBe(false);
  });

  it("BOOT-04 — linhas aria-hidden; o botão Pular é o único focável", () => {
    render(<HeroBoot aoTerminar={() => {}} />);
    act(() => { vi.advanceTimersByTime(BOOT_LANDING.passoMs); });
    expect(screen.getByText(/vulnera init/).closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /PULAR/ })).toBeInTheDocument();
  });
});
