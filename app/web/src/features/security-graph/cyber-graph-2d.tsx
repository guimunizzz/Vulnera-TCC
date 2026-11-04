/**
 * cyber-graph-2d.tsx
 *
 * O QUE FAZ
 * Desenha a visão 2D do CyberGraph em SVG: nós circulares com ícone, rótulo e
 * subtítulo, arestas curvas em degradê da origem ao destino, grupo de findings
 * com contagem, destaque do caminho selecionado, nós arrastáveis, arrastar o
 * fundo para mover, zoom (roda com o grafo em foco, +/− e botões), legenda,
 * minimapa quando o grafo não cabe e navegação por setas com um só ponto de Tab.
 * Abrir ou fechar um grupo anima: os filhos saem do pai (ou voltam para ele) e
 * os outros nós deslizam para o lugar novo.
 *
 * POR QUE EXISTE
 * É a visão de trabalho do grafo: lê bem em qualquer tamanho, não depende de
 * WebGL e cada nó é um botão focável.
 *
 * QUEM USA
 * `cyber-graph.tsx`.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMotion } from "../../motion/use-motion";
import { DAST_RISK_LABELS, DAST_SENSOR_SHORT_LABELS, type DastRisk } from "../../types/dast.types";
import { svgParaPng } from "./exportar";
import {
  caixaDoConteudo,
  interpolarVisao,
  vizinhoNaDirecao,
  type Direcao,
  type Kind2D,
  type No2D,
  type Visao2D,
  type Visao2DExibida,
} from "./graph-2d-layout";
import { contextoDoNo, chaveDaAresta } from "./graph-model";
import { cor, ICONE_DO_TIPO, ROTULO_TIPO, tokenDoNo } from "./node-visual";

export interface CyberGraph2DHandle {
  recentralizar(): void;
  /** < 1 afasta, > 1 aproxima, em torno do centro da tela. */
  aproximar(fator: number): void;
  /** Centraliza a vista num nó (busca, navegação por teclado). */
  centralizarEm(id: string): void;
  exportarPng(): Promise<Blob | null>;
}

interface Props {
  visao: Visao2D;
  selecionadoId: string | null;
  aoClicar(no: No2D): void;
  aoAbrir(no: No2D): void;
  aoLimpar(): void;
  /** Nó arrastado para (x, y), nas coordenadas do grafo. */
  aoMover(id: string, x: number, y: number): void;
  /** Minimapa ligado pela pessoa: fixo sobre o grafo, ele sempre pode cobrir algum nó. */
  minimapa: boolean;
}

const RAIO: Record<Kind2D, number> = { INTERNET: 40, ASSET: 28, ENDPOINT: 25, GROUP: 25, FINDING: 21, IP: 27, PORT: 19, TECH: 19, SUBDOMAIN: 21 };
const encurtar = (texto: string, max: number) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);
const SETAS: readonly string[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const LEGENDA_TIPOS: Kind2D[] = ["INTERNET", "ASSET", "ENDPOINT", "GROUP", "IP", "PORT", "TECH", "SUBDOMAIN"];
const LEGENDA_NOME: Record<Kind2D, string> = {
  INTERNET: "Internet",
  ASSET: "Alvo",
  ENDPOINT: "Endpoint",
  GROUP: "Grupo",
  FINDING: "Finding",
  IP: "IP",
  PORT: "Porta",
  TECH: "Tecnologia",
  SUBDOMAIN: "Subdomínio",
};
const LEGENDA_RISCOS: DastRisk[] = ["HIGH", "MEDIUM", "LOW", "INFO"];
const MINIMAPA = { w: 168, h: 108 };

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
      return `Risco ${DAST_RISK_LABELS[no.risk ?? "INFO"].toLowerCase()} · ${DAST_SENSOR_SHORT_LABELS[no.sensorKey ?? "zap"] ?? no.sensorKey}`;
    case "IP":
      return no.asset?.metadata?.publico === false ? "IP privado · sem consulta" : `IP público · ${no.total ?? 0} CVE${no.total === 1 ? "" : "s"}`;
    case "PORT":
      return "Porta aberta · InternetDB";
    case "TECH":
      return `Tecnologia · ${String(no.asset?.metadata?.fonte ?? "observada")}`;
    case "SUBDOMAIN":
      if (no.expandivel) return `${no.total ?? 0} em certificados · ${no.expandido ? "recolher" : "expandir"}`;
      return no.asset ? "Subdomínio · crt.sh" : `${no.total ?? 0} em certificados`;
  }
}

const DURACAO_GRUPO_MS = 360;

