/**
 * Painel não modal da orientação, com texto seguro, histórico rolável e atalhos fechados.
 * Consumido pelo assistente autenticado; prioriza a conversa e mantém posição independente do arraste.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { motion, useIsPresent } from "motion/react";
import { ArrowUp, Minus, Trash2, X } from "lucide-react";
import { useMotion } from "../../motion/use-motion";
import { DESLOCAMENTO, DURACAO, EASE } from "../../motion/tokens";
import { assistantDestination, assistantSuggestions, ASSISTANT_SCREEN_LABELS } from "../../lib/assistant-context";
import type { UserRole } from "../../types/auth.types";
import type { AssistantActionId, AssistantScreen } from "../../types/assistant.types";
import type { useAssistantConversation } from "./use-assistant-conversation";
import { AssistantMascot } from "./assistant-mascot";

interface Props {
  screen: AssistantScreen;
  role: UserRole;
  conversation: ReturnType<typeof useAssistantConversation>;
  onClose: () => void;
  onMinimize: () => void;
  draft: string;
  onDraftChange: (draft: string) => void;
  onNavigate: (action: AssistantActionId) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  animationsPaused?: boolean;
}

export function AssistantPanel({ screen, role, conversation, onClose, onMinimize, draft, onDraftChange: setDraft, onNavigate, inputRef, animationsPaused = false }: Props) {
  const present = useIsPresent();
  const section = useRef<HTMLElement>(null);
  const { reduzido } = useMotion();
  const quiet = reduzido || animationsPaused;
  const { messages, pending, error, send, clear, retryAfterSeconds, providerRetryAfterSeconds, availability } = conversation;
  const end = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];
  const activity = pending ? "thinking" : error ? "error" : draft.trim() ? "waiting" : lastMessage?.role === "assistant" ? "answered" : "greeting";
  const suggestions = <div className="assistant-suggestions" aria-label="Sugestões para esta tela">
    {assistantSuggestions(screen, role).map((suggestion) => <button key={suggestion} type="button" disabled={pending}
      onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}
  </div>;
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [messages, pending, error]);
  useLayoutEffect(() => { section.current?.toggleAttribute("inert", !present); }, [present]);

  function clearConversation() {
    clear();
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <motion.section ref={section} id="assistant-panel" role="dialog" aria-label="Assistente Vulnera" aria-describedby="assistant-context" className="assistant-panel"
      aria-hidden={!present || undefined}
      initial={{ opacity: 0, y: quiet ? 0 : DESLOCAMENTO.ancorado, scale: quiet ? 1 : 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: quiet ? 0 : DESLOCAMENTO.ancorado, scale: quiet ? 1 : 0.985 }}
      transition={{ duration: quiet ? DURACAO.instant : present ? DURACAO.slow : DURACAO.fast, ease: EASE.out }}>
      <header className="assistant-panel-header">
        <span className="assistant-panel-avatar"><AssistantMascot activity={activity} paused={animationsPaused || messages.length === 0} reactionKey={lastMessage?.id} /></span>
        <div className="assistant-panel-title"><h2>Vuvu</h2><p id="assistant-context">Assistente Vulnera · {ASSISTANT_SCREEN_LABELS[screen]}</p></div>
        <button type="button" className="assistant-icon-button" aria-label="Limpar conversa" onClick={clearConversation}><Trash2 size={17} /></button>
        <button type="button" className="assistant-icon-button" aria-label="Recolher Vuvu" title="Modo discreto" onClick={onMinimize}><Minus size={19} /></button>
        <button type="button" className="assistant-icon-button" aria-label="Fechar assistente" onClick={onClose}><X size={19} /></button>
      </header>

      <div className="assistant-history" role="log" tabIndex={0} aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text" aria-busy={pending}>
        {messages.length === 0 && <div className="assistant-welcome">
          <h3>Oi! Eu sou a Vuvu.</h3>
          <p>Como posso te ajudar no Vulnera?</p>
        </div>}
        {messages.map((message) => <article key={message.id} className={`assistant-message assistant-message-${message.role}`}>
          <span className="assistant-message-author">{message.role === "user" ? "Você" : "Vuvu"}</span>
          <p>{message.content}</p>
          {message.source && <span className="assistant-source">{message.source === "generated" ? "Resposta da Vuvu" : "Ajuda local"}</span>}
          {message.screen !== screen && <span className="assistant-message-context">Sobre: {ASSISTANT_SCREEN_LABELS[message.screen]}</span>}
          {message.actions && <div className="assistant-actions">
            {message.actions.map((action) => {
              const destination = assistantDestination(action.id, role);
              return destination && <button key={destination.id} type="button" onClick={() => onNavigate(destination.id)} className="assistant-action">
                {destination.label}
              </button>;
            })}
          </div>}
        </article>)}
        {pending && <div className="assistant-waiting" role="status"><span className="assistant-typing" aria-hidden="true"><i /><i /><i /></span><p>Vuvu está pensando…</p></div>}
        {error && <p className="assistant-error" role="alert">{error}</p>}
        <div ref={end} />
      </div>

      <div className="assistant-composer">
        {messages.length === 0 ? suggestions : <details className="assistant-suggestions-disclosure"><summary>Sugestões</summary>{suggestions}</details>}
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!present || pending || retryAfterSeconds > 0 || !draft.trim()) return;
          inputRef.current?.focus({ preventScroll: true });
          void send(draft, screen).then((sent) => { if (sent) setDraft(""); });
        }}>
          <label htmlFor="assistant-question" className="sr-only">Sua pergunta</label>
          <textarea id="assistant-question" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
              event.preventDefault();
              if (!event.repeat) event.currentTarget.form?.requestSubmit();
            }}
            maxLength={1_000} rows={2} readOnly={pending} placeholder="Pergunte à Vuvu…" enterKeyHint="send" aria-keyshortcuts="Enter Shift+Enter"
            aria-describedby={`assistant-keyboard assistant-privacy assistant-count${retryAfterSeconds > 0 ? " assistant-retry" : ""}${providerRetryAfterSeconds > 0 ? " assistant-provider-retry" : ""}`} />
          <div className="assistant-composer-controls">
            <button type="submit" className="assistant-send" aria-label="Enviar pergunta" disabled={pending || retryAfterSeconds > 0 || !draft.trim()}>
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          </div>
        </form>
        <p id="assistant-keyboard" className="assistant-keyboard">Enter envia · Shift+Enter quebra linha</p>
        {retryAfterSeconds > 0 && <p id="assistant-retry" className="assistant-notice" aria-live="off">Aguarde {retryAfterSeconds} segundos para enviar. Seu texto foi mantido.</p>}
        {providerRetryAfterSeconds > 0 && <p id="assistant-provider-retry" className="assistant-notice" aria-live="off">Nova tentativa em {providerRetryAfterSeconds} segundos. A ajuda local continua disponível.</p>}
        <span className="sr-only" role="status">{availability}</span>
        <span id="assistant-count" className={draft.length >= 800 ? "assistant-count" : "sr-only"}>{draft.length}/1.000</span>
        <p id="assistant-privacy" className="assistant-privacy">Não compartilhe dados confidenciais.</p>
      </div>
    </motion.section>
  );
}
