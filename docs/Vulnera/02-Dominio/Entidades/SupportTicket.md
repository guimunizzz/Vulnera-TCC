---
type: entidade
tags: [domain, source-of-truth, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> Tickets de suporte saíram do escopo do MVP. O model `SupportTicket` não existe no `schema.prisma` atual.
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# SupportTicket

## Definição
Representa uma solicitação de suporte aberta por um usuário CLIENT para a equipe da consultoria (Admin). Serve como canal formal de comunicação para dúvidas, problemas e solicitações fora do escopo dos projetos.

## Papel no sistema
`SupportTicket` é o canal de suporte ao cliente da plataforma. Separa comunicações de suporte geral dos chats de projeto, garantindo rastreabilidade e histórico formal do atendimento. O fluxo é gerenciado pelo Admin com notificação automática na abertura.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `opened_by` | uuid FK | [[User]] que abriu o ticket (deve ser CLIENT) |
| `company_id` | uuid FK | [[Company]] à qual o ticket pertence |
| `subject` | string | Assunto resumido do ticket |
| `description` | text | Descrição detalhada do problema |
| `status` | string | Estado atual: `OPEN`, `IN_PROGRESS`, `CLOSED` |
| `opened_at` | datetime | Momento de abertura |
| `closed_at` | datetime | Momento de encerramento (nullable) |

## Relacionamentos
- pertence a um [[User]] como solicitante
- pertence a uma [[Company]]
- não está vinculado a um [[Project]] específico — é canal de suporte geral

## Regras associadas
- [[RN23 - Ticket de suporte gera email para Admin]]
- [[RN16 - Cliente so ve dados da propria Company]]

## Estados / enums
Ver máquina de estados completa: [[Maquina - SupportTicket]]

| Status | Descrição |
|---|---|
| `OPEN` | Aberto pelo cliente, aguardando resposta do Admin |
| `IN_PROGRESS` | Admin respondeu e está em atendimento |
| `CLOSED` | Resolvido ou cancelado |

Transições permitidas:
- `OPEN → IN_PROGRESS`: Admin responde
- `IN_PROGRESS → OPEN`: Cliente responde, retorna à fila
- `IN_PROGRESS → CLOSED`: Admin encerra como resolvido
- `OPEN → CLOSED`: Cliente cancela sem aguardar resposta

## Permissões / visibilidade
- criação: CLIENT (qualquer companyRole)
- leitura: CLIENT vê apenas tickets da própria Company; ADMIN vê todos
- transições de status: conforme tabela da máquina de estados
- PENTESTER não possui acesso a tickets de suporte

## Considerações de segurança
- `description` é texto livre — sanitizar ao renderizar no front-end para prevenir XSS
- `opened_by` e `company_id` devem ser derivados do JWT, nunca do corpo da requisição
- e-mail enviado ao Admin deve conter link direto mas não deve expor dados sensíveis da empresa no assunto do e-mail

## Riscos de inconsistência
- ticket sem `company_id` pode resultar em vazamento entre empresas — campo deve ser obrigatório e derivado do usuário autenticado
- mudança de status sem notificação pode deixar cliente sem resposta visível — notificação in-app deve ser gerada em cada transição
- `closed_at` deve ser preenchido apenas quando status for `CLOSED`

## Links relacionados
[[Company]]
[[User]]
[[Maquina - SupportTicket]]
[[RN23 - Ticket de suporte gera email para Admin]]
[[RN16 - Cliente so ve dados da propria Company]]
[[Tickets]]
[[MOC - Dominio]]
