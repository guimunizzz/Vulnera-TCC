/**
 * Painel não modal da orientação, com texto seguro, histórico rolável e atalhos fechados.
 * Consumido pelo assistente autenticado; mantém posição estável enquanto a sentinela passeia.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowUp, ChevronRight, Trash2, X } from "lucide-react";
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
}

export function AssistantPanel({ screen, role, conversation, onClose, onNavigate, inputRef }: Props) {
  const [draft, setDraft] = useState("");
  const { messages, pending, error, send, clear } = conversation;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [messages, pending, error]);

  function clearConversation() {
    clear();
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <section id="assistant-panel" role="dialog" aria-label="Assistente Vulnera" aria-describedby="assistant-context" className="assistant-panel">
      <header className="assistant-panel-header">
        <span className="assistant-panel-avatar"><AssistantMascot /></span>
        <div className="assistant-panel-title"><h2>Assistente Vulnera</h2><p id="assistant-context">{ASSISTANT_SCREEN_LABELS[screen]}</p></div>
        <button type="button" className="assistant-icon-button" aria-label="Fechar assistente" onClick={onClose}><X size={19} /></button>
      </header>

      <div className="assistant-history" role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text" aria-busy={pending}>
        {messages.length === 0 && <div className="assistant-welcome">
          <p>Olá! Posso explicar as telas e os processos do Vulnera.</p>
          <p>Escolha uma sugestão ou escreva sua pergunta.</p>
        </div>}
        {messages.map((message) => <article key={message.id} className={`assistant-message assistant-message-${message.role}`}>
          <span className="assistant-message-author">{message.role === "user" ? "Você" : "Assistente Vulnera"}</span>
          <p>{message.content}</p>
          {message.source && <span className="assistant-source">{message.source === "gemini" ? "Gemini" : "Ajuda local"}</span>}
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
        {pending && <p className="assistant-waiting" role="status">Preparando orientação sobre {ASSISTANT_SCREEN_LABELS[messages[messages.length - 1]?.screen ?? screen]}…</p>}
        {error && <p className="assistant-error" role="alert">{error}</p>}
        <div ref={end} />
      </div>

      <div className="assistant-composer">
        <div className="assistant-suggestions" aria-label="Sugestões para esta tela">
          {assistantSuggestions(screen, role).map((suggestion) => <button key={suggestion} type="button" disabled={pending}
            onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          void send(draft, screen).then((sent) => { if (sent) setDraft(""); });
        }}>
          <label htmlFor="assistant-question">Sua pergunta</label>
          <textarea id="assistant-question" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)}
            maxLength={1_000} rows={2} readOnly={pending} placeholder="Como posso usar o Vulnera?" aria-describedby="assistant-privacy assistant-count" />
          <div className="assistant-composer-controls">
            <button type="button" className="assistant-icon-button" aria-label="Limpar conversa" onClick={clearConversation}><Trash2 size={18} /></button>
            <span id="assistant-count">{draft.length}/1.000</span>
            <button type="submit" className="assistant-send" aria-label="Enviar pergunta" disabled={pending || !draft.trim()}>
              {pending ? "Aguarde" : "Enviar"}<ArrowUp size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
        <p id="assistant-privacy" className="assistant-privacy">Pergunte sobre a plataforma. Evite nomes, URLs e informações confidenciais.</p>
      </div>
    </section>
  );
}
