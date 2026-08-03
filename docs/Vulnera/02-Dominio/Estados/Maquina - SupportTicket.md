---
type: maquina-estado
tags: [state-machine, source-of-truth, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> A entidade `SupportTicket` saiu do escopo do MVP; esta máquina de estados não é implementada.
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Maquina - SupportTicket

## Estados

- `OPEN` — ticket aberto pelo cliente, aguardando primeira resposta do Admin
- `IN_PROGRESS` — Admin respondeu e está em atendimento
- `CLOSED` — ticket resolvido ou cancelado

## Fluxo principal

```
OPEN → IN_PROGRESS → CLOSED
```

## Fluxos alternativos

- `IN_PROGRESS → OPEN` — cliente responde, retorna para fila do Admin
- `OPEN → CLOSED` — cliente cancela o ticket sem aguardar resposta

## Diagrama

```
[*] --> OPEN : cliente abre
OPEN --> IN_PROGRESS : admin responde
IN_PROGRESS --> OPEN : cliente responde
IN_PROGRESS --> CLOSED : resolvido
OPEN --> CLOSED : cancelado pelo cliente
CLOSED --> [*]
```

## Quem pode transicionar

| Transição | Ator |
|-----------|------|
| `*` → `OPEN` | Cliente (CLIENT, qualquer companyRole) |
| `OPEN` → `IN_PROGRESS` | Admin |
| `IN_PROGRESS` → `OPEN` | Cliente |
| `IN_PROGRESS` → `CLOSED` | Admin |
| `OPEN` → `CLOSED` | Cliente (cancelamento) |

## Comportamento de notificação
- abertura de ticket gera e-mail para Admin com link direto (RN23)
- resposta do Admin gera notificação in-app para o cliente
- resposta do cliente gera notificação in-app para o Admin

## Relacionado
[[SupportTicket]]
[[RN23 - Ticket de suporte gera email para Admin]]
[[Tickets]]
