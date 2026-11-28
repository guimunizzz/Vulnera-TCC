/**
 * Envia perguntas somente por ação explícita do painel, usando a sessão HTTP existente.
 * Não usa consultas com refetch nem repetição automática; o AbortSignal cancela sessões encerradas.
 */
import { apiClient } from "./client";
import type { AssistantChatInput, AssistantChatResponse } from "../../types/assistant.types";

export const assistantApi = {
  chat: (input: AssistantChatInput, signal: AbortSignal): Promise<AssistantChatResponse> =>
    apiClient.post<AssistantChatResponse>("/assistant/chat", input, { signal }).then((response) => response.data),
};
