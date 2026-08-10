/**
 * toast.tsx
 *
 * O QUE FAZ
 * Avisos temporários empilhados num canto. `ToastProvider` no topo da árvore,
 * `useToast()` em qualquer lugar.
 *
 * ⚠️ REGRA DE USO — toast some sozinho, então nunca use para:
 *   - erro que exige ação ("faltou preencher X") → mostre no formulário
 *   - informação que a pessoa vai precisar reler → mostre na página
 * Toast é confirmação efêmera: "salvo", "copiado", "relatório gerado".
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - A região é `role="region"` com `aria-label="Notificações"`.
 *   - Cada toast é `role="status"` (`aria-live="polite"`), salvo os de erro,
 *     que são `role="alert"` (`assertive`) — erro interrompe, sucesso espera a
 *     pessoa terminar a frase que está ouvindo.
 *   - A região existe no DOM DESDE O INÍCIO, vazia. Uma live region criada no
 *     mesmo instante em que ganha conteúdo não é anunciada por boa parte dos
 *     leitores de tela — é o bug clássico de toast "silencioso".
 *
 * TECLADO
 *   - Botão de fechar acessível por Tab.
 *   - Toast NÃO rouba o foco: seria interromper a digitação de quem só salvou
 *     um rascunho.
 *
 * TEMPO (WCAG 2.2.1)
 *   - O cronômetro PAUSA no hover e no foco. Sem isso, quem lê devagar ou
 *     navega por teclado perde a mensagem no meio.
 *   - Erro não some sozinho: exige fechar.
 * ==========================================================================
 *
 * QUEM USA
 * Salvamento de finding, geração de relatório, aprovação de assinatura, cópia
 * de link de filtro.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { SPRING, DURACAO, EASE } from "../../motion/tokens";
import { useMotion } from "../../motion/use-motion";

export type TipoToast = "sucesso" | "erro" | "info";

export interface Toast {
  id: string;
  tipo: TipoToast;
  titulo: string;
  descricao?: string;
}

interface ContextoToast {
  mostrar: (t: Omit<Toast, "id">) => void;
  sucesso: (titulo: string, descricao?: string) => void;
  erro: (titulo: string, descricao?: string) => void;
}

const Contexto = createContext<ContextoToast | null>(null);

const DURACAO_PADRAO_MS = 5000;

// A faixa colorida é um ELEMENTO, não um `border-left`. Motivo prático: as
// chaves de largura e de cor de borda do Tailwind colidem em `border-l-*`, e a
// combinação emitiria largura e cor pela mesma classe. Um `<span>` posicionado
// é inequívoco e ainda permite arredondar só o canto esquerdo.
const ESTILO: Record<TipoToast, { barra: string; icone: ReactNode }> = {
  sucesso: {
    barra: "bg-success",
    icone: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-success" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.2 4.8-4 4.5-2.4-2.2.9-1 1.5 1.4 3.1-3.5.9.8Z" />
      </svg>
    ),
  },
  erro: {
    barra: "bg-danger",
    icone: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-danger" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
      </svg>
    ),
  },
  info: {
    barra: "bg-accent",
    icone: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-accent-ink" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-.75 3h1.5v1.5h-1.5V4.5Zm0 3h1.5v4h-1.5v-4Z" />
      </svg>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const remover = useCallback((id: string) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const agendar = useCallback(
    (id: string, ms = DURACAO_PADRAO_MS) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => remover(id), ms));
    },
    [remover],
  );

  const mostrar = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((atual) => [...atual, { ...t, id }]);
      // Erro não expira: exige o fechamento explícito. Ver contrato.
      if (t.tipo !== "erro") agendar(id);
    },
    [agendar],
  );

  const valor = useMemo<ContextoToast>(
    () => ({
      mostrar,
      sucesso: (titulo, descricao) => mostrar({ tipo: "sucesso", titulo, descricao }),
      erro: (titulo, descricao) => mostrar({ tipo: "erro", titulo, descricao }),
    }),
    [mostrar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      {/* A região está SEMPRE no DOM, mesmo vazia — ver contrato. */}
      <ListaDeToasts
        toasts={toasts}
        aoFechar={remover}
        aoPausar={(id) => window.clearTimeout(timers.current.get(id))}
        aoRetomar={(id, tipo) => tipo !== "erro" && agendar(id)}
      />
    </Contexto.Provider>
  );
}

function ListaDeToasts({
  toasts,
  aoFechar,
  aoPausar,
  aoRetomar,
}: {
  toasts: Toast[];
  aoFechar: (id: string) => void;
  aoPausar: (id: string) => void;
  aoRetomar: (id: string, tipo: TipoToast) => void;
}) {
  const { reduzido } = useMotion();

  return (
    <div
      role="region"
      aria-label="Notificações"
      className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-full max-w-sm flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            // `layout` faz os toasts existentes DESLIZAREM para abrir espaço
            // ao novo, em vez de pularem. É o empilhamento pedido no CP3.
            layout={!reduzido}
            initial={{ opacity: 0, x: reduzido ? 0 : 32, scale: reduzido ? 1 : 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1, transition: reduzido ? { duration: DURACAO.fast } : SPRING.padrao }}
            exit={{ opacity: 0, x: reduzido ? 0 : 32, transition: { duration: DURACAO.fast, ease: EASE.out } }}
            role={t.tipo === "erro" ? "alert" : "status"}
            aria-live={t.tipo === "erro" ? "assertive" : "polite"}
            onPointerEnter={() => aoPausar(t.id)}
            onPointerLeave={() => aoRetomar(t.id, t.tipo)}
            onFocus={() => aoPausar(t.id)}
            onBlur={() => aoRetomar(t.id, t.tipo)}
            className={cn(
              "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-container",
              "border border-subtle bg-overlay p-4 pl-5 shadow-overlay",
            )}
          >
            <span aria-hidden="true" className={cn("absolute left-0 top-0 h-full w-1", ESTILO[t.tipo].barra)} />
            <span className="mt-px shrink-0">{ESTILO[t.tipo].icone}</span>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium text-fg">{t.titulo}</p>
              {t.descricao && <p className="text-xs text-fg-muted">{t.descricao}</p>}
            </div>
            <button
              type="button"
              aria-label="Fechar notificação"
              onClick={() => aoFechar(t.id)}
              className="alvo-estendido shrink-0 rounded-control p-1 text-fg-muted transition-colors duration-fast hover:bg-hovered hover:text-fg"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function useToast(): ContextoToast {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
