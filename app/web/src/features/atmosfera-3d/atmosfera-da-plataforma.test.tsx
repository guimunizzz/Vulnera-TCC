/**
 * atmosfera-da-plataforma.test.tsx — camadas e troca entre atmosferas.
 * As cenas (three) e o pôster (canvas 2D) são dublês: aqui importa QUAL
 * camada existe, em que estilo, e quando ela aparece/sai.
 *
 *   APL-01  Dashboard monta a nebulosa animada, visível depois do 1º quadro
 *   APL-02  troca de seção: a nova entra, a anterior apaga e sai do DOM depois do fade
 *   APL-03  formulário (SLA) mostra o ASCII parado, mesmo com a cena liberada
 *   APL-04  pôster no lugar da cena (movimento reduzido etc.) e com "Pausar animações"
 *   APL-05  alto contraste: nenhuma camada
 *   APL-06  cena que falha vira pôster na mesma camada
 *   APL-07  teto da camada: 3D usa TETO_DA_CAMADA; ASCII animado traz o próprio
 *   APL-08  uma tela suprime a atmosfera (aba do mapa 3D) e ela volta ao liberar
 *   APL-09  um ping pedido pela tela muda a chave de ping da cena 3D
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ modo: "animada" as "animada" | "poster" | "nenhuma", falhar3d: false }));

vi.mock("../../three/gate", () => ({ useModoDeCena: () => estado.modo }));

vi.mock("./cena-3d-canvas", () => ({
  default: function Cena3dDuble({ linguagem, modo, chaveDePing, aoPronta, aoFalhar }: { linguagem: string; modo: string; chaveDePing: string; aoPronta: () => void; aoFalhar: () => void }) {
    useEffect(() => (estado.falhar3d ? aoFalhar() : aoPronta()), [aoPronta, aoFalhar]);
    return <div data-testid={`cena-${linguagem}`} data-modo={modo} data-ping={chaveDePing} />;
  },
}));

vi.mock("../../components/dashboard/hero/dashboard-ambient-canvas", () => ({
  default: function AsciiDuble({ aoPronta }: { aoPronta: () => void }) {
    useEffect(() => aoPronta(), [aoPronta]);
    return <div data-testid="cena-ascii" />;
  },
}));

vi.mock("./poster-da-atmosfera", () => ({
  default: function PosterDuble({ linguagem, aoPronta }: { linguagem: string; aoPronta: () => void }) {
    useEffect(() => aoPronta(), [aoPronta]);
    return <div data-testid={`poster-${linguagem}`} />;
  },
}));

import { AtmosferaDaPlataforma } from "./atmosfera-da-plataforma";
import { pingarAtmosfera, useAtmosferaStore } from "./atmosfera.store";
import { TETO_DA_CAMADA } from "./config";

let irPara: (rota: string) => void = () => undefined;
function Navegador() {
  const navigate = useNavigate();
  irPara = navigate;
  return null;
}

function montar(rota: string, pausado = false) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Navegador />
      <AtmosferaDaPlataforma pausado={pausado} />
    </MemoryRouter>,
  );
}

const camadas = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>(".atmosfera-camada"));

beforeEach(() => {
  useAtmosferaStore.setState({ risco: null, donoDoRisco: null, supressao: null, sinal: 0 });
  estado.modo = "animada";
  estado.falhar3d = false;
  document.documentElement.setAttribute("data-theme", "dark");
});

describe("AtmosferaDaPlataforma", () => {
  it("APL-01 — Dashboard monta a nebulosa animada e mostra depois do 1º quadro", async () => {
    const { container } = montar("/dashboard");
    expect(await screen.findByTestId("cena-nebulosa")).toHaveAttribute("data-modo", "plataforma");
    await waitFor(() => expect(camadas(container)[0]).toHaveAttribute("data-visivel", "true"));
    expect(camadas(container)[0]).toHaveAttribute("data-linguagem", "nebulosa");
  });

  it("APL-02 — troca de seção faz crossfade e a anterior sai do DOM", async () => {
    const { container } = montar("/dashboard");
    await screen.findByTestId("cena-nebulosa");
    act(() => irPara("/findings"));
    await screen.findByTestId("cena-ascii");
    await waitFor(() => {
      const [anterior, nova] = camadas(container);
      expect(nova).toHaveAttribute("data-visivel", "true");
      expect(anterior).toHaveAttribute("data-visivel", "false");
    });
    // Depois do fade (0,8 s) só a nova continua montada.
    await waitFor(() => expect(camadas(container)).toHaveLength(1), { timeout: 2000 });
    expect(screen.queryByTestId("cena-nebulosa")).toBeNull();

    // Mesma linguagem: nenhuma camada nova.
    act(() => irPara("/dast"));
    expect(camadas(container)).toHaveLength(1);
  });

  it("APL-03 — formulário mostra o ASCII parado", async () => {
    const { container } = montar("/settings/sla");
    expect(await screen.findByTestId("poster-ascii")).toBeInTheDocument();
    expect(screen.queryByTestId("cena-ascii")).toBeNull();
    expect(camadas(container)[0]).toHaveAttribute("data-estilo", "poster");
  });

  it("APL-04 — pôster no lugar da cena, e com Pausar animações", async () => {
    estado.modo = "poster";
    const primeiro = montar("/projects");
    expect(await screen.findByTestId("poster-relevo")).toBeInTheDocument();
    expect(camadas(primeiro.container)[0]).toHaveAttribute("data-estilo", "poster");
    primeiro.unmount();

    estado.modo = "animada";
    montar("/findings", true);
    expect(await screen.findByTestId("poster-ascii")).toBeInTheDocument();
    expect(screen.queryByTestId("cena-ascii")).toBeNull();
  });

  it("APL-05 — alto contraste não monta nada", () => {
    estado.modo = "nenhuma";
    const { container } = montar("/dashboard");
    expect(camadas(container)).toHaveLength(0);
  });

  it("APL-06 — cena que falha vira pôster", async () => {
    estado.falhar3d = true;
    const { container } = montar("/remediation");
    expect(await screen.findByTestId("poster-relevo")).toBeInTheDocument();
    await waitFor(() => expect(camadas(container)[0]).toHaveAttribute("data-visivel", "true"));
  });

  it("APL-07 — teto da camada", async () => {
    const { container } = montar("/dashboard");
    await screen.findByTestId("cena-nebulosa");
    expect(camadas(container)[0].style.getPropertyValue("--atmosfera-teto")).toBe(String(TETO_DA_CAMADA.plataforma.dark));
    act(() => irPara("/findings"));
    await screen.findByTestId("cena-ascii");
    expect(camadas(container).at(-1)!.style.getPropertyValue("--atmosfera-teto")).toBe("1");
  });

  it("APL-08 — supressão tira a atmosfera e a liberação devolve", async () => {
    const { container } = montar("/exposure-graph");
    await screen.findByTestId("cena-relevo");
    act(() => useAtmosferaStore.getState().suprimir("aba-mapa"));
    await waitFor(() => expect(camadas(container)).toHaveLength(0), { timeout: 2000 });
    act(() => useAtmosferaStore.getState().liberar("aba-mapa"));
    expect(await screen.findByTestId("cena-relevo")).toBeInTheDocument();
  });

  it("APL-09 — ping pedido pela tela chega à cena", async () => {
    montar("/exposure-graph");
    const cena = await screen.findByTestId("cena-relevo");
    const antes = cena.getAttribute("data-ping");
    act(() => pingarAtmosfera());
    await waitFor(() => expect(screen.getByTestId("cena-relevo").getAttribute("data-ping")).not.toBe(antes));
  });
});
