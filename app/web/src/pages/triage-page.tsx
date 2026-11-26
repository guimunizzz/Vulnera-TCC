/**
 * triage-page.tsx
 *
 * O QUE FAZ
 * A caixa de triagem única (ADR-062): tudo que espera triagem no DAST, no
 * SAST/SCA e no Threat Intel numa lista só, da mais grave para a mais nova,
 * triada pelo teclado — j/k para andar, a/f/r para decidir, u para desfazer,
 * Enter para abrir no contexto, n para anotar. O mouse faz o mesmo pelos
 * botões do item ativo.
 *
 * COMO DECIDE
 * Otimista: o item sai da fila na hora e o próximo assume; a chamada vai pela
 * rota de triagem DA FONTE (`triageApi.triar`). Se ela falhar, o item volta e
 * o erro aparece. "u" desfaz a última decisão (volta para NEW na fonte).
 *
 * QUEM USA
 * `App.tsx` (rota `/triagem`) e o item "Triagem" da navegação.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CornerDownLeft, Inbox, Keyboard, ShieldOff, Undo2, XCircle } from "lucide-react";
import { Breadcrumb } from "../components/ui/navigation";
import { Alert } from "../components/ui";
import { Button } from "../components/ui/button";
import { Badge, SeverityBadge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Textarea } from "../components/ui/textarea";
import { useApiError } from "../hooks/use-api-error";
import { triageApi } from "../lib/api/triage.api";
import { cn } from "../lib/cn";
import { haQuanto } from "../lib/threat-intel";
import {
  decidir,
  desfazer,
  filaInicial,
  mover,
  reverterDecisao,
  ROTULO_DA_DECISAO,
  teclaParaAcao,
  type Decisao,
  type EstadoDaFila,
} from "../lib/fila-de-triagem";
import type { FonteDeTriagem } from "../types/triage.types";

const ROTULO_DA_FONTE: Record<FonteDeTriagem, string> = { DAST: "DAST", CODIGO: "SAST/SCA", THREAT_INTEL: "Threat Intel" };
const FONTES: FonteDeTriagem[] = ["DAST", "CODIGO", "THREAT_INTEL"];

const ATALHOS: Array<[string, string]> = [
  ["j / ↓", "próximo"],
  ["k / ↑", "anterior"],
  ["a", "confirmar"],
  ["f", "falso positivo"],
  ["r", "risco aceito"],
  ["u", "desfazer a última"],
  ["Enter", "abrir no contexto"],
  ["n", "escrever nota (vai com a próxima decisão)"],
  ["?", "mostrar ou esconder os atalhos"],
];

export function TriagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mensagemDeErro = useApiError();
  const caixa = useQuery({ queryKey: ["triage", "inbox"], queryFn: triageApi.caixa, refetchOnWindowFocus: false });

  const [fila, setFila] = useState<EstadoDaFila>(() => filaInicial([]));
  const [filtro, setFiltro] = useState<FonteDeTriagem | null>(null);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ajuda, setAjuda] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const campoDeNota = useRef<HTMLTextAreaElement>(null);
  const filaRef = useRef(fila);
  filaRef.current = fila;

  // A fila nasce (e renasce num "atualizar") da resposta da caixa, já no filtro.
  useEffect(() => {
    if (caixa.data) setFila(filaInicial(caixa.data.itens.filter((i) => !filtro || i.fonte === filtro)));
  }, [caixa.data, filtro]);

  const ativo = fila.itens[fila.ativo];

  // A fila abre pronta para o teclado. `autoFocus` não serve: o React só o aplica a
  // input/button/select/textarea. Só puxa o foco se ele estiver solto no body.
  const temItens = fila.itens.length > 0;
  useEffect(() => {
    if (temItens && document.activeElement === document.body) lista.current?.focus({ preventScroll: true });
  }, [temItens]);

  // O item ativo fica à vista quando a pessoa anda com o teclado.
  useEffect(() => {
    if (!ativo) return;
    lista.current?.querySelector(`[data-item="${CSS.escape(ativo.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const aplicarDecisao = useCallback(
    async (decisao: Decisao) => {
      const { estado, decidido } = decidir(filaRef.current, decisao);
      if (!decidido) return;
      const notaUsada = nota.trim() || null;
      setFila(estado);
      setNota("");
      setErro(null);
      setAviso(`${ROTULO_DA_DECISAO[decisao]}: ${decidido.item.titulo}. Pressione u para desfazer.`);
      try {
        await triageApi.triar(decidido.item.fonte, decidido.item.id, decisao, notaUsada);
        // A tela da fonte também precisa ver a decisão nova.
        void queryClient.invalidateQueries({ queryKey: decidido.item.fonte === "DAST" ? ["dast"] : decidido.item.fonte === "CODIGO" ? ["code-imports"] : ["threat-intel"] });
      } catch (e) {
        setFila((atual) => reverterDecisao(atual, decidido));
        setErro(`Não foi possível triar "${decidido.item.titulo}": ${mensagemDeErro(e)}`);
        setAviso("");
      }
    },
    [nota, mensagemDeErro, queryClient],
  );

  const desfazerUltima = useCallback(async () => {
    const { estado, desfeito } = desfazer(filaRef.current);
    if (!desfeito) return;
    setFila(estado);
    setAviso(`Desfeito: ${desfeito.item.titulo} voltou para a fila.`);
    try {
      await triageApi.triar(desfeito.item.fonte, desfeito.item.id, "NEW", null);
    } catch (e) {
      setErro(`Não foi possível desfazer: ${mensagemDeErro(e)}`);
    }
  }, [mensagemDeErro]);

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement;
    // Esc no campo de nota volta para a fila.
    if (alvo === campoDeNota.current && e.key === "Escape") {
      lista.current?.focus();
      return;
    }
    // Atalho só fora de controles: num botão, Enter é o clique dele; num campo, é texto.
    const emControle = alvo !== lista.current && !!alvo.closest("button, a, input, textarea, select");
    const acao = teclaParaAcao(e, emControle);
    if (!acao) return;
    e.preventDefault();
    if (acao.tipo === "mover") setFila((f) => mover(f, acao.delta));
    else if (acao.tipo === "decidir") void aplicarDecisao(acao.decisao);
    else if (acao.tipo === "desfazer") void desfazerUltima();
    else if (acao.tipo === "abrir" && ativo) navigate(ativo.link);
    else if (acao.tipo === "nota") campoDeNota.current?.focus();
    else if (acao.tipo === "ajuda") setAjuda((v) => !v);
  };

  /** Clique num botão de decisão: age e devolve o foco à fila, para o teclado seguir valendo. */
  const peloBotao = (acao: () => void) => () => {
    acao();
    lista.current?.focus();
  };

  const contagem = useMemo(() => caixa.data?.porFonte ?? { DAST: 0, CODIGO: 0, THREAT_INTEL: 0 }, [caixa.data]);
  // Fonte no corte tem "pelo menos" isso: "200+" não finge um total exato.
  const limite = caixa.data?.limitePorFonte ?? Infinity;
  const rotuloDaContagem = (n: number) => (n >= limite ? `${n}+` : String(n));
  const algumaNoCorte = FONTES.some((f) => contagem[f] >= limite);

  return (
    <div className="space-y-5" onKeyDown={aoTeclar}>
      <Breadcrumb itens={[{ rotulo: "Início", para: "/dashboard" }, { rotulo: "Triagem" }]} />

      <header className="atmosfera-veu flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Caixa de entrada</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">Triagem</h1>
          <p className="mt-1 max-w-prose text-sm text-fg-secondary">
            O que espera triagem no DAST, no SAST/SCA e no Threat Intel, do mais grave para o mais novo. Decida pelo teclado: a confirma, f falso
            positivo, r risco aceito, u desfaz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrar por fonte" className="inline-flex flex-wrap gap-1 rounded-control border border-subtle bg-inset p-1">
            {[null, ...FONTES].map((f) => (
              <button
                key={f ?? "todas"}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "alvo-estendido rounded-control px-3 py-1 text-xs font-semibold transition-colors",
                  filtro === f ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {f ? ROTULO_DA_FONTE[f] : "Todas"}
                <span className="ml-1 font-mono" data-numeric>
                  {f ? rotuloDaContagem(contagem[f]) : algumaNoCorte ? `${caixa.data?.total ?? 0}+` : caixa.data?.total ?? 0}
                </span>
              </button>
            ))}
          </div>
          <Button variant="fantasma" size="sm" aria-pressed={ajuda} onClick={() => setAjuda((v) => !v)} iconeInicio={<Keyboard className="h-4 w-4" />}>
            Atalhos
          </Button>
          <Button variant="secundario" size="sm" onClick={() => void caixa.refetch()} carregando={caixa.isFetching}>
            Atualizar
          </Button>
        </div>
      </header>

      {ajuda && (
        <section aria-label="Atalhos de teclado" className="rounded-container border border-subtle bg-surface p-4 shadow-raised">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {ATALHOS.map(([tecla, acao]) => (
              <div key={tecla} className="flex items-center gap-2">
                <dt>
                  <kbd className="rounded border border-subtle bg-inset px-[0.375rem] font-mono text-xs text-fg">{tecla}</kbd>
                </dt>
                <dd className="text-fg-secondary">{acao}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {erro && (
        <Alert tom="perigo" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}
      {algumaNoCorte && (
        <p className="text-xs text-fg-muted">
          Mostrando os {limite} mais graves e recentes de cada fonte. Decida e clique em Atualizar para trazer os próximos.
        </p>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {aviso}
      </p>

      {caixa.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : caixa.isError ? (
        <ErrorState descricao={mensagemDeErro(caixa.error)} aoTentarNovamente={() => void caixa.refetch()} />
      ) : fila.itens.length === 0 ? (
        <EmptyState
          icone={<Inbox className="h-6 w-6" aria-hidden="true" />}
          titulo={fila.historico.length ? "Fila zerada" : "Nada esperando triagem"}
          descricao={
            fila.historico.length
              ? `Você triou ${fila.historico.length} ${fila.historico.length === 1 ? "item" : "itens"} nesta sessão. Pressione u para desfazer a última.`
              : "Quando um scan, uma importação ou o Threat Intel trouxer algo novo, aparece aqui."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div
            ref={lista}
            role="listbox"
            tabIndex={0}
            aria-label={`Fila de triagem: ${fila.itens.length} itens. j e k andam, a confirma, f falso positivo, r risco aceito, u desfaz, Enter abre.`}
            aria-activedescendant={ativo ? `triagem-${ativo.id}` : undefined}
            className="min-w-0 space-y-2 rounded-container outline-none focus-visible:ring-2 focus-visible:ring-[oklch(var(--color-focus-ring))]"
          >
            {fila.itens.map((item, i) => {
              const eAtivo = i === fila.ativo;
              return (
                <div
                  key={item.id}
                  id={`triagem-${item.id}`}
                  data-item={item.id}
                  role="option"
                  aria-selected={eAtivo}
                  onClick={() => setFila((f) => ({ ...f, ativo: i }))}
                  className={cn(
                    "cursor-pointer rounded-control border p-3 transition-colors",
                    eAtivo ? "border-accent bg-accent-surface" : "border-subtle bg-surface hover:border-strong",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severidade={item.severidade} />
                        <Badge tom="neutro">{ROTULO_DA_FONTE[item.fonte]}</Badge>
                        <span className="text-xs text-fg-muted">{haQuanto(item.criadoEm)}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-fg">{item.titulo}</p>
                      <p className="truncate font-mono text-xs text-fg-secondary" title={item.contexto}>
                        {item.contexto}
                      </p>
                      {eAtivo && item.detalhe && <p className="mt-2 text-sm text-fg-secondary [overflow-wrap:anywhere]">{item.detalhe}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside aria-label="Decisão do item ativo" className="space-y-3 rounded-container border border-subtle bg-surface p-4 shadow-raised lg:sticky lg:top-4 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
              Item {fila.ativo + 1} de {fila.itens.length}
            </p>
            {ativo && <p className="text-sm font-semibold text-fg">{ativo.titulo}</p>}
            <Textarea
              ref={campoDeNota}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={2000}
              rows={2}
              maxLinhas={5}
              placeholder="Nota (opcional) — vai com a próxima decisão. Esc volta para a fila."
              aria-label="Nota da triagem"
            />
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={peloBotao(() => void aplicarDecisao("CONFIRMED"))} iconeInicio={<Check className="h-4 w-4" />} disabled={!ativo}>
                Confirmar <kbd className="ml-auto font-mono text-xs opacity-80">a</kbd>
              </Button>
              <Button variant="secundario" onClick={peloBotao(() => void aplicarDecisao("FALSE_POSITIVE"))} iconeInicio={<XCircle className="h-4 w-4" />} disabled={!ativo}>
                Falso positivo <kbd className="ml-auto font-mono text-xs opacity-80">f</kbd>
              </Button>
              <Button variant="secundario" onClick={peloBotao(() => void aplicarDecisao("ACCEPTED_RISK"))} iconeInicio={<ShieldOff className="h-4 w-4" />} disabled={!ativo}>
                Risco aceito <kbd className="ml-auto font-mono text-xs opacity-80">r</kbd>
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="fantasma" size="sm" onClick={() => ativo && navigate(ativo.link)} iconeInicio={<CornerDownLeft className="h-4 w-4" />} disabled={!ativo}>
                  Abrir
                </Button>
                <Button variant="fantasma" size="sm" onClick={peloBotao(() => void desfazerUltima())} iconeInicio={<Undo2 className="h-4 w-4" />} disabled={!fila.historico.length}>
                  Desfazer
                </Button>
              </div>
            </div>
            <p className="text-xs text-fg-muted">
              A decisão vai para o módulo de origem, com a regra dele. Promover a vulnerabilidade continua na tela do módulo (Enter abre).
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
