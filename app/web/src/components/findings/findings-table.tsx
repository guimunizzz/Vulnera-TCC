/**
 * findings-table.tsx
 *
 * O QUE FAZ
 * 🎯 A implementação de listagem de findings do sistema. Não "uma" — A.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Antes da FEAT-09 havia duas listagens de finding, com regras diferentes. A
 * aba do ProjectDetail puxava todos os findings do projeto e filtrava, ordenava
 * e paginava EM MEMÓRIA, com três `<select>` nativos e uma `<table>` escrita à
 * mão que não usava o design system. Os dashboards chamavam o endpoint cru e
 * resumiam o array. Nenhuma das duas tinha busca, contagem por opção ou URL
 * compartilhável — e corrigir qualquer coisa exigia lembrar das duas.
 *
 * Agora é um componente, configurado por contexto: a página global passa
 * `syncToUrl`; a aba do projeto passa `lockedFilters={{ projectId }}` e esconde
 * as colunas que seriam sempre iguais. Ver ADR-028.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 *   - A tabela é a `Table` do design system: `<table>` nativa, `<caption>`,
 *     `scope` e `aria-sort`. Ordenação CONTROLADA (o servidor ordena) —
 *     ordenar no cliente reordenaria só as 25 linhas da página.
 *   - Linha inteira clicável E operável por teclado: `tabIndex=0`, Enter e
 *     Espaço, com `aria-label` que identifica o finding. Ctrl/⌘+clique abre em
 *     nova aba, como um link.
 *   - Os três estados — carregando, vazio e ERRO — são visualmente distintos.
 *     "Nenhum resultado" e "a busca falhou" significam coisas opostas e não
 *     podem se parecer.
 *   - A contagem do recorte é anunciada por `aria-live="polite"`.
 *   - Chip inválido leva `role="status"` com o motivo em texto, não só a cor.
 * ==========================================================================
 *
 * QUEM USA
 * `pages/findings-page.tsx` e a aba Findings do `pages/project-detail-page.tsx`.
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Table, type ColunaTabela } from "../ui/table";
import { SeverityBadge, StatusBadge, ROTULO_SEVERIDADE, type Severidade } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover } from "../ui/popover";
import { EmptyState, ErrorState } from "../ui/empty-state";
import { Pagination } from "../ui/navigation";
import { Skeleton } from "../ui/card";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { useFindings } from "../../hooks/use-findings";
import { useFindingsFilters, type FindingFilters } from "../../hooks/use-findings-filters";
import {
  aplicarSugestao,
  tokenLabel,
  SEVERIDADES,
  STATUS,
  type ContextoDeSugestao,
  type FilterField,
} from "../../lib/finding-query";
import { QuerySuggestions, type EntidadesSugeriveis, type Sugestao } from "./query-suggestions";
import { useFindingsExport } from "../../hooks/use-findings-export";
import { useEntidadesSugeriveis } from "../../hooks/use-entidades-sugeriveis";
import { Alert } from "../ui/alert";
import { OWASP_CATEGORIES, OWASP_LABELS, type OwaspCategory } from "../../types/vulnerability.types";
import type { FacetCounts, FindingListItem } from "../../types/vulnerability.types";

export type ColumnKey = "title" | "severity" | "status" | "owasp" | "project" | "application" | "company" | "createdAt";

export interface FindingsTableProps {
  /** Filtros fixos, não editáveis pelo usuário. Ex.: `{ projectId: "abc" }`. */
  lockedFilters?: Partial<FindingFilters>;
  /** Campos que não aparecem na barra de filtros (já travados pelo contexto). */
  hiddenFields?: FilterField[];
  /** Colunas a ocultar. Ex.: em ProjectDetail, esconder a coluna Projeto. */
  hiddenColumns?: ColumnKey[];
  /** Sincroniza estado com a URL. `true` na página global, `false` na aba do projeto. */
  syncToUrl?: boolean;
  /** Para onde navegar ao clicar numa linha. Padrão: `/findings/:id`. */
  onSelect?: (findingId: string) => void;
  /** Conteúdo à direita da barra — ex.: o botão "Novo finding". */
  acoes?: ReactNode;
  /**
   * Oferece o botão de exportar CSV.
   *
   * Desligado por padrão: exportar faz sentido onde a pessoa montou um recorte
   * (a página global), não em toda tabela que exista. Ligar é uma palavra.
   */
  exportavel?: boolean;
}

