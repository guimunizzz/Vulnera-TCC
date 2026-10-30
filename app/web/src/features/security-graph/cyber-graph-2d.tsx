/**
 * cyber-graph-2d.tsx
 *
 * O QUE FAZ
 * Desenha a visão 2D do CyberGraph em SVG: nós circulares com ícone, rótulo e
 * subtítulo, arestas curvas em degradê da origem ao destino, grupo de findings
 * com contagem, destaque do caminho selecionado, nós arrastáveis, arrastar o
 * fundo para mover e zoom
 * pela roda (só com o grafo em foco, para não prender a rolagem da página).
 *
 * POR QUE EXISTE
 * É a visão de trabalho do grafo: lê bem em qualquer tamanho, não depende de
 * WebGL e cada nó é um botão focável.
 *
 * QUEM USA
 * `cyber-graph.tsx`.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Bug, Earth, Globe, ScanSearch, Server, type LucideIcon } from "lucide-react";
import { DAST_RISK_LABELS } from "../../types/dast.types";
import type { Kind2D, No2D, Visao2D } from "./graph-2d-layout";
import { contextoDoNo, chaveDaAresta } from "./graph-model";

export interface CyberGraph2DHandle {
  recentralizar(): void;
}

interface Props {
  visao: Visao2D;
  selecionadoId: string | null;
  aoClicar(no: No2D): void;
  aoAbrir(no: No2D): void;
  aoLimpar(): void;
  /** Nó arrastado para (x, y), nas coordenadas do grafo. */
  aoMover(id: string, x: number, y: number): void;
}

const ICONE: Record<Kind2D, LucideIcon> = { INTERNET: Earth, ASSET: Server, ENDPOINT: Globe, GROUP: ScanSearch, FINDING: Bug };
const RAIO: Record<Kind2D, number> = { INTERNET: 40, ASSET: 28, ENDPOINT: 25, GROUP: 25, FINDING: 21 };
const ROTULO_TIPO: Record<Kind2D, string> = {
  INTERNET: "Exposição",
  ASSET: "Alvo",
  ENDPOINT: "Endpoint",
  GROUP: "Grupo de findings",
  FINDING: "Finding",
};

/** Variável de cor do token: tipo para a estrutura, severidade para o que é achado. */
function tokenDoNo(no: Pick<No2D, "kind" | "risk">): string {
  if (no.kind === "INTERNET") return "--color-chart-2";
  if (no.kind === "ASSET") return "--color-accent";
  if (no.kind === "ENDPOINT") return "--color-chart-3";
  return `--color-severity-${(no.risk ?? "INFO").toLowerCase()}`;
}
const cor = (token: string, alfa = 1) => `oklch(var(${token}) / ${alfa})`;
const encurtar = (texto: string, max: number) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

