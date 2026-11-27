/**
 * Mantém a conversa somente em memória e protege cada envio contra duplicação e resposta tardia.
 * Consumido pelo painel; captura a tela ao enviar e nunca consulta registros de negócio.
 */
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { assistantApi } from "../../lib/api/assistant.api";
import { assistantDestination, assistantHistory } from "../../lib/assistant-context";
import { useAuthStore } from "../../store/auth.store";
import type { AssistantChatResponse, AssistantMessage, AssistantScreen } from "../../types/assistant.types";
import type { UserRole } from "../../types/auth.types";

export function assistantSessionKey(): string {
  const { sessionVersion, user } = useAuthStore.getState();
  return `${sessionVersion}:${user?.id ?? ""}:${user?.role ?? ""}`;
}

function responseIsValid(response: AssistantChatResponse): boolean {
  return !!response && typeof response.message === "string" && response.message.trim().length > 0
    && response.message.length <= 8_000 && ["gemini", "local"].includes(response.source) && Array.isArray(response.actions);
}

function recoverableError(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 429) {
    const raw: unknown = error.response.data?.retryAfterSeconds ?? error.response.headers["retry-after"];
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0
      ? `Muitas requisições. Aguarde ${Math.ceil(seconds)} segundos e envie novamente quando quiser.`
      : "Muitas requisições. Aguarde um pouco e envie novamente quando quiser.";
  }
  return "Não foi possível obter a orientação. Você pode continuar na plataforma e enviar novamente quando quiser.";
}

export function useAssistantConversation(role: UserRole) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  const request = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const generation = useRef(0);
  const alive = useRef(true);
  messagesRef.current = messages;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);

  function clear(): void {
    generation.current += 1;
    request.current?.abort();
    request.current = null;
    messagesRef.current = [];
    setMessages([]);
    setPending(false);
    setError(null);
  }

  async function send(question: string, screen: AssistantScreen): Promise<boolean> {
    const clean = question.trim();
    if (!clean || clean.length > 1_000 || request.current) return false;
    const controller = new AbortController();
    request.current = controller; // A trava existe antes de qualquer próximo render.
    const session = assistantSessionKey();
    const currentGeneration = generation.current;
    const history = assistantHistory(messagesRef.current);
    const outgoing: AssistantMessage = { id: nextId.current++, role: "user", content: clean, screen };
    setMessages((current) => [...current, outgoing]);
    setPending(true);
    setError(null);
    const current = () => alive.current && !controller.signal.aborted && generation.current === currentGeneration
      && assistantSessionKey() === session;
    try {
      const response = await assistantApi.chat({ question: clean, screen, history }, controller.signal);
      if (!current()) return false;
      if (!responseIsValid(response)) throw new Error("INVALID_ASSISTANT_RESPONSE");
      const actions = response.actions.flatMap((action) => {
        const destination = assistantDestination(action?.id, role);
        return destination ? [{ id: destination.id, label: destination.label }] : [];
      }).filter((action, index, all) => all.findIndex((candidate) => candidate.id === action.id) === index);
      setMessages((previous) => [...previous, {
        id: nextId.current++, role: "assistant", content: response.message.trim(), screen, source: response.source, actions,
      }]);
      return true;
    } catch (failure) {
      if (current()) {
        setMessages((previous) => previous.filter((message) => message.id !== outgoing.id));
        setError(recoverableError(failure));
      }
      return false;
    } finally {
      if (request.current === controller) request.current = null;
      if (current()) setPending(false);
    }
  }

  return { messages, pending, error, send, clear };
}
