/**
 * setup.ts — preparação do ambiente de teste do frontend.
 *
 * O QUE FAZ
 * Instala os matchers do `@testing-library/jest-dom` e supre as APIs de
 * navegador que o jsdom não implementa e das quais os componentes dependem.
 *
 * POR QUE CADA MOCK EXISTE (nenhum é decorativo)
 *   - `matchMedia`  — o jsdom não tem. Sem ele, `useReducedMotion` do `motion`
 *                     e o `useTelaEstreita` dos gráficos lançam na montagem.
 *   - `ResizeObserver` — usado pelo posicionamento ancorado e pelo `ScrollArea`.
 *   - `scrollIntoView` — usado pela navegação por setas das listas.
 *   - `getComputedStyle` de custom property — o jsdom devolve "" para
 *     `--tokens`; os gráficos leem cor por ali. Não afeta os testes de ARIA.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

/** Fábrica de `matchMedia`, para os testes poderem simular preferências. */
export function instalarMatchMedia(consultasVerdadeiras: string[] = []) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: consultasVerdadeiras.some((c) => query.includes(c)),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

instalarMatchMedia();

/**
 * `localStorage`.
 *
 * O Node 26 traz um `localStorage` global EXPERIMENTAL que só funciona com a
 * flag `--localstorage-file`; sem ela, ele existe como global e resolve para
 * `undefined`, SOMBREANDO o do jsdom. O resultado é `localStorage.clear()`
 * lançando "Cannot read properties of undefined" em ambiente jsdom — que é a
 * última coisa que se suspeitaria. Instalar o nosso explicitamente resolve e
 * ainda deixa o storage inspecionável nos testes.
 */
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== "function") {
  const mapa = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return mapa.size;
    },
    clear: () => mapa.clear(),
    getItem: (k) => mapa.get(k) ?? null,
    key: (i) => Array.from(mapa.keys())[i] ?? null,
    removeItem: (k) => void mapa.delete(k),
    setItem: (k, v) => void mapa.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });
  Object.defineProperty(window, "localStorage", { value: storage, writable: true, configurable: true });
}

class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverFalso as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView = vi.fn();

// `inert` ainda não é implementado pelo jsdom como propriedade — os overlays o
// definem por atributo (`setAttribute("inert")`), então basta não quebrar.
if (!("inert" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "inert", { value: false, writable: true });
}
