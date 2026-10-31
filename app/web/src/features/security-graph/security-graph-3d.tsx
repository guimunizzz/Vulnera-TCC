/**
 * security-graph-3d.tsx
 *
 * O QUE FAZ
 * Modo 3D do CyberGraph: canvas, camada de nomes, legenda e navegação por
 * teclado. Toda a parte Three.js vive em `scene/graph-scene.ts`; a seleção,
 * o painel e os botões ficam em `cyber-graph.tsx`.
 *
 * POR QUE EXISTE
 * Modo de apresentação do caminho de exposição. A lista "Achados" continua
 * sendo a visão de trabalho e a alternativa acessível ao canvas.
 *
 * QUEM USA
 * `cyber-graph.tsx`, exclusivamente via React.lazy() — `three` e os addons de
 * pós-processamento só baixam quando a pessoa escolhe o 3D.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTheme } from "../../design/theme-provider";
import { useMotion } from "../../motion/use-motion";
import type { SecurityGraph } from "./graph-model";
import { GraphScene, type Posicao3D } from "./scene/graph-scene";
import { GRAPH_PALETTE } from "./scene/palette";

export interface SecurityGraph3DHandle {
  recentralizar(): void;
  restaurarLayout(): void;
  /** < 1 aproxima, > 1 afasta. */
  aproximar(fator: number): void;
  ajustarVista(): void;
  capturar(): Promise<Blob | null>;
}

interface Props {
  grafo: SecurityGraph;
  selecionadoId: string | null;
  posicoes: ReadonlyMap<string, Posicao3D>;
  aoSelecionar(id: string | null): void;
  aoAbrir(id: string): void;
  aoMoverNo(id: string, posicao: Posicao3D): void;
}

const LEGENDA_SEVERIDADE = [
  ["bg-severity-high", "Alto"],
  ["bg-severity-medium", "Médio"],
  ["bg-severity-low", "Baixo"],
  ["bg-severity-info", "Info"],
] as const;

