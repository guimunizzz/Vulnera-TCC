/**
 * Orquestra orientação por ajuda/Gemini sem acessar registros de negócio.
 * Mantém permissões e origem sob controle da aplicação; consumido pelo controller.
 */
import { createRequire } from "node:module";
import type { AssistantConfig } from "../config/assistant.config";
import { ASSISTANT_CAPABILITIES, ASSISTANT_OUTSIDE_PRODUCT, ASSISTANT_REFUSALS } from "../config/assistant-conversation.config";
import type { AssistantBudgetResult, AssistantChatDTO, AssistantGateway, AssistantGatewayFailure, AssistantGatewayResult, AssistantResponseDTO } from "../models/assistant.model";
import type { JwtPayload } from "../utils/jwt.util";
import { AssistantHelpService, normalizeAssistantText } from "./assistant-help.service";
import { assistantRuleTarget, containsInternalDetails, containsSensitiveContent, historyForAssistant, outsideProductTopic, requestsCapabilityList, requestsProductNavigation } from "./assistant-input.service";

const { version: apiVersion } = createRequire(__filename)("../../package.json") as { version: string };
const ASSISTANT_REVISION = "AI-CHAT-11";
const PRIVACY = "Para proteger os dados, esta pergunta ficou na ajuda local. Envie só a dúvida sobre o Vulnera, sem URLs, identificadores, credenciais ou dados reais.";

type LocalReason = AssistantGatewayFailure | "local_mode" | "local_quota" | "privacy" | "internal_request";

function localResponse(reason: LocalReason, message: string, actions: AssistantResponseDTO["actions"] = [], retryAfterSeconds?: number): AssistantResponseDTO {
  // Campos fechados permitem diagnosticar a queda sem guardar documentos, texto ou identidade.
  console.info(JSON.stringify({ event: "assistant.local_response", reason, apiVersion, assistantRevision: ASSISTANT_REVISION }));
  return { source: "local", message, actions, ...(retryAfterSeconds ? { providerRetryAfterSeconds: retryAfterSeconds } : {}) };
}

export class AssistantService {
  constructor(
    private readonly help: AssistantHelpService,
    private readonly gateway: AssistantGateway,
    private readonly config: AssistantConfig,
  ) {}

  async chat(actor: JwtPayload, dto: AssistantChatDTO, reserveBudget: () => AssistantBudgetResult): Promise<AssistantResponseDTO> {
    if (!["ADMIN", "CLIENT", "PENTESTER"].includes(actor.role)) throw new Error("FORBIDDEN");
    const target = assistantRuleTarget(dto.question);
    const refusal = target ? ASSISTANT_REFUSALS[target] : null;
    if (containsSensitiveContent(dto.question)) {
      return localResponse("privacy", refusal ?? PRIVACY);
    }
    if (target === "private_instructions" || target === "private_credentials") return localResponse("internal_request", ASSISTANT_REFUSALS[target]);

    const history = historyForAssistant(dto.history);
    const outside = target ? null : outsideProductTopic(dto.question);
    const inventory = !target && !outside && requestsCapabilityList(dto.question) ? ASSISTANT_CAPABILITIES[actor.role] : null;
    const inventoryText = inventory?.map(([title, description]) => `• ${title}: ${description}`).join("\n");
    const topics = target || outside || inventory ? [] : this.help.select({ ...dto, history }, actor.role);
    const basic = this.help.conversation(dto.question);
    const actions = topics.length && requestsProductNavigation(dto.question) ? this.help.actions(topics, actor.role) : [];
    const local = (reason: LocalReason, retryAfterSeconds?: number): AssistantResponseDTO => {
      const productHelp = topics.length ? this.help.guidance(topics[0], actor.role) : null;
      const variants = outside ? ASSISTANT_OUTSIDE_PRODUCT[outside] : [];
      const unused = variants.filter((message) => !history.some((turn) => turn.role === "assistant" && turn.content === message));
      const message = refusal ?? inventoryText ?? basic ?? productHelp ?? (outside ? (unused.length ? unused : variants)[0]
        : "Você quer entender um conceito ou aprender a fazer algo no Vulnera? Me diga a tela ou o recurso.");
      return localResponse(reason, message, actions, retryAfterSeconds);
    };
    if (this.config.mode !== "gemini") return local("local_mode");
    if (!this.config.apiKey || !this.config.model) return local("provider_not_configured");
    const budget = reserveBudget();
    if (!budget.allowed) return local("local_quota", budget.retryAfterSeconds);

    const help = inventoryText ? `A pessoa pediu a lista de funções. Inclua todos os blocos abaixo pelos nomes indicados e diga o que pode fazer em cada um.\n${inventoryText}`
      : target || outside ? "" : this.help.context(topics.length ? topics : this.help.related(dto.screen, actor.role), actor.role);
    let result: AssistantGatewayResult;
    try {
      result = await this.gateway.generate({ question: dto.question, history, screen: dto.screen, role: actor.role, help });
    } catch {
      // Gateways injetados também devem falhar sem derrubar a orientação local.
      return local("provider_error");
    }
    if (!result.ok) return local(result.reason);

    const message = result.message.trim();
    const privateValue = [this.config.model, this.config.apiKey].some((value) => message.toLowerCase().includes(value.toLowerCase()));
    const expectedKind = target ? "refusal" : outside ? "off_topic" : inventory ? "answer" : null;
    const normalizedMessage = normalizeAssistantText(message);
    const inventoryHeadings = inventory ? message.split(/\r?\n/).map((line) => normalizeAssistantText(line).replace(/^\d+\s+/, "")) : [];
    const incompleteInventory = inventory?.some(([title]) => !inventoryHeadings.some((line) => line.startsWith(normalizeAssistantText(title))));
    const missedChoice = (outside === "cars" && !/\b(?:celta|corsa)\b/.test(normalizedMessage))
      || (outside === "pets" && !/\b(?:gato|cachorro)\b/.test(normalizedMessage));
    const repeatedJoke = result.kind === "off_topic" && (/\b(?:dashboard|tela de projetos|prefiro ficar|prefiro me manter|seria como tentar)\b/.test(normalizedMessage)
      || (outside && /\b(?:estou por aqui|e so me chamar|se quiser falar sobre|se a sua duvida for|quer ver alguma funcao por aqui|novos dados na sua tela)\b/.test(normalizedMessage))
      || history.some((turn) => turn.role === "assistant" && normalizeAssistantText(turn.content) === normalizedMessage));
    if (!message || message.length > 4_000 || privateValue || containsSensitiveContent(message) || containsInternalDetails(message) || (expectedKind && result.kind !== expectedKind) || incompleteInventory || missedChoice || repeatedJoke) {
      return local("provider_invalid_response");
    }
    return { message, source: "generated", actions: result.kind === "navigation" ? actions : [] };
  }
}
