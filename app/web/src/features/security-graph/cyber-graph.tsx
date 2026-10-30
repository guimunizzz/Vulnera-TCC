/**
 * cyber-graph.tsx
 *
 * O QUE FAZ
 * Aba CyberGraph do scan DAST: barra com "Recentralizar" e a alternância 2D/3D,
 * o palco do modo escolhido, o painel do nó selecionado e o modal de detalhes.
 * A seleção é uma só para os dois modos.
 *
 * POR QUE EXISTE
 * O 2D é a visão de trabalho (leve, sem WebGL, cada nó é um botão); o 3D é a
 * de apresentação. Os dois mostram o mesmo caminho Internet → alvo → endpoint
 * → finding, montado só com os findings reais do scan.
 *
 * QUEM USA
 * `dast-scan-detail-page.tsx`, via React.lazy(). O 3D é outro chunk lazy:
 * `three` só baixa quando a pessoa escolhe o 3D.
 */

import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { LocateFixed, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import type { DastFinding } from "../../types/dast.types";
import { CyberGraph2D, type CyberGraph2DHandle } from "./cyber-graph-2d";
import { ModalDoNo, PainelDoNo } from "./cyber-graph-detalhes";
import { montarVisao2D, type No2D, type Posicoes2D } from "./graph-2d-layout";
import { buildSecurityGraph } from "./graph-model";
import { descreverNo, grupoDoFinding } from "./node-detail";
import type { Posicao3D } from "./scene/graph-scene";
import type { SecurityGraph3DHandle } from "./security-graph-3d";
import "./cyber-graph.css";

const SecurityGraph3D = lazy(() => import("./security-graph-3d"));
const TEM_WEBGL = typeof window !== "undefined" && "WebGL2RenderingContext" in window;
const CHAVE_MODO = "vulnera:cybergraph-modo";

type Modo = "2d" | "3d";

function lerModo(): Modo {
  try {
    return TEM_WEBGL && window.localStorage.getItem(CHAVE_MODO) === "3d" ? "3d" : "2d";
  } catch {
    // localStorage lança em modo privado de alguns navegadores; o 2D é o padrão.
    return "2d";
  }
}

export default function CyberGraph({
  targetUrl,
  findings,
  aoVerNaLista,
}: {
  targetUrl: string;
  findings: DastFinding[];
  aoVerNaLista(findingId: string): void;
}) {
  const grafo = useMemo(() => buildSecurityGraph(targetUrl, findings), [targetUrl, findings]);
  const findingsPorNo = useMemo(() => new Map(findings.map((f) => [`finding:${f.id}`, f])), [findings]);
  const [modo, setModo] = useState<Modo>(lerModo);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(() => new Set());
  const [modalAberto, setModalAberto] = useState(false);
  // Posições arrastadas, por modo. Ficam aqui para sobreviver à troca 2D/3D e de tema.
  const [posicoes2d, setPosicoes2d] = useState<Posicoes2D>(() => new Map());
  const [posicoes3d, setPosicoes3d] = useState<ReadonlyMap<string, Posicao3D>>(() => new Map());
  const visao = useMemo(() => montarVisao2D(grafo, expandidos, posicoes2d), [grafo, expandidos, posicoes2d]);
  const layoutMexido = (modo === "2d" ? posicoes2d : posicoes3d).size > 0;
  const detalhe = useMemo(
    () => (selecionadoId ? descreverNo(grafo, findingsPorNo, selecionadoId) : null),
    [grafo, findingsPorNo, selecionadoId],
  );
  const ref2d = useRef<CyberGraph2DHandle>(null);
  const ref3d = useRef<SecurityGraph3DHandle>(null);

  // Selecionar um finding (no 3D, no painel ou no modal) abre o grupo dele no 2D.
  const selecionar = useCallback(
    (id: string | null) => {
      setSelecionadoId(id);
      const grupo = id?.startsWith("finding:") ? grupoDoFinding(grafo, id) : null;
      if (grupo) setExpandidos((atual) => (atual.has(grupo) ? atual : new Set(atual).add(grupo)));
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
    if (no.kind === "GROUP") alternarGrupo(no.id);
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

  const verNaLista = (findingId: string) => {
    setModalAberto(false);
    aoVerNaLista(findingId);
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-container border border-subtle">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle bg-surface px-3 py-2">
            <p className="text-xs text-fg-muted">
              Internet <span aria-hidden="true">→</span> Alvo <span aria-hidden="true">→</span> Endpoint{" "}
              <span aria-hidden="true">→</span> Findings
              <span className="ml-2 font-mono" data-numeric>
                · {grafo.nodes.length} nós
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

          <div className="cg-palco">
            {modo === "2d" ? (
              <CyberGraph2D
                ref={ref2d}
                visao={visao}
                selecionadoId={selecionadoId}
                aoClicar={aoClicar2D}
                aoAbrir={(no) => abrir(no.id)}
                aoLimpar={() => setSelecionadoId(null)}
                aoMover={mover2d}
              />
            ) : (
              <Suspense fallback={<Skeleton className="h-[34rem] w-full bg-inset" />}>
                <SecurityGraph3D
                  ref={ref3d}
                  grafo={grafo}
                  selecionadoId={selecionadoId}
                  posicoes={posicoes3d}
                  aoSelecionar={selecionar}
                  aoAbrir={abrir}
                  aoMoverNo={mover3d}
                />
              </Suspense>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {modo === "2d"
            ? "Arraste um nó para reposicioná-lo e o fundo para mover a vista; com o grafo em foco, role para aproximar. Clique em “Findings” para expandir o grupo."
            : "Arraste um objeto para reposicioná-lo e o fundo para girar; com a cena em foco, role para aproximar."}{" "}
          Duplo clique num nó abre os detalhes.
          {grafo.truncated && " Grafo truncado nos findings de maior risco."}
        </p>
      </div>

      <PainelDoNo
        detalhe={detalhe}
        targetUrl={targetUrl}
        totalFindings={findings}
        aoSelecionar={selecionar}
        aoExpandir={() => setModalAberto(true)}
        aoVerNaLista={verNaLista}
      />

      <ModalDoNo
        detalhe={detalhe}
        aberto={modalAberto}
        targetUrl={targetUrl}
        aoFechar={() => setModalAberto(false)}
        aoSelecionar={selecionar}
        aoVerNaLista={verNaLista}
      />
    </div>
  );
}
