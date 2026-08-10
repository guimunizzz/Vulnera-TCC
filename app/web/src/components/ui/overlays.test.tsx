/**
 * overlays.test.tsx
 *
 * PROVA o contrato de acessibilidade que o ADR-023 assumiu ao remover o Radix.
 *
 * O QUE ESTE ARQUIVO EXISTE PARA IMPEDIR
 * A regressão silenciosa. Trocar uma biblioteca acessível por componentes
 * próprios não quebra a tela — quebra o teclado e o leitor de tela, que
 * ninguém vê numa revisão de código. Cada teste aqui corresponde a uma linha
 * do bloco "CONTRATO DE ACESSIBILIDADE" dos componentes.
 *
 *   A11Y-01  Dialog · foco entra ao abrir
 *   A11Y-02  Dialog · foco respeita `data-autofocus`
 *   A11Y-03  Dialog · Tab cicla dentro (armadilha de foco)
 *   A11Y-04  Dialog · Escape fecha
 *   A11Y-05  Dialog · clique fora fecha, e não fecha quando desligado
 *   A11Y-06  Dialog · role, aria-modal, aria-labelledby, aria-describedby
 *   A11Y-07  Dialog · scroll do body travado enquanto aberto
 *   A11Y-08  Dialog · foco volta ao gatilho ao fechar
 *   A11Y-09  Dialog · resto da árvore fica `inert`
 *   A11Y-10  Menu   · aria-expanded/aria-haspopup no gatilho
 *   A11Y-11  Menu   · setas, Home/End e Enter
 *   A11Y-12  Menu   · typeahead salta para o item digitado
 *   A11Y-13  Select · role/aria-selected/aria-activedescendant
 *   A11Y-14  Tabs   · roving tabindex e ativação manual
 */

import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Button } from "./button";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "./dialog";
import { DropdownMenu } from "./dropdown-menu";
import { Select } from "./select";
import { Tabs } from "./tabs";

/* ==========================================================================
   Dialog
   ========================================================================== */

