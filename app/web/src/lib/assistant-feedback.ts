/**
 * Liga resultados confirmados da interface às expressões locais da Vuvu.
 * Não transporta dados de negócio; consumido por ações, cache de mutations e assistente da sessão atual.
 */
export type AssistantFeedback = "report-ready" | "operation-error";
type Reporter = (feedback: AssistantFeedback) => void;
let active: { receive: Reporter } | undefined;

export function subscribeAssistantFeedback(receive: Reporter): () => void {
  const owner = { receive };
  active = owner;
  return () => { if (active === owner) active = undefined; };
}

/** Capture ao iniciar a ação: uma resposta antiga não reage em outra sessão. */
export function beginAssistantFeedback(): Reporter {
  const owner = active;
  return (feedback) => {
    if (!owner || active !== owner || document.hidden) return;
    try { owner.receive(feedback); } catch { /* Decoração nunca muda o resultado da operação. */ }
  };
}
