---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# Notification

## Definição
Representa uma notificação in-app gerada para um usuário específico. Persiste no banco o histórico de alertas recebidos e controla estado de leitura. Pode também servir de gatilho para envio de push mobile.

## Papel no sistema
`Notification` é o registro central do sistema de comunicação assíncrona da plataforma. Toda notificação in-app passa por essa entidade — seja gerada por eventos de assinatura, findings, projetos, chat ou tickets. O front-end consulta notificações não lidas e o WebSocket entrega em tempo real. O push mobile é disparado com base no campo `sent_as_push` e nas preferências do usuário.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `user_id` | uuid FK | [[User]] destinatário |
| `category` | string | Categoria do evento que gerou a notificação |
| `title` | string | Título da notificação |
| `message` | text | Conteúdo da notificação |
| `is_read` | boolean | Se o usuário já visualizou |
| `sent_as_push` | boolean | Se também foi disparado como push mobile |
| `created_at` | datetime | Momento de criação |

## Categorias previstas

| Categoria | Evento gerador |
|---|---|
| `SUBSCRIPTION_PENDING` | Nova assinatura aguardando aprovação (para Admin) |
| `SUBSCRIPTION_APPROVED` | Assinatura aprovada (para Cliente) |
| `CRITICAL_FINDING` | Finding crítico criado em projeto do cliente |
| `PROJECT_STATUS` | Mudança de status do projeto |
| `CHAT_MESSAGE` | Nova mensagem no chat do projeto |
| `FINDING_COMMENT` | Novo comentário em finding |
| `TICKET_OPENED` | Ticket de suporte aberto (para Admin) |
| `TICKET_RESPONSE` | Resposta em ticket (para Cliente) |

## Relacionamentos
- pertence a um [[User]] como destinatário
- gerada por eventos em [[Subscription]], [[Vulnerability]], [[Project]], [[ChatMessage]], [[VulnerabilityComment]], [[SupportTicket]]

## Regras associadas
- [[RN22 - Nova assinatura notifica Admin]]
- [[RN23 - Ticket de suporte gera email para Admin]]
- [[RN24 - Push mobile filtravel por categoria]]

## Estados / enums
`Notification` possui estado binário de leitura: `is_read = false` (não lida) ou `is_read = true` (lida).

Não há exclusão de notificações no MVP — todas ficam no histórico.

## Permissões / visibilidade
- criação: exclusiva do sistema (serviços internos) — nunca por ação direta do usuário
- leitura: usuário dono (`user_id`) e ADMIN
- marcar como lida: usuário dono
- push mobile: apenas para usuários CLIENT com Expo token cadastrado, respeitando preferências por categoria ([[RN24 - Push mobile filtravel por categoria]])

## Considerações de segurança
- `user_id` deve ser validado no guard — usuário não deve conseguir ler notificações de terceiros
- `message` e `title` não devem conter dados sensíveis (hashes, tokens, detalhes técnicos internos)
- endpoint de listagem deve filtrar por `user_id` do usuário autenticado — nunca retornar todas as notificações sem filtro

## Riscos de inconsistência
- notificação gerada para usuário inexistente (ex: user deletado): FK inválida — validar existência do usuário antes de criar
- acúmulo ilimitado de notificações não lidas pode degradar performance — considerar paginação e limpeza periódica de notificações antigas
- `sent_as_push` marcado como true mas push não enviado (falha no Expo): o registro persiste correto; o push é best-effort

## Links relacionados
[[User]]
[[RN22 - Nova assinatura notifica Admin]]
[[RN23 - Ticket de suporte gera email para Admin]]
[[RN24 - Push mobile filtravel por categoria]]
[[Notificacoes]]
[[WebSocket e Tempo Real]]
[[Mobile Cliente]]
[[MOC - Dominio]]