function subtitulo(no: No2D): string {
  switch (no.kind) {
    case "INTERNET":
      return "origem do scan externo";
    case "ASSET":
      return "Alvo do scan · exposto";
    case "ENDPOINT":
      return `Endpoint · ${no.total ?? 0} finding${no.total === 1 ? "" : "s"}`;
    case "GROUP":
      return no.expandido ? "Clique para recolher" : "Clique para expandir";
    case "FINDING":
      return `Risco ${DAST_RISK_LABELS[no.risk ?? "INFO"].toLowerCase()}`;
  }
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;

export const CyberGraph2D = forwardRef<CyberGraph2DHandle, Props>(function CyberGraph2D(
  { visao, selecionadoId, aoClicar, aoAbrir, aoLimpar, aoMover },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 });
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 });
  const mexeu = useRef(false);
  // Arrasto do fundo (move a vista) ou de um nó (`no` preenchido: move só o nó).
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean; no?: string } | null>(null);
  const foiArrasto = useRef(false);

  const enquadrar = useCallback(() => {
    const { w, h } = tamanho;
    if (!w || !h || !visao.largura) return;
    // Abaixo de ~0,6 o texto deixa de ser legível: melhor transbordar (inclusive no celular) e deixar arrastar.
    const k = Math.max(Math.min((w - 32) / visao.largura, (h - 32) / visao.altura, 1.1), 0.6);
    const largura = visao.largura * k;
    // Centraliza mesmo transbordando: Internet e alvo ficam no meio da altura do grafo.
    setVista({ k, x: largura <= w ? (w - largura) / 2 : 12, y: (h - visao.altura * k) / 2 });
  }, [tamanho, visao.largura, visao.altura]);

  // Reenquadra no resize e quando um grupo abre ou fecha, a menos que a pessoa já tenha mexido.
  useEffect(() => {
    if (!mexeu.current) enquadrar();
  }, [enquadrar]);

  useImperativeHandle(ref, () => ({
    recentralizar() {
      mexeu.current = false;
      enquadrar();
    },
  }), [enquadrar]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entrada]) => {
      setTamanho({ w: entrada.contentRect.width, h: entrada.contentRect.height });
    });
    observer.observe(svg);
    // Roda só aproxima com o grafo em foco; sem foco, a página rola normalmente.
    const aoRolar = (e: WheelEvent) => {
      if (!svg.contains(document.activeElement)) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mexeu.current = true;
      setVista((v) => {
        const k = Math.min(Math.max(v.k * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN), ZOOM_MAX);
        return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
      });
    };
    svg.addEventListener("wheel", aoRolar, { passive: false });
    return () => {
      observer.disconnect();
      svg.removeEventListener("wheel", aoRolar);
    };
  }, []);

  const contexto = useMemo(
    () => (selecionadoId && visao.nodes.some((n) => n.id === selecionadoId) ? contextoDoNo(visao, selecionadoId) : null),
    [visao, selecionadoId],
  );
  const porId = useMemo(() => new Map(visao.nodes.map((n) => [n.id, n])), [visao]);

  const aoTeclar = (no: No2D) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.shiftKey) aoAbrir(no);
      else aoClicar(no);
    } else if (e.key === "Escape") {
      aoLimpar();
    }
  };

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      role="group"
      aria-roledescription="grafo"
      aria-label={`CyberGraph 2D: ${visao.nodes.length} nós, da Internet até os findings. Tab percorre os nós, Enter seleciona, Shift+Enter abre os detalhes, Esc limpa.`}
      className="block h-[34rem] w-full cursor-grab touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        foiArrasto.current = false;
        arrasto.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, moveu: false };
      }}
      onPointerMove={(e) => {
        const a = arrasto.current;
        if (!a) return;
        const dx = e.clientX - a.x;
        const dy = e.clientY - a.y;
        // Só captura o ponteiro depois de mover: capturar no pointerdown mudaria o alvo do clique.
        if (!a.moveu && Math.hypot(dx, dy) > 4) {
          a.moveu = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (!a.moveu) return;
        if (a.no) {
          aoMover(a.no, a.vx + dx / vista.k, a.vy + dy / vista.k);
          return;
        }
        mexeu.current = true;
        setVista((v) => ({ ...v, x: a.vx + dx, y: a.vy + dy }));
      }}
      onPointerUp={() => {
        foiArrasto.current = arrasto.current?.moveu ?? false;
        arrasto.current = null;
      }}
      onPointerCancel={() => {
        arrasto.current = null;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !foiArrasto.current) aoLimpar();
      }}
    >
      <defs>
        <filter id="cg-sombra" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="black" floodOpacity="0.25" />
        </filter>
        {visao.edges.map((edge, i) => {
          const de = porId.get(edge.source);
          const para = porId.get(edge.target);
          if (!de || !para) return null;
          return (
            <linearGradient key={chaveDaAresta(edge)} id={`cg-g-${i}`} gradientUnits="userSpaceOnUse" x1={de.x} y1={de.y} x2={para.x} y2={para.y}>
              <stop offset="0%" stopColor={cor(tokenDoNo(de))} />
              <stop offset="100%" stopColor={cor(tokenDoNo(para))} />
            </linearGradient>
          );
        })}
      </defs>

      <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
        {visao.edges.map((edge, i) => {
          const de = porId.get(edge.source);
          const para = porId.get(edge.target);
          if (!de || !para) return null;
          const x1 = de.x + RAIO[de.kind];
          const x2 = para.x - RAIO[para.kind];
          const meio = (x1 + x2) / 2;
          const d = `M ${x1} ${de.y} C ${meio} ${de.y}, ${meio} ${para.y}, ${x2} ${para.y}`;
          const noCaminho = contexto?.arestas.has(chaveDaAresta(edge)) ?? false;
          return (
            <g key={chaveDaAresta(edge)} className="cg-entrar">
              <path
                d={d}
                fill="none"
                stroke={`url(#cg-g-${i})`}
                strokeWidth={noCaminho ? 3 : 2}
                strokeOpacity={contexto ? (noCaminho ? 1 : 0.14) : 0.75}
                strokeLinecap="round"
              />
              {noCaminho && <path d={d} fill="none" stroke={cor("--color-text-primary", 0.55)} strokeWidth={1.4} className="cg-fluxo" />}
            </g>
          );
        })}

        {visao.nodes.map((no) => {
          const raio = RAIO[no.kind];
          const token = tokenDoNo(no);
          const Icone = ICONE[no.kind];
          const tamIcone = no.kind === "INTERNET" ? 34 : 20;
          const selecionado = no.id === selecionadoId;
          const apagado = contexto ? !contexto.nos.has(no.id) : false;
          const internet = no.kind === "INTERNET";
          return (
            <g
              key={no.id}
              transform={`translate(${no.x} ${no.y})`}
              role="button"
              tabIndex={0}
              aria-pressed={selecionado}
              aria-expanded={no.kind === "GROUP" ? no.expandido : undefined}
              aria-label={`${ROTULO_TIPO[no.kind]}: ${no.label}${no.risk ? `, risco ${DAST_RISK_LABELS[no.risk].toLowerCase()}` : ""}${no.total ? `, ${no.total} findings` : ""}`}
              className="cg-no cg-entrar cursor-grab outline-none active:cursor-grabbing"
              opacity={apagado ? 0.28 : 1}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                // Sem propagar: o fundo não começa a mover a vista junto com o nó.
                e.stopPropagation();
                foiArrasto.current = false;
                arrasto.current = { x: e.clientX, y: e.clientY, vx: no.x, vy: no.y, moveu: false, no: no.id };
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!foiArrasto.current) aoClicar(no);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                aoAbrir(no);
              }}
              onKeyDown={aoTeclar(no)}
            >
              <title>{no.label}</title>
              {selecionado && <circle r={raio + 9} fill={cor(token, 0.16)} stroke={cor(token, 0.7)} strokeWidth={1.5} />}
              <circle className="cg-foco" r={raio + 5} fill="none" stroke={cor("--color-focus-ring")} strokeWidth={2} opacity={0} />
              {no.kind === "GROUP" && <circle r={raio + 4} fill="none" stroke={cor(token, 0.55)} strokeWidth={1.5} />}
              <circle r={raio} fill={cor("--color-bg-surface")} stroke={cor(token)} strokeWidth={2} filter="url(#cg-sombra)" />
              <circle r={raio - 5} fill={cor(token, internet ? 0.22 : 0.14)} />
              <Icone
                x={-tamIcone / 2}
                y={-tamIcone / 2}
                width={tamIcone}
                height={tamIcone}
                color={cor(token)}
                strokeWidth={internet ? 1.4 : 1.8}
                aria-hidden="true"
              />
              {no.kind === "GROUP" && (
                <g transform={`translate(${raio * 0.75} ${-raio * 0.75})`}>
                  <circle r={10} fill={cor(`${token}-surface`)} stroke={cor(token)} strokeWidth={1.5} />
                  <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight={700} fill={cor(`${token}-ink`)}>
                    {no.total}
                  </text>
                </g>
              )}
              <text
                y={raio + (internet ? 22 : 17)}
                textAnchor="middle"
                fontSize={internet ? 17 : 13}
                fontWeight={internet ? 700 : 600}
                fill={cor("--color-text-primary")}
              >
                {encurtar(no.label, internet ? 20 : 26)}
              </text>
              <text y={raio + (internet ? 38 : 32)} textAnchor="middle" fontSize={11} fill={cor("--color-text-muted")}>
                {subtitulo(no)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
});
