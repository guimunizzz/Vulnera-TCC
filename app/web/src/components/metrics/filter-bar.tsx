/**
 * filter-bar.tsx
 *
 * O QUE FAZ
 * A barra de filtros do dashboard: presets de período, multi-seleção com
 * contagem, busca com debounce, interruptor de comparação e os chips do que
 * está ativo.
 *
 * PRINCÍPIOS QUE ESTA BARRA SEGUE (CP6)
 *   - Preset em DESTAQUE, calendário escondido atrás de "Personalizado":
 *     preset é o que se usa 95% do tempo.
 *   - Contagem por opção ("HIGH (12)") refletindo os OUTROS filtros já
 *     aplicados — um número que não reage aos demais filtros é pior que
 *     nenhum, porque promete resultados que não existem.
 *   - Chips removíveis um a um + "limpar tudo": a pessoa precisa VER o que
 *     está filtrando sem abrir menu.
 *   - Tudo vai para a URL (ver `use-filtros-metricas.ts`).
 *
 * ACESSIBILIDADE
 *   - Presets são um `radiogroup` (escolha exclusiva), com setas entre opções.
 *   - Cada chip é um botão com `aria-label` completo ("Remover filtro
 *     severidade Alta") — "×" sozinho não diz o que remove.
 *   - A contagem de resultados é anunciada por `aria-live` ao mudar.
 *
 * QUEM USA
 * `application-dashboard-page.tsx`.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Button, Input, Popover, Switch, ROTULO_SEVERIDADE, type Severidade } from "../ui";
import { PRESETS, type ControlesDeFiltro, type IdPreset } from "../../hooks/use-filtros-metricas";
import type { ContagemPorChave } from "../../types/metrics.types";

const SEVERIDADES: Severidade[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
const STATUS: { valor: string; rotulo: string }[] = [
  { valor: "OPEN", rotulo: "Aberto" },
  { valor: "IN_PROGRESS", rotulo: "Em andamento" },
  { valor: "FIXED", rotulo: "Corrigido" },
  { valor: "CLOSED", rotulo: "Fechado" },
];
const OWASP = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"];

const DEBOUNCE_MS = 300;

export interface FilterBarProps {
  controles: ControlesDeFiltro;
  /** Contagens por severidade e por OWASP, já refletindo os outros filtros. */
  contagens?: { severidade?: ContagemPorChave; owasp?: ContagemPorChave };
  /** Total de findings no recorte — anunciado por `aria-live`. */
  totalNoRecorte?: number;
  carregando?: boolean;
}

