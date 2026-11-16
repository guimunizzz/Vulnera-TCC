/**
 * Orquestra orientação por ajuda/Gemini sem acessar registros de negócio.
 * Mantém permissões e origem sob controle da aplicação; consumido pelo controller.
 */
import type { AssistantConfig } from "../config/assistant.config";
import type { AssistantBudgetResult, AssistantChatDTO, AssistantGateway, AssistantResponseDTO } from "../models/assistant.model";
import type { JwtPayload } from "../utils/jwt.util";
import { AssistantHelpService } from "./assistant-help.service";

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

  async chat(actor: JwtPayload, dto: AssistantChatDTO, reserveBudget: () => AssistantBudgetResult): Promise<AssistantResponseDTO> {
    if (!["ADMIN", "CLIENT", "PENTESTER"].includes(actor.role)) throw new Error("FORBIDDEN");
    const topics = this.help.select(dto, actor.role);
    const related = topics.length ? topics : this.help.related(dto.screen, actor.role);
    const actions = this.help.actions(related, actor.role);
    const conversation = [dto.question, ...dto.history.map((item) => item.content)].join("\n");
    if (containsSensitiveContent(conversation)) {
      return { source: "local", actions, message: "Para proteger os dados, esta pergunta ficou na ajuda local. Envie apenas dúvidas sobre o uso da plataforma, sem nomes, e-mails, URLs, identificadores, credenciais ou conteúdo real de findings. Posso orientar sobre projetos, análise, SLA e relatórios." };
    }
    const basic = this.help.conversation(dto.question, actor.role);
    if (basic) return basic;
    if (!topics.length) {
      return { source: "local", actions: [], message: `Ainda não consegui relacionar sua pergunta ao uso do Vulnera. Você quer entender um conceito ou aprender a fazer algo na plataforma? Posso explicar: ${related.map((topic) => topic.title).join("; ")}.` };
    }
    const local = (): AssistantResponseDTO => ({ source: "local", actions, message: this.help.guidance(topics[0], actor.role) });
    if (this.config.mode === "gemini" && this.config.apiKey && this.config.model) {
      const budget = reserveBudget();
      if (!budget.allowed) return { ...local(), providerRetryAfterSeconds: budget.retryAfterSeconds };
      let message: string | null = null;
      try {
        message = await this.gateway.generate({ question: dto.question, history: dto.history, screen: dto.screen, role: actor.role, help: this.help.context(topics, actor.role) });
      } catch {
        // Gateways injetados também devem falhar sem derrubar a orientação local.
      }
      // A configuração do provedor não faz parte da orientação pública do produto.
      const candidate = message ?? "";
      const privateValue = [this.config.model, this.config.apiKey].some((value) => value && candidate.toLowerCase().includes(value.toLowerCase()));
      if (candidate.trim() && candidate.length <= 4_000 && !privateValue) return { message: candidate, source: "gemini", actions };
    }
    return local();
  }
}