const SecurityGraph3D = forwardRef<SecurityGraph3DHandle, Props>(function SecurityGraph3D(
  { grafo, selecionadoId, posicoes, aoSelecionar, aoAbrir, aoMoverNo },
  ref,
) {
  const palcoRef = useRef<HTMLDivElement>(null);
  const rotulosRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<GraphScene | null>(null);
  const { resolvido } = useTheme();
  const { reduzido } = useMotion();
  const [falhou, setFalhou] = useState(false);
  const [ocultos, setOcultos] = useState(0);
  const [qualidadeReduzida, setQualidadeReduzida] = useState(false);
  // Espelhos para a cena não ser recriada a cada render do pai.
  const props = useRef({ selecionadoId, posicoes, aoSelecionar, aoAbrir, aoMoverNo });
  props.current = { selecionadoId, posicoes, aoSelecionar, aoAbrir, aoMoverNo };
  const daCena = useRef<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      recentralizar: () => cenaRef.current?.recentralizar(),
      restaurarLayout: () => cenaRef.current?.restaurarLayout(),
      aproximar: (fator) => cenaRef.current?.aproximar(fator),
      ajustarVista: () => cenaRef.current?.ajustarVista(),
      capturar: () => cenaRef.current?.capturar() ?? Promise.resolve(null),
    }),
    [],
  );

  useEffect(() => {
    const palco = palcoRef.current;
    const rotulos = rotulosRef.current;
    if (!palco || !rotulos) return;
    // Um canvas por cena: o dispose força a perda do contexto WebGL, então ele não pode
    // ser reaproveitado pela cena seguinte (troca de tema, StrictMode, findings novos).
    const canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", "grafo 3D");
    canvas.setAttribute(
      "aria-label",
      `CyberGraph 3D: ${grafo.nodes.length} nós, de Internet até os findings. Setas percorrem os nós, Enter abre os detalhes, Esc limpa a seleção. A mesma informação está no modo 2D e na aba Achados.`,
    );
    canvas.className =
      "block h-[34rem] w-full cursor-grab touch-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:cursor-grabbing";
    palco.prepend(canvas);

    let cena: GraphScene;
    try {
      cena = new GraphScene(canvas, rotulos, grafo, {
        paleta: GRAPH_PALETTE[resolvido],
        reduzido,
        posicoesSalvas: props.current.posicoes,
        aoMoverNo: (id, posicao) => props.current.aoMoverNo(id, posicao),
        aoContarOcultos: setOcultos,
        aoMudarQualidade: () => setQualidadeReduzida(true),
        aoSelecionar: (node) => {
          daCena.current = node?.id ?? null;
          props.current.aoSelecionar(daCena.current);
        },
        aoPerderContexto: () => setFalhou(true),
      });
    } catch {
      canvas.remove();
      setFalhou(true);
      return;
    }

    // Setas percorrem os nós na ordem do grafo; Enter abre o modal; Esc limpa a seleção.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cena.selecionar(null);
        return;
      }
      if (e.key === "Enter" && daCena.current) {
        props.current.aoAbrir(daCena.current);
        return;
      }
      const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      const total = grafo.nodes.length;
      const atual = grafo.nodes.findIndex((n) => n.id === daCena.current);
      const proximo = atual === -1 ? (passo > 0 ? 0 : total - 1) : (atual + passo + total) % total;
      cena.selecionar(grafo.nodes[proximo].id);
    };
    // O clique já selecionou; o segundo clique abre os detalhes do que ficou selecionado.
    const aoDuploClique = () => {
      if (daCena.current) props.current.aoAbrir(daCena.current);
    };
    canvas.addEventListener("keydown", aoTeclar);
    canvas.addEventListener("dblclick", aoDuploClique);
    cenaRef.current = cena;
    daCena.current = null;
    // Mantém a seleção ao trocar de 2D para 3D (ou de tema).
    if (props.current.selecionadoId) cena.selecionar(props.current.selecionadoId);
    return () => {
      canvas.removeEventListener("keydown", aoTeclar);
      canvas.removeEventListener("dblclick", aoDuploClique);
      cenaRef.current = null;
      cena.dispose();
      canvas.remove();
    };
  }, [grafo, resolvido, reduzido]);

  // Seleção vinda de fora (painel, caminho de exposição) entra na cena.
  useEffect(() => {
    if (cenaRef.current && selecionadoId !== daCena.current) cenaRef.current.selecionar(selecionadoId);
  }, [selecionadoId]);

  if (falhou) {
    return <p className="p-4 text-sm text-fg-muted">Este navegador não conseguiu iniciar o WebGL. Use o modo 2D.</p>;
  }

  return (
    <div ref={palcoRef} className="relative min-h-[34rem] overflow-hidden">
      {/* Nomes abaixo dos objetos (CSS2DRenderer); o canvas já descreve o grafo para leitor de tela. */}
      <div ref={rotulosRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0" />
      {(ocultos > 0 || qualidadeReduzida) && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-xs" aria-live="polite">
          {ocultos > 0 && (
            <span className="rounded-control bg-surface/85 px-2 py-1 text-fg-muted backdrop-blur">
              {ocultos} {ocultos === 1 ? "nome oculto" : "nomes ocultos"} para não encavalar · passe o mouse ou gire a cena
            </span>
          )}
          {qualidadeReduzida && (
            <span className="rounded-control bg-surface/85 px-2 py-1 text-fg-muted backdrop-blur">
              Efeitos reduzidos para manter a fluidez neste dispositivo
            </span>
          )}
        </div>
      )}
      {/* Legenda na base; a margem direita deixa espaço para os botões de zoom. */}
      <div className="pointer-events-none absolute bottom-3 left-3 mr-16 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/80 px-3 py-2 text-xs text-fg-muted backdrop-blur">
        <span>Globo: Internet</span>
        <span>Rack: alvo</span>
        <span>Hexágono: endpoint</span>
        <span className="flex items-center gap-2">
          Cristal:
          {LEGENDA_SEVERIDADE.map(([classe, rotulo]) => (
            <span key={rotulo} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rotate-45 ${classe}`} />
              {rotulo}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
});

export default SecurityGraph3D;
