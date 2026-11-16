/**
 * Define respostas básicas da Vuvu separadas da ajuda de telas e fluxos.
 * Evita gastar geração externa com apresentações; consumido pela recuperação de ajuda.
 */
import type { AssistantActionId } from "../models/assistant.model";

export const ASSISTANT_CONVERSATION: Record<"greeting" | "identity" | "product", { message: string; actions: readonly AssistantActionId[] }> = {
  greeting: {
    message: "Oi! Sou a Vuvu 💜 Posso te ajudar a entender o Vulnera e usar suas funcionalidades. Você quer conhecer a plataforma ou precisa de ajuda com alguma etapa?",
    actions: [],
  },
  identity: {
    message: "Sou a Vuvu, sua assistente no Vulnera. Explico conceitos, regras e os passos para usar a plataforma conforme seu perfil. Não consulto registros reais nem executo operações por você. O que você gostaria de aprender?",
    actions: [],
  },
  product: {
    message: "O Vulnera é uma plataforma para organizar análises de segurança e acompanhar vulnerabilidades. Aplicações são os sistemas avaliados; projetos organizam o trabalho de análise; findings registram cada vulnerabilidade, com evidências, prioridade e acompanhamento da correção. Clientes e analistas participam conforme suas permissões. Você quer entender esse fluxo ou aprender a solicitar uma análise?",
    actions: ["projects"],
  },
};
