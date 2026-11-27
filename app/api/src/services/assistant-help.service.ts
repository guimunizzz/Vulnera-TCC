/**
 * Recupera ajuda curta por termos em português e tela conhecida, sem banco.
 * Mantém o mesmo material no fallback e no prompt; consumido pelo serviço do
 * assistente e por testes de permissões/continuação.
 */
import { ASSISTANT_ACTIONS, ASSISTANT_TOPICS } from "../config/assistant-help.config";
import { ASSISTANT_CONVERSATION } from "../config/assistant-conversation.config";
import type { AssistantActionDTO, AssistantChatDTO, AssistantScreen, AssistantTopic } from "../models/assistant.model";
import type { UserRole } from "../models/user.model";

export function normalizeAssistantText(value: string): string {
  const aliases: Record<string, string> = { oq: "o que", q: "que", vc: "voce", vcs: "voces", pq: "por que", pfv: "por favor", tb: "tambem" };
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b(?:oq|q|vc|vcs|pq|pfv|tb)\b/g, (word) => aliases[word]).replace(/\s+/g, " ").trim();
}

export class AssistantHelpService {
  conversation(question: string): string | null {
    const text = normalizeAssistantText(question).replace(/^(?:oi+|ola|opa|bom dia|boa tarde|boa noite)\s+(?=quem|o que|que|para|pra|qual)/, "").replace(/ por favor$/, "");
    const intent = /^(?:oi+|ola|opa|e ai|bom dia|boa tarde|boa noite)(?: vuvu)?(?: tudo bem| tudo bom| como vai)?$/.test(text) || /^(?:tudo bem|tudo bom|como vai)(?: vuvu)?$/.test(text) ? "greeting"
      : /^(?:(?:quem|o que) (?:e|eh) (?:voce|a vuvu)|qual (?:e )?(?:o )?seu nome|se apresente)(?: mesmo)?$/.test(text) ? "identity"
      : /^(?:(?:o que|que) (?:e|eh) (?:o )?vulnera|(?:para|pra) que serve (?:o )?vulnera)(?: mesmo)?$/.test(text) ? "product" : null;
    return intent ? ASSISTANT_CONVERSATION[intent] : null;
  }

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
      let specificity = 0;
      for (const keyword of topic.keywords) {
        const term = normalizeAssistantText(keyword);
        // Expressões específicas de produto prevalecem sobre um termo genérico isolado.
        if (` ${question} `.includes(` ${term} `)) {
          const words = term.split(" ").length;
          score += 8 + Math.min(12, (words - 1) * 4);
          specificity = Math.max(specificity, words);
        }
        else if (continuation && history && ` ${history} `.includes(` ${term} `)) score += 1;
      }
      if (topic.screens.includes(dto.screen) && contextual && !hasCurrentMatch) score += 15;
      else if (score > 0 && topic.screens.includes(dto.screen)) score += 2;
      return { topic, score, specificity };
    }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score || b.specificity - a.specificity).slice(0, 3).map(({ topic }) => topic);
  }

  guidance(topic: AssistantTopic, role: UserRole): string {
    if (!topic.roles.includes(role)) return "";
    return [topic.byRole?.[role], topic.guidance].filter(Boolean).join("\n\n");
  }

  restriction(screen: AssistantScreen, role: UserRole): string | undefined {
    return ASSISTANT_TOPICS.find((topic) => topic.restrictedGuidance && topic.screens.includes(screen)
      && !topic.roles.includes(role))?.restrictedGuidance;
  }

  context(topics: AssistantTopic[], role: UserRole): string {
    return topics.filter((topic) => topic.roles.includes(role)).map((topic) => `${topic.title}\n${this.guidance(topic, role)}`).join("\n\n").slice(0, 6_000);
  }

  actions(topics: AssistantTopic[], role: UserRole): AssistantActionDTO[] {
    const ids = [...new Set(topics.filter((topic) => topic.roles.includes(role)).flatMap((topic) => [...topic.actions]))];
    return ids.filter((id) => ASSISTANT_ACTIONS[id].roles.includes(role)).slice(0, 3)
      .map((id) => ({ id, label: ASSISTANT_ACTIONS[id].label }));
  }

  related(screen: AssistantScreen, role: UserRole): AssistantTopic[] {
    const topics = ASSISTANT_TOPICS.filter((topic) => topic.roles.includes(role) && topic.screens.includes(screen));
    return topics.length ? topics.slice(0, 2) : ASSISTANT_TOPICS.filter((topic) => topic.id === "overview");
  }
}
