/**
 * Recupera ajuda curta por termos em português e tela conhecida, sem banco.
 * Mantém o mesmo material no fallback e no prompt; consumido pelo serviço do
 * assistente e por testes de permissões/continuação.
 */
import { ASSISTANT_ACTIONS, ASSISTANT_TOPICS } from "../config/assistant-help.config";
import type { AssistantActionDTO, AssistantChatDTO, AssistantScreen, AssistantTopic } from "../models/assistant.model";
import type { UserRole } from "../models/user.model";

export function normalizeAssistantText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export class AssistantHelpService {
  select(dto: AssistantChatDTO, role: UserRole): AssistantTopic[] {
    const question = normalizeAssistantText(dto.question);
    const history = normalizeAssistantText(dto.history.map((item) => item.content).join(" "));
    const contextual = /(?:nesta|nessa|esta|essa) tela|o que posso fazer|por onde comeco|^ajuda$/.test(question);
    const continuation = /^(?:e depois|e agora|como faco isso|pode explicar melhor|e sobre isso|continue)\b/.test(question);
    const dastContext = dto.screen.startsWith("dast") || /\b(?:dast|zap|scan)\b/.test(question);
    const eligible = ASSISTANT_TOPICS.filter((topic) => topic.roles.includes(role) && (topic.id !== "dast-reports" || dastContext));
    const hasCurrentMatch = eligible.some((topic) => topic.keywords.some((keyword) => ` ${question} `.includes(` ${normalizeAssistantText(keyword)} `)));
    return eligible.map((topic) => {
      let score = 0;
      for (const keyword of topic.keywords) {
        const term = normalizeAssistantText(keyword);
        if (` ${question} `.includes(` ${term} `)) score += 8;
        else if (continuation && history && ` ${history} `.includes(` ${term} `)) score += 1;
      }
      if (topic.screens.includes(dto.screen) && contextual && !hasCurrentMatch) score += 15;
      else if (score > 0 && topic.screens.includes(dto.screen)) score += 2;
      return { topic, score };
    }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(({ topic }) => topic);
  }

  guidance(topic: AssistantTopic, role: UserRole): string {
    if (role === "PENTESTER" && ["applications", "new-analysis"].includes(topic.id)) return topic.byRole?.[role] ?? topic.guidance;
    if (role === "CLIENT" && topic.id === "dast-reports") return topic.byRole?.[role] ?? topic.guidance;
    // A restrição aparece antes dos passos para não orientar acesso impossível.
    return [topic.byRole?.[role], topic.guidance].filter(Boolean).join("\n\n");
  }

  context(topics: AssistantTopic[], role: UserRole): string {
    return topics.map((topic) => `${topic.title}\n${this.guidance(topic, role)}`).join("\n\n").slice(0, 6_000);
  }

  actions(topics: AssistantTopic[], role: UserRole): AssistantActionDTO[] {
    const ids = [...new Set(topics.flatMap((topic) => [...topic.actions]))];
    return ids.filter((id) => ASSISTANT_ACTIONS[id].roles.includes(role)).slice(0, 3)
      .map((id) => ({ id, label: ASSISTANT_ACTIONS[id].label }));
  }

  related(screen: AssistantScreen, role: UserRole): AssistantTopic[] {
    const topics = ASSISTANT_TOPICS.filter((topic) => topic.roles.includes(role) && topic.screens.includes(screen));
    return topics.length ? topics.slice(0, 2) : ASSISTANT_TOPICS.filter((topic) => topic.id === "overview");
  }
}
