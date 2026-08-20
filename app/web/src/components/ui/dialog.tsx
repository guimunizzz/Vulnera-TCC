/**
 * dialog.tsx
 *
 * O QUE FAZ
 * Janela modal centralizada. Substitui o `@radix-ui/react-dialog` (ADR-023).
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE — a checklist herdada do Radix, item a item
 * ==========================================================================
 * ROLE / ARIA
 *   - `role="dialog"` + `aria-modal="true"` no painel.
 *   - `aria-labelledby` → id do `<DialogTitle>` (obrigatório; sem título, o
 *     leitor de tela anuncia "diálogo" e nada mais).
 *   - `aria-describedby` → id do `<DialogDescription>`, quando existir.
 *   - O gatilho recebe `aria-expanded` e `aria-controls` (ver `useDialog`).
 *
 * TECLADO
 *   - Tab / Shift+Tab CICLAM dentro do painel e não escapam (`useFocusTrap`).
 *   - Escape fecha (`useDismiss`). Com dois overlays empilhados, fecha só o
 *     de cima.
 *   - Enter/Espaço no botão de fechar fecham (nativo).
 *
 * FOCO
 *   - Ao abrir: vai para o elemento com `data-autofocus` ou, na falta dele,
 *     para o primeiro focável do painel.
 *   - Enquanto aberto: preso dentro.
 *   - Ao fechar: VOLTA para o gatilho que abriu.
 *
 * FUNDO
 *   - Rolagem do body travada (`useScrollLock`), com compensação da largura da
 *     barra para a página não saltar.
 *   - Resto da árvore marcado `inert` (`useInertForaDe`) — é o que impede o
 *     leitor de tela de ler o formulário atrás do modal.
 *
 * LEITOR DE TELA
 *   Anuncia "diálogo", o título, e a descrição se houver. Ao fechar, volta ao
 *   contexto do gatilho.
 *
 * MOVIMENTO
 *   Entra em 0.96 → 1 com fade (~200ms), sai mais rápido (~140ms). Com
 *   `prefers-reduced-motion` a escala some e sobra o fade. Ver motion/.
 * ==========================================================================
 *
 * QUEM USA
 * Confirmação de exclusão, override de severidade, criação de aplicação,
 * aprovação de assinatura.
 */

import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { Portal } from "./_internal/portal";
import { useFocusTrap } from "./_internal/use-focus-trap";
import { useDismiss, useInertForaDe, useScrollLock } from "./_internal/use-dismiss";
import { Button } from "./button";

interface ContextoDialog {
  idTitulo: string;
  idDescricao: string;
  fechar: () => void;
}
const Contexto = createContext<ContextoDialog | null>(null);

export interface DialogProps {
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  /** `sm` confirmação · `md` padrão · `lg` formulário. */
  tamanho?: "sm" | "md" | "lg";
  /**
   * Clique fora fecha? Padrão `true`.
   * Desligue em fluxo com dados não salvos — perder um formulário preenchido
   * por um clique de raspão é o tipo de coisa que a pessoa não perdoa.
   */
  fecharAoClicarFora?: boolean;
  className?: string;
}

const TAMANHOS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" } as const;

export function Dialog({ aberto, aoFechar, children, tamanho = "md", fecharAoClicarFora = true, className }: DialogProps) {
  const refPainel = useRef<HTMLDivElement>(null);
  const base = useId();
  const { overlay, scrim } = useMotion();

  useFocusTrap(refPainel, { ativo: aberto });
  useDismiss({ ativo: aberto, aoFechar, refConteudo: refPainel, fecharAoClicarFora });
  useScrollLock(aberto);
  useInertForaDe(aberto, refPainel);

  const ctx = useMemo<ContextoDialog>(
    () => ({ idTitulo: `${base}-titulo`, idDescricao: `${base}-descricao`, fechar: aoFechar }),
    [base, aoFechar],
  );

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <Contexto.Provider value={ctx}>
            {/* O véu é `aria-hidden`: ele não tem conteúdo, e anunciá-lo só
                acrescentaria ruído antes do título do diálogo. */}
            <motion.div
              aria-hidden="true"
              variants={scrim}
              initial="inicial"
              animate="visivel"
              exit="saindo"
              className="fixed inset-0 z-overlay bg-scrim"
            />
            <div className="fixed inset-0 z-modal grid place-items-center overflow-y-auto p-4">
              <motion.div
                ref={refPainel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={ctx.idTitulo}
                aria-describedby={ctx.idDescricao}
                variants={overlay}
                initial="inicial"
                animate="visivel"
                exit="saindo"
                className={cn(
                  "w-full rounded-overlay border border-subtle bg-overlay p-6 shadow-modal",
                  TAMANHOS[tamanho],
                  className,
                )}
              >
                {children}
              </motion.div>
            </div>
          </Contexto.Provider>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Título. Obrigatório — é o que dá nome ao diálogo para o leitor de tela. */
export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useDialogContexto();
  return (
    <h2 id={ctx.idTitulo} className={cn("text-lg font-semibold text-fg", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useDialogContexto();
  return (
    <p id={ctx.idDescricao} className={cn("mt-2 text-sm text-fg-muted", className)}>
      {children}
    </p>
  );
}

/** Rodapé de ações. Em telas estreitas empilha, com a ação primária em cima. */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>{children}</div>;
}

/** Botão de fechar no canto. `rotulo` vira `aria-label` — é só ícone. */
export function DialogClose({ className }: { className?: string }) {
  const ctx = useDialogContexto();
  return (
    <Button
      variant="sutil"
      size="sm"
      rotulo="Fechar"
      onClick={ctx.fechar}
      className={cn("absolute right-4 top-4", className)}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </Button>
  );
}

function useDialogContexto(): ContextoDialog {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("Componentes de Dialog precisam estar dentro de <Dialog>");
  return ctx;
}

/**
 * Estado + atributos ARIA do gatilho, num pacote só.
 *
 * Existe porque `aria-expanded` e `aria-controls` no BOTÃO são a metade do
 * contrato que mais se esquece: sem eles, o leitor de tela anuncia "botão" e
 * não "botão, recolhido" — a pessoa não sabe que ali abre alguma coisa.
 */
export function useDialog(idExterno?: string) {
  const gerado = useId();
  const id = idExterno ?? gerado;
  const [aberto, setAberto] = useState(false);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  return {
    aberto,
    abrir,
    fechar,
    /** Espalhe no botão que abre. */
    propsDoGatilho: {
      "aria-expanded": aberto,
      "aria-controls": aberto ? id : undefined,
      "aria-haspopup": "dialog" as const,
      onClick: abrir,
    },
    /** Espalhe no `<Dialog>`. */
    propsDoDialog: { aberto, aoFechar: fechar },
  };
}
