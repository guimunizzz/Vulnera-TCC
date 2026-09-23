import { useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import "@fontsource-variable/inter";
import "./login-page.css";

// O cenário permanece montado enquanto apenas o formulário troca de rota.
export function AuthLayout() {
  const loginRef = useRef<HTMLElement>(null);
  const patternId = useId();
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const reducedMotion = useReducedMotion();
  const direction = pathname === "/register" ? 1 : -1;

  function revelarFundo(event: ReactPointerEvent<HTMLElement>): void {
    const pagina = loginRef.current;
    if (!pagina || event.pointerType === "touch") return;

    const limites = pagina.getBoundingClientRect();
    pagina.style.setProperty("--login-mouse-x", `${event.clientX - limites.left}px`);
    pagina.style.setProperty("--login-mouse-y", `${event.clientY - limites.top}px`);
    pagina.dataset.revealActive = "true";
  }

  function ocultarFundo(): void {
    if (loginRef.current) loginRef.current.dataset.revealActive = "false";
  }

  return (
    <main ref={loginRef} className="vx-login" onPointerMove={revelarFundo} onPointerLeave={ocultarFundo}>
      <div className="vx-login-background" aria-hidden="true">
        <svg className="vx-login-circuit" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
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
      </div>

      <header className="vx-login-header">
        <Link to="/" className="vx-login-brand" aria-label="Vulnera — página inicial">
          VULNERA<span className="vx-login-cursor" aria-hidden="true" />
        </Link>
      </header>

      <div className="vx-login-stage">
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

      <footer className="vx-login-footer">
        <span className="vx-login-footer-brand"><span aria-hidden="true">//</span> VULNERA SECURITY</span>
        <span>Gestão de vulnerabilidades</span>
        <span className="vx-login-footer-decoration" aria-hidden="true">+ + +</span>
      </footer>
    </main>
  );
}

