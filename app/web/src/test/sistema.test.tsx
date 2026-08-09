/**
 * sistema.test.tsx
 *
 * Testes do que atravessa a aplicação inteira: tema, movimento reduzido,
 * filtros na URL e varredura de acessibilidade automatizada.
 *
 *   TEMA-01  o script inline do index.html concorda com `design/theme.ts`
 *   TEMA-02  `system` resolve pelo `prefers-color-scheme`
 *   TEMA-03  a escolha é persistida e reaplicada
 *   TEMA-04  componentes renderizam nos dois temas
 *   MOV-01   `prefers-reduced-motion` remove deslocamento e escala
 *   MOV-02   com movimento reduzido, o contador não conta
 *   FILT-01  filtro vai para a URL e volta dela
 *   FILT-02  a URL vence o localStorage
 *   FILT-03  filtragem cruzada aplica o recorte inteiro
 *   FILT-04  limpar tudo remove só os parâmetros de filtro
 *   AXE-01   styleguide sem violações de acessibilidade
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import axe from "axe-core";
import { CHAVE_STORAGE, TEMAS, aplicarTema, lerTemaGuardado, resolverTema } from "../design/theme";
import { ThemeProvider } from "../design/theme-provider";
import { ThemeToggle } from "../design/theme-toggle";
import { useMotion } from "../motion/use-motion";
import { NumeroAnimado } from "../motion/components";
import { useFiltrosMetricas } from "../hooks/use-filtros-metricas";
import { Badge, Button, SeverityBadge } from "../components/ui";
import { instalarMatchMedia } from "./setup";

/* ==========================================================================
   Tema
   ========================================================================== */

describe("Tema", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    instalarMatchMedia();
  });

  it("TEMA-01 — o script inline do index.html usa a MESMA chave e os mesmos valores", () => {
    // Este teste existe por um motivo específico: a lógica de tema é
    // deliberadamente DUPLICADA entre `design/theme.ts` e um script inline no
    // `index.html` (o inline precisa rodar antes do React, para não haver
    // flash). Duplicação sem trava diverge — esta é a trava.
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");

    expect(html).toContain(`localStorage.getItem("${CHAVE_STORAGE}")`);
    for (const tema of TEMAS) {
      expect(html).toContain(`"${tema}"`);
    }
    expect(html).toContain('setAttribute("data-theme"');
    expect(html).toContain("prefers-color-scheme: dark");
    // O script precisa rodar ANTES do bundle, senão não evita o flash.
    expect(html.indexOf("data-theme")).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it("TEMA-02 — `system` segue o prefers-color-scheme", () => {
    instalarMatchMedia(["prefers-color-scheme: dark"]);
    expect(resolverTema("system")).toBe("dark");

    instalarMatchMedia([]);
    expect(resolverTema("system")).toBe("light");

    // Escolha explícita ignora o sistema — é o ponto de haver três opções.
    instalarMatchMedia(["prefers-color-scheme: dark"]);
    expect(resolverTema("light")).toBe("light");
  });

  it("TEMA-03 — a escolha é persistida e o documento é estampado", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("radio", { name: "Claro" }));

    expect(localStorage.getItem(CHAVE_STORAGE)).toBe("light");
    // `data-theme` sempre CONCRETO, nunca "system" — é o que deixa o CSS com
    // dois casos em vez de três.
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(lerTemaGuardado()).toBe("light");

    await user.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("TEMA-04 — componentes renderizam nos dois temas sem quebrar", () => {
    for (const tema of ["dark", "light"] as const) {
      aplicarTema(tema);
      const { unmount } = render(
        <div>
          <Button>Salvar</Button>
          <SeverityBadge severidade="CRITICAL" cvss={9.8} />
          <Badge tom="sucesso">ok</Badge>
        </div>,
      );
      // O que se prova aqui é que nenhum componente depende de um token que só
      // existe num tema — a paridade de CONTRASTE é medida por
      // `scripts/check-contrast.mjs`, que é a ferramenta certa para isso.
      expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
      expect(screen.getByText("Crítica")).toBeInTheDocument();
      unmount();
    }
  });
});

