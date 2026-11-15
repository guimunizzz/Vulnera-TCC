/**
 * code-graph.tsx
 *
 * O QUE FAZ
 * Aba "Security Graph" do detalhe de uma importação SAST/SCA (ADR-052): onde
 * estão os problemas — Aplicação → Código (pasta → arquivo → achado) e
 * Dependências (pacote → CVE). Mesmo desenho do CyberGraph do DAST e do
 * Exposure Graph: layouts, zoom, minimapa, arrastar, busca, PNG e grupos que
 * abrem e fecham.
 *
 * Falsos-positivos começam ocultos, com um interruptor para mostrar (decisão
 * de 2026-11-13, coerente com o PDF). "Ver na lista" leva o achado para a aba
 * Achados, já expandido.
 *
 * QUEM USA
 * `code-import-detail-page.tsx`, via React.lazy() — o grafo só é baixado
 * quando a aba abre.
 */

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { Download, List, LocateFixed, Map as MapIcon, Minus, Plus, RotateCcw, Scan, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { SeverityBadge } from "../../components/ui/badge";
import { cn } from "../../lib/cn";
import { CODE_SEVERITY_LABELS, CODE_SEVERITY_ORDER, localDoAchado, type CodeFinding, type CodeSeverity } from "../../types/code-import.types";
import { DAST_TRIAGE_LABELS } from "../../types/dast.types";
import { CyberGraph2D, type CyberGraph2DHandle } from "./cyber-graph-2d";
import { caminhoParaMostrar, expandidosIniciais, montarArvoreCodigo, montarVisaoCodigo } from "./code-graph-model";
import { baixarArquivo } from "./exportar";
import type { No2D, Posicoes2D } from "./graph-2d-layout";
import { aplicarLayout, type LayoutId } from "./graph-layouts";
import { ROTULO_TIPO } from "./node-visual";
import { SeletorDeLayout } from "./seletor-de-layout";
import { useLayoutSalvo } from "./use-layout-salvo";
import "./cyber-graph.css";

const badge = (s: CodeSeverity) => (s === "INFO" ? "NONE" : s);

export default function CodeGraph({
  nomeAplicacao,
  findings,
  aoVerNaLista,
}: {
  nomeAplicacao: string;
  findings: CodeFinding[];
  aoVerNaLista(findingId: string): void;
}) {
  const [severidades, setSeveridades] = useState<ReadonlySet<CodeSeverity>>(() => new Set(CODE_SEVERITY_ORDER));
  const [mostrarFP, setMostrarFP] = useState(false);
  const arvore = useMemo(
    () => montarArvoreCodigo(nomeAplicacao, findings, { severidades, mostrarFalsosPositivos: mostrarFP }),
    [nomeAplicacao, findings, severidades, mostrarFP],
  );
  // O que começa aberto é recalculado a cada filtro (um ramo que aparece não nasce fechado);
  // por cima disso valem as escolhas explícitas da pessoa.
  const iniciais = useMemo(() => expandidosIniciais(arvore), [arvore]);
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set());
  const [recolhidos, setRecolhidos] = useState<ReadonlySet<string>>(() => new Set());
  const expandidos = useMemo(
    () => new Set([...iniciais, ...abertos].filter((id) => !recolhidos.has(id))),
    [iniciais, abertos, recolhidos],
  );
  const [layout, setLayout] = useLayoutSalvo("vulnera:code-graph-layout");
  const [posicoes, setPosicoes] = useState<Posicoes2D>(() => new Map());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [minimapa, setMinimapa] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [busca, setBusca] = useState("");
  const [avisoBusca, setAvisoBusca] = useState("");
  const ref = useRef<CyberGraph2DHandle>(null);

  const base = useMemo(() => montarVisaoCodigo(arvore, expandidos), [arvore, expandidos]);
  const noLayout = useMemo(() => aplicarLayout(base, layout), [base, layout]);
  const visao = useMemo(() => aplicarLayout(noLayout, "hierarquico", posicoes), [noLayout, posicoes]);
  const falsosPositivos = useMemo(() => findings.filter((f) => f.triageStatus === "FALSE_POSITIVE").length, [findings]);
  const contagem = useMemo(() => {
    const c: Record<CodeSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const f of findings) if (mostrarFP || f.triageStatus !== "FALSE_POSITIVE") c[f.severity] += 1;
    return c;
  }, [findings, mostrarFP]);
  const selecionado = useMemo(() => arvore.todos.find((n) => n.id === selecionadoId) ?? null, [arvore, selecionadoId]);
  const achadoSelecionado = selecionadoId ? arvore.achados.get(selecionadoId) : undefined;
  const nomesParaBusca = useMemo(() => [...new Set(arvore.todos.map((n) => n.label))].sort(), [arvore]);

  const mover = useCallback((id: string, x: number, y: number) => setPosicoes((atual) => new Map(atual).set(id, { x, y })), []);

  /** Seleciona um nó e abre o caminho até ele (busca, painel). */
  const selecionar = useCallback(
    (id: string | null) => {
      setSelecionadoId(id);
      if (!id) return;
      const caminho = caminhoParaMostrar(arvore, id).filter((c) => !expandidos.has(c));
      if (!caminho.length) return;
      setAbertos((atual) => new Set([...atual, ...caminho]));
      setRecolhidos((atual) => new Set([...atual].filter((c) => !caminho.includes(c))));
    },
    [arvore, expandidos],
  );

  const aoClicar = (no: No2D) => {
    if (no.expandivel) {
      const fechar = expandidos.has(no.id);
      const tirar = (atual: ReadonlySet<string>) => new Set([...atual].filter((id) => id !== no.id));
      setAbertos((atual) => (fechar ? tirar(atual) : new Set(atual).add(no.id)));
      setRecolhidos((atual) => (fechar ? new Set(atual).add(no.id) : tirar(atual)));
      window.setTimeout(() => ref.current?.centralizarEm(no.id), 0);
    }
    selecionar(no.id);
  };

  const trocarLayout = (novo: LayoutId) => {
    if (novo === layout) return;
    setPosicoes(new Map());
    setLayout(novo);
    window.setTimeout(() => ref.current?.recentralizar(), 0);
  };

  const alternarSeveridade = (s: CodeSeverity) =>
    setSeveridades((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(s)) proximo.add(s);
      // Sem nenhuma severidade o grafo some; volta a mostrar todas.
      return proximo.size ? proximo : new Set(CODE_SEVERITY_ORDER);
    });

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const termo = busca.trim().toLowerCase();
    if (!termo) return;
    const achado = arvore.todos.find((n) => n.label.toLowerCase() === termo) ?? arvore.todos.find((n) => n.label.toLowerCase().includes(termo));
    if (!achado) {
      setAvisoBusca(`Nada com "${busca.trim()}" no grafo (confira os filtros de severidade e de falsos-positivos).`);
      return;
    }
    setAvisoBusca("");
    selecionar(achado.id);
    window.setTimeout(() => ref.current?.centralizarEm(achado.id), 50);
  };

  const exportarPng = async () => {
    setExportando(true);
    try {
      const blob = await ref.current?.exportarPng();
      if (blob) baixarArquivo(blob, `security-graph-sast-sca-${layout}.png`);
    } finally {
      setExportando(false);
    }
  };

  if (arvore.todos.length <= 1) {
    return (
      <p className="rounded-container border border-subtle bg-surface p-6 text-sm text-fg-muted">
        Nenhum achado para desenhar{falsosPositivos && !mostrarFP ? " — todos foram triados como falso-positivo" : ""}.
        {falsosPositivos > 0 && !mostrarFP && (
          <Button variant="fantasma" size="sm" className="ml-2" onClick={() => setMostrarFP(true)}>
            Mostrar falsos-positivos
          </Button>
        )}
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-hidden rounded-container border border-subtle" data-tour="code-graph">
        {/* Duas faixas de controles (eram quatro): o palco fica à vista sem rolar. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle bg-surface px-3 py-2">
          <p className="text-xs text-fg-muted">
            Aplicação <span aria-hidden="true">→</span> código (pasta, arquivo) e dependências (pacote) <span aria-hidden="true">→</span> achados
            <span className="font-mono" data-numeric>
              {" "}
              · {visao.nodes.length} nós
            </span>
          </p>
          <form role="search" onSubmit={buscar} className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <label className="sr-only" htmlFor="busca-code-graph">
              Buscar nó no grafo
            </label>
            <input
              id="busca-code-graph"
              list="nomes-code-graph"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Arquivo, pacote, CVE ou achado"
              className="h-touch w-full max-w-xs rounded-control border border-default bg-inset px-3 text-sm text-fg"
            />
            <datalist id="nomes-code-graph">
              {nomesParaBusca.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Button type="submit" variant="secundario" size="sm" rotulo="Buscar">
              <Search className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
        {avisoBusca && (
          <p className="border-b border-subtle bg-surface px-3 py-2 text-xs text-fg-muted" aria-live="polite">
            {avisoBusca}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface px-3 py-2">
          <SeletorDeLayout valor={layout} aoMudar={trocarLayout} />
          <div role="group" aria-label="Severidades no grafo" className="flex flex-wrap items-center gap-1">
            {CODE_SEVERITY_ORDER.map((s) => {
              const ativo = severidades.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => alternarSeveridade(s)}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs transition-colors duration-fast",
                    ativo ? "border-accent bg-accent-surface text-accent-ink" : "border-subtle text-fg-muted hover:bg-hovered",
                  )}
                >
                  {CODE_SEVERITY_LABELS[s]} <span className="font-mono" data-numeric>{contagem[s]}</span>
                </button>
              );
            })}
          </div>
          <Switch checked={mostrarFP} onCheckedChange={setMostrarFP} rotulo={`Falsos-positivos (${falsosPositivos})`} />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="secundario"
              size="sm"
              rotulo="Recentralizar"
              onClick={() => {
                setSelecionadoId(null);
                ref.current?.recentralizar();
              }}
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="secundario"
              size="sm"
              rotulo={posicoes.size ? "Restaurar layout (volta os nós arrastados)" : "Restaurar layout (arraste um nó para mudar)"}
              onClick={() => setPosicoes(new Map())}
              disabled={!posicoes.size}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="secundario" size="sm" rotulo="Exportar PNG" onClick={exportarPng} carregando={exportando}>
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {base.truncado && (
          <p className="border-b border-subtle bg-surface px-3 py-2 text-xs text-fg-muted">
            O grafo mostra até 300 nós; recolha um grupo ou filtre a severidade para ver o resto. A lista de achados tem todos.
          </p>
        )}

        <div className="cg-palco relative">
          <CyberGraph2D
            ref={ref}
            visao={visao}
            animarTroca={`${layout}:${mostrarFP}:${[...severidades].join(",")}`}
            descricao="da aplicação até os achados de código e de dependências"
            selecionadoId={selecionadoId}
            aoClicar={aoClicar}
            aoAbrir={(no: No2D) => selecionar(no.id)}
            aoLimpar={() => setSelecionadoId(null)}
            aoMover={mover}
            minimapa={minimapa}
          />
          <div role="group" aria-label="Zoom" className="absolute bottom-3 right-3 flex flex-col gap-1">
            <Button variant="secundario" size="sm" rotulo="Aproximar" onClick={() => ref.current?.aproximar(1.25)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="secundario" size="sm" rotulo="Afastar" onClick={() => ref.current?.aproximar(1 / 1.25)}>
              <Minus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="secundario" size="sm" rotulo="Ajustar à tela" onClick={() => ref.current?.recentralizar()}>
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

      <aside aria-label="Nó selecionado" className="flex flex-col gap-3 self-start rounded-container border border-subtle bg-surface p-4">
        {!selecionado ? (
          <p className="text-sm text-fg-muted">
            Clique num nó para ver os detalhes. Pastas, arquivos e pacotes abrem e fecham; com um nó em foco, as setas andam pelo grafo.
          </p>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-fg-muted">{ROTULO_TIPO[selecionado.kind]}</p>
              <h3 className="mt-1 break-words text-base font-semibold text-fg">{selecionado.label}</h3>
              {selecionado.risk && (
                <div className="mt-2">
                  <SeverityBadge severidade={badge(selecionado.risk as CodeSeverity)} />
                </div>
              )}
            </div>
            {achadoSelecionado ? (
              <>
                <dl className="flex flex-col gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-fg-muted">{achadoSelecionado.category === "SAST" ? "Local" : "Componente"}</dt>
                    <dd className="break-all font-mono text-xs text-fg">{localDoAchado(achadoSelecionado)}</dd>
                  </div>
                  {achadoSelecionado.category === "SCA" && achadoSelecionado.title !== selecionado.label && (
                    <div>
                      <dt className="text-xs text-fg-muted">Título</dt>
                      <dd className="text-fg">{achadoSelecionado.title}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-fg-muted">Regra</dt>
                    <dd className="break-all font-mono text-xs text-fg">{achadoSelecionado.ruleId}</dd>
                  </div>
                  {achadoSelecionado.fixedVersion && (
                    <div>
                      <dt className="text-xs text-fg-muted">Versão corrigida</dt>
                      <dd className="font-mono text-xs text-fg">{achadoSelecionado.fixedVersion}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-fg-muted">Triagem</dt>
                    <dd className="text-fg">
                      {DAST_TRIAGE_LABELS[achadoSelecionado.triageStatus]}
                      {achadoSelecionado.promotedVulnerability ? " · já é vulnerabilidade" : ""}
                    </dd>
                  </div>
                </dl>
                <Button size="sm" onClick={() => aoVerNaLista(achadoSelecionado.id)} iconeInicio={<List className="h-4 w-4" aria-hidden="true" />}>
                  Ver na lista para triar
                </Button>
              </>
            ) : (
              <p className="text-sm text-fg-muted">
                {selecionado.subtitulo}
                {selecionado.expandivel ? ` · clique no nó para ${expandidos.has(selecionado.id) ? "recolher" : "expandir"}.` : ""}
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
