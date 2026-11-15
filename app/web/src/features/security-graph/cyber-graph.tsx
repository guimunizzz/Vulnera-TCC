/**
 * cyber-graph.tsx
 *
 * O QUE FAZ
 * Aba CyberGraph do scan DAST: barra com Recentralizar, Caminho mais crítico,
 * Restaurar layout, Exportar PNG e o seletor de layout (hierárquico, radial,
 * estrela, orgânico, clusters); busca de nó e filtro por severidade; o palco
 * com botões de zoom; o painel do nó selecionado e o modal de detalhes.
 *
 * POR QUE EXISTE
 * Mostra o caminho Internet → alvo → endpoint → finding, montado só com os
 * findings reais do scan e os ativos dos sensores de descoberta. O modo 3D
 * saiu (ADR-051): no lugar dele, layouts 2D que respondem perguntas diferentes
 * sobre o mesmo grafo, todos em SVG e com cada nó focável.
 *
 * QUEM USA
 * `dast-scan-detail-page.tsx`, via React.lazy().
 */

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { Download, LocateFixed, Map as MapIcon, Minus, Plus, RotateCcw, Route, Scan, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
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
import { gruposParaMostrar, montarVisao2D, type No2D, type Posicoes2D } from "./graph-2d-layout";
import { aplicarLayout, type LayoutId } from "./graph-layouts";
import { SeletorDeLayout } from "./seletor-de-layout";
import { useLayoutSalvo } from "./use-layout-salvo";
import { buildSecurityGraph, type GraphNode } from "./graph-model";
import { descreverNo } from "./node-detail";
import { cor, tokenDoNo } from "./node-visual";
import "./cyber-graph.css";

const RISCOS: DastRisk[] = ["HIGH", "MEDIUM", "LOW", "INFO"];

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
  const [layout, setLayout] = useLayoutSalvo("vulnera:cybergraph-layout");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(() => new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [avisoBusca, setAvisoBusca] = useState("");
  const [exportando, setExportando] = useState(false);
  const [minimapa, setMinimapa] = useState(false);
  // Posições arrastadas no layout atual. Ficam aqui para sobreviver à troca de tema.
  const [posicoes2d, setPosicoes2d] = useState<Posicoes2D>(() => new Map());
  const base = useMemo(() => montarVisao2D(grafo, expandidos), [grafo, expandidos]);
  // Separado das posições: o orgânico custa alguns ms e não precisa rodar a cada quadro de arrasto.
  const noLayout = useMemo(() => aplicarLayout(base, layout), [base, layout]);
  const visao = useMemo(() => aplicarLayout(noLayout, "hierarquico", posicoes2d), [noLayout, posicoes2d]);
  const layoutMexido = posicoes2d.size > 0;
  const detalhe = useMemo(
    () => (selecionadoId ? descreverNo(grafo, findingsPorNo, selecionadoId, targetUrl) : null),
    [grafo, findingsPorNo, selecionadoId, targetUrl],
  );
  const nomesParaBusca = useMemo(() => [...new Set(grafo.nodes.map((n) => n.label))].sort(), [grafo]);
  const ref2d = useRef<CyberGraph2DHandle>(null);

  // Selecionar um nó escondido (pelo painel, pelo modal ou pela busca) abre o grupo dele.
  const selecionar = useCallback(
    (id: string | null) => {
      setSelecionadoId(id);
      const grupos = id ? gruposParaMostrar(grafo, id) : [];
      if (grupos.some((g) => !expandidos.has(g))) setExpandidos((atual) => new Set([...atual, ...grupos]));
    },
    [grafo, expandidos],
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

  const trocarLayout = (novo: LayoutId) => {
    if (novo === layout) return;
    // Posição arrastada vale para o layout em que foi feita.
    setPosicoes2d(new Map());
    setLayout(novo);
    window.setTimeout(() => ref2d.current?.recentralizar(), 0);
  };

  const recentralizar = () => {
    setSelecionadoId(null);
    ref2d.current?.recentralizar();
  };

  const mover2d = useCallback((id: string, x: number, y: number) => setPosicoes2d((atual) => new Map(atual).set(id, { x, y })), []);

  const aproximar = (fator: number) => ref2d.current?.aproximar(fator);
  const ajustar = () => ref2d.current?.recentralizar();

  // O grafo já vem ordenado por risco: o primeiro finding é o mais grave.
  const maisCritico = grafo.nodes.find((n) => n.kind === "FINDING");
  const mostrarCaminhoCritico = () => {
    if (!maisCritico) return;
    selecionar(maisCritico.id);
    // Depois do render: o grupo do finding acabou de abrir e mudou as posições.
    window.setTimeout(() => ref2d.current?.centralizarEm(maisCritico.id), 0);
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
    window.setTimeout(() => ref2d.current?.centralizarEm(no.id), 0);
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
      const blob = await ref2d.current?.exportarPng();
      if (blob) baixarArquivo(blob, `cybergraph-${hostDe(targetUrl)}-${layout}.png`);
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
                className="rounded-full border border-subtle bg-inset px-2 py-1"
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
                onClick={mostrarCaminhoCritico}
                disabled={!maisCritico}
                className="whitespace-nowrap"
                title={
                  maisCritico
                    ? `Destaca o caminho de exposição da Internet até “${maisCritico.label}”`
                    : "Nenhum finding entre as severidades visíveis"
                }
                iconeInicio={<Route className="h-4 w-4" aria-hidden="true" />}
              >
                Caminho mais crítico
              </Button>
              <Button
                variant="secundario"
                size="sm"
                onClick={() => setPosicoes2d(new Map())}
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
                title="Baixa o grafo inteiro como imagem, no layout atual"
                iconeInicio={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Exportar PNG
              </Button>
              <SeletorDeLayout valor={layout} aoMudar={trocarLayout} />
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
                  className="h-10 w-full rounded-control border border-default bg-inset pl-8 pr-2 text-sm text-fg placeholder:text-fg-muted"
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
                      "alvo-estendido flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
            <CyberGraph2D
              ref={ref2d}
              visao={visao}
              animarTroca={layout}
              selecionadoId={selecionadoId}
              aoClicar={aoClicar2D}
              aoAbrir={(no) => abrir(no.id)}
              aoLimpar={() => setSelecionadoId(null)}
              aoMover={mover2d}
              minimapa={minimapa}
            />
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
              <Button
                variant={minimapa ? "primario" : "secundario"}
                size="sm"
                rotulo={minimapa ? "Esconder minimapa" : "Mostrar minimapa"}
                aria-pressed={minimapa}
                onClick={() => setMinimapa((v) => !v)}
              >
                <MapIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          Arraste um nó para reposicioná-lo e o fundo para mover a vista. Com um nó em foco, as setas andam pelo grafo. Clique em “Findings”
          para expandir o grupo.{" "}
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
