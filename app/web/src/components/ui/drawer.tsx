/**
 * drawer.tsx
 *
 * O QUE FAZ
 * Painel modal que entra por uma borda da tela. Mesmo contrato do `Dialog`,
 * geometria diferente.
 *
 * QUANDO USAR EM VEZ DO DIALOG
 * Quando o conteúdo é uma LISTA ou um formulário longo, e a pessoa precisa
 * continuar vendo o contexto atrás. Filtros avançados, detalhe lateral de um
 * finding, navegação em telas estreitas.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * Idêntico ao `Dialog` — `role="dialog"` + `aria-modal`, `aria-labelledby`
 * obrigatório, armadilha de foco, Escape, clique fora, trava de rolagem,
 * `inert` no resto. Ver dialog.tsx para o detalhamento; a maquinaria é a mesma
 * (`_internal/`), o que muda é o layout.
 *
 * MOVIMENTO
 * Aqui o deslocamento é ESSENCIAL, não decoração: ele responde "de onde isto
 * veio?" e, no fechamento, "para onde foi?". Por isso o drawer desliza mesmo
 * onde o dialog só faz escala. Com `prefers-reduced-motion`, vira fade puro.
 * ==========================================================================
 *
 * QUEM USA
 * Filtros avançados (CP6), navegação mobile, detalhe lateral.
 */

import { createContext, useContext, useId, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { DURACAO, EASE } from "../../motion/tokens";
import { useMotion } from "../../motion/use-motion";
import { Portal } from "./_internal/portal";
import { useFocusTrap } from "./_internal/use-focus-trap";
import { useDismiss, useInertForaDe, useScrollLock } from "./_internal/use-dismiss";
import { Button } from "./button";

type LadoDrawer = "direita" | "esquerda" | "baixo";

interface ContextoDrawer {
  idTitulo: string;
  fechar: () => void;
}
const Contexto = createContext<ContextoDrawer | null>(null);

export interface DrawerProps {
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  lado?: LadoDrawer;
  className?: string;
}

const GEOMETRIA: Record<LadoDrawer, string> = {
  direita: "right-0 top-0 h-full w-full max-w-md border-l",
  esquerda: "left-0 top-0 h-full w-full max-w-md border-r",
  baixo: "bottom-0 left-0 w-full max-h-[85dvh] border-t rounded-t-overlay",
};

/** De onde o painel entra, em px. Fora da tela pelo eixo do próprio lado. */
const ENTRADA: Record<LadoDrawer, { x?: number; y?: number }> = {
  direita: { x: 24 },
  esquerda: { x: -24 },
  baixo: { y: 24 },
};

export function Drawer({ aberto, aoFechar, children, lado = "direita", className }: DrawerProps) {
  const refPainel = useRef<HTMLDivElement>(null);
  const base = useId();
  const { scrim, reduzido } = useMotion();

  useFocusTrap(refPainel, { ativo: aberto });
  useDismiss({ ativo: aberto, aoFechar, refConteudo: refPainel });
  useScrollLock(aberto);
  useInertForaDe(aberto, refPainel);

  const ctx = useMemo<ContextoDrawer>(() => ({ idTitulo: `${base}-titulo`, fechar: aoFechar }), [base, aoFechar]);
  const deslocamento = reduzido ? {} : ENTRADA[lado];

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <Contexto.Provider value={ctx}>
            <motion.div
              aria-hidden="true"
              variants={scrim}
              initial="inicial"
              animate="visivel"
              exit="saindo"
              className="fixed inset-0 z-overlay bg-scrim"
            />
            <motion.div
              ref={refPainel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={ctx.idTitulo}
              initial={{ opacity: 0, ...deslocamento }}
              animate={{ opacity: 1, x: 0, y: 0, transition: { duration: DURACAO.slow, ease: EASE.emphasized } }}
              exit={{ opacity: 0, ...deslocamento, transition: { duration: DURACAO.fast, ease: EASE.out } }}
              className={cn(
                "fixed z-modal flex flex-col overflow-y-auto border-subtle bg-overlay shadow-modal",
                GEOMETRIA[lado],
                className,
              )}
            >
              {children}
            </motion.div>
          </Contexto.Provider>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Cabeçalho fixo com título e botão de fechar. */
export function DrawerHeader({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useDrawerContexto();
  return (
    <header
      className={cn(
        "sticky top-0 z-sticky flex items-center justify-between gap-4 border-b border-subtle bg-overlay px-6 py-4",
        className,
      )}
    >
      <h2 id={ctx.idTitulo} className="text-lg font-semibold text-fg">
        {children}
      </h2>
      <Button variant="sutil" size="sm" rotulo="Fechar" onClick={ctx.fechar}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </Button>
    </header>
  );
}

export function DrawerBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex-1 px-6 py-4", className)}>{children}</div>;
}

export function DrawerFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer
      className={cn("sticky bottom-0 flex gap-2 border-t border-subtle bg-overlay px-6 py-4", className)}
    >
      {children}
    </footer>
  );
}

function useDrawerContexto(): ContextoDrawer {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("Componentes de Drawer precisam estar dentro de <Drawer>");
  return ctx;
}
