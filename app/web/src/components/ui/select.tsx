/**
 * select.tsx — Select e Combobox
 *
 * O QUE FAZ
 * Escolha de UM valor entre opções. `Select` lista; `Combobox` lista e filtra
 * por digitação.
 *
 * POR QUE OS DOIS NO MESMO ARQUIVO
 * Combobox é Select mais um campo de busca. A lista, o posicionamento, a
 * navegação por teclado e todo o ARIA são idênticos. Em arquivos separados,
 * seriam 150 linhas duplicadas destinadas a divergir — e é justamente na lista
 * que mora a acessibilidade que o ADR-023 assumiu reconstruir.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA — Select
 *   - Gatilho `<button>` com `aria-haspopup="listbox"`, `aria-expanded`,
 *     `aria-controls`.
 *   - Painel `role="listbox"`, itens `role="option"` com `aria-selected`.
 *   - `aria-activedescendant` no elemento focado aponta a opção ativa.
 *
 * ROLE / ARIA — Combobox (padrão APG "combobox com listbox popup")
 *   - `<input role="combobox">` com `aria-expanded`, `aria-controls`,
 *     `aria-autocomplete="list"`.
 *   - O FOCO FICA NO INPUT o tempo todo; a opção ativa é indicada por
 *     `aria-activedescendant`. É por isso que a navegação usa
 *     activedescendant e não roving tabindex — mover o foco real para a opção
 *     impediria a pessoa de continuar digitando.
 *   - Contagem de resultados anunciada por `aria-live="polite"`; sem isso,
 *     filtrar de 40 para 2 opções é um evento silencioso.
 *
 * TECLADO (os dois)
 *   Enter/Espaço/↓ abrem · ↑ ↓ navegam · Home/End vão aos extremos · digitar
 *   salta (Select) ou filtra (Combobox) · Enter escolhe · Escape fecha e
 *   devolve o foco · Tab fecha e segue.
 *
 * FOCO
 *   Select: entra no painel, volta ao gatilho ao fechar.
 *   Combobox: nunca sai do input.
 *
 * ESTADO VAZIO
 *   "Nenhum resultado" é renderizado como texto, não como lista vazia — uma
 *   listbox sem filhos não é anunciada, e a pessoa fica sem resposta.
 * ==========================================================================
 *
 * QUEM USA
 * Filtros (CP6), formulários (ambiente, tipo de análise, categoria OWASP,
 * responsável).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { Portal } from "./_internal/portal";
import { useDismiss } from "./_internal/use-dismiss";
import { useAnchoredPosition } from "./_internal/use-anchored-position";
import { useListaNavegavel } from "./_internal/use-lista-navegavel";
import { CLASSES_CONTROLE } from "./field";

export interface OpcaoSelect {
  valor: string;
  rotulo: string;
  desabilitado?: boolean;
  /** Conteúdo à direita — usado para a contagem dos filtros ("HIGH (12)"). */
  sufixo?: ReactNode;
}

