/**
 * ui.tsx — primitivas visuais compartilhadas pelas seções da landing.
 *
 * Portado de `vulnera-landing/src/components/ui.jsx`. `framer-motion` virou
 * `motion/react` (mesma API para o que usamos aqui); o resto é só tipagem.
 */

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { motion } from "motion/react";
import { movimentoReduzido, observarAcessibilidade, useMovimentoReduzido } from "../../design/accessibility";
import { gsap } from "./motion/gsap";
import { useMovimentoLanding } from "./motion/use-landing-motion";
import {
  DECODIFICACAO_LANDING,
  DESLOCAMENTO_MOTION_LANDING,
  DURACAO_MOTION_LANDING,
  EASE_LANDING,
  EASE_MOTION_LANDING,
  ESCALONAMENTO_MOTION_LANDING,
  MASCARA_LANDING,
  SCRUB_LANDING,
} from "./motion/tokens";

type RevealTag = "div" | "li" | "span" | "section" | "p";

/**
 * Como o bloco entra, conforme o tipo de conteúdo:
 *   - `subir`   — cards e itens de lista, em sequência (fade + deslocamento);
 *   - `fade`    — cabeçalho de seção: o título já se decodifica, então o bloco
 *                 só aparece, sem um segundo movimento por cima;
 *   - `mascara` — mockup e tabela: o recorte abre de cima para baixo, como
 *                 uma tela sendo desenhada.
 * Com movimento reduzido, as três viram fade.
 */
export type VarianteReveal = "subir" | "fade" | "mascara";

interface RevealProps {
  children: ReactNode;
  /** Posição na sequência: o atraso é `ordem × ESCALONAMENTO_MOTION_LANDING.revelacao`. */
  ordem?: number;
  className?: string;
  as?: RevealTag;
  variante?: VarianteReveal;
}

function estadosDoReveal(variante: VarianteReveal, reduzido: boolean) {
  if (reduzido || variante !== "subir") return { inicial: { opacity: 0 }, final: { opacity: 1 } };
  return { inicial: { opacity: 0, y: DESLOCAMENTO_MOTION_LANDING.revelacao }, final: { opacity: 1, y: 0 } };
}

/** Reveal — entrada quando o elemento entra na viewport (`whileInView`, uma vez). */
export function Reveal({ children, ordem = 0, className = "", as = "div", variante = "subir" }: RevealProps) {
  const Comp = (motion[as] ?? motion.div) as typeof motion.div;
  // O recorte não é transform: o MotionConfig "always" não o corta sozinho.
  const reduzido = useMovimentoReduzido();
  const { inicial, final } = estadosDoReveal(variante, reduzido);
  const transicao = {
    duration: DURACAO_MOTION_LANDING.entrada,
    ease: EASE_MOTION_LANDING.saida,
    delay: ordem * ESCALONAMENTO_MOTION_LANDING.revelacao,
  };

  // ⚠️ A máscara fica num filho, nunca no elemento observado: o Chrome desconta
  // o `clip-path` do próprio alvo na interseção, e um recorte que começa
  // fechado nunca "entra na tela" — o bloco ficava invisível para sempre.
  if (variante === "mascara" && !reduzido) {
    return (
      <Comp className={className} initial="oculto" whileInView="visivel" viewport={{ once: true, amount: 0.15 }}>
        <motion.div
          variants={{
            oculto: { opacity: 0, clipPath: MASCARA_LANDING.fechada },
            visivel: { opacity: 1, clipPath: MASCARA_LANDING.aberta },
          }}
          transition={transicao}
        >
          {children}
        </motion.div>
      </Comp>
    );
  }

  return (
    <Comp
      className={className}
      initial={inicial}
      whileInView={final}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: DURACAO_MOTION_LANDING.entrada,
        ease: EASE_MOTION_LANDING.saida,
        delay: ordem * ESCALONAMENTO_MOTION_LANDING.revelacao,
      }}
    >
      {children}
    </Comp>
  );
}

interface GlitchHeadingProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

interface TituloDecodificadoProps {
  children: string;
  className?: string;
  as?: ElementType;
}

/**
 * TituloDecodificado — título de seção que, ao entrar na tela, passa letra a
 * letra por glifos de terminal até assentar. Toca UMA vez; com movimento
 * reduzido (sistema ou menu), não toca.
 *
 * Cada letra tem um "slot": a letra original, invisível durante o efeito,
 * segura a largura, e o glifo fica por cima — o título não treme numa fonte
 * proporcional. Palavras não quebram no meio (`white-space: nowrap`). O nome
 * acessível vem do `sr-only`; os slots são `aria-hidden`. A troca de glifo é
 * DOM direto num rAF, sem estado React por quadro.
 */
