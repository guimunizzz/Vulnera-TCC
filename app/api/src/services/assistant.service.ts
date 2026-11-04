/**
 * Orquestra orientação por ajuda/Gemini sem acessar registros de negócio.
 * Mantém permissões e origem sob controle da aplicação; consumido pelo controller.
 */
import type { AssistantConfig } from "../config/assistant.config";
import type { AssistantChatDTO, AssistantGateway, AssistantResponseDTO } from "../models/assistant.model";
import type { JwtPayload } from "../utils/jwt.util";
import { AssistantHelpService, normalizeAssistantText } from "./assistant-help.service";

/** Barreiras reconhecíveis, sem alegar detectar todo dado sensível em texto livre. */
function containsSensitiveContent(text: string): boolean {
  return /https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:bearer\s+\S+|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)|\b[a-z][a-z0-9]{23,}\b|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:senha|password|api[_ -]?key|token|segredo)\s*[:=]\s*\S+/i.test(text);
}

export class AssistantService {
  constructor(
    private readonly help: AssistantHelpService,
    private readonly gateway: AssistantGateway,
    private readonly config: AssistantConfig,
  ) {}

  async chat(actor: JwtPayload, dto: AssistantChatDTO): Promise<AssistantResponseDTO> {
    if (!["ADMIN", "CLIENT", "PENTESTER"].includes(actor.role)) throw new Error("FORBIDDEN");
    const topics = this.help.select(dto, actor.role);
    const related = topics.length ? topics : this.help.related(dto.screen, actor.role);
    const actions = this.help.actions(related, actor.role);
    const conversation = [dto.question, ...dto.history.map((item) => item.content)].join("\n");
    if (containsSensitiveContent(conversation)) {
      return { source: "local", actions, message: "Para proteger os dados, esta pergunta ficou na ajuda local. Envie apenas dúvidas sobre o uso da plataforma, sem nomes, e-mails, URLs, identificadores, credenciais ou conteúdo real de findings. Posso orientar sobre projetos, análise, SLA e relatórios." };
    }
    if (!topics.length) {
      return { source: "local", actions, message: `Minha ajuda cobre o uso do Vulnera, sem consultar registros reais ou executar operações. Não encontrei essa informação na documentação de ajuda. Posso explicar: ${related.map((topic) => topic.title).join("; ")}.` };
    }
    if (this.config.mode === "gemini" && this.config.apiKey && this.config.model) {
      let message: string | null = null;
      try {
        message = await this.gateway.generate({ question: dto.question, history: dto.history, screen: dto.screen, role: actor.role, help: this.help.context(topics, actor.role) });
      } catch {
        // Gateways injetados também devem falhar sem derrubar a orientação local.
      }
      if (message?.trim() && message.length <= 4_000) return { message, source: "gemini", actions };
    }
    const first = topics[0];
    // A pergunta por conceito não deve ganhar uma instrução operacional alheia.
    const prefix = normalizeAssistantText(dto.question).includes("quem e voce") ? "Sou o Assistente Vulnera.\n\n" : "";
    return { source: "local", actions, message: `${prefix}${this.help.guidance(first, actor.role)}` };
  }
}
