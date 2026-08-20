---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN22
criticidade: alta
---

# RN22 - Nova assinatura notifica Admin

## Enunciado
Uma nova assinatura (`Subscription` em status `PENDING_APPROVAL`) notifica o Admin por e-mail e via notificação in-app.

## Motivação
O processo de aprovação de assinaturas é manual — o Admin precisa ser alertado imediatamente para não deixar clientes esperando. Sem notificação ativa, o Admin dependeria de verificar periodicamente a fila de pendências.

## Escopo
Aplica-se ao momento em que uma `Subscription` é criada com status `PENDING_APPROVAL`.

## Condições
- ao criar a Subscription, o Service deve disparar:
  1. e-mail para o Admin com dados da empresa e link direto para aprovação
  2. `Notification` in-app para todos os usuários com `role = ADMIN`
- os canais de notificação são: web (in-app) e e-mail
- push mobile **não** é disparado para este evento (Admin não usa mobile)

## Impacta
[[Subscription]]
[[Notification]]
[[Company]]
[[User]]

## Casos de teste
- criação de Subscription gera Notification para Admin no banco
- e-mail é enviado para o Admin com assunto e conteúdo corretos
- nenhum push mobile é disparado

## Relacionado
[[Maquina - Subscription]]
[[RN23 - Ticket de suporte gera email para Admin]]
[[Notificacoes]]