function DialogDeTeste({ fecharAoClicarFora = true }: { fecharAoClicarFora?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const refGatilho = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <input aria-label="campo fora do dialog" />
      <Button ref={refGatilho} onClick={() => setAberto(true)}>
        Abrir
      </Button>
      <Dialog aberto={aberto} aoFechar={() => setAberto(false)} fecharAoClicarFora={fecharAoClicarFora}>
        <DialogTitle>Excluir finding?</DialogTitle>
        <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
        <DialogFooter>
          <Button data-autofocus onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button variant="destrutivo">Excluir</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

describe("Dialog — contrato de acessibilidade", () => {
  it("A11Y-01/02 — ao abrir, o foco entra e respeita data-autofocus", async () => {
    const user = userEvent.setup();
    render(<DialogDeTeste />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = await screen.findByRole("dialog");
    // `data-autofocus` está no "Cancelar" de propósito: num diálogo
    // destrutivo o foco não pode nascer sobre o botão que apaga.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus());
  });

  it("A11Y-03 — Tab cicla dentro do dialog e não escapa", async () => {
    const user = userEvent.setup();
    render(<DialogDeTeste />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");

    const cancelar = within(dialog).getByRole("button", { name: "Cancelar" });
    const excluir = within(dialog).getByRole("button", { name: "Excluir" });
    const foraDoDialog = screen.getByLabelText("campo fora do dialog");

    await user.tab();
    expect(excluir).toHaveFocus();

    // No ÚLTIMO focável, Tab volta ao primeiro — não vai para o campo de fora.
    await user.tab();
    expect(cancelar).toHaveFocus();
    expect(foraDoDialog).not.toHaveFocus();

    // E o caminho inverso também fecha o ciclo.
    await user.tab({ shift: true });
    expect(excluir).toHaveFocus();
  });

  it("A11Y-04 — Escape fecha", async () => {
    const user = userEvent.setup();
    render(<DialogDeTeste />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("A11Y-05 — clique fora fecha, e respeita fecharAoClicarFora={false}", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DialogDeTeste />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    unmount();

    // Com o fechamento por clique-fora desligado, o dialog PERMANECE — é o
    // caso de formulário com dados não salvos.
    render(<DialogDeTeste fecharAoClicarFora={false} />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await user.click(document.body);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("A11Y-06 — role, aria-modal e as associações de nome e descrição", async () => {
    const user = userEvent.setup();
    render(<DialogDeTeste />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");

    // `aria-labelledby` tem que apontar para um elemento que EXISTE e que
    // contém o título — um id órfão passa despercebido e deixa o dialog sem nome.
    const idTitulo = dialog.getAttribute("aria-labelledby");
    expect(idTitulo).toBeTruthy();
    expect(document.getElementById(idTitulo!)).toHaveTextContent("Excluir finding?");

    const idDescricao = dialog.getAttribute("aria-describedby");
    expect(document.getElementById(idDescricao!)).toHaveTextContent("Esta ação não pode ser desfeita.");
  });

  it("A11Y-07 — trava a rolagem do body enquanto aberto e devolve ao fechar", async () => {
    const user = userEvent.setup();
    render(<DialogDeTeste />);

    expect(document.body.style.overflow).not.toBe("hidden");
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });

  it("A11Y-08 — ao fechar, o foco volta ao gatilho", async () => {
    const user = userEvent.setup();
    render(<DialogDeTeste />);
    const gatilho = screen.getByRole("button", { name: "Abrir" });

    await user.click(gatilho);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    // Sem isso o foco cairia no <body> e o próximo Tab recomeçaria do topo.
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it("A11Y-09 — o resto da árvore fica inert enquanto o dialog está aberto", async () => {
    const user = userEvent.setup();
    const { container } = render(<DialogDeTeste />);
    // A Testing Library anexa `container` como filho direto do <body> — é ele
    // o "resto da árvore" que o overlay precisa tornar inerte. Usar
    // `container.parentElement` pegaria o próprio <body>, que nunca é marcado.
    const raizDaApp = container;

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    // `inert` é o que impede o leitor de tela de LER o formulário atrás do
    // modal — a armadilha de foco sozinha resolve só o teclado.
    await waitFor(() => expect(raizDaApp).toHaveAttribute("inert"));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(raizDaApp).not.toHaveAttribute("inert"));
  });
});

/* ==========================================================================
   DropdownMenu
   ========================================================================== */

describe("DropdownMenu — contrato de acessibilidade", () => {
  const itens = (aoEscolher: () => void) => [
    { id: "editar", rotulo: "Editar", aoEscolher },
    { id: "duplicar", rotulo: "Duplicar", aoEscolher },
    { id: "arquivar", rotulo: "Arquivar", desabilitado: true, aoEscolher },
    { id: "zerar", rotulo: "Zerar contador", aoEscolher },
  ];

  it("A11Y-10 — gatilho declara aria-haspopup e aria-expanded", async () => {
    const user = userEvent.setup();
    render(<DropdownMenu rotulo="Ações" gatilho={<Button>Ações</Button>} itens={itens(vi.fn())} />);

    const gatilho = screen.getByRole("button", { name: "Ações" });
    expect(gatilho).toHaveAttribute("aria-haspopup", "menu");
    expect(gatilho).toHaveAttribute("aria-expanded", "false");

    await user.click(gatilho);
    await screen.findByRole("menu");
    expect(gatilho).toHaveAttribute("aria-expanded", "true");
  });

  it("A11Y-11 — setas navegam pulando desabilitado, Home/End vão aos extremos, Enter executa", async () => {
    const user = userEvent.setup();
    const escolher = vi.fn();
    render(<DropdownMenu rotulo="Ações" gatilho={<Button>Ações</Button>} itens={itens(escolher)} />);

    await user.click(screen.getByRole("button", { name: "Ações" }));
    const menu = await screen.findByRole("menu");
    await waitFor(() => expect(menu).toHaveFocus());

    const ativo = () => document.getElementById(menu.getAttribute("aria-activedescendant")!);

    expect(ativo()).toHaveTextContent("Editar");

    await user.keyboard("{ArrowDown}");
    expect(ativo()).toHaveTextContent("Duplicar");

    // "Arquivar" está desabilitado — a seta tem que PULAR, não parar nele.
    await user.keyboard("{ArrowDown}");
    expect(ativo()).toHaveTextContent("Zerar contador");

    await user.keyboard("{Home}");
    expect(ativo()).toHaveTextContent("Editar");

    await user.keyboard("{End}");
    expect(ativo()).toHaveTextContent("Zerar contador");

    await user.keyboard("{Enter}");
    expect(escolher).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("A11Y-12 — digitar salta para o item que começa com aquelas letras", async () => {
    const user = userEvent.setup();
    render(<DropdownMenu rotulo="Ações" gatilho={<Button>Ações</Button>} itens={itens(vi.fn())} />);

    await user.click(screen.getByRole("button", { name: "Ações" }));
    const menu = await screen.findByRole("menu");
    await waitFor(() => expect(menu).toHaveFocus());

    await user.keyboard("d");
    const ativo = document.getElementById(menu.getAttribute("aria-activedescendant")!);
    expect(ativo).toHaveTextContent("Duplicar");
  });
});

/* ==========================================================================
   Select
   ========================================================================== */

describe("Select — contrato de acessibilidade", () => {
  const opcoes = [
    { valor: "PROD", rotulo: "Produção" },
    { valor: "HOMOL", rotulo: "Homologação" },
    { valor: "DEV", rotulo: "Desenvolvimento" },
  ];

  it("A11Y-13 — listbox, option, aria-selected e aria-activedescendant", async () => {
    const user = userEvent.setup();
    function Wrapper() {
      const [valor, setValor] = useState<string | null>("PROD");
      return <Select opcoes={opcoes} valor={valor} aoMudar={setValor} aria-label="Ambiente" />;
    }
    render(<Wrapper />);

    const gatilho = screen.getByRole("button", { name: /Ambiente|Produção/ });
    expect(gatilho).toHaveAttribute("aria-haspopup", "listbox");

    await user.click(gatilho);
    const listbox = await screen.findByRole("listbox");

    const opcoesRenderizadas = within(listbox).getAllByRole("option");
    expect(opcoesRenderizadas).toHaveLength(3);
    // Exatamente UMA selecionada — duas quebrariam o anúncio do leitor de tela.
    expect(opcoesRenderizadas.filter((o) => o.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(listbox).toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    // Escolher devolve o foco ao gatilho — senão o Tab seguinte recomeça do topo.
    await waitFor(() => expect(gatilho).toHaveFocus());
    expect(gatilho).toHaveTextContent("Homologação");
  });
});

/* ==========================================================================
   Tabs
   ========================================================================== */

describe("Tabs — contrato de acessibilidade", () => {
  const abas = [
    { id: "postura", rotulo: "Postura atual", conteudo: <p>conteúdo postura</p> },
    { id: "evolucao", rotulo: "Evolução", conteudo: <p>conteúdo evolução</p> },
    { id: "insights", rotulo: "Insights", conteudo: <p>conteúdo insights</p> },
  ];

  it("A11Y-14 — roving tabindex e ativação MANUAL pela seta", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Tabs abas={abas} />
      </MemoryRouter>,
    );

    const tabs = screen.getAllByRole("tab");
    // Só a aba ativa é focável por Tab — é o que faz o Tab pular a barra
    // inteira e cair no conteúdo.
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    tabs[0].focus();
    await user.keyboard("{ArrowRight}");

    // ATIVAÇÃO MANUAL: a seta move o FOCO, mas não troca a aba. Cada aba do
    // dashboard dispara requisições de métricas — atravessar quatro abas com a
    // seta dispararia quatro cargas que ninguém pediu.
    expect(tabs[1]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("conteúdo postura")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(tabs[1]).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByText("conteúdo evolução")).toBeInTheDocument();

    // O painel aponta de volta para a aba que o nomeia.
    const painel = screen.getByRole("tabpanel");
    expect(painel.getAttribute("aria-labelledby")).toBe(tabs[1].id);
  });
});