export function FilterBar({ controles, contagens, totalNoRecorte, carregando }: FilterBarProps) {
  const { filtros, quantidadeAtiva, definirPreset, alternarValor, definirBusca, alternarComparacao, removerFiltro, limparTudo } =
    controles;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorDePeriodo preset={filtros.preset} de={filtros.de} ate={filtros.ate} aoDefinir={definirPreset} />

        <MultiSelecao
          rotulo="Severidade"
          opcoes={SEVERIDADES.map((s) => ({ valor: s, rotulo: ROTULO_SEVERIDADE[s], contagem: contagens?.severidade?.[s] }))}
          selecionados={filtros.severidades}
          aoAlternar={(v) => alternarValor("severidades", v)}
        />

        <MultiSelecao
          rotulo="Status"
          opcoes={STATUS.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
          selecionados={filtros.status}
          aoAlternar={(v) => alternarValor("status", v)}
        />

        <MultiSelecao
          rotulo="OWASP"
          opcoes={OWASP.map((o) => ({ valor: o, rotulo: o, contagem: contagens?.owasp?.[o] }))}
          selecionados={filtros.owasp}
          aoAlternar={(v) => alternarValor("owasp", v)}
        />

        <BuscaComDebounce valorInicial={filtros.busca} aoMudar={definirBusca} />

        <Switch
          rotulo="Comparar"
          checked={filtros.comparar}
          onCheckedChange={alternarComparacao}
          className="min-h-0 gap-2"
        />
      </div>

      {/* Contagem anunciada. `aria-live` num elemento que já existe no DOM —
          criado junto com o conteúdo, não seria anunciado. */}
      <span className="sr-only" role="status" aria-live="polite">
        {carregando ? "Atualizando resultados" : totalNoRecorte !== undefined ? `${totalNoRecorte} findings no recorte atual` : ""}
      </span>

      {quantidadeAtiva > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted">Filtros ativos:</span>

          {filtros.severidades.map((s) => (
            <Chip
              key={`sev-${s}`}
              rotulo={`Severidade: ${ROTULO_SEVERIDADE[s as Severidade] ?? s}`}
              aoRemover={() => removerFiltro("severidades", s)}
            />
          ))}
          {filtros.status.map((s) => (
            <Chip
              key={`st-${s}`}
              rotulo={`Status: ${STATUS.find((x) => x.valor === s)?.rotulo ?? s}`}
              aoRemover={() => removerFiltro("status", s)}
            />
          ))}
          {filtros.owasp.map((o) => (
            <Chip key={`ow-${o}`} rotulo={`OWASP: ${o}`} aoRemover={() => removerFiltro("owasp", o)} />
          ))}
          {filtros.busca && <Chip rotulo={`Busca: "${filtros.busca}"`} aoRemover={() => removerFiltro("busca")} />}

          <Button variant="sutil" size="sm" onClick={limparTudo}>
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Período
   ========================================================================== */

function SeletorDePeriodo({
  preset,
  de,
  ate,
  aoDefinir,
}: {
  preset: IdPreset;
  de: string | null;
  ate: string | null;
  aoDefinir: (p: IdPreset, de?: string, ate?: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const indice = PRESETS.findIndex((p) => p.id === preset);

  return (
    <div className="flex items-center gap-1">
      <div
        role="radiogroup"
        aria-label="Período"
        className="inline-flex items-center gap-1 rounded-control border border-subtle bg-inset p-1"
        onKeyDown={(e) => {
          let alvo = -1;
          if (e.key === "ArrowRight") alvo = (Math.max(indice, 0) + 1) % PRESETS.length;
          else if (e.key === "ArrowLeft") alvo = (Math.max(indice, 0) - 1 + PRESETS.length) % PRESETS.length;
          if (alvo < 0) return;
          e.preventDefault();
          aoDefinir(PRESETS[alvo].id);
          refs.current[alvo]?.focus();
        }}
      >
        {PRESETS.map((p, i) => {
          const ativo = p.id === preset;
          return (
            <button
              key={p.id}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={ativo ? 0 : -1}
              onClick={() => aoDefinir(p.id)}
              className={cn(
                "alvo-estendido rounded-control px-3 py-1 text-xs font-medium transition-colors duration-fast",
                ativo ? "bg-raised text-fg shadow-raised" : "text-fg-muted hover:text-fg",
              )}
            >
              {p.rotulo}
            </button>
          );
        })}
      </div>

      {/* O calendário fica atrás de um popover porque intervalo personalizado é
          exceção — deixá-lo sempre visível competiria com os presets, que são
          o caminho comum. */}
      <Popover
        gatilho={
          <Button variant={preset === "custom" ? "secundario" : "sutil"} size="sm">
            {preset === "custom" && de ? `${formatarData(de)} – ${ate ? formatarData(ate) : "hoje"}` : "Personalizado"}
          </Button>
        }
      >
        <IntervaloPersonalizado de={de} ate={ate} aoAplicar={(d, a) => aoDefinir("custom", d, a)} />
      </Popover>
    </div>
  );
}

const formatarData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const paraInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function IntervaloPersonalizado({
  de,
  ate,
  aoAplicar,
}: {
  de: string | null;
  ate: string | null;
  aoAplicar: (de: string, ate: string) => void;
}) {
  const [inicio, setInicio] = useState(paraInput(de));
  const [fim, setFim] = useState(paraInput(ate) || new Date().toISOString().slice(0, 10));
  const invalido = Boolean(inicio && fim && inicio > fim);

  return (
    <div className="flex w-64 flex-col gap-3">
      <p className="text-sm font-medium text-fg">Intervalo personalizado</p>
      {/* `<input type="date">` nativo: traz o calendário do sistema, é
          navegável por teclado e é localizado pelo próprio navegador — um
          calendário próprio custaria 200 linhas para ficar pior. */}
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        De
        <Input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Até
        <Input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
      </label>
      {invalido && <p className="text-xs text-danger-ink">A data inicial precisa vir antes da final.</p>}
      <Button
        size="sm"
        disabled={!inicio || !fim || invalido}
        onClick={() => aoAplicar(new Date(`${inicio}T00:00:00Z`).toISOString(), new Date(`${fim}T23:59:59Z`).toISOString())}
      >
        Aplicar
      </Button>
    </div>
  );
}

/* ==========================================================================
   Multi-seleção
   ========================================================================== */

function MultiSelecao({
  rotulo,
  opcoes,
  selecionados,
  aoAlternar,
}: {
  rotulo: string;
  opcoes: { valor: string; rotulo: string; contagem?: number }[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
}) {
  return (
    <Popover
      gatilho={
        <Button variant={selecionados.length > 0 ? "secundario" : "sutil"} size="sm">
          {rotulo}
          {selecionados.length > 0 && (
            <span className="ml-1 rounded-full bg-accent px-2 text-xs text-accent-fg" data-numeric>
              {selecionados.length}
            </span>
          )}
        </Button>
      }
    >
      <fieldset className="flex w-56 flex-col gap-1">
        <legend className="mb-2 text-sm font-medium text-fg">{rotulo}</legend>
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className="flex min-h-touch cursor-pointer items-center gap-3 rounded-control px-2 text-sm transition-colors duration-fast hover:bg-hovered"
          >
            <input
              type="checkbox"
              checked={selecionados.includes(o.valor)}
              onChange={() => aoAlternar(o.valor)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="grid h-4 w-4 shrink-0 place-items-center rounded-control border border-strong peer-checked:border-accent peer-checked:bg-accent peer-checked:[&>svg]:opacity-100"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3 opacity-0 text-accent-fg" fill="none">
                <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex-1 text-fg">{o.rotulo}</span>
            {o.contagem !== undefined && (
              <span className="font-mono text-xs text-fg-muted" data-numeric>
                {o.contagem}
              </span>
            )}
          </label>
        ))}
      </fieldset>
    </Popover>
  );
}

/* ==========================================================================
   Busca
   ========================================================================== */

/**
 * Busca com debounce de 300ms.
 *
 * O estado local existe para o campo responder à digitação NA HORA; só a
 * escrita na URL é adiada. Sem o estado local, cada tecla dispararia uma
 * navegação e o cursor pularia; sem o debounce, cada tecla dispararia uma
 * requisição.
 */
function BuscaComDebounce({ valorInicial, aoMudar }: { valorInicial: string; aoMudar: (v: string) => void }) {
  const [texto, setTexto] = useState(valorInicial);
  const primeiraRenderizacao = useRef(true);

  // Ressincroniza quando a URL muda por fora (voltar do navegador, chip
  // removido, "limpar tudo").
  useEffect(() => {
    setTexto(valorInicial);
  }, [valorInicial]);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const t = window.setTimeout(() => aoMudar(texto), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // `aoMudar` muda a cada render (depende de `params`); incluí-lo reiniciaria
    // o temporizador em toda renderização e o debounce nunca dispararia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <Input
      type="search"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      placeholder="Buscar por título…"
      aria-label="Buscar findings por título ou descrição"
      className="h-8 w-48 text-xs"
      prefixo={
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      }
    />
  );
}

/* ==========================================================================
   Chip
   ========================================================================== */

function Chip({ rotulo, aoRemover }: { rotulo: string; aoRemover: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-surface py-1 pl-3 pr-1 text-xs text-accent-ink">
      {rotulo}
      <button
        type="button"
        onClick={aoRemover}
        // O rótulo completo é o que diferencia dez chips idênticos na leitura.
        aria-label={`Remover filtro ${rotulo}`}
        className="alvo-estendido grid h-5 w-5 place-items-center rounded-full transition-colors duration-fast hover:bg-hovered"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
          <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
