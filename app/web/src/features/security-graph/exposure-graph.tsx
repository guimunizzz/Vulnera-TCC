/**
 * exposure-graph.tsx
 *
 * O QUE FAZ
 * Grafo 2D da empresa (Exposure Graph): barra com seletor de layout, filtro
 * "só expostas à Internet", Recentralizar, Restaurar layout e Exportar PNG;
 * o palco com zoom e minimapa. A seleção vem de fora (a página divide com o
 * mapa 3D e com o painel).
 *
 * POR QUE EXISTE
 * Responde "onde está o risco da empresa e o que ele tem em comum": a mesma
 * categoria OWASP aberta em várias aplicações aparece como um nó só, ligado a
 * todas. Reusa o desenho, os layouts e o teclado do CyberGraph do scan.
 *
 * QUEM USA
 * `exposure-graph-page.tsx`.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, LocateFixed, Map as MapIcon, Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import type { ExposureGraph } from "../../types/exposure-graph.types";
import { CyberGraph2D, type CyberGraph2DHandle } from "./cyber-graph-2d";
import { baixarArquivo } from "./exportar";
import { montarVisaoEmpresa } from "./exposure-graph-model";
import type { No2D, Posicoes2D } from "./graph-2d-layout";
import { aplicarLayout, type LayoutId } from "./graph-layouts";
import { SeletorDeLayout } from "./seletor-de-layout";
import { useLayoutSalvo } from "./use-layout-salvo";
import "./cyber-graph.css";

export function ExposureGraph2D({
  dados,
  nomeEmpresa,
  selecionadoId,
  aoSelecionar,
}: {
  dados: ExposureGraph;
  nomeEmpresa: string;
  selecionadoId: string | null;
  aoSelecionar(id: string | null): void;
}) {
  // Estrela por padrão: com uma empresa no centro, as aplicações viram hubs e as categorias se repetem em volta.
  const [layout, setLayout] = useLayoutSalvo("vulnera:exposure-graph-layout", "organico");
  const [apenasExpostas, setApenasExpostas] = useState(false);
  const [posicoes, setPosicoes] = useState<Posicoes2D>(() => new Map());
  const [minimapa, setMinimapa] = useState(false);
  const [exportando, setExportando] = useState(false);
  const ref = useRef<CyberGraph2DHandle>(null);

  const base = useMemo(() => montarVisaoEmpresa(dados, nomeEmpresa, apenasExpostas), [dados, nomeEmpresa, apenasExpostas]);
  const noLayout = useMemo(() => aplicarLayout(base, layout), [base, layout]);
  const visao = useMemo(() => aplicarLayout(noLayout, "hierarquico", posicoes), [noLayout, posicoes]);
  const mover = useCallback((id: string, x: number, y: number) => setPosicoes((atual) => new Map(atual).set(id, { x, y })), []);

  const trocarLayout = (novo: LayoutId) => {
    if (novo === layout) return;
    setPosicoes(new Map());
    setLayout(novo);
    window.setTimeout(() => ref.current?.recentralizar(), 0);
  };

  const exportarPng = async () => {
    setExportando(true);
    try {
      const blob = await ref.current?.exportarPng();
      if (blob) baixarArquivo(blob, `exposure-graph-${layout}.png`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="min-w-0">
      <div className="overflow-hidden rounded-container border border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle bg-surface px-3 py-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
            <span>
              Empresa <span aria-hidden="true">→</span> Aplicações <span aria-hidden="true">→</span> Categorias OWASP abertas
            </span>
            <span className="font-mono" data-numeric>
              · {visao.nodes.length} nós
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Switch checked={apenasExpostas} onCheckedChange={setApenasExpostas} rotulo="Só expostas à Internet" />
            <Button
              variant="secundario"
              size="sm"
              onClick={() => {
                aoSelecionar(null);
                ref.current?.recentralizar();
              }}
              className="whitespace-nowrap"
              iconeInicio={<LocateFixed className="h-4 w-4" aria-hidden="true" />}
            >
              Recentralizar
            </Button>
            <Button
              variant="secundario"
              size="sm"
              onClick={() => setPosicoes(new Map())}
              disabled={!posicoes.size}
              className="whitespace-nowrap"
              title={posicoes.size ? "Volta os nós arrastados para a posição do layout" : "Arraste um nó para mudar o layout"}
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
              iconeInicio={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              Exportar PNG
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface px-3 py-2">
          <SeletorDeLayout valor={layout} aoMudar={trocarLayout} />
        </div>
        <div className="cg-palco relative">
          <CyberGraph2D
            ref={ref}
            visao={visao}
            animarTroca={`${layout}:${apenasExpostas}`}
            descricao="da empresa até as categorias OWASP com vulnerabilidades abertas"
            selecionadoId={selecionadoId}
            aoClicar={(no: No2D) => aoSelecionar(no.id)}
            aoAbrir={(no: No2D) => aoSelecionar(no.id)}
            aoLimpar={() => aoSelecionar(null)}
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
      <p className="mt-2 text-sm text-fg-muted">
        Clique numa aplicação ou categoria para destacar o que está ligado a ela. Arraste um nó para reposicioná-lo e o fundo para mover a vista;
        com um nó em foco, as setas andam pelo grafo.
      </p>
    </div>
  );
}
