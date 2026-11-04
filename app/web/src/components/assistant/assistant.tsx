/**
 * Instância autenticada do assistente: portal persistente, movimento e painel de conversa.
 * Consumida por AuthenticatedLayout; respeita os modais existentes e isola cada nova sessão.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Portal } from "../ui/_internal/portal";
import { useAuthStore } from "../../store/auth.store";
import { assistantDestination, assistantScreen } from "../../lib/assistant-context";
import type { UserRole } from "../../types/auth.types";
import { AssistantMascot } from "./assistant-mascot";
import { AssistantPanel } from "./assistant-panel";
import { useAssistantConversation } from "./use-assistant-conversation";
import { useAssistantMotion } from "./use-assistant-motion";
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
  const [manualPause, setManualPause] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [blocked, setBlocked] = useState(() => !!document.querySelector('[aria-modal="true"]'));
  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const reasons = [...(manualPause ? ["manual"] : []), ...(hover ? ["hover"] : []), ...(focus ? ["focus"] : []), ...(open ? ["chat"] : []), ...(blocked ? ["modal"] : [])];
  const movement = useAssistantMotion(reasons);

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
      onKeyDown={(event) => {
        if (!blocked && open && event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(); }
      }}>
      <motion.div className="assistant-mascot" data-testid="assistant-mascot" data-motion={movement.state}
        data-pause-reasons={movement.reasons.join(" ")} style={{ x: movement.x, y: movement.y }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setFocus(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false); }}>
        <button ref={launcher} type="button" className="assistant-launcher" data-testid="assistant-launcher"
          aria-label="Abrir Assistente Vulnera" aria-expanded={open} aria-controls="assistant-panel"
          onClick={() => { if (!blocked) setOpen((previous) => !previous); }}>
          <AssistantMascot /><span aria-hidden="true">Ajuda</span>
        </button>
        <button type="button" className="assistant-pause assistant-icon-button" aria-label={manualPause ? "Retomar movimento" : "Pausar movimento"}
          aria-pressed={manualPause} onClick={() => setManualPause((previous) => !previous)}>
          {manualPause ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
        </button>
      </motion.div>
      {open && <AssistantPanel screen={screen} role={role} conversation={conversation} inputRef={input} onClose={close}
        onNavigate={(id) => { const destination = assistantDestination(id, role); if (!blocked && destination) navigate(destination.path); }} />}
    </div>
  </Portal>;
}
