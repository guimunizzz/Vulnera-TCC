/**
 * motion/components.tsx
 *
 * O QUE FAZ
 * Os quatro padrões de movimento que aparecem em mais de um lugar do produto:
 * lista escalonada, número animado, troca de conteúdo e transição de rota.
 *
 * POR QUE COMPONENTES E NÃO RECEITAS COPIADAS
 * Cada um deles tem uma armadilha específica que só se descobre depois de
 * errar. Encapsuladas aqui, ninguém precisa redescobrir:
 *   - lista: reanimar a cada refetch faz o conteúdo PULAR quando o cache
 *     atualiza. Anima só na primeira montagem.
 *   - número: sem `tabular-nums` a largura oscila enquanto conta; e um valor
 *     que muda 60× por segundo é ruído puro para leitor de tela.
 *   - troca: sem reservar o espaço antes, o crossfade vira salto de layout.
 *   - rota: qualquer deslocamento enjoa em navegação frequente.
 *
 * QUEM USA
 * Dashboards (CP5), listas de findings, KPIs, e o `AppLayout` (rota).
 */

import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMotion } from "./use-motion";
import { STAGGER_MAX_ITENS } from "./tokens";

/* ==========================================================================
   Lista escalonada
   ========================================================================== */

/**
 * Container de lista com entrada escalonada.
 *
 * ⚠️ O escalonamento roda UMA vez, na primeira montagem. Reanimar a cada
 * atualização de dados é o erro clássico: o TanStack Query revalida em foco de
 * janela, a lista inteira re-escalona, e o item que a pessoa ia clicar se move
 * debaixo do cursor.
 */
export function StaggerList({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "tbody";
}) {
  const { lista } = useMotion();
  const jaAnimou = useRef(false);
  const animarAgora = !jaAnimou.current;
  useEffect(() => {
    jaAnimou.current = true;
  }, []);

  const MotionTag = motion[Tag];
  return (
    <MotionTag
      className={className}
      variants={lista}
      initial={animarAgora ? "inicial" : false}
      animate="visivel"
    >
      {children}
    </MotionTag>
  );
}

/** Item de uma `StaggerList`. O índice existe só para respeitar o teto. */
export function StaggerItem({
  children,
  className,
  indice = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  indice?: number;
  as?: "div" | "li" | "tr";
}) {
  const { item } = useMotion();
  const MotionTag = motion[Tag];
  // Acima do teto o item entra junto com o bloco, sem atraso próprio: numa
  // tabela de 200 linhas o último entraria 6 segundos depois do primeiro.
  const participa = indice < STAGGER_MAX_ITENS;
  return (
    <MotionTag className={className} variants={participa ? item : undefined}>
      {children}
    </MotionTag>
  );
}

/* ==========================================================================
   Número animado
   ========================================================================== */

export interface NumeroAnimadoProps {
  valor: number;
  /** Como escrever o número. Recebe o valor JÁ arredondado. */
  formatar?: (n: number) => string;
  /** Casas decimais durante a contagem. 0 para inteiros. */
  casas?: number;
  className?: string;
}

/**
 * Contador que interpola do valor anterior ao novo.
 *
 * ACESSIBILIDADE
 * O span que anima é `aria-hidden`: um leitor de tela não deve ouvir "12, 15,
 * 19, 23, 27" — deve ouvir o resultado. O valor final vai num `.sr-only`
 * irmão, que é o que de fato é anunciado.
 *
 * LARGURA
 * `tabular-nums` (aplicado em `base.css` via `[data-numeric]`) é obrigatório:
 * sem ele, "1" é mais estreito que "8" e o KPI encolhe e cresce enquanto conta.
 */
export function NumeroAnimado({ valor, formatar, casas = 0, className }: NumeroAnimadoProps) {
  const { numero, reduzido } = useMotion();
  const escrever = formatar ?? ((n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas }));

  const bruto = useMotionValue(valor);
  const suavizado = useSpring(bruto, numero);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    bruto.set(valor);
  }, [valor, bruto]);

  useMotionValueEvent(suavizado, "change", (v) => {
    if (!ref.current) return;
    const arredondado = casas === 0 ? Math.round(v) : Number(v.toFixed(casas));
    ref.current.textContent = escrever(arredondado);
  });

  // Com movimento reduzido o número simplesmente troca — contar é movimento.
  if (reduzido) {
    return (
      <span className={className} data-numeric>
        {escrever(valor)}
      </span>
    );
  }

  return (
    <span className={className} data-numeric>
      <span ref={ref} aria-hidden="true">
        {escrever(valor)}
      </span>
      <span className="sr-only">{escrever(valor)}</span>
    </span>
  );
}

/* ==========================================================================
   Troca de conteúdo (skeleton → dados, aba → aba)
   ========================================================================== */

/**
 * Crossfade entre dois conteúdos no mesmo lugar.
 *
 * ⚠️ Quem chama é responsável por reservar a altura ANTES (o skeleton tem que
 * ter a forma final). Sem isso o crossfade vira salto de layout, que é pior que
 * não animar nada.
 */
export function TrocaDeConteudo({
  chave,
  children,
  className,
}: {
  /** Muda quando o conteúdo muda. Ex: "carregando" | "pronto" | id da aba. */
  chave: string;
  children: ReactNode;
  className?: string;
}) {
  const { troca } = useMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={chave} className={className} variants={troca} initial="inicial" animate="visivel" exit="saindo">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ==========================================================================
   Transição de rota
   ========================================================================== */

/**
 * Crossfade curto entre páginas — SEM deslocamento.
 *
 * Deslocar a página inteira parece sofisticado na primeira navegação e enjoa na
 * vigésima. Numa ferramenta em que a pessoa alterna entre projeto e finding o
 * dia todo, a única coisa que o movimento precisa dizer é "trocou de página",
 * e opacidade diz isso em 150ms.
 */
export function TransicaoDeRota({ chave, children }: { chave: string; children: ReactNode }) {
  const { reduzido } = useMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={chave}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduzido ? 0.05 : 0.15 }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ==========================================================================
   Desenho progressivo de gráfico
   ========================================================================== */

/**
 * Diz ao gráfico se ele deve animar AGORA.
 *
 * O Recharts reanima a cada re-render por padrão. Num dashboard com filtros,
 * isso significa a linha se redesenhando inteira a cada tecla digitada na
 * busca. Este hook devolve `true` só na primeira vez que o gráfico recebe
 * dados; depois disso, os pontos se movem, mas o traçado não recomeça.
 */
export function useDesenhoInicial(temDados: boolean): { animar: boolean; duracaoMs: number } {
  const { duracaoGraficoMs } = useMotion();
  const [jaDesenhou, setJaDesenhou] = useState(false);

  useEffect(() => {
    if (temDados && !jaDesenhou) setJaDesenhou(true);
  }, [temDados, jaDesenhou]);

  return { animar: !jaDesenhou, duracaoMs: duracaoGraficoMs };
}
