---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN23
criticidade: media
---

# RN23 - Ticket de suporte gera email para Admin

## Enunciado
A abertura de um ticket de suporte (`SupportTicket`) gera um e-mail para o Admin com link direto.

## Motivação
Tickets de suporte requerem atenção rápida para manter a qualidade do relacionamento com o cliente. O e-mail com link direto reduz o tempo de resposta e evita que tickets fiquem ignorados na fila.

## Escopo
Aplica-se ao momento em que um `SupportTicket` é criado por um CLIENT.

## Condições
- ao criar o SupportTicket, o Service deve disparar:
  - e-mail para o Admin com subject, descrição resumida e link direto para o ticket
- notificação in-app também deve ser criada para o Admin
- push mobile **não** é disparado para este evento
- o cliente recebe confirmação in-app de que o ticket foi aberto com sucesso

## Impacta
[[SupportTicket]]
[[Notification]]

## Casos de teste
- abertura de ticket gera e-mail para Admin com link correto
- e-mail contém subject e resumo da descrição
- notificação in-app é criada para o Admin
- cliente vê confirmação no frontend

## Relacionado
[[Maquina - SupportTicket]]
[[RN22 - Nova assinatura notifica Admin]]
[[Tickets]]
