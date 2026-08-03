---
type: funcionalidade
tags: [feature, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> Tickets de suporte saíram do escopo do MVP.
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Tickets

## Objetivo
Permitir que clientes abram tickets de suporte para a consultoria, com notificação imediata ao Admin e acompanhamento na plataforma.

## Usuários envolvidos
- **Cliente** (OWNER ou MEMBER): abre e acompanha tickets
- **Admin**: recebe, responde e fecha tickets

## Capacidades

### Do cliente
- abrir novo ticket com `subject` e `description`
- acompanhar o status do ticket (OPEN, IN_PROGRESS, CLOSED)
- responder a mensagem do Admin (retorna para OPEN)
- cancelar o ticket (fecha como CLOSED)

### Do Admin
- visualizar lista de tickets abertos e em progresso de todas as empresas
- responder ao ticket (move para IN_PROGRESS)
- fechar o ticket ao resolver

## Estados do ticket
Ver [[Maquina - SupportTicket]] para o diagrama completo.
- `OPEN` → `IN_PROGRESS` → `CLOSED`
- `IN_PROGRESS` → `OPEN` (cliente responde)

## Notificações
- abertura de ticket envia e-mail para Admin com link direto (RN23)
- resposta do Admin gera notificação in-app para o cliente
- resposta do cliente gera notificação in-app para o Admin

## Regras associadas
- [[RN23 - Ticket de suporte gera email para Admin]]

## Fluxos relacionados
Não há fluxo dedicado na lista canônica — o processo é descrito pela máquina de estados [[Maquina - SupportTicket]].

## Dependências técnicas
- `POST /support` (cliente cria)
- `GET /support` (admin: todos · cliente: apenas da própria company)
- `POST /support/:id/reply` (resposta de qualquer lado)
- `POST /support/:id/close`
- e-mail enviado via Nodemailer/Resend ao criar

## Relacionado
[[SupportTicket]]
[[Maquina - SupportTicket]]
[[Notificacoes]]
[[RN23 - Ticket de suporte gera email para Admin]]