interface BaseSelectProps {
  opcoes: OpcaoSelect[];
  valor: string | null;
  aoMudar: (valor: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Atributos vindos do `Field` (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  /** Rótulo para leitor de tela quando não há `Field` em volta. */
  "aria-label"?: string;
}

export type SelectProps = BaseSelectProps;
export interface ComboboxProps extends BaseSelectProps {
  /** Texto do estado vazio. */
  textoVazio?: string;
}

/* ==========================================================================
   Lista compartilhada
   ========================================================================== */

interface ListaProps {
  opcoes: OpcaoSelect[];
  valor: string | null;
  idPainel: string;
  idAtivo: string | undefined;
  idDoItem: (i: number) => string;
  indiceAtivo: number;
  definirIndiceAtivo: (i: number) => void;
  escolher: (o: OpcaoSelect) => void;
  textoVazio: string;
}

function ListaDeOpcoes({
  opcoes,
  valor,
  idPainel,
  idAtivo,
  idDoItem,
  indiceAtivo,
  definirIndiceAtivo,
  escolher,
  textoVazio,
}: ListaProps) {
  if (opcoes.length === 0) {
    return (
      <p role="status" className="px-3 py-4 text-center text-sm text-fg-muted">
        {textoVazio}
      </p>
    );
  }
  return (
    <div role="listbox" id={idPainel} aria-activedescendant={idAtivo} className="flex flex-col gap-px">
      {opcoes.map((o, i) => (
        <div
          key={o.valor}
          id={idDoItem(i)}
          role="option"
          aria-selected={o.valor === valor}
          aria-disabled={o.desabilitado || undefined}
          data-ativo={i === indiceAtivo || undefined}
          onPointerMove={() => !o.desabilitado && definirIndiceAtivo(i)}
          onClick={() => !o.desabilitado && escolher(o)}
          className={cn(
            "flex cursor-pointer select-none items-center gap-3 rounded-control px-3 py-2 text-sm text-fg",
            "data-[ativo]:bg-hovered",
            "aria-selected:font-medium aria-selected:text-accent-ink",
            "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          )}
        >
          {/* A marca de selecionado é ÍCONE + peso + cor. Só cor reprovaria
              o critério 1.4.1 do WCAG. */}
          <span aria-hidden="true" className="w-4 shrink-0">
            {o.valor === valor && (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="flex-1 truncate">{o.rotulo}</span>
          {o.sufixo && <span className="shrink-0 text-xs text-fg-muted">{o.sufixo}</span>}
        </div>
      ))}
    </div>
  );
}

const SETA = (
  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-fg-muted" fill="none" aria-hidden="true">
    <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ==========================================================================
   Select
   ========================================================================== */

export function Select({
  opcoes,
  valor,
  aoMudar,
  placeholder = "Selecione…",
  disabled,
  className,
  id,
  ...aria
}: SelectProps) {
  const [aberto, setAberto] = useState(false);
  const refGatilho = useRef<HTMLButtonElement>(null);
  const refPainel = useRef<HTMLDivElement | null>(null);
  const base = useId();
  const { ancorado } = useMotion();

  const fecharEDevolverFoco = useCallback(() => {
    setAberto(false);
    refGatilho.current?.focus({ preventScroll: true });
  }, []);

  const escolher = useCallback(
    (o: OpcaoSelect) => {
      aoMudar(o.valor);
      fecharEDevolverFoco();
    },
    [aoMudar, fecharEDevolverFoco],
  );

  const lista = useListaNavegavel<OpcaoSelect>({
    itens: opcoes,
    rotuloDe: (o) => o.rotulo,
    desabilitado: (o) => Boolean(o.desabilitado),
    aoEscolher: escolher,
    aoCancelar: () => setAberto(false),
    idBase: base,
    // Abre já com o valor atual ativo — é o que faz ↓ continuar de onde parou.
    indiceInicial: Math.max(0, opcoes.findIndex((o) => o.valor === valor)),
  });

  useDismiss({ ativo: aberto, aoFechar: () => setAberto(false), refConteudo: refPainel, refGatilho });
  const posicao = useAnchoredPosition({
    ativo: aberto,
    refGatilho,
    refFlutuante: refPainel,
    igualarLargura: true,
  });

  useEffect(() => {
    if (aberto) refPainel.current?.focus({ preventScroll: true });
  }, [aberto]);

  const selecionada = opcoes.find((o) => o.valor === valor);

  return (
    <>
      <button
        ref={refGatilho}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? base : undefined}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className={cn(CLASSES_CONTROLE, "flex h-10 items-center justify-between gap-2 text-left", className)}
        {...aria}
      >
        <span className={cn("truncate", !selecionada && "text-fg-muted")}>{selecionada?.rotulo ?? placeholder}</span>
        {SETA}
      </button>

      <Portal>
        <AnimatePresence>
          {aberto && (
            <motion.div
              ref={(el) => {
                refPainel.current = el;
                (lista.refLista as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }}
              tabIndex={-1}
              onKeyDown={lista.aoTeclar}
              variants={ancorado}
              initial="inicial"
              animate="visivel"
              exit="saindo"
              style={{
                position: "fixed",
                top: posicao?.top ?? -9999,
                left: posicao?.left ?? -9999,
                width: posicao?.largura,
                maxHeight: posicao?.maxHeight,
              }}
              className="z-dropdown overflow-auto rounded-overlay border border-subtle bg-overlay p-1 shadow-overlay"
            >
              <ListaDeOpcoes
                opcoes={opcoes}
                valor={valor}
                idPainel={base}
                idAtivo={lista.idAtivo}
                idDoItem={lista.idDoItem}
                indiceAtivo={lista.indiceAtivo}
                definirIndiceAtivo={lista.definirIndiceAtivo}
                escolher={escolher}
                textoVazio="Nenhuma opção disponível"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}

/* ==========================================================================
   Combobox
   ========================================================================== */

export function Combobox({
  opcoes,
  valor,
  aoMudar,
  placeholder = "Buscar…",
  disabled,
  className,
  id,
  textoVazio = "Nenhum resultado",
  ...aria
}: ComboboxProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const refInput = useRef<HTMLInputElement>(null);
  const refPainel = useRef<HTMLDivElement | null>(null);
  const refCampo = useRef<HTMLDivElement>(null);
  const base = useId();
  const { ancorado } = useMotion();

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    // `includes` e não `startsWith`: numa lista de categorias OWASP, buscar
    // "acesso" precisa achar "A01 Broken Access Control".
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(q));
  }, [busca, opcoes]);

  const escolher = useCallback(
    (o: OpcaoSelect) => {
      aoMudar(o.valor);
      setBusca("");
      setAberto(false);
      refInput.current?.focus({ preventScroll: true });
    },
    [aoMudar],
  );

  const lista = useListaNavegavel<OpcaoSelect>({
    itens: filtradas,
    rotuloDe: (o) => o.rotulo,
    desabilitado: (o) => Boolean(o.desabilitado),
    aoEscolher: escolher,
    aoCancelar: () => setAberto(false),
    idBase: base,
    indiceInicial: 0,
  });

  // O índice ativo volta ao topo a cada nova filtragem: manter o índice antigo
  // apontaria para uma opção que já não está mais na posição — e Enter
  // escolheria a errada.
  useEffect(() => {
    lista.definirIndiceAtivo(filtradas.length > 0 ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, filtradas.length]);

  useDismiss({ ativo: aberto, aoFechar: () => setAberto(false), refConteudo: refPainel, refGatilho: refCampo });
  const posicao = useAnchoredPosition({
    ativo: aberto,
    refGatilho: refCampo,
    refFlutuante: refPainel,
    igualarLargura: true,
  });

  const selecionada = opcoes.find((o) => o.valor === valor);

  return (
    <>
      <div ref={refCampo}>
        <input
          ref={refInput}
          id={id}
          role="combobox"
          type="text"
          disabled={disabled}
          autoComplete="off"
          aria-expanded={aberto}
          aria-controls={aberto ? base : undefined}
          aria-autocomplete="list"
          aria-activedescendant={aberto ? lista.idAtivo : undefined}
          placeholder={selecionada?.rotulo ?? placeholder}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !aberto) {
              e.preventDefault();
              setAberto(true);
              return;
            }
            lista.aoTeclar(e);
          }}
          className={cn(CLASSES_CONTROLE, "h-10", className)}
          {...aria}
        />
      </div>

      {/* Contagem de resultados. Fora do painel de propósito: precisa existir
          no DOM ANTES de mudar, senão o leitor de tela não anuncia a alteração
          de uma região que acabou de nascer. */}
      <span className="sr-only" role="status" aria-live="polite">
        {aberto ? `${filtradas.length} ${filtradas.length === 1 ? "resultado" : "resultados"}` : ""}
      </span>

      <Portal>
        <AnimatePresence>
          {aberto && (
            <motion.div
              ref={(el) => {
                refPainel.current = el;
                (lista.refLista as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }}
              variants={ancorado}
              initial="inicial"
              animate="visivel"
              exit="saindo"
              style={{
                position: "fixed",
                top: posicao?.top ?? -9999,
                left: posicao?.left ?? -9999,
                width: posicao?.largura,
                maxHeight: posicao?.maxHeight,
              }}
              className="z-dropdown overflow-auto rounded-overlay border border-subtle bg-overlay p-1 shadow-overlay"
            >
              <ListaDeOpcoes
                opcoes={filtradas}
                valor={valor}
                idPainel={base}
                idAtivo={lista.idAtivo}
                idDoItem={lista.idDoItem}
                indiceAtivo={lista.indiceAtivo}
                definirIndiceAtivo={lista.definirIndiceAtivo}
                escolher={escolher}
                textoVazio={textoVazio}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
