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

export function assistantSessionKey({ sessionVersion, user } = useAuthStore.getState()): string {
  return JSON.stringify([sessionVersion, user?.id, user?.role, user?.companyId]);
}

function responseIsValid(response: AssistantChatResponse): boolean {
  return !!response && typeof response.message === "string" && response.message.trim().length > 0
    && response.message.length <= 4_000 && ["generated", "local"].includes(response.source) && Array.isArray(response.actions)
    && (response.providerRetryAfterSeconds === undefined || (typeof response.providerRetryAfterSeconds === "number" && Number.isFinite(response.providerRetryAfterSeconds) && response.providerRetryAfterSeconds > 0));
}

function retryDelay(error: unknown): number {
  if (!isAxiosError(error) || error.response?.status !== 429) return 0;
  const raw: unknown = error.response.data?.retryAfterSeconds ?? error.response.headers["retry-after"];
  const numeric = Number(raw);
  const seconds = Number.isFinite(numeric) ? numeric : typeof raw === "string" ? (Date.parse(raw) - Date.now()) / 1_000 : 0;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86_400, Math.ceil(seconds)) : 0;
}

function recoverableError(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 429) {
    return "Muitas requisições. Seu texto foi mantido; aguarde para enviar novamente.";
  }
  return "Não foi possível obter a orientação. Você pode continuar na plataforma e enviar novamente quando quiser.";
}

export function useAssistantConversation(role: UserRole) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const blockedUntilRef = useRef(0);
  const [providerUntil, setProviderUntil] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [availability, setAvailability] = useState("");
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

  useEffect(() => {
    if (!blockedUntil && !providerUntil) return;
    const timer = setInterval(() => setClock(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [blockedUntil, providerUntil]);

  useEffect(() => {
    if (blockedUntil && clock >= blockedUntil) {
      blockedUntilRef.current = 0; setBlockedUntil(0); setError(null);
      setAvailability("Você já pode enviar sua pergunta. O envio é manual.");
    }
    if (providerUntil && clock >= providerUntil) {
      setProviderUntil(0);
      setAvailability("Você já pode enviar uma nova pergunta para tentar outra resposta da Vuvu. A ajuda local continua disponível.");
    }
  }, [clock, blockedUntil, providerUntil]);

  function clear(): void {
    generation.current += 1;
    request.current?.abort();
    request.current = null;
    messagesRef.current = [];
    setMessages([]);
    setPending(false);
    setError(blockedUntilRef.current > Date.now() ? "Muitas requisições. Seu texto foi mantido; aguarde para enviar novamente." : null);
  }

  async function send(question: string, screen: AssistantScreen): Promise<boolean> {
    const clean = question.trim();
    if (!clean || clean.length > 1_000 || request.current || blockedUntilRef.current > Date.now()) return false;
    const controller = new AbortController();
    request.current = controller; // A trava existe antes de qualquer próximo render.
    const session = assistantSessionKey();
    const currentGeneration = generation.current;
    const history = assistantHistory(messagesRef.current);
    const outgoing: AssistantMessage = { id: nextId.current++, role: "user", content: clean, screen };
    setMessages((current) => [...current, outgoing]);
    setPending(true);
    setError(null);
    setAvailability("");
    const current = () => alive.current && !controller.signal.aborted && generation.current === currentGeneration
      && assistantSessionKey() === session;
    try {
      const response = await assistantApi.chat({ question: clean, screen, history }, controller.signal);
      if (!current()) return false;
      if (!responseIsValid(response)) throw new Error("INVALID_ASSISTANT_RESPONSE");
      if (response.providerRetryAfterSeconds) {
        setClock(Date.now());
        setProviderUntil(Date.now() + Math.min(86_400, response.providerRetryAfterSeconds) * 1_000);
        setAvailability("As respostas da Vuvu estão temporariamente limitadas. Você pode continuar perguntando com a ajuda local.");
      } else if (response.source === "generated") setProviderUntil(0);
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
        const delay = retryDelay(failure);
        if (delay) {
          blockedUntilRef.current = Date.now() + delay * 1_000;
          setClock(Date.now()); setBlockedUntil(blockedUntilRef.current);
        }
      }
      return false;
    } finally {
      if (request.current === controller) request.current = null;
      if (current()) setPending(false);
    }
  }

  return { messages, pending, error, send, clear, availability,
    retryAfterSeconds: Math.max(0, Math.ceil((blockedUntil - clock) / 1_000)),
    providerRetryAfterSeconds: Math.max(0, Math.ceil((providerUntil - clock) / 1_000)) };
}
