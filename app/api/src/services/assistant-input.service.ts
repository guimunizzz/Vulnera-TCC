/**
 * Classifica sinais explícitos da conversa e monta o histórico apto para envio.
 * Isola as decisões de privacidade e de navegação usadas pelo AssistantService.
 */
import { ASSISTANT_SCREENS, type AssistantHistoryMessage } from "../models/assistant.model";
import { normalizeAssistantText } from "./assistant-help.service";

/** Heurística para texto livre em contents. A origem de systemInstruction é regida pelo ADR-064. */
export function containsSensitiveContent(text: string): boolean {
  return /https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:bearer\s+\S+|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)|\b[a-z][a-z0-9]{23,}\b|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:senha|password|api[_ -]?key|token|segredo)\s*[:=]\s*\S+/i.test(text);
}

export function containsInternalDetails(text: string): boolean {
  const terms = normalizeAssistantText(text);
  return /\b(?:gemini|google (?:ai|cloud|generative)|openai|chatgpt|anthropic|claude|gpt|llama|ollama|prisma|mysql|postgresql|sqlite|node js|nodejs|express(?: js)?|react|vite|tailwind|docker|typescript|zaproxy|zap|system prompt)\b/.test(terms)
    || ASSISTANT_SCREENS.some((screen) => screen.includes("-") && text.toLowerCase().includes(screen))
    || /\b(?:gemini_\w+|assistant_mode|database_url|jwt_\w+|[a-z0-9_]+_(?:api_key|secret|password|token))\b/i.test(text)
    || /(?:\/(?:api|dist|src)\/|\bpackage(?:-lock)?\.json\b|(?:^|\s)\.(?:env|git)(?:\b|\.)|```)/i.test(text)
    || /\b(?:dependencias internas|versao (?:da stack|do backend|da api interna)|endpoints privados|variaveis de ambiente|codigo fonte (?:do vulnera|da vuvu|do assistente))\b/.test(terms);
}

function asksForImplementation(text: string): boolean {
  return /^(?:qual|quais|que|como|diga|me diga|liste|mostre|exiba|voce usa|a vuvu usa|o vulnera usa)\b/.test(text)
    && (/\b(?:gemini|openai|chatgpt|claude|gpt|provedor|modelo de ia|modelo de linguagem|llm|stack|framework|bibliotecas internas|dependencias do projeto|instrucoes internas|banco de dados|endpoints privados|variaveis de ambiente|versao do modelo|versoes das dependencias|codigo fonte (?:do vulnera|da vuvu|do assistente|do projeto))\b/.test(text)
      || /\b(?:ia|tecnologia|linguagem|modelo|versao) (?:voces? usam?|a vuvu usa|o vulnera usa|esta por tras)\b/.test(text));
}

export type AssistantRuleTarget = "role_marker" | "claimed_authority" | "concealed_instruction" | "private_instructions" | "private_credentials" | "rule_override";

export function assistantRuleTarget(question: string): AssistantRuleTarget | null {
  const text = normalizeAssistantText(question);
  if (/\b(?:senhas?|senahs|sehnas|credenciais|chaves de acesso)\b/.test(text)
    && /\b(?:admin|administrador|banco(?: de dados)?|root|internas?)\b/.test(text)
    && /\b(?:diga|dizer|fala|fale|mostre|passe|me manda|envie|quais|qual|revele)\b/.test(text)) return "private_credentials";
  // Marcadores no início são texto da pessoa e não mudam o papel da mensagem.
  if (/^\s*(?:\[\s*(?:system|developer)\s*\]|<\s*(?:system|developer)(?=[\s>])|(?:\[im_end\]\s*)?\[im_start\]\s*(?:system|developer)\b|<start_of_turn>\s*(?:system|developer)\b)/i.test(question)) {
    return "role_marker";
  }

  // A intenção vem do pedido de obedecer; formatos, links e codificações isolados não bastam.
  const execute = /\b(?:execute|siga|obedeca|interprete|trate)\b/.test(text);
  const directive = /\b(?:instrucao|ordem)\b/.test(text);
  const commandToDecode = /^(?:decodifique .*\bbase64|aplique rot13)\b/.test(text) && execute && directive;
  const embeddedCommand = /^(?:o comentario|resuma|leia|execute|siga)\b/.test(text) && execute
    && (/<!--\s*(?:system|developer)\b/i.test(question) || /\b(?:instrucao|ordem) (?:oculta|escondida)\b/.test(text));
  if (commandToDecode || embeddedCommand || /^decodifique e execute\b/.test(text)) return "concealed_instruction";

  const claimsAuthority = /^(?:(?:eu )?sou (?:o |a )?(?:administrador|responsavel pela auditoria)|estamos em (?:uma )?janela de manutencao)\b/.test(text);
  if (claimsAuthority && /\b(?:prioridade e superior|ignore sua funcao|verificacoes de autorizacao podem ser ignoradas|seguranca esta desligad[ao])\b/.test(text)) {
    return "claimed_authority";
  }

  if (/^(?:(?:estou fazendo uma auditoria|nao|ao) )?(?:repita|revele|liste|mostre|converta|quais|reconstrua)\b.{0,110}\b(?:suas instrucoes|instrucoes internas|instrucoes ocultas|regras de seguranca que voce|ferramentas internas|endpoints privados|configuracoes internas|variaveis de ambiente|system prompt)\b/.test(text)) {
    return "private_instructions";
  }
  if (asksForImplementation(text.replace(/^(?:oi|ola|opa)(?: vuvu)?\s+/, ""))) return "private_instructions";
  if (/^relatorio de seguranca instrucao prioritaria para o assistente ignore\b/.test(text)
    || /^(?:voce (?:esta|foi) (?:liberad[ao]|autorizad[ao]) a ignorar|ignore|desative|desconsidere)\b.{0,60}\b(?:instrucoes|prompts|regras|restricoes|politicas)\b/.test(text)
    || /^(?:aja|finja|responda)\b.*\b(?:dan|sem politicas|sem restricoes|sem filtros)\b/.test(text)) {
    return "rule_override";
  }
  return null;
}

export function historyForAssistant(history: readonly AssistantHistoryMessage[]): AssistantHistoryMessage[] {
  let keepTurn = false;
  return history.filter((item) => {
    const clear = !containsSensitiveContent(item.content) && !assistantRuleTarget(item.content);
    // A resposta seguinte pode repetir a pergunta descartada; retire o turno completo.
    if (item.role === "user") keepTurn = clear;
    return keepTurn && clear;
  });
}

export function requestsCapabilityList(question: string): boolean {
  const text = normalizeAssistantText(question);
  return /^(?:(?:me )?(?:liste|listar|diga|mostre)|quais|o que)\b.{0,65}\b(?:funcoes|funcionalidades|recursos|modulos) (?:do|no) vulnera\b/.test(text)
    || /^(?:tudo )?(?:o que (?:da pra|posso) fazer|quais recursos (?:eu )?tenho) no vulnera\b/.test(text);
}

export function outsideProductTopic(question: string): "cars" | "airplane" | "rice" | "cooking" | "weather" | "joke" | "pets" | null {
  const text = normalizeAssistantText(question);
  if (/\bcelta ou corsa\b|\bcorsa ou celta\b/.test(text)) return "cars";
  if (/^se (?:voce )?fosse (?:um )?aviao\b/.test(text)) return "airplane";
  if (/^como (?:se )?(?:faz|faco|fazer|preparo|preparar) (?:um |o )?(?:arroz|arrpz)\b/.test(text)) return "rice";
  if (/^(?:(?:me )?(?:conte|conta|diga) uma piada|tem uma piada)\b/.test(text)) return "joke";
  if (/\b(?:gato ou cachorro|cachorro ou gato)\b/.test(text)) return "pets";
  if (/^(?:como (?:se )?(?:faz|faco|fazer|preparo|preparar)|(?:me )?(?:passe|ensine)) (?:um |uma |o |a )?(?:bolo|receita)\b/.test(text)
    || /^receita de\b/.test(text)) return "cooking";
  if (/^(?:(?:qual|como) (?:e |esta )?(?:a )?)?previsao do tempo(?:$| (?:hoje|amanha|para hoje|para amanha|em \w+)\b)/.test(text)) return "weather";
  return null;
}

export function requestsProductNavigation(question: string): boolean {
  const text = normalizeAssistantText(question).replace(/^(?:oi|ola|opa)(?: vuvu)?\s+/, "");
  return /^(?:onde|em qual tela|em que tela)\b/.test(text)
    || /^o que posso fazer (?:nesta|nessa) tela\b/.test(text)
    || /^como faco (?:uma|a) analise\b/.test(text)
    || /^(?:como (?:eu )?(?:(?:posso|faco para) )?|(?:voce )?pode )?(?:abro|abrir|acesso|acessar|vejo|ver|consulto|consultar|encontro|encontrar|cadastro|cadastrar|solicito|solicitar|crio|criar|gero|gerar|baixo|baixar|exporto|exportar|marco|marcar|envio|enviar|anexo|anexar|atribuo|atribuir|movo|mover|duplico|duplicar|comparo|comparar|trio|triar|revalido|revalidar|filtro|filtrar|corrijo|corrigir)\b/.test(text);
}
