/** Envia apenas pergunta, tela normalizada e histórico limitado à API do assistente. */
import { apiClient } from "./client";
import type { AssistantScreen } from "../lib/assistant-context";

export type AssistantHistory = { role: "user" | "assistant"; content: string };
export type AssistantResponse = { message: string; source: "gemini" | "local"; actions: { id: string; label: string }[]; providerRetryAfterSeconds?: number };
export const assistantApi = {
  chat: (question: string, screen: AssistantScreen, history: AssistantHistory[], signal: AbortSignal) =>
    apiClient.post<AssistantResponse>("/assistant/chat", { question, screen, history }, { signal }).then((response) => response.data),
};
