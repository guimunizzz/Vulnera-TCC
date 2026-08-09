/**
 * dropdown-menu.tsx — DropdownMenu e ContextMenu
 *
 * O QUE FAZ
 * Menu de AÇÕES ancorado. `DropdownMenu` abre num gatilho; `ContextMenu` abre
 * no botão direito, na posição do cursor.
 *
 * MENU × SELECT — a distinção que muda o ARIA
 * Menu executa AÇÕES ("Excluir", "Duplicar"): `role="menu"` / `menuitem`.
 * Select ESCOLHE UM VALOR entre opções: `role="listbox"` / `option`.
 * Trocar um pelo outro faz o leitor de tela anunciar a coisa errada — "menu"
 * quando a pessoa está preenchendo um formulário, ou "caixa de listagem"
 * quando está prestes a apagar algo.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - `role="menu"` no painel · `role="menuitem"` nos itens.
 *   - Gatilho: `aria-haspopup="menu"` + `aria-expanded` + `aria-controls`.
 *   - `aria-activedescendant` no painel aponta o item ativo; o painel é quem
 *     tem o foco do DOM (ver `_internal/use-lista-navegavel.ts` para o porquê
 *     desta estratégia em vez de roving tabindex).
 *   - Item destrutivo leva `data-destrutivo`, que é só visual — a semântica de
 *     "isto apaga" tem que estar no TEXTO do item.
 *
 * TECLADO
 *   - Gatilho: Enter/Espaço/Seta-baixo abrem, já com o primeiro item ativo.
 *   - ↑ ↓ navegam (pulando desabilitados e separadores) · Home/End vão aos
 *     extremos · digitar salta para o item que começa com aquelas letras
 *     (typeahead com janela de 500ms) · Enter executa · Escape fecha · Tab
 *     fecha e segue o fluxo normal da página.
 *
 * FOCO
 *   Entra no painel ao abrir e VOLTA ao gatilho ao fechar, inclusive depois de
 *   executar um item — senão a pessoa perde a posição na página.
 *
 * FUNDO
 *   Não é modal: nada de `inert`, nada de trava de rolagem. Clique fora fecha.
 * ==========================================================================
 *
 * QUEM USA
 * Ações de linha de tabela, menu do usuário, ações de finding.
 */

import { cloneElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { Portal } from "./_internal/portal";
import { useDismiss } from "./_internal/use-dismiss";
import { useAnchoredPosition, type Alinhamento, type Lado } from "./_internal/use-anchored-position";
import { useListaNavegavel } from "./_internal/use-lista-navegavel";
import type { PropsDeGatilho } from "./popover";

export interface ItemDeMenu {
  id: string;
  rotulo: string;
  aoEscolher: () => void;
  icone?: ReactNode;
  desabilitado?: boolean;
  /** Pinta o item na cor de perigo. Não substitui um texto claro. */
  destrutivo?: boolean;
  /** Atalho exibido à direita (apenas informativo — não registra listener). */
  atalho?: string;
}

interface PainelProps {
  itens: ItemDeMenu[];
  aberto: boolean;
  fechar: () => void;
  idPainel: string;
  posicao: { top: number; left: number; maxHeight?: number } | null;
  refPainel: React.RefObject<HTMLDivElement>;
  rotulo?: string;
}

/** O painel em si — compartilhado por DropdownMenu e ContextMenu. */
function PainelDeMenu({ itens, aberto, fechar, idPainel, posicao, refPainel, rotulo }: PainelProps) {
  const { ancorado } = useMotion();

  // O painel precisa RECEBER o foco ao abrir: é ele que escuta as setas e é
  // ele que carrega o `aria-activedescendant`. Sem o foco aqui, o teclado
  // continuaria no gatilho e o menu seria navegável só com o mouse.
  useEffect(() => {
    if (aberto) refPainel.current?.focus({ preventScroll: true });
  }, [aberto, refPainel]);

  const escolher = useCallback(
    (item: ItemDeMenu) => {
      fechar();
      // Executa DEPOIS de fechar: se a ação abrir outro overlay (um dialog de
      // confirmação), o menu já saiu do caminho e a devolução de foco não
      // disputa com a armadilha do novo overlay.
      item.aoEscolher();
    },
    [fechar],
  );

  const lista = useListaNavegavel<ItemDeMenu>({
    itens,
    rotuloDe: (i) => i.rotulo,
    desabilitado: (i) => Boolean(i.desabilitado),
    aoEscolher: escolher,
    aoCancelar: fechar,
    idBase: idPainel,
    indiceInicial: 0,
  });

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            ref={(el) => {
              (refPainel as React.MutableRefObject<HTMLDivElement | null>).current = el;
              (lista.refLista as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            id={idPainel}
            role="menu"
            aria-label={rotulo}
            aria-activedescendant={lista.idAtivo}
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
              maxHeight: posicao?.maxHeight,
            }}
            className="z-dropdown min-w-menu overflow-auto rounded-overlay border border-subtle bg-overlay p-1 shadow-overlay"
          >
            {itens.map((item, i) => (
              <div
                key={item.id}
                id={lista.idDoItem(i)}
                role="menuitem"
                aria-disabled={item.desabilitado || undefined}
                data-ativo={i === lista.indiceAtivo || undefined}
                data-destrutivo={item.destrutivo || undefined}
                // `onPointerMove` e não `onPointerEnter`: com o mouse parado
                // sobre o menu, abrir com o teclado moveria o item ativo para
                // debaixo do cursor sem a pessoa ter mexido em nada.
                onPointerMove={() => !item.desabilitado && lista.definirIndiceAtivo(i)}
                onClick={() => !item.desabilitado && escolher(item)}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-3 rounded-control px-3 py-2 text-sm text-fg",
                  "data-[ativo]:bg-hovered",
                  "data-[destrutivo]:text-danger-ink",
                  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
                )}
              >
                {item.icone && (
                  <span aria-hidden="true" className="shrink-0">
                    {item.icone}
                  </span>
                )}
                <span className="flex-1 truncate">{item.rotulo}</span>
                {item.atalho && (
                  <span aria-hidden="true" className="font-mono text-xs text-fg-muted">
                    {item.atalho}
                  </span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/* ==========================================================================
   DropdownMenu — ancorado a um gatilho
   ========================================================================== */

export interface DropdownMenuProps {
  gatilho: ReactElement<PropsDeGatilho>;
  itens: ItemDeMenu[];
  lado?: Lado;
  alinhamento?: Alinhamento;
  /** Nome do menu para o leitor de tela ("Ações do finding"). */
  rotulo?: string;
}

export function DropdownMenu({ gatilho, itens, lado = "bottom", alinhamento = "end", rotulo }: DropdownMenuProps) {
  const [aberto, setAberto] = useState(false);
  const refGatilho = useRef<HTMLElement>(null);
  const refPainel = useRef<HTMLDivElement>(null);
  const id = useId();

  const fechar = useCallback(() => {
    setAberto(false);
    // Devolve o foco ao gatilho. Sem isto o foco cairia no `body` e o próximo
    // Tab recomeçaria do topo da página.
    refGatilho.current?.focus({ preventScroll: true });
  }, []);

  useDismiss({ ativo: aberto, aoFechar: () => setAberto(false), refConteudo: refPainel, refGatilho });
  const posicao = useAnchoredPosition({ ativo: aberto, refGatilho, refFlutuante: refPainel, lado, alinhamento });

  const onClickOriginal = gatilho.props.onClick;
  const gatilhoClonado = cloneElement<PropsDeGatilho>(gatilho, {
    ref: refGatilho,
    "aria-haspopup": "menu",
    "aria-expanded": aberto,
    "aria-controls": aberto ? id : undefined,
    onClick: (e) => {
      onClickOriginal?.(e);
      setAberto((v) => !v);
    },
  });

  return (
    <>
      {gatilhoClonado}
      <PainelDeMenu
        itens={itens}
        aberto={aberto}
        fechar={fechar}
        idPainel={id}
        posicao={posicao}
        refPainel={refPainel}
        rotulo={rotulo}
      />
    </>
  );
}

/* ==========================================================================
   ContextMenu — no botão direito, na posição do cursor
   ========================================================================== */

export interface ContextMenuProps {
  itens: ItemDeMenu[];
  children: ReactNode;
  rotulo?: string;
  className?: string;
}

export function ContextMenu({ itens, children, rotulo, className }: ContextMenuProps) {
  const [ponto, setPonto] = useState<{ top: number; left: number } | null>(null);
  const refPainel = useRef<HTMLDivElement>(null);
  const refArea = useRef<HTMLDivElement>(null);
  const id = useId();

  const fechar = useCallback(() => setPonto(null), []);
  useDismiss({ ativo: ponto !== null, aoFechar: fechar, refConteudo: refPainel });

  return (
    <div
      ref={refArea}
      className={className}
      onContextMenu={(e) => {
        e.preventDefault();
        setPonto({ top: e.clientY, left: e.clientX });
      }}
      // Teclado: a tecla de menu de contexto (ou Shift+F10) abre no canto do
      // elemento. Sem isto, o menu de contexto seria exclusivo de quem usa
      // mouse — e um recurso só-mouse é um recurso inacessível.
      onKeyDown={(e) => {
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault();
          const r = refArea.current?.getBoundingClientRect();
          if (r) setPonto({ top: r.top + r.height / 2, left: r.left + r.width / 2 });
        }
      }}
    >
      {children}
      <PainelDeMenu
        itens={itens}
        aberto={ponto !== null}
        fechar={fechar}
        idPainel={id}
        posicao={ponto}
        refPainel={refPainel}
        rotulo={rotulo}
      />
    </div>
  );
}
