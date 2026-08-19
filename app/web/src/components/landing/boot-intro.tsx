/**
 * boot-intro.tsx
 *
 * O QUE FAZ
 * Tela de abertura da landing: ~2,5s de "boot de terminal" (linhas de log
 * monoespaçadas empilhando, cursor piscando) sobre a MESMA cena Three.js do
 * hero (`CyberCanvas`, via `lazy()`) — a cena "ligando" atrás do log é a
 * piada visual. Pulada inteiramente se `prefers-reduced-motion` pedir menos
 * movimento, e mostrada no máximo uma vez por aba (`sessionStorage`) — voltar
 * pra "/" depois de navegar pro dashboard não repete o boot.
 *
 * POR QUE REAPROVEITA O `CyberCanvas` EM VEZ DE UMA CENA NOVA
 * `CyberCanvas`/`useHeroScene` já foram validados de verdade num Chromium
 * real (não só `jsdom`) na task 8.12 — três bugs de WebGL só apareceram
 * nessa validação (ver ADR-026). Escrever uma SEGUNDA cena Three.js só para
 * o intro duplicaria esse risco sem necessidade; o custo aceito é montar o
 * WebGL duas vezes em sequência (intro → dispose → hero monta de novo), que
 * na pior das hipóteses mostra o gradiente de fallback por uma fração de
 * segundo a mais — nunca uma tela quebrada.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * `role="status"` + `aria-live="polite"` com um rótulo curto ("Carregando
 * Vulnera") — quem usa leitor de tela ouve isso uma vez, não as linhas
 * decorativas uma a uma (elas são puramente visuais). Pulável a qualquer
 * momento por clique, toque (`pointerdown`) ou qualquer tecla — um intro que
 * força 2,5s de espera sem saída é hostil, especialmente pra quem já viu.
 * `prefers-reduced-motion` pula o intro por completo: nem monta, nem atrasa
 * o `onFinished`.
 * ==========================================================================
 *
 * QUEM USA
 * `landing-page.tsx`.
 */

import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useMotion } from "../../motion/use-motion";
import { HeroFallback } from "./hero-fallback";
import { LANDING_PARTICLE } from "./landing-palette";

const CyberCanvas = lazy(() => import("./cyber-canvas").then((m) => ({ default: m.CyberCanvas })));

/** Exportado pro teste não duplicar a string à mão (mesmo padrão de
 * `CHAVE_STORAGE` em `design/theme.ts`). */
export const INTRO_SESSION_KEY = "vulnera:landing-intro-visto";

const INTRO_DURATION_MS = 2500;
const FIRST_LINE_DELAY_MS = 200;
const LINE_STAGGER_MS = 260;

const BOOT_LINES = [
  "vulnera_appsec_suite --init",
  "carregando motor cvss.......... [OK]",
  "montando trilha de auditoria... [OK]",
  "calibrando risk score.......... [OK]",
  "sessão segura estabelecida",
] as const;

function jaViuNestaSessao(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  } catch {
    return false; // sessionStorage lança em modo privado de alguns navegadores — não bloqueia o intro por isso
  }
}

function marcarComoVisto(): void {
  try {
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
  } catch {
    // idem — falhar aqui não pode impedir a landing de carregar
  }
}

export interface BootIntroProps {
  /** Chamado uma única vez, quando o intro deve sair (pulado, terminado, ou
   * nem exibido porque `prefers-reduced-motion`/já visto nesta sessão). */
  onFinished: () => void;
}

type Fase = "decidindo" | "ativo" | "saindo" | "concluido";

export function BootIntro({ onFinished }: BootIntroProps) {
  const { reduzido, scrim } = useMotion();
  const [fase, setFase] = useState<Fase>("decidindo");

  // Decide UMA vez, ao montar, se o intro roda ou pula direto.
  useEffect(() => {
    if (reduzido || jaViuNestaSessao()) {
      marcarComoVisto();
      setFase("concluido");
      return;
    }
    marcarComoVisto();
    setFase("ativo");
  }, [reduzido]);

  // Enquanto ativo: timer de 2,5s + qualquer interação pula na hora.
  useEffect(() => {
    if (fase !== "ativo") return;
    const pular = (): void => setFase("saindo");
    const timer = window.setTimeout(pular, INTRO_DURATION_MS);
    window.addEventListener("keydown", pular);
    window.addEventListener("pointerdown", pular);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", pular);
      window.removeEventListener("pointerdown", pular);
    };
  }, [fase]);

  useEffect(() => {
    if (fase === "concluido") onFinished();
  }, [fase, onFinished]);

  if (fase === "decidindo" || fase === "concluido") return null;

  return (
    <motion.div
      variants={scrim}
      initial="inicial"
      animate={fase === "saindo" ? "saindo" : "visivel"}
      onAnimationComplete={(variante) => {
        if (variante === "saindo") setFase("concluido");
      }}
      role="status"
      aria-live="polite"
      aria-label="Carregando Vulnera"
      className="fixed inset-0 z-modal flex items-center justify-center overflow-hidden bg-canvas"
    >
      <HeroFallback />
      <Suspense fallback={null}>
        <CyberCanvas />
      </Suspense>

      <div
        className="relative flex flex-col gap-1 px-4 font-mono text-sm sm:text-base"
        style={{ color: LANDING_PARTICLE.spark }}
      >
        {BOOT_LINES.map((linha, i) => (
          <p
            key={linha}
            className="boot-line"
            style={{ animationDelay: `${FIRST_LINE_DELAY_MS + i * LINE_STAGGER_MS}ms` }}
          >
            {linha}
          </p>
        ))}
        <p
          aria-hidden="true"
          className="boot-line boot-cursor"
          style={{ animationDelay: `${FIRST_LINE_DELAY_MS + BOOT_LINES.length * LINE_STAGGER_MS}ms` }}
        >
          _
        </p>
        <p
          className="boot-line mt-4 text-xs text-fg-muted"
          style={{ animationDelay: `${FIRST_LINE_DELAY_MS + (BOOT_LINES.length + 1) * LINE_STAGGER_MS}ms` }}
        >
          clique, toque ou pressione qualquer tecla para pular
        </p>
      </div>
    </motion.div>
  );
}