export function TituloDecodificado({ children, className = "", as: Tag = "h2" }: TituloDecodificadoProps) {
  const raiz = useRef<HTMLElement>(null);
  const palavras = children.split(" ");

  useEffect(() => {
    const titulo = raiz.current;
    if (!titulo || typeof IntersectionObserver === "undefined") return;
    const letras = Array.from(children.replace(/ /g, ""));
    const glifos = Array.from(titulo.querySelectorAll<HTMLElement>(".vx-decode-glifo"));
    const { porLetraMs, minimoMs, maximoMs, passoMs, limiarVisivel, glifos: alfabeto } = DECODIFICACAO_LANDING;
    const duracao = Math.min(maximoMs, Math.max(minimoMs, letras.length * porLetraMs));
    let quadro: number | undefined;

    const parar = () => {
      if (quadro !== undefined) cancelAnimationFrame(quadro);
      quadro = undefined;
      delete titulo.dataset.decodificando;
      glifos.forEach((glifo, i) => { glifo.textContent = letras[i]; glifo.classList.remove("vx-decode-ruido"); });
    };

    const tocar = () => {
      if (movimentoReduzido()) return;
      const inicio = performance.now();
      let ultimoPasso = -1;
      titulo.dataset.decodificando = "true";
      const passo = (agora: number) => {
        const decorrido = agora - inicio;
        if (decorrido >= duracao || document.hidden) { parar(); return; }
        const indice = Math.floor(decorrido / passoMs);
        if (indice !== ultimoPasso) {
          ultimoPasso = indice;
          const assentadas = Math.floor((decorrido / duracao) * letras.length);
          glifos.forEach((glifo, i) => {
            const ruido = i >= assentadas;
            glifo.textContent = ruido ? alfabeto[Math.floor(Math.random() * alfabeto.length)] : letras[i];
            // Só o ruído é violeta: a letra assentada já tem a cor final.
            glifo.classList.toggle("vx-decode-ruido", ruido);
          });
        }
        quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    };

    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      tocar();
    }, { threshold: limiarVisivel });
    observador.observe(titulo);
    const pararDeObservar = observarAcessibilidade(() => { if (movimentoReduzido()) parar(); });

    return () => {
      observador.disconnect();
      pararDeObservar();
      parar();
    };
  }, [children]);

  return (
    <Tag ref={raiz} className={`vx-decode ${className}`}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {palavras.map((palavra, p) => (
          <span key={p}>
            {p > 0 && " "}
            <span className="vx-decode-palavra">
              {Array.from(palavra, (letra, i) => (
                <span key={i} className="vx-decode-slot">
                  <span className="vx-decode-letra">{letra}</span>
                  <span className="vx-decode-glifo">{letra}</span>
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}

/**
 * GlitchHeading — heading com efeito glitch RGB em hover. Reservado ao hero e
 * à chamada final: se todo título dá glitch, o glitch deixa de chamar atenção.
 * Os títulos de seção usam `TituloDecodificado`. (3 camadas: base,
 * magenta -2px, ciano +2px). Ver `.vx-glitch` em landing.css.
 */
export function GlitchHeading({ children, className = "", as: Tag = "h2" }: GlitchHeadingProps) {
  return (
    <Tag className={`vx-glitch ${className}`}>
      <span className="vx-glitch-base relative z-10 inline-block">{children}</span>
      <span className="vx-glitch-layer vx-glitch-r" aria-hidden="true">
        {children}
      </span>
      <span className="vx-glitch-layer vx-glitch-c" aria-hidden="true">
        {children}
      </span>
    </Tag>
  );
}

/**
 * ScrollProgress — barra neon no topo que acompanha a rolagem da página.
 *
 * Efeito guiado por scroll, então é GSAP (ScrollTrigger com scrub), não
 * Motion. O scrub curto substitui a spring que existia antes. Sob movimento
 * reduzido a barra continua — ela informa a posição, como uma barra de
 * rolagem —, mas colada ao scroll, sem a suavização que a faz "deslizar".
 */
export function ScrollProgress() {
  const barra = useRef<HTMLDivElement>(null);

  useMovimentoLanding(barra, ({ reduzido }) => {
    gsap.fromTo(
      barra.current,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: EASE_LANDING.linear,
        scrollTrigger: { start: 0, end: "max", scrub: reduzido ? true : SCRUB_LANDING.barra },
      },
    );
  });

  return (
    <div
      ref={barra}
      className="fixed left-0 right-0 top-0 z-[45] h-[2px] origin-left bg-[var(--vx-accent)]"
      style={{ transform: "scaleX(0)", boxShadow: "0 0 8px rgba(var(--vx-accent-rgb),0.8)" }}
      aria-hidden="true"
    />
  );
}
