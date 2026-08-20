/**
 * accordion.tsx
 *
 * O QUE FAZ
 * Seções recolhíveis. Uma aberta por vez, ou várias.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE (padrão APG "Accordion")
 * ==========================================================================
 * ROLE / ARIA
 *   - Cabeçalho é `<h3><button>`: o `<h3>` põe a seção no sumário de títulos
 *     do leitor de tela (é assim que se pula de seção em seção), e o
 *     `<button>` é o que responde a Enter/Espaço.
 *   - `aria-expanded` no botão · `aria-controls` → id do painel ·
 *     `aria-labelledby` no painel → id do botão.
 *   - `role="region"` no painel só quando ABERTO: uma region escondida
 *     continuaria na lista de landmarks, prometendo conteúdo que não está lá.
 *
 * TECLADO
 *   Tab percorre os cabeçalhos · Enter/Espaço alternam. Sem setas de propósito:
 *   o padrão APG as marca como opcionais, e aqui os cabeçalhos são poucos e
 *   entremeados de conteúdo, onde o Tab é mais previsível.
 *
 * CONTEÚDO ESCONDIDO
 *   O painel fechado é DESMONTADO, não escondido com CSS. `display: none`
 *   bastaria para o leitor de tela, mas manter 30 painéis montados numa lista
 *   de findings custa render e mantém requisições vivas.
 * ==========================================================================
 *
 * QUEM USA
 * Detalhe de finding (evidências, comentários, trilha de auditoria), filtros
 * avançados, FAQ de planos.
 */

import { useCallback, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import { useMotion } from "../../motion/use-motion";
import { DURACAO, EASE } from "../../motion/tokens";

export interface SecaoAccordion {
  id: string;
  titulo: ReactNode;
  /** Texto/contagem à direita do título. */
  meta?: ReactNode;
  conteudo: ReactNode;
}

export function Accordion({
  secoes,
  multiplas = false,
  abertasPorPadrao = [],
  className,
}: {
  secoes: SecaoAccordion[];
  /** Permite várias abertas ao mesmo tempo. */
  multiplas?: boolean;
  abertasPorPadrao?: string[];
  className?: string;
}) {
  const [abertas, setAbertas] = useState<string[]>(abertasPorPadrao);
  const base = useId();
  const { reduzido } = useMotion();

  const alternar = useCallback(
    (id: string) => {
      setAbertas((atual) => {
        if (atual.includes(id)) return atual.filter((x) => x !== id);
        return multiplas ? [...atual, id] : [id];
      });
    },
    [multiplas],
  );

  return (
    <div className={cn("flex flex-col divide-y divide-subtle", className)}>
      {secoes.map((s) => {
        const aberta = abertas.includes(s.id);
        const idBotao = `${base}-botao-${s.id}`;
        const idPainel = `${base}-painel-${s.id}`;

        return (
          <div key={s.id}>
            <h3>
              <button
                type="button"
                id={idBotao}
                aria-expanded={aberta}
                aria-controls={idPainel}
                onClick={() => alternar(s.id)}
                className={cn(
                  "flex min-h-touch w-full items-center gap-3 py-3 text-left text-sm font-medium text-fg",
                  "transition-colors duration-fast hover:text-accent-ink",
                )}
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0 text-fg-muted transition-transform duration-fast ease-out",
                    aberta && "rotate-90",
                  )}
                  fill="none"
                >
                  <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="flex-1">{s.titulo}</span>
                {s.meta && <span className="shrink-0 text-xs text-fg-muted">{s.meta}</span>}
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {aberta && (
                <motion.div
                  id={idPainel}
                  role="region"
                  aria-labelledby={idBotao}
                  // `height: auto` animado é a única exceção à regra "só
                  // transform e opacity": não há como abrir um acordeão sem
                  // animar altura. O `motion` mede e interpola em vez de
                  // deixar o CSS fazer layout a cada quadro.
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduzido ? 0 : DURACAO.base, ease: EASE.emphasized }}
                  className="overflow-hidden"
                >
                  <div className="pb-4 text-sm text-fg-secondary">{s.conteudo}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