/* ==========================================================================
   Movimento
   ========================================================================== */

function SondaDeMovimento() {
  const m = useMotion();
  return (
    <div>
      <span data-testid="reduzido">{String(m.reduzido)}</span>
      <span data-testid="item-y">{JSON.stringify((m.item.inicial as { y: number }).y)}</span>
      <span data-testid="overlay-escala">{JSON.stringify((m.overlay.inicial as { scale: number }).scale)}</span>
      <span data-testid="grafico-ms">{m.duracaoGraficoMs}</span>
    </div>
  );
}

/**
 * O `useReducedMotion` do `motion` resolve a media query UMA VEZ e memoriza —
 * reinstalar o `matchMedia` depois disso não muda o valor. Por isso a
 * preferência é mockada na fonte: o que este projeto POSSUI (e portanto o que
 * precisa de teste) é o MAPEAMENTO de "reduzido" para as variantes; se a
 * biblioteca lê a media query corretamente é responsabilidade dela.
 */
vi.mock("motion/react", async (original) => {
  const real = await original<typeof import("motion/react")>();
  return { ...real, useReducedMotion: () => reduzidoMockado };
});
let reduzidoMockado = false;

describe("Movimento reduzido", () => {
  it("MOV-01 — remove deslocamento e escala, e zera o desenho de gráfico", () => {
    reduzidoMockado = false;
    const { unmount } = render(<SondaDeMovimento />);
    expect(screen.getByTestId("reduzido")).toHaveTextContent("false");
    expect(screen.getByTestId("item-y")).toHaveTextContent("10");
    expect(screen.getByTestId("overlay-escala")).toHaveTextContent("0.96");
    unmount();

    reduzidoMockado = true;
    render(<SondaDeMovimento />);
    expect(screen.getByTestId("reduzido")).toHaveTextContent("true");
    // Deslocamento vira ZERO e a escala vira 1 — sobra a opacidade. Movimento
    // reduzido não é "sem feedback", é "sem deslocamento".
    expect(screen.getByTestId("item-y")).toHaveTextContent("0");
    expect(screen.getByTestId("overlay-escala")).toHaveTextContent("1");
    expect(screen.getByTestId("grafico-ms")).toHaveTextContent("0");
  });

  it("MOV-02 — o contador de KPI não conta, apenas mostra o valor", () => {
    reduzidoMockado = true;
    render(<NumeroAnimado valor={1234} />);

    // Sem movimento reduzido haveria DOIS nós (o animado `aria-hidden` e o
    // `.sr-only`); com ele, um só — contar É movimento.
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(document.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
    reduzidoMockado = false;
  });
});

/* ==========================================================================
   Filtros
   ========================================================================== */

function SondaDeFiltros() {
  const c = useFiltrosMetricas("app-1");
  const [params] = useSearchParams();
  return (
    <div>
      <span data-testid="url">{params.toString()}</span>
      <span data-testid="severidades">{c.filtros.severidades.join("|")}</span>
      <span data-testid="preset">{c.filtros.preset}</span>
      <span data-testid="ativos">{c.quantidadeAtiva}</span>
      <button onClick={() => c.alternarValor("severidades", "CRITICAL")}>alternar crítica</button>
      <button onClick={() => c.definirPreset("7d")}>7 dias</button>
      <button onClick={() => c.aplicarRecorte({ severity: "HIGH", status: "OPEN", owasp: "A01" })}>recorte</button>
      <button onClick={c.limparTudo}>limpar</button>
    </div>
  );
}

function renderizarFiltros(rotaInicial = "/app/app-1") {
  return render(
    <MemoryRouter initialEntries={[rotaInicial]}>
      <Routes>
        <Route path="/app/:id" element={<SondaDeFiltros />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Filtros do dashboard", () => {
  beforeEach(() => localStorage.clear());

  it("FILT-01 — o filtro vai para a URL e é lido de volta dela", async () => {
    const user = userEvent.setup();
    renderizarFiltros();

    await user.click(screen.getByRole("button", { name: "alternar crítica" }));
    expect(screen.getByTestId("url")).toHaveTextContent("severity=CRITICAL");
    expect(screen.getByTestId("severidades")).toHaveTextContent("CRITICAL");
    expect(screen.getByTestId("ativos")).toHaveTextContent("1");

    // Alternar de novo REMOVE — o mesmo controle liga e desliga.
    await user.click(screen.getByRole("button", { name: "alternar crítica" }));
    expect(screen.getByTestId("url")).not.toHaveTextContent("severity");
    expect(screen.getByTestId("ativos")).toHaveTextContent("0");
  });

  it("FILT-02 — a URL vence o localStorage", async () => {
    // Um filtro guardado de uma visita anterior…
    localStorage.setItem("vulnera:filtros:app-1", "severity=LOW&periodo=30d");

    // …e um link compartilhado com OUTRO filtro. Quem manda é o link, senão
    // abrir o link de alguém mostraria o recorte de quem clicou.
    renderizarFiltros("/app/app-1?severity=CRITICAL");

    await waitFor(() => expect(screen.getByTestId("severidades")).toHaveTextContent("CRITICAL"));
    expect(screen.getByTestId("severidades")).not.toHaveTextContent("LOW");
  });

  it("FILT-03 — a filtragem cruzada aplica o recorte inteiro de uma vez", async () => {
    const user = userEvent.setup();
    renderizarFiltros();

    await user.click(screen.getByRole("button", { name: "recorte" }));

    const url = screen.getByTestId("url").textContent ?? "";
    expect(url).toContain("severity=HIGH");
    expect(url).toContain("status=OPEN");
    expect(url).toContain("owasp=A01");
  });

  it("FILT-04 — limpar tudo remove os filtros e preserva o resto da URL", async () => {
    const user = userEvent.setup();
    renderizarFiltros("/app/app-1?severity=CRITICAL&aba=evolucao");

    await waitFor(() => expect(screen.getByTestId("severidades")).toHaveTextContent("CRITICAL"));
    await user.click(screen.getByRole("button", { name: "limpar" }));

    const url = screen.getByTestId("url").textContent ?? "";
    expect(url).not.toContain("severity");
    // `aba` NÃO é filtro — limpar filtros não pode jogar a pessoa de volta
    // para a primeira aba.
    expect(url).toContain("aba=evolucao");
  });
});

/* ==========================================================================
   Varredura automatizada
   ========================================================================== */

describe("Acessibilidade automatizada (axe-core)", () => {
  it("AXE-01 — componentes do design system sem violações", async () => {
    instalarMatchMedia([]);
    const { container } = render(
      <MemoryRouter>
        <main>
          <h1>Painel</h1>
          <Button>Salvar</Button>
          <Button rotulo="Excluir finding" variant="destrutivo">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 2h4v1h3v1.5H3V3h3V2Z" />
            </svg>
          </Button>
          <SeverityBadge severidade="CRITICAL" cvss={9.8} />
          <Badge tom="atencao">pendente</Badge>
        </main>
      </MemoryRouter>,
    );

    const resultado = await axe.run(container, {
      // Regras de COR são desligadas de propósito: o jsdom não computa cor
      // resolvida de custom property, então `color-contrast` daria falso
      // negativo. O contraste real é medido por `scripts/check-contrast.mjs`,
      // que faz a conta em OKLCH e roda no `npm run check`.
      rules: { "color-contrast": { enabled: false } },
    });

    const violacoes = resultado.violations.map((v) => `${v.id}: ${v.nodes.length} nó(s) — ${v.help}`);
    expect(violacoes).toEqual([]);
  });
});
