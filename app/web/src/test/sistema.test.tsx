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
 *   MOV-03   a opção do menu de acessibilidade reduz sem o sistema pedir
 *   A11Y-PREF-01  o script inline do index.html aplica o mesmo que o módulo
 *   A11Y-PREF-02  preferência guardada inválida cai no padrão, campo a campo
 *   A11Y-PREF-03  o painel muda texto e opções na hora, guarda e restaura
 *   A11Y-PREF-04  movimento reduzido pelo sistema aparece ligado e explicado
 *   A11Y-PREF-05  painel aberto sem violações WCAG A/AA no axe
 *   FILT-01  filtro vai para a URL e volta dela
 *   FILT-02  a URL vence o localStorage
 *   FILT-03  filtragem cruzada aplica o recorte inteiro
 *   FILT-04  limpar tudo remove só os parâmetros de filtro
 *   AXE-01   styleguide sem violações de acessibilidade
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import axe from "axe-core";
import { CHAVE_STORAGE, TEMAS, aplicarTema, lerTemaGuardado, resolverTema } from "../design/theme";
import { ThemeProvider } from "../design/theme-provider";
import { ThemeToggle } from "../design/theme-toggle";
import {
  ATRIBUTO_A11Y,
  CHAVE_STORAGE_A11Y,
  ESCALAS_FONTE,
  PREFERENCIAS_PADRAO,
  definirPreferencias,
  lerPreferencias,
  restaurarPreferencias,
} from "../design/accessibility";
import { AccessibilityMenu } from "../design/accessibility-menu";
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
 * `useMotion` lê "reduzido" de design/accessibility.ts, que consulta o
 * `matchMedia` a cada leitura (e não memoriza, como o `useReducedMotion` do
 * `motion`). Por isso basta reinstalar o mock de `matchMedia` entre as
 * montagens — sem mockar a biblioteca.
 */
