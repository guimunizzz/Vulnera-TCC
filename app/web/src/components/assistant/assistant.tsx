/**
 * Instância autenticada do assistente: portal persistente, movimento e painel de conversa.
 * Consumida por AuthenticatedLayout; respeita os modais existentes e isola cada nova sessão.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Portal } from "../ui/_internal/portal";
import { useAuthStore } from "../../store/auth.store";
import { usePreferenciasAcessibilidade } from "../../design/accessibility";
import { assistantDestination, assistantScreen } from "../../lib/assistant-context";
import type { UserRole } from "../../types/auth.types";
import { AssistantMascot } from "./assistant-mascot";
import { AssistantPanel } from "./assistant-panel";
import { useAssistantConversation } from "./use-assistant-conversation";
import { ASSISTANT_FOOTPRINT, useAssistantMotion } from "./use-assistant-motion";
import { VUVU_SIX_SEVEN } from "./vuvu-sprite";
import "./assistant.css";

export function Assistant() {
  const user = useAuthStore((state) => state.user);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  if (!user) return null;
  return <AssistantSession key={`${sessionVersion}:${user.id}:${user.role}`} role={user.role} />;
}

function AssistantSession({ role }: { role: UserRole }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const screen = assistantScreen(pathname);
  const conversation = useAssistantConversation(role);
  const [open, setOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [blocked, setBlocked] = useState(() => !!document.querySelector('[aria-modal="true"]'));
  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const { altoContraste, escalaFonte } = usePreferenciasAcessibilidade();
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const danceTimer = useRef<ReturnType<typeof setTimeout>>();
  const clickStartOpen = useRef(false);
  const movement = useAssistantMotion(blocked);
  const animationsPaused = blocked || altoContraste || movement.reasons.includes("hidden") || movement.reasons.includes("reduced");
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const activity = movement.dragging ? "dragging" : celebrating ? "six-seven" : conversation.pending ? "thinking" : conversation.error ? "error" : hover ? "playful" : focus ? "greeting"
    : lastMessage?.role === "assistant" ? "answered" : "idle";

  useEffect(() => () => { clearTimeout(clickTimer.current); clearTimeout(danceTimer.current); }, []);

  useEffect(() => {
    if (blocked) { clearTimeout(clickTimer.current); clearTimeout(danceTimer.current); setCelebrating(false); }
  }, [blocked]);

  function dance() {
    clearTimeout(clickTimer.current);
    if (animationsPaused || movement.dragging) return;
    clearTimeout(danceTimer.current);
    setCelebrating(true);
    setCelebrationKey((key) => key + 1);
    danceTimer.current = setTimeout(() => setCelebrating(false), VUVU_SIX_SEVEN.durationMs);
  }

  useLayoutEffect(() => {
    const update = () => {
      const activeModal = document.querySelector('[aria-modal="true"]:not([aria-hidden="true"])');
      const inertPortal = root.current?.parentElement?.closest("[inert]");
      setBlocked(!!activeModal || !!inertPortal);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert", "aria-modal", "hidden", "aria-hidden"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (open && !blocked) input.current?.focus({ preventScroll: true });
    // Foco muda somente ao abrir; navegação e retorno de outro modal não o roubam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || blocked) return;
    const escape = (event: KeyboardEvent) => {
      // O painel é não modal: o foco pode estar na página ou sair de um botão
      // desabilitado durante envio. Escape continua funcionando nesses casos.
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setOpen(false);
      launcher.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, blocked]);

  function close() {
    setOpen(false);
    if (!blocked) launcher.current?.focus({ preventScroll: true });
  }

  return <Portal>
    <div ref={root} className="assistant-root" data-testid="assistant-root" hidden={blocked} aria-hidden={blocked || undefined}
      data-animations-paused={animationsPaused || undefined}
      data-large-text={escalaFonte >= 1.5 || undefined}
      style={{ "--assistant-width": `${ASSISTANT_FOOTPRINT.width}px`, "--assistant-height": `${ASSISTANT_FOOTPRINT.height}px` } as CSSProperties}
      onKeyDown={(event) => {
        if (!blocked && open && event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(); }
      }}>
      <motion.div className="assistant-mascot" data-testid="assistant-mascot" data-motion={movement.state}
        data-pause-reasons={movement.reasons.join(" ")} style={{ x: movement.x, y: movement.y }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setFocus(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false); }}>
        <button ref={launcher} type="button" className="assistant-launcher" data-testid="assistant-launcher"
          aria-label="Ajuda — abrir Assistente Vulnera" aria-expanded={open} aria-controls="assistant-panel"
          aria-describedby="assistant-mascot-instructions" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home Shift+Enter"
          {...movement.handlers}
          onPointerDown={(event) => { clearTimeout(clickTimer.current); movement.handlers.onPointerDown(event); }}
          onKeyDown={(event) => {
            const direction: Record<string, [number, number]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
            if (direction[event.key]) { event.preventDefault(); movement.moveBy(...direction[event.key]); }
            else if (event.key === "Home") { event.preventDefault(); movement.reset(); }
            else if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); dance(); }
          }}
          onClick={(event) => {
            clearTimeout(clickTimer.current);
            if (blocked || (event.detail > 0 && movement.suppressClick())) return;
            if (event.detail === 0) { setOpen((previous) => !previous); return; }
            if (event.detail === 1) { clickStartOpen.current = open; clickTimer.current = setTimeout(() => setOpen((previous) => !previous), 280); }
          }}
          onDoubleClick={(event) => { event.preventDefault(); if (!blocked && !movement.suppressClick()) { setOpen(clickStartOpen.current); dance(); } }}>
          <AssistantMascot activity={activity} paused={animationsPaused || (open && !celebrating && !movement.dragging)} trackPointer={!open}
            reactionKey={celebrating ? `dance-${celebrationKey}` : lastMessage?.id} movingLeft={movement.movingLeft} />
          <span className="assistant-launcher-label" aria-hidden="true"><MessageCircle size={13} />Ajuda</span>
        </button>
        <span id="assistant-mascot-instructions" className="sr-only">Clique para abrir a ajuda. Arraste ou use as setas para mover a Vuvu; Home volta ao canto. Duplo clique ou Shift e Enter faz o six seven.</span>
      </motion.div>
      {open && <AssistantPanel screen={screen} role={role} conversation={conversation} inputRef={input} onClose={close} animationsPaused={animationsPaused}
        onNavigate={(id) => { const destination = assistantDestination(id, role); if (!blocked && destination) navigate(destination.path); }} />}
    </div>
  </Portal>;
}
