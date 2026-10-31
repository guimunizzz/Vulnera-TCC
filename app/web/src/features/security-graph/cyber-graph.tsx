/**
 * cyber-graph.tsx
 *
 * O QUE FAZ
 * Aba CyberGraph do scan DAST: barra com Recentralizar, Restaurar layout,
 * Exportar PNG e a alternância 2D/3D; busca de nó e filtro por severidade; o
 * palco do modo escolhido com botões de zoom; o painel do nó selecionado e o
 * modal de detalhes. A seleção é uma só para os dois modos.
 *
 * POR QUE EXISTE
 * O 2D é a visão de trabalho (leve, sem WebGL, cada nó é um botão); o 3D é a
 * de apresentação. Os dois mostram o mesmo caminho Internet → alvo → endpoint
 * → finding, montado só com os findings reais do scan (OWASP ZAP). Sensores
 * passivos ainda não existem: a barra diz isso em vez de simular.
 *
 * QUEM USA
 * `dast-scan-detail-page.tsx`, via React.lazy(). O 3D é outro chunk lazy:
 * `three` só baixa quando a pessoa escolhe o 3D.
 */

import { lazy, Suspense, useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { Download, LocateFixed, Map as MapIcon, Minus, Plus, RotateCcw, Scan, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import {
  DAST_RISK_LABELS,
  DAST_SENSOR_SHORT_LABELS,
  type DastFinding,
  type DastObservedAsset,
  type DastRisk,
  type DastSensorRun,
} from "../../types/dast.types";
import { CyberGraph2D, type CyberGraph2DHandle } from "./cyber-graph-2d";
import { ModalDoNo, PainelDoNo } from "./cyber-graph-detalhes";
import { baixarArquivo } from "./exportar";
import { gruposDoNo, gruposParaMostrar, montarVisao2D, type No2D, type Posicoes2D } from "./graph-2d-layout";
import { buildSecurityGraph, type GraphNode } from "./graph-model";
import { descreverNo } from "./node-detail";
import { cor, tokenDoNo } from "./node-visual";
import type { Posicao3D } from "./scene/graph-scene";
import type { SecurityGraph3DHandle } from "./security-graph-3d";
import "./cyber-graph.css";

const SecurityGraph3D = lazy(() => import("./security-graph-3d"));
const TEM_WEBGL = typeof window !== "undefined" && "WebGL2RenderingContext" in window;
const CHAVE_MODO = "vulnera:cybergraph-modo";
const RISCOS: DastRisk[] = ["HIGH", "MEDIUM", "LOW", "INFO"];

type Modo = "2d" | "3d";

function lerModo(): Modo {
  try {
    return TEM_WEBGL && window.localStorage.getItem(CHAVE_MODO) === "3d" ? "3d" : "2d";
  } catch {
    // localStorage lança em modo privado de alguns navegadores; o 2D é o padrão.
    return "2d";
  }
}

/** Nó pelo texto digitado: nome exato primeiro, depois o primeiro que contém o termo. */
function acharNo(nos: GraphNode[], termo: string): GraphNode | undefined {
  const t = termo.trim().toLowerCase();
  if (!t) return undefined;
  return nos.find((n) => n.label.toLowerCase() === t) ?? nos.find((n) => n.label.toLowerCase().includes(t));
}

function hostDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^\w.-]/g, "_");
  } catch {
    return "scan";
  }
}