const ROTULO_STATUS: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  FIXED: "Corrigido",
  CLOSED: "Fechado",
};

/** Mapeia a coluna clicada para o campo que o backend sabe ordenar. */
const CAMPO_DE_ORDENACAO: Partial<Record<ColumnKey, "createdAt" | "severity" | "cvssScore" | "title" | "status">> = {
  title: "title",
  severity: "severity",
  status: "status",
  createdAt: "createdAt",
};

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export function FindingsTable({
  lockedFilters,
  hiddenFields = [],
  hiddenColumns = [],
  syncToUrl = false,
  onSelect,
  acoes,
  exportavel = false,
}: FindingsTableProps) {
  const navigate = useNavigate();
  const { reduzido } = useMotion();
  const filtros = useFindingsFilters(Boolean(syncToUrl), lockedFilters);
  const { dados, carregando, atualizando, erro, recarregar } = useFindings(filtros.paramsDaApi);

  const facetas = dados?.facets;
  const linhas = dados?.data ?? [];
  const total = dados?.pagination.total ?? 0;

  const abrir = useCallback(
    (finding: FindingListItem) => {
      if (onSelect) {
        onSelect(finding.id);
        return;
      }
      navigate(`/findings/${finding.id}`);
    },
    [onSelect, navigate],
  );

  const campoVisivel = useCallback((field: FilterField) => !hiddenFields.includes(field), [hiddenFields]);
  const entidades = useEntidadesSugeriveis(hiddenFields);
  const exportacao = useFindingsExport(filtros.paramsDaApi, filtros.quantidadeAtiva);
  const colunaVisivel = useCallback((key: ColumnKey) => !hiddenColumns.includes(key), [hiddenColumns]);

  /* --- colunas ------------------------------------------------------------ */

  const colunas = useMemo<ColunaTabela<FindingListItem>[]>(() => {
    const todas: (ColunaTabela<FindingListItem> & { chave: ColumnKey })[] = [
      {
        chave: "title",
        id: "title",
        cabecalho: "Finding",
        ordenavel: true,
        celula: (f) => <span className="font-medium text-fg">{f.title}</span>,
      },
      {
        chave: "severity",
        id: "severity",
        cabecalho: "Severidade",
        ordenavel: true,
        celula: (f) => <SeverityBadge severidade={f.severityFinal} cvss={f.cvssScore} />,
      },
      {
        chave: "status",
        id: "status",
        cabecalho: "Status",
        ordenavel: true,
        celula: (f) => <StatusBadge status={f.status} />,
      },
      {
        chave: "owasp",
        id: "owasp",
        cabecalho: "OWASP",
        ocultarEmTelaEstreita: true,
        celula: (f) => (
          <span className="text-fg-muted" title={OWASP_LABELS[f.owaspCategory as OwaspCategory]}>
            {f.owaspCategory}
          </span>
        ),
      },
      {
        chave: "project",
        id: "project",
        cabecalho: "Projeto",
        ocultarEmTelaEstreita: true,
        celula: (f) => <span className="text-fg-muted">{f.projectName}</span>,
      },
      {
        chave: "application",
        id: "application",
        cabecalho: "Aplicação",
        ocultarEmTelaEstreita: true,
        celula: (f) => <span className="text-fg-muted">{f.applicationName}</span>,
      },
      {
        chave: "company",
        id: "company",
        cabecalho: "Empresa",
        ocultarEmTelaEstreita: true,
        celula: (f) => <span className="text-fg-muted">{f.companyName}</span>,
      },
      {
        chave: "createdAt",
        id: "createdAt",
        cabecalho: "Criado em",
        ordenavel: true,
        alinhamento: "direita",
        ocultarEmTelaEstreita: true,
        celula: (f) => (
          <span className="text-fg-muted" data-numeric>
            {dataCurta(f.createdAt)}
          </span>
        ),
      },
    ];

    return todas.filter((c) => colunaVisivel(c.chave));
  }, [colunaVisivel]);

  const ordemDaTabela = useMemo(() => {
    const coluna = (Object.entries(CAMPO_DE_ORDENACAO).find(([, campo]) => campo === filtros.sortBy) ?? [])[0];
    return coluna ? { coluna, direcao: filtros.sortOrder } : null;
  }, [filtros.sortBy, filtros.sortOrder]);

  const aoOrdenar = useCallback(
    (colunaId: string) => {
      const campo = CAMPO_DE_ORDENACAO[colunaId as ColumnKey];
      if (campo) filtros.ordenarPor(campo);
    },
    [filtros],
  );

  /* --- render ------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4">
      <BarraDeFiltros
        filtros={filtros}
        facetas={facetas}
        campoVisivel={campoVisivel}
        camposOcultos={hiddenFields}
        entidades={entidades}
        acoes={
          <>
            {exportavel && <BotaoDeExportacao exportacao={exportacao} total={total} temDados={Boolean(dados)} />}
            {acoes}
          </>
        }
        carregando={carregando || atualizando}
      />

      {exportacao.erro && <Alert tom="perigo">{exportacao.erro}</Alert>}
      {exportacao.aviso && <Alert tom="atencao">{exportacao.aviso}</Alert>}

      {/* ⚠️ Só anuncia a contagem quando ELA EXISTE. Anunciar "0 findings" numa
          busca que falhou diz a quem usa leitor de tela exatamente o oposto do
          que aconteceu — e essa pessoa não tem a caixa vermelha para corrigir a
          impressão. */}
      <p className="sr-only" role="status" aria-live="polite">
        {carregando
          ? "Carregando findings"
          : erro || !dados
            ? "Não foi possível carregar os findings"
            : `${total} finding${total === 1 ? "" : "s"} no recorte atual`}
      </p>

      {/* A transição só cobre a REVALIDAÇÃO (dados antigos na tela enquanto os
          novos chegam). Movimento reduzido mantém a opacidade e some com o
          resto — a pessoa continua vendo QUE mudou, sem a coisa se mexer. */}
      <motion.div
        animate={{ opacity: atualizando ? 0.55 : 1 }}
        transition={{ duration: reduzido ? 0.08 : 0.18, ease: "easeOut" }}
      >
        {carregando && <EsqueletoDaTabela colunas={colunas.length} />}

        {/* ⚠️ "Terminei de carregar e não tenho NADA" é erro, nunca vazio.
            Sem o `!dados`, uma busca que falhou (servidor fora, rede caída, ou
            a consulta presa sem nunca resolver) caía no estado vazio e dizia
            "Nenhum finding com esses filtros" — a pessoa conclui que o recorte
            dela não tem resultado e vai mexer no filtro, quando o problema é
            que o dado não chegou. Foi o que apareceu na validação do CP8. */}
        {!carregando && (erro || !dados) && (
          <ErrorState
            titulo="Não foi possível carregar os findings"
            descricao="A busca não chegou ao servidor. Os filtros continuam aplicados — tente de novo."
            aoTentarNovamente={recarregar}
          />
        )}

        {!carregando && !erro && dados && linhas.length === 0 && (
          <EmptyState
            titulo={filtros.quantidadeAtiva ? "Nenhum finding com esses filtros" : "Nenhum finding registrado ainda"}
            descricao={
              filtros.quantidadeAtiva
                ? "O recorte atual não tem resultado. Remova um filtro para ampliar a busca."
                : "Quando um finding for registrado nos projetos que você acompanha, ele aparece aqui."
            }
            acao={
              filtros.quantidadeAtiva ? (
                <Button variant="secundario" size="sm" onClick={filtros.limparTudo}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        )}

        {!carregando && !erro && dados && linhas.length > 0 && (
          <div className="overflow-hidden rounded-container border border-subtle">
            <Table
              legenda={`Findings — ${total} no recorte atual`}
              colunas={colunas}
              linhas={linhas}
              chaveDaLinha={(f) => f.id}
              rotuloDaLinha={(f) =>
                `${f.title}, severidade ${ROTULO_SEVERIDADE[f.severityFinal as Severidade] ?? f.severityFinal}, ${
                  ROTULO_STATUS[f.status] ?? f.status
                }`
              }
              aoClicarLinha={abrir}
              ordem={ordemDaTabela}
              aoOrdenar={aoOrdenar}
              primeiraColunaFixa
            />
          </div>
        )}
      </motion.div>

      {!carregando && !erro && (dados?.pagination.totalPages ?? 1) > 1 && (
        <Pagination
          pagina={filtros.page}
          totalPaginas={dados!.pagination.totalPages}
          aoMudar={filtros.irParaPagina}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Barra de filtros
   ========================================================================== */

function BarraDeFiltros({
  filtros,
  facetas,
  campoVisivel,
  camposOcultos,
  entidades,
  acoes,
  carregando,
}: {
  filtros: ReturnType<typeof useFindingsFilters>;
  facetas: { severity: FacetCounts; status: FacetCounts; owasp: FacetCounts } | undefined;
  campoVisivel: (field: FilterField) => boolean;
  camposOcultos: FilterField[];
  entidades: EntidadesSugeriveis;
  acoes?: ReactNode;
  carregando: boolean;
}) {
  const refDoCampo = useRef<HTMLInputElement>(null);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [cursor, setCursor] = useState(0);

  /** Lê onde o cursor está de fato — é isso que decide campo vs. valor. */
  const sincronizarCursor = useCallback(() => {
    setCursor(refDoCampo.current?.selectionStart ?? refDoCampo.current?.value.length ?? 0);
  }, []);

  const escolherSugestao = useCallback(
    (sugestao: Sugestao, contexto: ContextoDeSugestao) => {
      const { texto, cursor: novoCursor } = aplicarSugestao(filtros.rascunho, contexto, sugestao.inserir);
      filtros.definirRascunho(texto);
      setCursor(novoCursor);
      // Devolve o cursor para a posição certa DEPOIS do React reescrever o
      // valor — sem isto o cursor pula para o fim e escolher um campo no meio
      // da expressão continuaria a digitação no lugar errado.
      requestAnimationFrame(() => {
        refDoCampo.current?.focus();
        refDoCampo.current?.setSelectionRange(novoCursor, novoCursor);
      });
      // A caixa segue aberta: escolher "severidade" tem que mostrar as
      // severidades em seguida, senão a pessoa escolhe o campo e fica sozinha.
      setSugestoesAbertas(true);
    },
    [filtros],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Input
            ref={refDoCampo}
            type="text"
            value={filtros.rascunho}
            onChange={(e) => {
              filtros.definirRascunho(e.target.value);
              sincronizarCursor();
              setSugestoesAbertas(true);
            }}
            onFocus={() => {
              sincronizarCursor();
              setSugestoesAbertas(true);
            }}
            onClick={sincronizarCursor}
            onKeyUp={sincronizarCursor}
            // `onBlur` fecha, mas as opções usam `onMouseDown` com
            // `preventDefault`, então clicar numa delas não tira o foco daqui.
            onBlur={() => setSugestoesAbertas(false)}
            onKeyDown={(e) => {
              // Enter só aplica quando a caixa está fechada — com ela aberta,
              // Enter é "escolher a sugestão" (tratado em QuerySuggestions).
              if (e.key === "Enter" && !sugestoesAbertas) {
                e.preventDefault();
                filtros.aplicarAgora();
              }
            }}
            placeholder="Clique para ver os filtros, ou digite: severidade = HIGH, CRITICAL"
            aria-label="Filtrar findings. Aceita expressões como severidade = HIGH, ou texto livre."
          />

          <QuerySuggestions
            valor={filtros.rascunho}
            cursor={cursor}
            aberta={sugestoesAbertas}
            camposOcultos={camposOcultos}
            facetas={facetas}
            entidades={entidades}
            aoEscolher={escolherSugestao}
            aoFechar={() => setSugestoesAbertas(false)}
            refDoCampo={refDoCampo}
          />
        </div>

        {campoVisivel("severidade") && (
          <MultiSelecao
            rotulo="Severidade"
            opcoes={SEVERIDADES.map((s) => ({
              valor: s,
              rotulo: ROTULO_SEVERIDADE[s as Severidade] ?? s,
              contagem: facetas?.severity?.[s],
            }))}
            estaAtivo={(v) => filtros.estaAtivo("severidade", v)}
            aoAlternar={(v) => filtros.alternarValor("severidade", v)}
            carregando={carregando}
          />
        )}

        {campoVisivel("status") && (
          <MultiSelecao
            rotulo="Status"
            opcoes={STATUS.map((s) => ({ valor: s, rotulo: ROTULO_STATUS[s] ?? s, contagem: facetas?.status?.[s] }))}
            estaAtivo={(v) => filtros.estaAtivo("status", v)}
            aoAlternar={(v) => filtros.alternarValor("status", v)}
            carregando={carregando}
          />
        )}

        {campoVisivel("owasp") && (
          <MultiSelecao
            rotulo="OWASP"
            opcoes={OWASP_CATEGORIES.map((o) => ({
              valor: o,
              rotulo: OWASP_LABELS[o],
              contagem: facetas?.owasp?.[o],
            }))}
            estaAtivo={(v) => filtros.estaAtivo("owasp", v)}
            aoAlternar={(v) => filtros.alternarValor("owasp", v)}
            carregando={carregando}
          />
        )}

        {acoes && <div className="ml-auto">{acoes}</div>}
      </div>

      {filtros.tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filtros.tokens.map((token, i) => (
            <Chip
              key={`${token.kind}-${i}-${token.raw}`}
              rotulo={tokenLabel(token)}
              motivo={token.kind === "invalid" ? token.reason : undefined}
              aoRemover={() => filtros.removerToken(i)}
            />
          ))}
          <button
            type="button"
            onClick={filtros.limparTudo}
            className="rounded-control px-2 py-1 text-xs text-fg-muted underline transition-colors duration-fast hover:text-fg"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Botão de exportar CSV.
 *
 * Mostra o progresso enquanto pagina, porque exportar um recorte grande leva
 * vários segundos e um botão que só fica cinza parece travado. O rótulo diz o
 * que vai sair — "Exportar 137" — para ninguém descobrir só depois de abrir o
 * arquivo que o filtro não era o que pensava.
 */
function BotaoDeExportacao({
  exportacao,
  total,
  temDados,
}: {
  exportacao: ReturnType<typeof useFindingsExport>;
  total: number;
  temDados: boolean;
}) {
  const { exportar, exportando, progresso } = exportacao;

  const rotulo = exportando
    ? progresso && progresso.total > 0
      ? `Exportando ${progresso.baixados}/${progresso.total}...`
      : "Exportando..."
    : total > 0
      ? `Exportar ${total} em CSV`
      : "Exportar CSV";

  return (
    <Button
      variant="secundario"
      size="sm"
      onClick={exportar}
      // Sem dados carregados não há recorte confirmado para exportar, e com
      // zero resultados o arquivo sairia só com o cabeçalho.
      disabled={exportando || !temDados || total === 0}
      aria-busy={exportando}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M7.25 1.5h1.5v6.2l2.2-2.2 1.05 1.05L8 10.55 3.999 6.55 5.05 5.5l2.2 2.2V1.5ZM2.5 11.5H4v2h8v-2h1.5v3.5h-11V11.5Z" />
      </svg>
      {rotulo}
    </Button>
  );
}

/**
 * Multi-seleção com contagem por opção.
 *
 * A contagem vem das facetas, que refletem os OUTROS filtros já aplicados. Um
 * número que não reage aos demais filtros é pior que nenhum, porque promete
 * resultados que não existem. Enquanto o recorte recarrega, a contagem some
 * em vez de mostrar o valor velho — número errado é pior que número ausente.
 */
function MultiSelecao({
  rotulo,
  opcoes,
  estaAtivo,
  aoAlternar,
  carregando,
}: {
  rotulo: string;
  opcoes: { valor: string; rotulo: string; contagem?: number }[];
  estaAtivo: (valor: string) => boolean;
  aoAlternar: (valor: string) => void;
  carregando: boolean;
}) {
  const marcados = opcoes.filter((o) => estaAtivo(o.valor)).length;

  return (
    <Popover
      gatilho={
        <Button variant={marcados > 0 ? "secundario" : "sutil"} size="sm">
          {rotulo}
          {marcados > 0 && (
            <span className="ml-1 rounded-full bg-accent px-2 text-xs text-accent-fg" data-numeric>
              {marcados}
            </span>
          )}
        </Button>
      }
    >
      <fieldset className="flex w-[16rem] flex-col gap-1">
        <legend className="mb-2 text-sm font-medium text-fg">{rotulo}</legend>
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className="flex min-h-touch cursor-pointer items-center gap-3 rounded-control px-2 text-sm transition-colors duration-fast hover:bg-hovered"
          >
            <input
              type="checkbox"
              checked={estaAtivo(o.valor)}
              onChange={() => aoAlternar(o.valor)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="grid h-4 w-4 shrink-0 place-items-center rounded-control border border-strong peer-checked:border-accent peer-checked:bg-accent peer-checked:[&>svg]:opacity-100"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3 opacity-0 text-accent-fg" fill="none">
                <path
                  d="m3.5 8.5 3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="flex-1 truncate text-fg">{o.rotulo}</span>
            {!carregando && o.contagem !== undefined && (
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

/**
 * Chip de filtro. Em erro, o motivo vai em TEXTO (no `title` e no nome
 * acessível), não só na cor — WCAG 1.4.1.
 */
function Chip({ rotulo, motivo, aoRemover }: { rotulo: string; motivo?: string; aoRemover: () => void }) {
  const invalido = Boolean(motivo);

  return (
    <span
      role={invalido ? "status" : undefined}
      title={motivo}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs",
        invalido ? "bg-danger-surface text-danger-ink" : "bg-accent-surface text-accent-ink",
      )}
    >
      {invalido && (
        <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M8 1.5 15 14H1L8 1.5Zm-.8 4.2v4h1.6v-4H7.2Zm0 5.3v1.6h1.6V11H7.2Z" />
        </svg>
      )}
      <span className="truncate">{rotulo}</span>
      {invalido && <span className="sr-only">— filtro não aplicado: {motivo}</span>}
      <button
        type="button"
        onClick={aoRemover}
        // O rótulo completo é o que diferencia dez chips idênticos na leitura.
        aria-label={`Remover filtro ${rotulo}`}
        className="alvo-estendido grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-fast hover:bg-hovered"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
          <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}

/**
 * Esqueleto com a FORMA da tabela.
 *
 * Reserva a altura antes do conteúdo chegar. Um spinner centralizado no lugar
 * disso faria a página saltar quando as linhas aparecessem — e é justamente o
 * salto que a Fase 6.5 tirou das outras telas.
 */
function EsqueletoDaTabela({ colunas }: { colunas: number }) {
  return (
    <div className="overflow-hidden rounded-container border border-subtle" aria-hidden="true">
      <div className="flex gap-4 border-b border-subtle px-3 py-2">
        {Array.from({ length: colunas }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, linha) => (
        <div key={linha} className="flex gap-4 border-b border-subtle px-3 py-4">
          {Array.from({ length: colunas }).map((_, coluna) => (
            <Skeleton key={coluna} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
