/**
 * Painel não modal da orientação, com texto seguro, histórico rolável e atalhos fechados.
 * Consumido pelo assistente autenticado; mantém posição estável enquanto a sentinela passeia.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowUp, ChevronRight, Compass, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
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
  onNavigate: (action: AssistantActionId) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  animationsPaused?: boolean;
}

export function AssistantPanel({ screen, role, conversation, onClose, onNavigate, inputRef, animationsPaused = false }: Props) {
  const [draft, setDraft] = useState("");
  const { messages, pending, error, send, clear } = conversation;
  const end = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];
  const activity = pending ? "thinking" : error ? "error" : draft.trim() ? "waiting" : lastMessage?.role === "assistant" ? "answered" : "greeting";
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [messages, pending, error]);

  function clearConversation() {
    clear();
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <section id="assistant-panel" role="dialog" aria-label="Assistente Vulnera" aria-describedby="assistant-context" className="assistant-panel">
      <header className="assistant-panel-header">
        <span className="assistant-panel-avatar"><AssistantMascot activity={activity} paused={animationsPaused || messages.length === 0} reactionKey={lastMessage?.id} /></span>
        <div className="assistant-panel-title"><p className="assistant-eyebrow">Assistente Vulnera</p><h2>Vuvu<span aria-hidden="true"> ✦</span></h2></div>
        <button type="button" className="assistant-icon-button" aria-label="Fechar assistente" onClick={onClose}><X size={19} /></button>
      </header>
      <div className="assistant-context-bar" id="assistant-context"><Compass size={14} aria-hidden="true" /><span>{ASSISTANT_SCREEN_LABELS[screen]}</span><span className="assistant-context-caption">Ajuda contextual</span></div>

      <div className="assistant-history" role="log" tabIndex={0} aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text" aria-busy={pending}>
        {messages.length === 0 && <div className="assistant-welcome">
          <div className="assistant-welcome-art"><AssistantMascot activity={activity} paused={animationsPaused} trackPointer /></div>
          <span className="assistant-eyebrow">Uma companhia pelo caminho</span>
          <h3>Oi! Eu sou a Vuvu.</h3>
          <p>Vamos encontrar seu próximo passo?<br />Posso te guiar pelas telas do Vulnera.</p>
        </div>}
        {messages.map((message) => <article key={message.id} className={`assistant-message assistant-message-${message.role}`}>
          <span className="assistant-message-author">{message.role === "user" ? "Você" : "Vuvu"}{message.role === "assistant" && <Sparkles size={12} aria-hidden="true" />}</span>
          <p>{message.content}</p>
          {message.source && <span className="assistant-source"><span aria-hidden="true" />{message.source === "gemini" ? "Gemini" : "Ajuda local"}</span>}
          {message.screen !== screen && <span className="assistant-message-context">Sobre: {ASSISTANT_SCREEN_LABELS[message.screen]}</span>}
          {message.actions && <div className="assistant-actions">
            {message.actions.map((action) => {
              const destination = assistantDestination(action.id, role);
              return destination && <button key={destination.id} type="button" onClick={() => onNavigate(destination.id)} className="assistant-action">
                {destination.label}<ChevronRight size={15} aria-hidden="true" />
              </button>;
            })}
          </div>}
        </article>)}
        {pending && <div className="assistant-waiting" role="status"><span className="assistant-typing" aria-hidden="true"><i /><i /><i /></span><p>Preparando sua orientação sobre {ASSISTANT_SCREEN_LABELS[messages[messages.length - 1]?.screen ?? screen]}…</p></div>}
        {error && <p className="assistant-error" role="alert">{error}</p>}
        <div ref={end} />
      </div>

      <div className="assistant-composer">
        <span className="assistant-suggestions-label">Por onde vamos?</span>
        <div className="assistant-suggestions" aria-label="Sugestões para esta tela">
          {assistantSuggestions(screen, role).map((suggestion) => <button key={suggestion} type="button" disabled={pending}
            onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          void send(draft, screen).then((sent) => { if (sent) setDraft(""); });
        }}>
          <label htmlFor="assistant-question" className="sr-only">Sua pergunta</label>
          <textarea id="assistant-question" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)}
            maxLength={1_000} rows={2} readOnly={pending} placeholder="O que você quer fazer por aqui?" aria-describedby="assistant-privacy assistant-count" />
          <div className="assistant-composer-controls">
            <button type="button" className="assistant-icon-button" aria-label="Limpar conversa" onClick={clearConversation}><Trash2 size={18} /></button>
            <span id="assistant-count">{draft.length}/1.000</span>
            <button type="submit" className="assistant-send" aria-label="Enviar pergunta" disabled={pending || !draft.trim()}>
              <span>{pending ? "Aguarde" : "Enviar"}</span><ArrowUp size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
        <p id="assistant-privacy" className="assistant-privacy"><ShieldCheck size={14} aria-hidden="true" /><span>Pergunte sobre a plataforma. Evite nomes, URLs e informações confidenciais.</span></p>
      </div>
    </section>
  );
}
