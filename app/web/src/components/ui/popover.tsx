/**
 * popover.tsx
 *
 * O QUE FAZ
 * Painel flutuante ancorado a um gatilho. NÃO é modal: a página atrás continua
 * lendo e rolando.
 *
 * POPOVER × DIALOG — a diferença não é de tamanho
 * Popover é para conteúdo AUXILIAR, ancorado a algo (um seletor de data preso
 * ao campo, um resumo preso a uma linha). Dialog é para uma decisão que
 * interrompe. Se a pessoa PRECISA responder antes de continuar, é dialog.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - `role="dialog"` no painel (é um agrupamento com conteúdo interativo), mas
 *     SEM `aria-modal` — porque não é modal. Marcar `aria-modal` num popover
 *     mentiria para o leitor de tela, que passaria a ignorar o resto da página.
 *   - Gatilho: `aria-expanded` + `aria-controls` + `aria-haspopup="dialog"`.
 *   - `aria-labelledby` quando há título.
 *
 * TECLADO
 *   - Enter/Espaço no gatilho abre · Escape fecha e DEVOLVE o foco ao gatilho.
 *   - Tab dentro do painel circula (armadilha de foco) — mesmo não sendo
 *     modal. Sem isso, Tab levaria a pessoa para trás do painel aberto, que
 *     visualmente está por cima.
 *
 * FOCO
 *   Entra no primeiro focável do painel ao abrir; volta ao gatilho ao fechar.
 *
 * FUNDO
 *   Rolagem NÃO é travada (o painet reposiciona ao rolar) e nada vira `inert` —
 *   é justamente o que separa popover de modal.
 *
 * POSICIONAMENTO
 *   `useAnchoredPosition`: vira de lado quando não cabe, gruda na borda quando
 *   transborda, recalcula em scroll e resize. `data-side` reflete o lado
 *   realmente usado, para o CSS saber de onde animar.
 * ==========================================================================
 *
 * QUEM USA
 * Seletor de período (CP6), seletor de colunas, resumo de finding.
 */

import { cloneElement, useCallback, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { Portal } from "./_internal/portal";
import { useFocusTrap } from "./_internal/use-focus-trap";
import { useDismiss } from "./_internal/use-dismiss";
import { useAnchoredPosition, type Alinhamento, type Lado } from "./_internal/use-anchored-position";

/** O que o `Popover` injeta no elemento de gatilho por `cloneElement`. */
export interface PropsDeGatilho {
  ref?: React.Ref<HTMLElement>;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-haspopup"?: "dialog" | "menu" | "listbox";
  onClick?: (e: React.MouseEvent) => void;
}

export interface PopoverProps {
  /**
   * O gatilho. Recebe por clonagem `ref`, `onClick`, `aria-expanded`,
   * `aria-controls` e `aria-haspopup` — quem chama não precisa lembrar de
   * nenhum deles, que é o ponto.
   */
  gatilho: ReactElement<PropsDeGatilho>;
  children: ReactNode;
  lado?: Lado;
  alinhamento?: Alinhamento;
  /** Controlado de fora (opcional). Sem isto, o popover controla a si mesmo. */
  aberto?: boolean;
  aoMudarAberto?: (aberto: boolean) => void;
  className?: string;
}

export function Popover({
  gatilho,
  children,
  lado = "bottom",
  alinhamento = "start",
  aberto: abertoExterno,
  aoMudarAberto,
  className,
}: PopoverProps) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const controlado = abertoExterno !== undefined;
  const aberto = controlado ? abertoExterno : abertoInterno;

  const refGatilho = useRef<HTMLElement>(null);
  const refPainel = useRef<HTMLDivElement>(null);
  const id = useId();
  const { ancorado } = useMotion();

  const definirAberto = useCallback(
    (v: boolean) => {
      if (!controlado) setAbertoInterno(v);
      aoMudarAberto?.(v);
    },
    [controlado, aoMudarAberto],
  );

  const fechar = useCallback(() => definirAberto(false), [definirAberto]);

  useFocusTrap(refPainel, { ativo: aberto });
  useDismiss({ ativo: aberto, aoFechar: fechar, refConteudo: refPainel, refGatilho });

  const posicao = useAnchoredPosition({ ativo: aberto, refGatilho, refFlutuante: refPainel, lado, alinhamento });

  const onClickOriginal = (gatilho.props as PropsDeGatilho).onClick;
  const gatilhoClonado = cloneElement<PropsDeGatilho>(gatilho, {
    ref: refGatilho,
    "aria-expanded": aberto,
    "aria-controls": aberto ? id : undefined,
    "aria-haspopup": "dialog",
    onClick: (e) => {
      onClickOriginal?.(e);
      definirAberto(!aberto);
    },
  });

  return (
    <>
      {gatilhoClonado}
      <Portal>
        <AnimatePresence>
          {aberto && (
            <motion.div
              ref={refPainel}
              id={id}
              role="dialog"
              data-side={posicao?.ladoFinal ?? lado}
              variants={ancorado}
              initial="inicial"
              animate="visivel"
              exit="saindo"
              style={{
                position: "fixed",
                // Antes do primeiro cálculo o painel é renderizado fora da tela
                // para poder ser MEDIDO. Sem isso não há como saber a altura, e
                // sem altura não há como decidir o flip.
                top: posicao?.top ?? -9999,
                left: posicao?.left ?? -9999,
                maxHeight: posicao?.maxHeight,
              }}
              className={cn(
                "z-dropdown overflow-auto rounded-overlay border border-subtle bg-overlay p-4 shadow-overlay",
                className,
              )}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