/**
 * O que o SVG desenha: a própria visão, ou um quadro da transição quando o
 * conjunto de nós muda (grupo abriu/fechou, filtro). Arrastar e selecionar não
 * mudam o conjunto, então seguem o ponteiro sem atraso.
 */
function useVisaoAnimada(visao: Visao2D, reduzido: boolean): Visao2DExibida {
  const [quadro, setQuadro] = useState<Visao2DExibida | null>(null);
  const anterior = useRef(visao);
  const exibida: Visao2DExibida = quadro ?? visao;
  const ultimo = useRef(exibida);
  ultimo.current = exibida;

  // Layout effect: o primeiro quadro entra antes da pintura, sem piscar a visão final.
  useLayoutEffect(() => {
    const de = anterior.current;
    anterior.current = visao;
    const ids = new Set(de.nodes.map((n) => n.id));
    if (reduzido || (de.nodes.length === visao.nodes.length && visao.nodes.every((n) => ids.has(n.id)))) {
      setQuadro(null);
      return;
    }
    // Parte de onde os nós estão na tela agora (uma transição pode ter sido interrompida).
    const naTela = new Map(ultimo.current.nodes.filter((n) => !n.saindo).map((n) => [n.id, n]));
    const origem = { ...de, nodes: de.nodes.map((n) => ({ ...n, x: naTela.get(n.id)?.x ?? n.x, y: naTela.get(n.id)?.y ?? n.y })) };
    const inicio = performance.now();
    let raf = 0;
    const passo = (agora: number) => {
      const t = (agora - inicio) / DURACAO_GRUPO_MS;
      setQuadro(t < 1 ? interpolarVisao(origem, visao, t) : null);
      if (t < 1) raf = requestAnimationFrame(passo);
    };
    setQuadro(interpolarVisao(origem, visao, 0));
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [visao, reduzido]);

  return exibida;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const limitarZoom = (k: number) => Math.min(Math.max(k, ZOOM_MIN), ZOOM_MAX);

export const CyberGraph2D = forwardRef<CyberGraph2DHandle, Props>(function CyberGraph2D(
  { visao, selecionadoId, aoClicar, aoAbrir, aoLimpar, aoMover, minimapa },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { reduzido } = useMotion();
  const desenho = useVisaoAnimada(visao, reduzido);
  const porIdDesenho = useMemo(() => new Map(desenho.nodes.map((n) => [n.id, n])), [desenho]);
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 });
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 });
  const [focoId, setFocoId] = useState<string | null>(null);
  const mexeu = useRef(false);
  // Arrasto do fundo (move a vista) ou de um nó (`no` preenchido: move só o nó).
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean; no?: string } | null>(null);
  const foiArrasto = useRef(false);
  // Espelhos para os métodos do handle lerem o estado mais recente (ex.: centralizar logo após expandir um grupo).
  const atual = useRef({ visao, vista, tamanho });
  atual.current = { visao, vista, tamanho };

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

  const centralizarEm = useCallback((id: string) => {
    const { visao: v, vista: vi, tamanho: t } = atual.current;
    const no = v.nodes.find((n) => n.id === id);
    if (!no || !t.w) return;
    mexeu.current = true;
    setVista({ k: vi.k, x: t.w / 2 - no.x * vi.k, y: t.h / 2 - no.y * vi.k });
  }, []);

  const aproximar = useCallback((fator: number) => {
    const { tamanho: t } = atual.current;
    mexeu.current = true;
    setVista((v) => {
      const k = limitarZoom(v.k * fator);
      const cx = t.w / 2;
      const cy = t.h / 2;
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      recentralizar() {
        mexeu.current = false;
        enquadrar();
      },
      aproximar,
      centralizarEm,
      // Grafo inteiro, não só o que está na tela; zoom e deslocamento da vista não entram.
      async exportarPng() {
        const svg = svgRef.current;
        if (!svg) return null;
        const caixa = caixaDoConteudo(atual.current.visao.nodes);
        const copia = svg.cloneNode(true) as SVGSVGElement;
        copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copia.setAttribute("viewBox", `${caixa.x} ${caixa.y} ${caixa.largura} ${caixa.altura}`);
        copia.setAttribute("width", String(caixa.largura));
        copia.setAttribute("height", String(caixa.altura));
        copia.setAttribute("font-family", getComputedStyle(svg).fontFamily);
        copia.querySelector("[data-vista]")?.setAttribute("transform", "");
        const fundo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        fundo.setAttribute("x", String(caixa.x));
        fundo.setAttribute("y", String(caixa.y));
        fundo.setAttribute("width", String(caixa.largura));
        fundo.setAttribute("height", String(caixa.altura));
        fundo.setAttribute("fill", cor("--color-bg-canvas"));
        copia.insertBefore(fundo, copia.querySelector("[data-vista]"));
        return svgParaPng(copia, caixa.largura, caixa.altura);
      },
    }),
    [enquadrar, aproximar, centralizarEm],
  );

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
        const k = limitarZoom(v.k * Math.exp(-e.deltaY * 0.0015));
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

  // Um só ponto de Tab no grafo (roving tabindex): 300 nós em sequência de Tab seriam uma maratona.
  const tabulavel = (focoId && porId.has(focoId) ? focoId : null) ?? (selecionadoId && porId.has(selecionadoId) ? selecionadoId : null) ?? visao.nodes[0]?.id;

  const focarNo = (no: No2D) => {
    setFocoId(no.id);
    svgRef.current?.querySelector<SVGGElement>(`[data-no-id="${CSS.escape(no.id)}"]`)?.focus();
    // Fora da tela (ou quase), traz para o centro: o foco do teclado não pode sumir de vista.
    const { vista: v, tamanho: t } = atual.current;
    const sx = v.x + no.x * v.k;
    const sy = v.y + no.y * v.k;
    if (sx < 60 || sx > t.w - 60 || sy < 60 || sy > t.h - 60) centralizarEm(no.id);
  };

  const aoTeclar = (no: No2D) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.shiftKey) aoAbrir(no);
      else aoClicar(no);
    } else if (e.key === "Escape") {
      aoLimpar();
    } else if (SETAS.includes(e.key)) {
      e.preventDefault();
      const proximo = vizinhoNaDirecao(visao.nodes, no, e.key as Direcao);
      if (proximo) focarNo(proximo);
    }
  };

  const caixa = useMemo(() => caixaDoConteudo(visao.nodes), [visao.nodes]);
  const escalaMini = Math.min(MINIMAPA.w / caixa.largura, MINIMAPA.h / caixa.altura);
  const moverPeloMinimapa = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const gx = caixa.x + (e.clientX - rect.left) / escalaMini;
    const gy = caixa.y + (e.clientY - rect.top) / escalaMini;
    mexeu.current = true;
    setVista((v) => ({ ...v, x: tamanho.w / 2 - gx * v.k, y: tamanho.h / 2 - gy * v.k }));
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        tabIndex={-1}
        role="group"
        aria-roledescription="grafo"
        aria-label={`CyberGraph 2D: ${visao.nodes.length} nós, da Internet até os findings. Setas andam entre os nós, Enter seleciona, Shift+Enter abre os detalhes, Esc limpa, + e − aproximam.`}
        className="block h-[34rem] w-full cursor-grab touch-none select-none outline-none active:cursor-grabbing"
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") aproximar(1.2);
          else if (e.key === "-") aproximar(1 / 1.2);
        }}
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
          {desenho.edges.map((edge, i) => {
            const de = porIdDesenho.get(edge.source);
            const para = porIdDesenho.get(edge.target);
            if (!de || !para) return null;
            return (
              <linearGradient key={chaveDaAresta(edge)} id={`cg-g-${i}`} gradientUnits="userSpaceOnUse" x1={de.x} y1={de.y} x2={para.x} y2={para.y}>
                <stop offset="0%" stopColor={cor(tokenDoNo(de))} />
                <stop offset="100%" stopColor={cor(tokenDoNo(para))} />
              </linearGradient>
            );
          })}
        </defs>

        <g data-vista transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
          {desenho.edges.map((edge, i) => {
            const de = porIdDesenho.get(edge.source);
            const para = porIdDesenho.get(edge.target);
            if (!de || !para) return null;
            const x1 = de.x + RAIO[de.kind];
            const x2 = para.x - RAIO[para.kind];
            const meio = (x1 + x2) / 2;
            const d = `M ${x1} ${de.y} C ${meio} ${de.y}, ${meio} ${para.y}, ${x2} ${para.y}`;
            const noCaminho = contexto?.arestas.has(chaveDaAresta(edge)) ?? false;
            return (
              <g key={chaveDaAresta(edge)} className="cg-entrar" opacity={para.opacidade}>
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

          {desenho.nodes.map((no) => {
            const raio = RAIO[no.kind];
            const token = tokenDoNo(no);
            const Icone = ICONE_DO_TIPO[no.kind];
            const tamIcone = no.kind === "INTERNET" ? 34 : 20;
            const selecionado = no.id === selecionadoId;
            const apagado = contexto ? !contexto.nos.has(no.id) : false;
            const internet = no.kind === "INTERNET";
            if (no.saindo) {
              // Encolhendo para dentro do pai: só desenho, fora da árvore de acessibilidade e do clique.
              return (
                <g key={no.id} transform={`translate(${no.x} ${no.y}) scale(${no.opacidade})`} opacity={no.opacidade} aria-hidden="true" pointerEvents="none">
                  <circle r={raio} fill={cor("--color-bg-surface")} stroke={cor(token)} strokeWidth={2} />
                  <circle r={raio - 5} fill={cor(token, 0.14)} />
                </g>
              );
            }
            return (
              <g
                key={no.id}
                data-no-id={no.id}
                transform={`translate(${no.x} ${no.y})`}
                role="button"
                tabIndex={no.id === tabulavel ? 0 : -1}
                aria-pressed={selecionado}
                aria-expanded={no.kind === "GROUP" || no.expandivel ? no.expandido : undefined}
                aria-label={`${ROTULO_TIPO[no.kind]}: ${no.label}${no.risk ? `, risco ${DAST_RISK_LABELS[no.risk].toLowerCase()}` : ""}${no.total ? `, ${no.total} ${no.kind === "SUBDOMAIN" ? "subdomínios" : no.kind === "IP" ? "CVEs" : "findings"}` : ""}`}
                className="cg-no cg-entrar cursor-grab outline-none active:cursor-grabbing"
                opacity={apagado ? 0.28 : 1}
                onFocus={() => setFocoId(no.id)}
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
                {(no.kind === "GROUP" || no.expandivel) && <circle r={raio + 4} fill="none" stroke={cor(token, 0.55)} strokeWidth={1.5} />}
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
                {(no.kind === "GROUP" || no.expandivel) && (
                  <g transform={`translate(${raio * 0.75} ${-raio * 0.75})`}>
                    {/* Só os tokens de severidade têm -surface/-ink; o resto usa a superfície neutra. */}
                    <circle r={10} fill={no.kind === "GROUP" ? cor(`${token}-surface`) : cor("--color-bg-surface")} stroke={cor(token)} strokeWidth={1.5} />
                    <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight={700} fill={no.kind === "GROUP" ? cor(`${token}-ink`) : cor("--color-text-primary")}>
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

      {/* Legenda: mesma linguagem do nó (ícone na cor do tipo; findings pela severidade). */}
      <div className="pointer-events-none absolute bottom-3 left-3 mr-16 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/85 px-3 py-2 text-xs text-fg-muted backdrop-blur">
        {LEGENDA_TIPOS.filter((kind) => kind === "INTERNET" || kind === "ASSET" || visao.nodes.some((n) => n.kind === kind)).map((kind) => {
          const Icone = ICONE_DO_TIPO[kind];
          return (
            <span key={kind} className="flex items-center gap-1">
              <Icone className="h-3.5 w-3.5" style={{ color: cor(tokenDoNo({ kind })) }} aria-hidden="true" />
              {LEGENDA_NOME[kind]}
            </span>
          );
        })}
        <span className="flex items-center gap-2">
          Finding:
          {LEGENDA_RISCOS.map((risk) => (
            <span key={risk} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor(tokenDoNo({ kind: "FINDING", risk })) }} />
              {DAST_RISK_LABELS[risk]}
            </span>
          ))}
        </span>
      </div>

      {minimapa && (
        <div className="absolute bottom-3 right-14 overflow-hidden rounded-control border border-subtle bg-surface/90 shadow-raised backdrop-blur">
          <svg
            width={MINIMAPA.w}
            height={MINIMAPA.h}
            role="img"
            aria-label="Minimapa do grafo: clique ou arraste para mover a vista"
            className="block cursor-pointer touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              moverPeloMinimapa(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) moverPeloMinimapa(e);
            }}
          >
            <g transform={`scale(${escalaMini}) translate(${-caixa.x} ${-caixa.y})`}>
              {visao.edges.map((edge) => {
                const de = porId.get(edge.source);
                const para = porId.get(edge.target);
                if (!de || !para) return null;
                return (
                  <line
                    key={chaveDaAresta(edge)}
                    x1={de.x}
                    y1={de.y}
                    x2={para.x}
                    y2={para.y}
                    stroke={cor("--color-text-muted", 0.35)}
                    strokeWidth={1 / escalaMini}
                  />
                );
              })}
              {visao.nodes.map((no) => (
                <circle key={no.id} cx={no.x} cy={no.y} r={RAIO[no.kind] * 0.9} fill={cor(tokenDoNo(no))} />
              ))}
              <rect
                x={-vista.x / vista.k}
                y={-vista.y / vista.k}
                width={tamanho.w / vista.k}
                height={tamanho.h / vista.k}
                fill={cor("--color-accent", 0.1)}
                stroke={cor("--color-accent")}
                strokeWidth={2 / escalaMini}
              />
            </g>
          </svg>
        </div>
      )}
    </div>
  );
});
