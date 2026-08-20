---
type: enum
tags: [data, domain, source-of-truth, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> A entidade `SupportTicket` saiu do escopo do MVP; este enum não é implementado.
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Enum - TicketStatus

## Definição
`TicketStatus` representa o estado atual de um `SupportTicket`. Controla o fluxo de atendimento entre cliente e Admin.

## Valores

| Valor | Descrição |
|---|---|
| `OPEN` | Ticket aberto pelo cliente. Aguarda primeira resposta do Admin. |
| `IN_PROGRESS` | Admin respondeu. Atendimento em andamento. |
| `CLOSED` | Ticket encerrado — resolvido ou cancelado pelo cliente. |

## Campo no banco

Tabela `SUPPORT_TICKET`, campo `status`:
```
status  VARCHAR / ENUM  NOT NULL
```

Valores válidos no Prisma:
```prisma
enum TicketStatus {
  OPEN
  IN_PROGRESS
  CLOSED
}
```

## Fluxo de transições

### Fluxo principal
```
OPEN → IN_PROGRESS → CLOSED
```

### Fluxos alternativos
```
IN_PROGRESS → OPEN    (cliente responde — retorna à fila do Admin)
OPEN → CLOSED         (cliente cancela sem aguardar resposta)
```

Ver máquina de estados completa: [[Maquina - SupportTicket]]

## Quem pode transicionar

| Transição | Ator |
|---|---|
| `*` → `OPEN` | Cliente (CLIENT, qualquer CompanyRole) |
| `OPEN` → `IN_PROGRESS` | Admin |
| `IN_PROGRESS` → `OPEN` | Cliente (nova resposta) |
| `IN_PROGRESS` → `CLOSED` | Admin |
| `OPEN` → `CLOSED` | Cliente (cancelamento) |

## Comportamento de notificação por transição

| Transição | Notificação gerada |
|---|---|
| `*` → `OPEN` | E-mail para Admin + notificação in-app para Admin (RN23) |
| `OPEN` → `IN_PROGRESS` | Notificação in-app para o Cliente |
| `IN_PROGRESS` → `OPEN` | Notificação in-app para Admin |
| `*` → `CLOSED` | Notificação in-app para o Cliente |

## Impacto funcional

| Status | Estado do atendimento |
|---|---|
| `OPEN` | Visível na fila de pendências do Admin |
| `IN_PROGRESS` | Admin está atendendo ativamente |
| `CLOSED` | Arquivado no histórico; sem ações adicionais |

## Regras associadas
- [[RN23 - Ticket de suporte gera email para Admin]]

## Links relacionados
[[Maquina - SupportTicket]]
[[SupportTicket]]
[[RN23 - Ticket de suporte gera email para Admin]]
[[MOC - Dominio]]
