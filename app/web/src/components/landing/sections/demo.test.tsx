import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Demo from "./demo";

function setup() {
  render(<Demo />);
  return {
    user: userEvent.setup(),
    nav: within(screen.getByRole("navigation", { name: "Navegação do preview" })),
    views: within(screen.getByRole("group", { name: "Visualizações do dashboard" })),
  };
}

describe("Preview interativo da landing", () => {
  it("filtra por severidade e limpa o filtro", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Filtrar severidade CRÍTICA" }));
    expect(screen.getByRole("button", { name: /SQL Injection/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /JWT sem expiração/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(screen.getByRole("button", { name: /JWT sem expiração/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3 Críticos" }));
    expect(screen.getByRole("button", { name: "Filtrar severidade CRÍTICA" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "28 Findings abertos" }));
    expect(screen.queryByRole("button", { name: "Limpar filtro" })).not.toBeInTheDocument();
  });

  it("abre detalhes por teclado, simula correção e atualiza os indicadores", async () => {
    const { user } = setup();
    screen.getByRole("button", { name: /SQL Injection/ }).focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: "Simular correção" }));
    expect(screen.getByRole("status")).toHaveTextContent("Correção simulada");
    expect(screen.getByRole("button", { name: "Reabrir finding" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Voltar ao dashboard" }));
    expect(await screen.findByRole("button", { name: "27 Findings abertos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 Críticos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CORRIGIDA SQL Injection/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /CORRIGIDA SQL Injection/ }));
    await user.click(await screen.findByRole("button", { name: "Reabrir finding" }));
    await user.click(screen.getByRole("button", { name: "Voltar ao dashboard" }));
    expect(await screen.findByRole("button", { name: "28 Findings abertos" })).toBeInTheDocument();
  });

  it("troca as quatro visualizações e abre aplicações pelo comparativo", async () => {
    const { user, views, nav } = setup();
    await user.click(views.getByRole("button", { name: "Evolução" }));
    expect(await screen.findByRole("heading", { name: "Menos exposição, a cada ciclo." })).toBeInTheDocument();
    await user.click(views.getByRole("button", { name: "Insights" }));
    expect(await screen.findByRole("heading", { name: "Onde agir primeiro" })).toBeInTheDocument();
    await user.click(views.getByRole("button", { name: "Comparativo" }));
    await user.click(await screen.findByRole("button", { name: /Painel administrativo 9 findings/ }));
    expect(await screen.findByText("Equipe de operações")).toBeInTheDocument();
    expect(nav.getByRole("button", { name: "Aplicações" })).toHaveAttribute("aria-current", "page");
    await user.click(views.getByRole("button", { name: "Postura atual" }));
    expect(await screen.findByRole("button", { name: /SQL Injection/ })).toBeInTheDocument();
  });

  it("explora aplicações, projetos e domínios de maturidade", async () => {
    const { user, nav } = setup();
    await user.click(screen.getByRole("button", { name: "12 Aplicações" }));
    await user.click(await screen.findByRole("button", { name: /Portal do cliente Aplicação web/ }));
    expect(screen.getByText("Equipe de experiência")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Explorar finding" }));
    expect(await screen.findByRole("heading", { name: "Header X-Frame-Options ausente" })).toBeInTheDocument();
    await user.click(nav.getByRole("button", { name: "Projetos" }));
    await user.click(await screen.findByRole("button", { name: /Assessment do portal Concluído/ }));
    expect(screen.getByRole("progressbar", { name: "Progresso do projeto" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Relatório entregue")).toBeInTheDocument();
    await user.click(nav.getByRole("button", { name: "Maturidade" }));
    await user.click(await screen.findByRole("button", { name: /Desenvolvimento seguro/ }));
    expect(screen.getByRole("progressbar", { name: "Maturidade do domínio" })).toHaveAttribute("aria-valuenow", "68");
    expect(screen.getByText(/ampliar testes de segurança no pipeline/)).toBeInTheDocument();
  });

  it("mantém as preferências ao navegar e permite reiniciar a demonstração", async () => {
    const { user, nav } = setup();
    await user.click(screen.getByRole("button", { name: /SQL Injection/ }));
    await user.click(await screen.findByRole("button", { name: "Simular correção" }));
    await user.click(nav.getByRole("button", { name: "Configurações" }));
    const notificationSwitch = await screen.findByRole("switch", { name: /Notificações de segurança/ });
    await user.click(notificationSwitch);
    expect(notificationSwitch).not.toBeChecked();
    await user.click(screen.getByRole("switch", { name: /Visualização compacta/ }));
    expect(screen.getByRole("region", { name: "Preview interativo da plataforma" })).toHaveClass("vx-demo--compact");
    await user.click(nav.getByRole("button", { name: "Aplicações" }));
    await screen.findByText("Equipe de integrações");
    await user.click(nav.getByRole("button", { name: "Configurações" }));
    expect(await screen.findByRole("switch", { name: /Visualização compacta/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /Notificações de segurança/ })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(await screen.findByRole("button", { name: "28 Findings abertos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Preview interativo da plataforma" })).not.toHaveClass("vx-demo--compact");
    expect(screen.getByRole("status")).toHaveTextContent("Demonstração reiniciada.");
    await user.click(nav.getByRole("button", { name: "Configurações" }));
    expect(await screen.findByRole("switch", { name: /Notificações de segurança/ })).toBeChecked();
  });
});
