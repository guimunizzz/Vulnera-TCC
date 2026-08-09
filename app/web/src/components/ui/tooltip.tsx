/**
 * tooltip.tsx
 *
 * O QUE FAZ
 * Rótulo curto que aparece ao apontar ou focar um elemento.
 *
 * ⚠️ REGRA DE USO — tooltip NÃO é lugar de informação essencial.
 * Quem usa toque não tem hover; quem usa leitor de tela ouve o `aria-describedby`
 * mas não vê o balão. Se a informação é necessária para a pessoa DECIDIR, ela
 * tem que estar na tela. Tooltip é para o nome de um botão de ícone e para a
 * definição de uma sigla — nunca para instrução de uso.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - `role="tooltip"` no balão.
 *   - O gatilho recebe `aria-describedby` apontando para ele. `describedby` e
 *     não `labelledby`: o tooltip COMPLEMENTA o nome, não o substitui. Um botão
 *     de ícone continua precisando do próprio `aria-label`.
 *
 * TECLADO
 *   - Foco no gatilho MOSTRA o tooltip (WCAG 1.4.13) — não só o hover.
 *   - Escape esconde sem tirar o foco do gatilho, para quem quer ver o que está
 *     embaixo.
 *
 * PONTEIRO
 *   - Atraso de 400ms para abrir: sem ele, atravessar uma barra de ferramentas
 *     dispara seis balões em sequência.
 *   - Fecha na hora ao sair. Atrasar o fechamento faz o balão perseguir o
 *     cursor.
 *
 * SEM ARMADILHA DE FOCO
 *   Tooltip não recebe foco e não contém interativo. `pointer-events: none`
 *   garante que ele nunca roube o clique do que está embaixo.
 * ==========================================================================
 *
 * QUEM USA
 * Botões de ícone, siglas (CVSS, OWASP, MTTR), truncamento de texto.
 */

import { cloneElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { Portal } from "./_internal/portal";
import { useAnchoredPosition, type Lado } from "./_internal/use-anchored-position";

const ATRASO_MS = 400;

interface PropsGatilhoTooltip {
  ref?: React.Ref<HTMLElement>;
  "aria-describedby"?: string;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
}

export interface TooltipProps {
  conteudo: ReactNode;
  children: ReactElement<PropsGatilhoTooltip>;
  lado?: Lado;
}

export function Tooltip({ conteudo, children, lado = "top" }: TooltipProps) {
  const [visivel, setVisivel] = useState(false);
  const refGatilho = useRef<HTMLElement>(null);
  const refBalao = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  const { ancorado } = useMotion();

  const posicao = useAnchoredPosition({
    ativo: visivel,
    refGatilho,
    refFlutuante: refBalao,
    lado,
    alinhamento: "center",
  });

  const abrirComAtraso = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisivel(true), ATRASO_MS);
  }, []);

  // Foco por teclado abre NA HORA: quem chegou por Tab já demonstrou intenção,
  // e esperar 400ms a cada parada tornaria a navegação lenta.
  const abrirAgora = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisivel(true);
  }, []);

  const fechar = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisivel(false);
  }, []);

  useEffect(() => {
    if (!visivel) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [visivel, fechar]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const props = children.props;
  const gatilho = cloneElement<PropsGatilhoTooltip>(children, {
    ref: refGatilho,
    "aria-describedby": visivel ? id : undefined,
    onPointerEnter: (e) => {
      props.onPointerEnter?.(e);
      abrirComAtraso();
    },
    onPointerLeave: (e) => {
      props.onPointerLeave?.(e);
      fechar();
    },
    onFocus: (e) => {
      props.onFocus?.(e);
      abrirAgora();
    },
    onBlur: (e) => {
      props.onBlur?.(e);
      fechar();
    },
  });

  return (
    <>
      {gatilho}
      <Portal>
        <AnimatePresence>
          {visivel && (
            <motion.div
              ref={refBalao}
              id={id}
              role="tooltip"
              variants={ancorado}
              initial="inicial"
              animate="visivel"
              exit="saindo"
              style={{ position: "fixed", top: posicao?.top ?? -9999, left: posicao?.left ?? -9999 }}
              className={cn(
                "pointer-events-none z-toast max-w-xs rounded-control border border-subtle bg-overlay",
                "px-3 py-2 text-xs text-fg shadow-overlay",
              )}
            >
              {conteudo}
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
