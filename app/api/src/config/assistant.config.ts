/**
 * Configuração opcional do assistente, com padrões conservadores.
 * Permite iniciar a API sem conta externa; consumida pela factory e gateway.
 */
import { EnvKeys } from "./enum/EnvKeys";
import { EnvVar } from "./EnvVar";

export interface AssistantConfig {
  mode: "local" | "gemini";
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
}
export function loadAssistantConfig(): AssistantConfig {
  const timeout = Number(EnvVar.getOptional(EnvKeys.ASSISTANT_TIMEOUT_MS, "15000"));
  const output = Number(EnvVar.getOptional(EnvKeys.ASSISTANT_MAX_OUTPUT_TOKENS, "500"));
  return {
    mode: EnvVar.getOptional(EnvKeys.ASSISTANT_MODE, "local").trim() === "gemini" ? "gemini" : "local",
    apiKey: EnvVar.getOptional(EnvKeys.GEMINI_API_KEY, "").trim(),
    model: EnvVar.getOptional(EnvKeys.GEMINI_MODEL, "").trim(),
    timeoutMs: Number.isFinite(timeout) && timeout >= 100 && timeout <= 15000 ? Math.floor(timeout) : 15000,
    maxOutputTokens: Number.isFinite(output) && output >= 64 && output <= 500 ? Math.floor(output) : 500,
  };
}
