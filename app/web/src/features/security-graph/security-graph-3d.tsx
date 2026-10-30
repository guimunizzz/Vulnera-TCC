/**
 * security-graph-3d.tsx
 *
 * O QUE FAZ
 * Casca React da cena 3D do grafo: canvas, tooltip de hover, legenda,
 * legenda de seleção (aria-live) e navegação por teclado. Toda a parte Three.js
 * vive em `scene/graph-scene.ts`; aqui só há estado de UI.
 *
 * POR QUE EXISTE
 * Modo de apresentação do caminho de exposição. A lista "Achados" continua
 * sendo a visão de trabalho e a alternativa acessível ao canvas.
 *
 * QUEM USA
 * `dast-scan-detail-page.tsx`, exclusivamente via React.lazy() — `three` e os
 * addons de pós-processamento não podem entrar no bundle inicial.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { useTheme } from "../../design/theme-provider";
import { useMotion } from "../../motion/use-motion";
import type { DastFinding } from "../../types/dast.types";
import { buildSecurityGraph, type GraphNode, type GraphNodeKind } from "./graph-model";
import { GraphScene } from "./scene/graph-scene";
import { GRAPH_PALETTE } from "./scene/palette";

const KIND_LABEL: Record<GraphNodeKind, string> = {
  INTERNET: "Exposição",
  ASSET: "Alvo",
  ENDPOINT: "Endpoint",
  FINDING: "Finding",
};

const LEGENDA_SEVERIDADE = [
  ["bg-severity-high", "Alto"],
  ["bg-severity-medium", "Médio"],
  ["bg-severity-low", "Baixo"],
  ["bg-severity-info", "Info"],
] as const;

export default function SecurityGraph3D({ targetUrl, findings }: { targetUrl: string; findings: DastFinding[] }) {
  const palcoRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<GraphScene | null>(null);
  const { resolvido } = useTheme();
  const { reduzido } = useMotion();
  const grafo = useMemo(() => buildSecurityGraph(targetUrl, findings), [targetUrl, findings]);
  const [selecionado, setSelecionado] = useState<GraphNode | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const palco = palcoRef.current;
    const tooltip = tooltipRef.current;
    if (!palco || !tooltip) return;
    // Um canvas por cena: o dispose força a perda do contexto WebGL, então ele não pode
    // ser reaproveitado pela cena seguinte (troca de tema, StrictMode, findings novos).
    const canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", "grafo 3D");
    canvas.setAttribute(
      "aria-label",
      `Grafo 3D do scan: ${grafo.nodes.length} nós, de Internet até os findings. Setas percorrem os nós, Esc limpa a seleção. A mesma informação está na aba Achados.`,
    );
    canvas.className =
      "block h-[32rem] w-full cursor-grab touch-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:cursor-grabbing";
    palco.prepend(canvas);

    let atual = -1;
    let cena: GraphScene;
    try {
      cena = new GraphScene(canvas, tooltip, grafo, {
        paleta: GRAPH_PALETTE[resolvido],
        reduzido,
        aoSelecionar: (node) => {
          atual = node ? grafo.nodes.indexOf(node) : -1;
          setSelecionado(node);
        },
        aoPerderContexto: () => setFalhou(true),
      });
    } catch {
      canvas.remove();
      setFalhou(true);
      return;
    }

    // Setas percorrem os nós na ordem do grafo; Esc limpa a seleção.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cena.selecionar(null);
        return;
      }
      const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      const total = grafo.nodes.length;
      const proximo = atual === -1 ? (passo > 0 ? 0 : total - 1) : (atual + passo + total) % total;
      cena.selecionar(grafo.nodes[proximo].id);
    };
    canvas.addEventListener("keydown", aoTeclar);
    cenaRef.current = cena;
    setSelecionado(null);
    return () => {
      canvas.removeEventListener("keydown", aoTeclar);
      cenaRef.current = null;
      cena.dispose();
      canvas.remove();
    };
  }, [grafo, resolvido, reduzido]);

  if (falhou) {
    return <p className="mt-4 text-sm text-fg-muted">Este navegador não conseguiu iniciar o WebGL. Use a aba Achados.</p>;
  }

  return (
    <div className="mt-4">
      <div ref={palcoRef} className="relative min-h-[32rem] overflow-hidden rounded-container border border-subtle">
        <div
          ref={tooltipRef}
          hidden
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 max-w-64 truncate rounded-control border border-subtle bg-surface/90 px-2 py-1 text-xs text-fg shadow-lg backdrop-blur"
        />
        {/* Legenda na base: no topo ela disputaria espaço com o botão em telas estreitas. */}
        <div className="pointer-events-none absolute bottom-3 left-3 mr-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/80 px-3 py-2 text-xs text-fg-muted backdrop-blur">
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
        {/* Wrapper posicionado: a classe `press` do Button redefine `position`. */}
        <div className="absolute right-3 top-3">
          <Button variant="secundario" size="sm" onClick={() => cenaRef.current?.recentralizar()}>
            Recentralizar
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-fg-muted" aria-live="polite">
        {selecionado
          ? `${KIND_LABEL[selecionado.kind]}${selecionado.risk ? ` · ${selecionado.risk}` : ""}: ${selecionado.label}`
          : "Arraste para girar; com a cena em foco, role para aproximar. Clique num objeto para destacar o caminho dele até a Internet."}
        {grafo.truncated && " Grafo truncado nos findings de maior risco."}
      </p>
    </div>
  );
}