describe("Movimento reduzido", () => {
  beforeEach(() => {
    restaurarPreferencias();
    instalarMatchMedia([]);
  });

  it("MOV-01 — remove deslocamento e escala, e zera o desenho de gráfico", () => {
    const { unmount } = render(<SondaDeMovimento />);
    expect(screen.getByTestId("reduzido")).toHaveTextContent("false");
    expect(screen.getByTestId("item-y")).toHaveTextContent("10");
    expect(screen.getByTestId("overlay-escala")).toHaveTextContent("0.96");
    unmount();

    instalarMatchMedia(["prefers-reduced-motion: reduce"]);
    render(<SondaDeMovimento />);
    expect(screen.getByTestId("reduzido")).toHaveTextContent("true");
    // Deslocamento vira ZERO e a escala vira 1 — sobra a opacidade. Movimento
    // reduzido não é "sem feedback", é "sem deslocamento".
    expect(screen.getByTestId("item-y")).toHaveTextContent("0");
    expect(screen.getByTestId("overlay-escala")).toHaveTextContent("1");
    expect(screen.getByTestId("grafico-ms")).toHaveTextContent("0");
  });

  it("MOV-02 — o contador de KPI não conta, apenas mostra o valor", () => {
    instalarMatchMedia(["prefers-reduced-motion: reduce"]);
    render(<NumeroAnimado valor={1234} />);

    // Sem movimento reduzido haveria DOIS nós (o animado `aria-hidden` e o
    // `.sr-only`); com ele, um só — contar É movimento.
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(document.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
  });

  it("MOV-03 — a opção do menu de acessibilidade reduz sem o sistema pedir", () => {
    definirPreferencias({ reduzirMovimento: true });
    render(<SondaDeMovimento />);

    expect(screen.getByTestId("reduzido")).toHaveTextContent("true");
    expect(screen.getByTestId("item-y")).toHaveTextContent("0");
    // O atributo é o que liga o piso de CSS (base.css) para animação de terceiros.
    expect(document.documentElement).toHaveAttribute(ATRIBUTO_A11Y.reduzirMovimento);
  });
});

/* ==========================================================================
   Menu de acessibilidade
   ========================================================================== */

describe("Menu de acessibilidade", () => {
  beforeEach(() => {
    restaurarPreferencias();
    localStorage.clear();
    instalarMatchMedia([]);
  });

  it("A11Y-PREF-01 — o script inline do index.html aplica o mesmo que o módulo, antes do React", () => {
    // Mesma trava do TEMA-01: a cópia mínima no index.html não pode divergir de
    // design/accessibility.ts. Aqui o script é EXECUTADO, não só lido.
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    localStorage.setItem(CHAVE_STORAGE_A11Y, JSON.stringify({ escalaFonte: 1.5, altoContraste: true, sublinharLinks: true }));

    new Function(script)();

    const raiz = document.documentElement;
    expect(raiz.style.getPropertyValue("--a11y-escala-fonte")).toBe("1.5");
    expect(raiz).toHaveAttribute(ATRIBUTO_A11Y.altoContraste);
    expect(raiz).toHaveAttribute(ATRIBUTO_A11Y.sublinharLinks);
    expect(raiz).not.toHaveAttribute(ATRIBUTO_A11Y.reduzirMovimento);
    for (const atributo of Object.values(ATRIBUTO_A11Y)) expect(script).toContain(`"${atributo}"`);
    for (const escala of ESCALAS_FONTE.slice(1)) expect(script).toContain(String(escala));
  });

  it("A11Y-PREF-02 — preferência guardada inválida cai no padrão, campo a campo", () => {
    localStorage.setItem(CHAVE_STORAGE_A11Y, JSON.stringify({ escalaFonte: 3, altoContraste: "sim", focoReforcado: true }));
    expect(lerPreferencias()).toEqual({ ...PREFERENCIAS_PADRAO, focoReforcado: true });

    localStorage.setItem(CHAVE_STORAGE_A11Y, "{quebrado");
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO);
  });

  it("A11Y-PREF-03 — o painel muda texto e opções na hora, guarda e restaura", async () => {
    const user = userEvent.setup();
    render(<AccessibilityMenu />);
    await user.click(screen.getByRole("button", { name: "Acessibilidade" }));
    const painel = screen.getByRole("dialog", { name: "Acessibilidade" });

    // No limite o botão fica aria-disabled (e não disabled), para não perder o foco.
    expect(within(painel).getByRole("button", { name: "Diminuir texto" })).toHaveAttribute("aria-disabled", "true");
    await user.click(within(painel).getByRole("button", { name: "Aumentar texto" }));
    await user.click(within(painel).getByRole("button", { name: "Aumentar texto" }));
    expect(within(painel).getByText("125%")).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--a11y-escala-fonte")).toBe("1.25");

    const contraste = within(painel).getByRole("switch", { name: "Alto contraste" });
    await user.click(contraste);
    expect(contraste).toHaveAttribute("aria-checked", "true");
    expect(contraste).toHaveAccessibleDescription(/nível AAA/);
    expect(document.documentElement).toHaveAttribute(ATRIBUTO_A11Y.altoContraste);
    expect(JSON.parse(localStorage.getItem(CHAVE_STORAGE_A11Y) ?? "{}")).toMatchObject({ escalaFonte: 1.25, altoContraste: true });
    // O gatilho avisa que há ajuste ativo — também para o leitor de tela.
    expect(screen.getByRole("button", { name: "Acessibilidade (ajustes ativos)" })).toBeInTheDocument();

    await user.click(within(painel).getByRole("button", { name: "Restaurar padrão" }));
    expect(document.documentElement).not.toHaveAttribute(ATRIBUTO_A11Y.altoContraste);
    expect(document.documentElement.style.getPropertyValue("--a11y-escala-fonte")).toBe("");
  });

  it("A11Y-PREF-04 — movimento reduzido pelo sistema aparece ligado e explicado", async () => {
    instalarMatchMedia(["prefers-reduced-motion: reduce"]);
    const user = userEvent.setup();
    render(<AccessibilityMenu />);
    await user.click(screen.getByRole("button", { name: "Acessibilidade" }));

    const movimento = screen.getByRole("switch", { name: "Reduzir animações" });
    expect(movimento).toHaveAttribute("aria-checked", "true");
    expect(movimento).toBeDisabled();
    expect(movimento).toHaveAccessibleDescription("Já ativo pelas configurações do seu sistema.");
  });

  it("A11Y-PREF-05 — painel aberto sem violações WCAG A/AA no axe", async () => {
    const user = userEvent.setup();
    render(<AccessibilityMenu />);
    await user.click(screen.getByRole("button", { name: "Acessibilidade" }));

    const resultado = await axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      // Ver AXE-01: o jsdom não resolve cor de custom property.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
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
