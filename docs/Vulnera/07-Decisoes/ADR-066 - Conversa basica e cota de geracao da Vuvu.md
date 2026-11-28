---
status: aceito
data: 2026-11-16
---

<!-- Registra a separação entre conversa local, geração e proteção HTTP; consumido pelos mantenedores para preservar custo, acessibilidade e permissões. -->

# ADR-066 — Conversa básica e cota de geração da Vuvu

> A ADR-067 substituiu a prioridade da ajuda local nas mensagens básicas e sem tópico. As decisões de cota, proteção HTTP e teclado continuam vigentes.

> Em 20/11/2026, a capacidade inicial pessoal e compartilhada passou para 20 gerações. As taxas de reposição e a proteção HTTP continuam vigentes.

> Em 27/11/2026, a [ADR-068](ADR-068%20-%20Orcamento%20e%20fronteiras%20da%20Vuvu.md) substituiu a configuração das rajadas e definiu contadores próprios e divisão por processo.

## Contexto

O usuário relatou que “OI”, “OQ E O VULNERA” e “quem e vc” recebiam uma resposta
genérica e que a conversa era bloqueada mesmo usando ajuda local. Autorizou
corrigir reconhecimento, separar cotas, melhorar a espera e enviar por Enter.
A ADR-064 originalmente consumia os buckets próprios antes de toda conversa.

## Decisão

- Preservar os 44 tópicos de domínio e acrescentar três respostas básicas curadas
  em configuração própria: saudação, identidade e apresentação do produto.
  Reconhecer somente intenções completas para não descartar um pedido que começa
  com “Oi”. Normalizar abreviações por palavras inteiras, acentos e caixa;
  conservar a pergunta original para a conversa e eventual gateway.
- Executar a barreira de conteúdo sensível antes dessas respostas. Não ampliar
  perfis, telas, atalhos autorizados ou acesso a dados. Pergunta não reconhecida
  pede esclarecimento, sem afirmar ausência de documentação ou oferecer ações
  operacionais que não foram identificadas.
- Reservar os buckets existentes `assistant-user` e `assistant-global` somente
  antes de tentar gerar pelo gateway. Manter valores de reposição/rajada,
  retenção e memória. Rejeição global devolve reserva pessoal; tentativa externa
  falha continua consumindo orçamento, evitando repetição ilimitada com custo.
- No esgotamento desses buckets, retornar ajuda local HTTP 200 com o campo
  opcional `providerRetryAfterSeconds`. Não chamar o gateway nem agendar reenvio.
  A interface mantém envio manual de novas dúvidas e mostra o prazo da geração.
- Manter autenticação e limites HTTP gerais/usuário/empresa/escrita. Eles ainda
  podem devolver HTTP 429 com `Retry-After`/`retryAfterSeconds`; nesses casos, a
  interface conserva o rascunho, conta o prazo e bloqueia novos envios até expirar.
- O controller recebe o limiter da aplicação e passa uma função de reserva ao
  service, sem transportar Request/Response ou identificadores de conta ao
  gateway. Factory, store único e responsabilidades de camada preservados.
- Enter no campo envia pelo mesmo formulário do botão; Shift+Enter insere linha.
  Ignorar composição IME, repetição de tecla e envio vazio/pendente. Botão segue
  acessível por Tab/Enter e o foco vai ao campo no envio explícito. Sem roubar o
  foco após a resposta. Atalhos da personagem continuam separados.
- Mostrar instruções de teclado e relacionar campo/contadores por descrição
  acessível. Prazos usam relógio absoluto e não são anunciados a cada segundo;
  início/fim têm mensagens estáveis. Timers são limpos ao desmontar a sessão.

## Consequências

Substitui a parte da ADR-064 que aplicava o orçamento próprio a toda mensagem e
convertia seu esgotamento em 429. O contrato 429 dos limitadores gerais permanece.
Ajuda local não gasta orçamento de geração, mas continua sujeita à proteção HTTP.
Não aumenta cotas, tokens ou frequência configurada do Gemini; o aproveitamento
da cota pode aumentar porque mensagens locais deixam de consumi-la. Sem garantia
de gratuidade, consulta ao faturamento ou mudança no ambiente privado.

Não há schema, dependência ou persistência nova. Conversa e espera são de sessão;
reload não reinicia os buckets do servidor. Valores numéricos não revelam modelo,
chave ou dados de cliente. A contagem de 44 refere-se aos tópicos de domínio;
as três respostas conversacionais básicas são mantidas separadamente.

## Relacionado

- ADR-064 — Assistente contextual com Gemini e ajuda local.
- ADR-065 — Reações locais e modo discreto da Vuvu.
- `docs/ASSISTENTE_VULNERA.md`.
- `docs/QA_VUVU_CONVERSA_2026-11-16.md`.

Registro de integração do PR #88 em 26/11/2026. Esta decisão usava ADR-056 na branch visual. O número foi atualizado para preservar a decisão da dev já publicada com aquele identificador.