export default function CyberGraph({
  targetUrl,
  findings,
  sensores,
  ativos = [],
  aoVerNaLista,
}: {
  targetUrl: string;
  findings: DastFinding[];
  sensores: DastSensorRun[];
  /** IP, portas, tecnologias e subdomínios vistos pelos sensores de descoberta. */
  ativos?: DastObservedAsset[];
  aoVerNaLista(findingId: string): void;
}) {
  const [riscos, setRiscos] = useState<ReadonlySet<DastRisk>>(() => new Set(RISCOS));
  const visiveis = useMemo(() => findings.filter((f) => riscos.has(f.risk)), [findings, riscos]);
  const grafo = useMemo(() => buildSecurityGraph(targetUrl, visiveis, ativos), [targetUrl, visiveis, ativos]);
  const findingsPorNo = useMemo(() => new Map(findings.map((f) => [`finding:${f.id}`, f])), [findings]);
  const contagem = useMemo(() => {
    const c: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const f of findings) c[f.risk] += 1;
    return c;
  }, [findings]);
  const [modo, setModo] = useState<Modo>(lerModo);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(() => new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [avisoBusca, setAvisoBusca] = useState("");
  const [exportando, setExportando] = useState(false);
  const [minimapa, setMinimapa] = useState(false);
  // Posições arrastadas, por modo. Ficam aqui para sobreviver à troca 2D/3D e de tema.
  const [posicoes2d, setPosicoes2d] = useState<Posicoes2D>(() => new Map());
  const [posicoes3d, setPosicoes3d] = useState<ReadonlyMap<string, Posicao3D>>(() => new Map());
  const visao = useMemo(() => montarVisao2D(grafo, expandidos, posicoes2d), [grafo, expandidos, posicoes2d]);
  const layoutMexido = (modo === "2d" ? posicoes2d : posicoes3d).size > 0;
  const detalhe = useMemo(
    () => (selecionadoId ? descreverNo(grafo, findingsPorNo, selecionadoId, targetUrl) : null),
    [grafo, findingsPorNo, selecionadoId, targetUrl],
  );
  const nomesParaBusca = useMemo(() => [...new Set(grafo.nodes.map((n) => n.label))].sort(), [grafo]);
  const ref2d = useRef<CyberGraph2DHandle>(null);
  const ref3d = useRef<SecurityGraph3DHandle>(null);

  // Selecionar um nó escondido (pelo painel, pelo modal ou pela busca) abre o grupo dele, no 2D e no 3D.
  const selecionar = useCallback(
    (id: string | null) => {
      setSelecionadoId(id);
      const grupos = id ? gruposParaMostrar(grafo, id) : [];
      if (grupos.some((g) => !expandidos.has(g))) setExpandidos((atual) => new Set([...atual, ...grupos]));
    },
    [grafo, expandidos],
  );

  // No 3D não há nó de grupo: interagir com o endpoint, o IP ou "Subdomínios" abre ou fecha o que pende dele.
  const alternarRamo = useCallback(
    (id: string) => {
      const grupos = gruposDoNo(grafo, id);
      if (!grupos.length) return;
      setExpandidos((atual) => {
        const aberto = grupos.every((g) => atual.has(g));
        const proximo = new Set(atual);
        for (const g of grupos) {
          if (aberto) proximo.delete(g);
          else proximo.add(g);
        }
        return proximo;
      });
    },
    [grafo],
  );

  const alternarGrupo = (id: string) =>
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(id)) proximo.add(id);
      return proximo;
    });

  const aoClicar2D = (no: No2D) => {
    if (no.kind === "GROUP" || no.expandivel) {
      alternarGrupo(no.id);
      // Com vários ramos o grafo fica mais alto que o palco: o grupo aberto vai para o centro
      // para os filhos dele não nascerem fora da tela.
      window.setTimeout(() => ref2d.current?.centralizarEm(no.id), 0);
    }
    selecionar(no.id);
  };

  const abrir = useCallback(
    (id: string) => {
      selecionar(id);
      setModalAberto(true);
    },
    [selecionar],
  );

  const trocarModo = (novo: Modo) => {
    if (novo === modo) return;
    // Grupo só existe no 2D: no 3D a seleção cai no endpoint dele.
    if (novo === "3d" && selecionadoId?.startsWith("grupo:")) setSelecionadoId(selecionadoId.slice("grupo:".length));
    setModo(novo);
    try {
      window.localStorage.setItem(CHAVE_MODO, novo);
    } catch {
      // Sem storage, a escolha vale só nesta visita.
    }
  };

  const recentralizar = () => {
    setSelecionadoId(null);
    if (modo === "2d") ref2d.current?.recentralizar();
    else ref3d.current?.recentralizar();
  };

  const mover2d = useCallback((id: string, x: number, y: number) => setPosicoes2d((atual) => new Map(atual).set(id, { x, y })), []);
  const mover3d = useCallback((id: string, p: Posicao3D) => setPosicoes3d((atual) => new Map(atual).set(id, p)), []);

  const restaurarLayout = () => {
    if (modo === "2d") {
      setPosicoes2d(new Map());
    } else {
      setPosicoes3d(new Map());
      ref3d.current?.restaurarLayout();
    }
  };

  // Zoom: no 2D o fator multiplica a escala; no 3D divide a distância da câmera.
  const aproximar = (fator: number) => {
    if (modo === "2d") ref2d.current?.aproximar(fator);
    else ref3d.current?.aproximar(1 / fator);
  };
  const ajustar = () => {
    if (modo === "2d") ref2d.current?.recentralizar();
    else ref3d.current?.ajustarVista();
  };

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const no = acharNo(grafo.nodes, busca);
    if (!no) {
      setAvisoBusca(`Nenhum nó com “${busca.trim()}” ${riscos.size < RISCOS.length ? "entre as severidades visíveis" : "neste scan"}.`);
      return;
    }
    setAvisoBusca("");
    selecionar(no.id);
    // Depois do render: o grupo do finding acabou de abrir e mudou as posições.
    if (modo === "2d") window.setTimeout(() => ref2d.current?.centralizarEm(no.id), 0);
  };

  const alternarRisco = (risco: DastRisk) =>
    setRiscos((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(risco)) proximo.add(risco);
      return proximo;
    });

  const exportarPng = async () => {
    setExportando(true);
    try {
      const blob = modo === "2d" ? await ref2d.current?.exportarPng() : await ref3d.current?.capturar();
      if (blob) baixarArquivo(blob, `cybergraph-${hostDe(targetUrl)}-${modo}.png`);
    } finally {
      setExportando(false);
    }
  };

  const verNaLista = (findingId: string) => {
    setModalAberto(false);
    aoVerNaLista(findingId);
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-container border border-subtle">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle bg-surface px-3 py-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
              <span>
                Internet <span aria-hidden="true">→</span> Alvo <span aria-hidden="true">→</span> Endpoint{" "}
                <span aria-hidden="true">→</span> Findings
              </span>
              <span className="font-mono" data-numeric>
                · {grafo.nodes.length} nós
              </span>
              {/* Escopo honesto: só as fontes que rodaram neste scan. */}
              <span
                className="rounded-full border border-subtle bg-inset px-2 py-0.5"
                title="Fontes que rodaram neste scan. Status e mensagem de cada uma estão na faixa de sensores acima."
              >
                {sensores.length > 1
                  ? `Fontes: ${sensores.map((s) => DAST_SENSOR_SHORT_LABELS[s.sensorKey] ?? s.sensorKey).join(" · ")}`
                  : "Fonte: OWASP ZAP"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secundario"
                size="sm"
                onClick={recentralizar}
                className="whitespace-nowrap"
                iconeInicio={<LocateFixed className="h-4 w-4" aria-hidden="true" />}
              >
                Recentralizar
              </Button>
              <Button
                variant="secundario"
                size="sm"
                onClick={restaurarLayout}
                className="whitespace-nowrap"
                disabled={!layoutMexido}
                title={layoutMexido ? "Volta os nós arrastados para a posição padrão" : "Arraste um nó para mudar o layout"}
                iconeInicio={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
              >
                Restaurar layout
              </Button>
              <Button
                variant="secundario"
                size="sm"
                onClick={exportarPng}
                carregando={exportando}
                className="whitespace-nowrap"
                title={modo === "2d" ? "Baixa o grafo inteiro como imagem" : "Baixa a cena como está na tela"}
                iconeInicio={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Exportar PNG
              </Button>
              <div role="group" aria-label="Modo de visualização" className="inline-flex rounded-control border border-subtle bg-inset p-0.5">
                {(["2d", "3d"] as const).map((m) => {
                  const indisponivel = m === "3d" && !TEM_WEBGL;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={modo === m}
                      disabled={indisponivel}
                      title={indisponivel ? "Este navegador não tem WebGL 2" : `Ver em ${m.toUpperCase()}`}
                      onClick={() => trocarModo(m)}
                      className={cn(
                        "alvo-estendido rounded-control px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        modo === m ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      {m.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface px-3 py-2">
            <form role="search" onSubmit={buscar} className="flex min-w-[14rem] flex-1 items-center gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Buscar nó no grafo</span>
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
                <input
                  type="search"
                  list="cg-nomes"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setAvisoBusca("");
                  }}
                  placeholder="Buscar nó (endpoint, finding, alvo)…"
                  className="h-9 w-full rounded-control border border-default bg-inset pl-8 pr-2 text-sm text-fg placeholder:text-fg-muted"
                />
              </label>
              <datalist id="cg-nomes">
                {nomesParaBusca.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
              <Button type="submit" variant="secundario" size="sm" disabled={!busca.trim()}>
                Ir
              </Button>
            </form>
            <div role="group" aria-label="Filtrar findings por severidade" className="flex flex-wrap gap-1">
              {RISCOS.map((risco) => {
                const ativo = riscos.has(risco);
                const token = tokenDoNo({ kind: "FINDING", risk: risco });
                return (
                  <button
                    key={risco}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alternarRisco(risco)}
                    className={cn(
                      "alvo-estendido flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      ativo ? "text-fg" : "text-fg-muted line-through opacity-60",
                    )}
                    style={{ borderColor: ativo ? cor(token, 0.6) : undefined, background: ativo ? cor(token, 0.12) : undefined }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: cor(token) }} aria-hidden="true" />
                    {DAST_RISK_LABELS[risco]}
                    <span className="font-mono text-fg-muted" data-numeric>
                      {contagem[risco]}
                    </span>
                  </button>
                );
              })}
            </div>
            {avisoBusca && (
              <p className="w-full text-xs text-fg-muted" role="status">
                {avisoBusca}
              </p>
            )}
          </div>

          <div className="cg-palco relative">
            {modo === "2d" ? (
              <CyberGraph2D
                ref={ref2d}
                visao={visao}
                selecionadoId={selecionadoId}
                aoClicar={aoClicar2D}
                aoAbrir={(no) => abrir(no.id)}
                aoLimpar={() => setSelecionadoId(null)}
                aoMover={mover2d}
                minimapa={minimapa}
              />
            ) : (
              <Suspense fallback={<Skeleton className="h-[34rem] w-full bg-inset" />}>
                <SecurityGraph3D
                  ref={ref3d}
                  grafo={grafo}
                  selecionadoId={selecionadoId}
                  posicoes={posicoes3d}
                  expandidos={expandidos}
                  aoSelecionar={selecionar}
                  aoAlternar={alternarRamo}
                  aoAbrir={abrir}
                  aoMoverNo={mover3d}
                />
              </Suspense>
            )}
            {/* Zoom por botões: a roda só funciona com o grafo em foco, e no celular não há roda. */}
            <div role="group" aria-label="Zoom" className="absolute bottom-3 right-3 flex flex-col gap-1">
              <Button variant="secundario" size="sm" rotulo="Aproximar" onClick={() => aproximar(1.25)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="secundario" size="sm" rotulo="Afastar" onClick={() => aproximar(1 / 1.25)}>
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="secundario" size="sm" rotulo="Ajustar à tela" onClick={ajustar}>
                <Scan className="h-4 w-4" aria-hidden="true" />
              </Button>
              {modo === "2d" && (
                <Button
                  variant={minimapa ? "primario" : "secundario"}
                  size="sm"
                  rotulo={minimapa ? "Esconder minimapa" : "Mostrar minimapa"}
                  aria-pressed={minimapa}
                  onClick={() => setMinimapa((v) => !v)}
                >
                  <MapIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {modo === "2d"
            ? "Arraste um nó para reposicioná-lo e o fundo para mover a vista. Com um nó em foco, as setas andam pelo grafo. Clique em “Findings” para expandir o grupo."
            : "Clique num endpoint, no IP ou em Subdomínios para abrir ou fechar o que pende dele (Espaço faz o mesmo pelo teclado). Arraste um objeto para reposicioná-lo e o fundo para girar; com a cena em foco, role para aproximar e use as setas para percorrer os nós."}{" "}
          Duplo clique num nó abre os detalhes.
          {grafo.truncated && " Grafo truncado nos findings de maior risco."}
          {visiveis.length < findings.length && ` Mostrando ${visiveis.length} de ${findings.length} findings pelo filtro de severidade.`}
        </p>
      </div>

      <PainelDoNo
        detalhe={detalhe}
        targetUrl={targetUrl}
        totalFindings={findings}
        aoSelecionar={selecionar}
        aoExpandir={() => setModalAberto(true)}
        certificado={sensores.find((s) => s.sensorKey === "ssl")?.message ?? null}
        aoVerNaLista={verNaLista}
      />

      <ModalDoNo
        detalhe={detalhe}
        aberto={modalAberto}
        targetUrl={targetUrl}
        aoFechar={() => setModalAberto(false)}
        aoSelecionar={selecionar}
        certificado={sensores.find((s) => s.sensorKey === "ssl")?.message ?? null}
        aoVerNaLista={verNaLista}
      />
    </div>
  );
}
