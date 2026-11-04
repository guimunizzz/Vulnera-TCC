import { memo, useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { movimentoReduzido, observarAcessibilidade, useMovimentoReduzido } from "../../design/accessibility";
import "@fontsource-variable/inter";
import "./login-page.css";

const BACKGROUND_FADE_MS = 550;

// O SVG estático não precisa reconciliar seus caminhos a cada troca de rota.
const AuthCircuit = memo(function AuthCircuit({ patternId, svgRef }: {
  patternId: string;
  svgRef: RefObject<SVGSVGElement>;
}) {
  return (
    <svg ref={svgRef} className="vx-login-circuit" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <pattern id={patternId} width="192" height="192" patternUnits="userSpaceOnUse">
          <g className="vx-login-pattern-lines">
            <path d="M12 30V12H30 M54 12H72V30 M72 54V72H54 M30 72H12V54" />
            <circle cx="42" cy="42" r="21" />
            <path d="M34 32L42 51L50 32 M114 20L134 40L114 60 M154 20L134 40L154 60" />
            <path d="M120 120H148V148H120Z M134 106V118 M134 150V162 M106 134H118 M150 134H162" />
            <path d="M16 116L36 136L16 156 M44 116L64 136L44 156" />
          </g>
          <g className="vx-login-pattern-solid">
            <path d="M114 20H128V34Z M154 60H140V46Z M130 130H138V138H130Z" />
            <circle cx="90" cy="90" r="2" />
          </g>
        </pattern>
      </defs>
      <rect width="1440" height="900" fill={`url(#${patternId})`} />
      <text x="720" y="510" textAnchor="middle" className="vx-login-background-word">VULNERA</text>
      <g className="vx-login-tracks">
        <path d="M0 170 H180 L340 330 H480 M0 730 H180 L340 570 H480" />
        <path d="M1440 170 H1260 L1100 330 H960 M1440 730 H1260 L1100 570 H960" />
        <path d="M120 0 V210 L270 360 V540 L120 690 V900" />
        <path d="M1320 0 V210 L1170 360 V540 L1320 690 V900" />
        <path d="M0 450 H360 M1080 450 H1440" />
        <circle cx="360" cy="450" r="4" />
        <circle cx="1080" cy="450" r="4" />
      </g>
      <g className="vx-login-emblem">
        <path d="M720 92 C816 146 908 164 1000 184 V414 C1000 606 888 744 720 820 C552 744 440 606 440 414 V184 C532 164 624 146 720 92Z" />
        <path d="M720 174 V726 M535 262 H635 L720 347 L805 262 H905 M512 548 H620 L720 448 L820 548 H928" />
        <circle cx="720" cy="448" r="78" />
        <circle cx="535" cy="262" r="5" />
        <circle cx="905" cy="262" r="5" />
        <circle cx="512" cy="548" r="5" />
        <circle cx="928" cy="548" r="5" />
      </g>
      <g className="vx-login-signals">
        <path pathLength="100" d="M0 170 H180 L340 330 H480" />
        <path pathLength="100" d="M1440 730 H1260 L1100 570 H960" />
        <path pathLength="100" d="M1320 0 V210 L1170 360 V540 L1320 690 V900" />
      </g>
      <g className="vx-login-pulses">
        <circle r="3.5">
          <animateMotion dur="14s" repeatCount="indefinite" path="M0 170 H180 L340 330 H480" />
        </circle>
        <circle r="3.5">
          <animateMotion dur="17s" begin="-7s" repeatCount="indefinite" path="M1440 730 H1260 L1100 570 H960" />
        </circle>
        <circle r="3.5">
          <animateMotion dur="20s" begin="-11s" repeatCount="indefinite" path="M1320 0 V210 L1170 360 V540 L1320 690 V900" />
        </circle>
      </g>
    </svg>
  );
});

// O cenário permanece montado enquanto apenas o formulário troca de rota.
export function AuthLayout() {
  const loginRef = useRef<HTMLElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const circuitRef = useRef<SVGSVGElement>(null);
  const backgroundTimerRef = useRef<number>();
  const backgroundMotionRef = useRef(false);
  const refreshBackgroundRef = useRef<((fadeOut?: boolean) => void) | null>(null);
  const pointerFrameRef = useRef<number>();
  const pointerPositionRef = useRef({ x: 0, y: 0 });
  const patternId = useId();
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const reducedMotion = useMovimentoReduzido();
  const isRegister = pathname.replace(/\/+$/, "").toLowerCase() === "/register";
  const direction = isRegister ? 1 : -1;

  useEffect(() => {
    const hover = window.matchMedia("(hover: none)");

    function cancelPointerFrame(): void {
      if (pointerFrameRef.current !== undefined) {
        cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = undefined;
      }
    }

    function setPlaying(playing: boolean): void {
      const page = loginRef.current;
      if (!page) return;
      if (page.dataset.backgroundRunning !== String(playing)) {
        page.dataset.backgroundRunning = String(playing);
        if (playing) circuitRef.current?.unpauseAnimations?.();
        else circuitRef.current?.pauseAnimations?.();
      }
    }

    function syncPlayback(fadeOut = false): void {
      const page = loginRef.current;
      if (!page) return;
      if (backgroundTimerRef.current !== undefined) {
        window.clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = undefined;
      }
      const visible = !document.hidden;
      const allowed = visible && !movimentoReduzido();
      backgroundMotionRef.current = allowed;
      page.dataset.pageVisible = String(visible);
      if (!allowed) {
        cancelPointerFrame();
        page.dataset.revealActive = "false";
      }
      const playing = allowed && (hover.matches || page.dataset.revealActive === "true");
      // Mantém os sinais durante o fade de 550ms e retoma do mesmo ponto.
      if (!playing && fadeOut && allowed && page.dataset.backgroundRunning === "true") {
        backgroundTimerRef.current = window.setTimeout(() => {
          backgroundTimerRef.current = undefined;
          syncPlayback();
        }, BACKGROUND_FADE_MS);
      } else setPlaying(playing);
    }

    const mediaChanged = () => syncPlayback(true);
    const visibilityChanged = () => syncPlayback();
    refreshBackgroundRef.current = syncPlayback;
    syncPlayback();
    hover.addEventListener("change", mediaChanged);
    const pararDeObservar = observarAcessibilidade(mediaChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      cancelPointerFrame();
      if (backgroundTimerRef.current !== undefined) window.clearTimeout(backgroundTimerRef.current);
      refreshBackgroundRef.current = null;
      hover.removeEventListener("change", mediaChanged);
      pararDeObservar();
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  function revelarFundo(event: ReactPointerEvent<HTMLElement>): void {
    const page = loginRef.current;
    if (!page || !backgroundMotionRef.current || event.pointerType === "touch") return;
    pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    if (page.dataset.revealActive !== "true") {
      page.dataset.revealActive = "true";
      refreshBackgroundRef.current?.();
    }
    if (pointerFrameRef.current !== undefined) return;

    // Só as duas camadas decorativas mudam, no máximo uma vez por frame.
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = undefined;
      const current = loginRef.current;
      if (!current || !backgroundMotionRef.current || document.hidden) return;
      const bounds = current.getBoundingClientRect();
      const x = `${pointerPositionRef.current.x - bounds.left}px`;
      const y = `${pointerPositionRef.current.y - bounds.top}px`;
      for (const layer of [backgroundRef.current, glowRef.current]) {
        layer?.style.setProperty("--login-mouse-x", x);
        layer?.style.setProperty("--login-mouse-y", y);
      }
    });
  }

  function ocultarFundo(): void {
    if (pointerFrameRef.current !== undefined) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = undefined;
    }
    if (loginRef.current) loginRef.current.dataset.revealActive = "false";
    refreshBackgroundRef.current?.(true);
  }

  return (
    <main ref={loginRef} className={isRegister ? "vx-login vx-register" : "vx-login"} onPointerMove={revelarFundo} onPointerLeave={ocultarFundo}>
      <div ref={glowRef} className="vx-login-glow" aria-hidden="true" />
      <div ref={backgroundRef} className="vx-login-background" aria-hidden="true">
        <AuthCircuit patternId={patternId} svgRef={circuitRef} />
      </div>

      <div className="vx-login-stage">
        <div className="vx-auth-card">
          <header className="vx-login-header">
            <Link to="/" className="vx-login-brand" aria-label="Vulnera — página inicial">
              <span className="vx-login-wordmark">
                VULNERA<span className="vx-login-cursor" aria-hidden="true" />
              </span>
              <span className="vx-login-brand-security">SECURITY</span>
            </Link>
          </header>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={pathname}
              className="vx-auth-transition"
              custom={direction}
              variants={{
                enter: (side: number) => ({ opacity: 0, x: reducedMotion ? 0 : side * 24 }),
                visible: { opacity: 1, x: 0 },
                exit: (side: number) => ({
                  opacity: 0,
                  x: reducedMotion ? 0 : side * -24,
                  transition: { duration: reducedMotion ? 0 : .18 },
                }),
              }}
              initial="enter"
              animate="visible"
              exit="exit"
              transition={{ duration: reducedMotion ? 0 : .36, ease: [.22, 1, .36, 1] }}
              onAnimationComplete={(definition) => {
                if (definition === "visible") {
                  loginRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
                }
              }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
