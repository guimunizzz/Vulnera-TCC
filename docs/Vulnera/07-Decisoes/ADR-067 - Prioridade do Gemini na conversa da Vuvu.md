---
status: aceito
data: 2026-11-20
---

<!-- Registra a prioridade do Gemini e as condições da ajuda local para orientar a manutenção da Vuvu. -->

# ADR-067 — Prioridade do Gemini na conversa da Vuvu

## Contexto

A ADR-066 introduziu respostas locais para saudações, apresentações e perguntas
sem assunto reconhecido. O usuário pediu que o Gemini responda quando estiver
disponível e que a ajuda local sirva como alternativa.

## Decisão

- Tentar o Gemini para toda mensagem elegível quando o provedor estiver
  configurado e houver orçamento. Se a seleção não identificar um tópico,
  fornecer ao modelo sugestões da tela filtradas pelo perfil autenticado.
  O modelo continua orientado a conversar apenas sobre o Vulnera.
- Usar a resposta básica, a orientação do catálogo ou o pedido de esclarecimento
  local quando a geração estiver indisponível ou não devolver texto utilizável.
- Aplicar a verificação de conteúdo sensível reconhecível antes da reserva e do
  envio. A API continua decidindo os atalhos. O contexto da tela, por si só,
  não cria atalhos para perguntas sem tópico.

## Consequências

Saudações e perguntas sem tópico passam a consumir orçamento quando encaminhadas
ao Gemini e podem reduzir o número de respostas externas antes da reposição.
Os valores dos limites, os perfis e o contrato de resposta continuam os mesmos.
A ajuda local mantém o chat utilizável durante o esgotamento ou uma falha externa.

## Relacionado

- ADR-064 — Assistente contextual com Gemini e ajuda local.
- ADR-066 — Conversa básica e cota de geração da Vuvu.
- `docs/ASSISTENTE_VULNERA.md`.

Registro de integração do PR #88 em 26/11/2026. Esta decisão usava ADR-057 na branch visual. O número foi atualizado para preservar a decisão da dev já publicada com aquele identificador.
