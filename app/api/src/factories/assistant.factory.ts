/**
 * FACTORY METHOD do Assistente Vulnera (padrão GoF).
 * Esconde a montagem Ajuda/Gateway → Service → Controller e centraliza a
 * configuração opcional. Não há repository porque não existe persistência.
 * Consumidor: somente as rotas; testes podem injetar gateway e configuração.
 */
import { loadAssistantConfig, type AssistantConfig } from "../config/assistant.config";
import { AssistantController } from "../controllers/assistant.controller";
import type { AssistantGateway } from "../models/assistant.model";
import { AssistantHelpService } from "../services/assistant-help.service";
import { AssistantService } from "../services/assistant.service";
import { GeminiService } from "../services/gemini.service";

export function makeAssistantController(options: { config?: AssistantConfig; gateway?: AssistantGateway } = {}): AssistantController {
  const config = options.config ?? loadAssistantConfig();
  const gateway = options.gateway ?? new GeminiService(config);
  return new AssistantController(new AssistantService(new AssistantHelpService(), gateway, config));
}
