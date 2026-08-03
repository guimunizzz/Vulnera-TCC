---
type: enum
tags: [data, domain, source-of-truth]
status: ativo
---

# Enum - SubscriptionStatus

## Definição
`SubscriptionStatus` representa o estado atual de uma `Subscription`. Determina se a empresa cliente pode operar na plataforma e sob quais condições.

## Valores

| Valor | Descrição |
|---|---|
| `PENDING_APPROVAL` | Assinatura criada pelo cliente, aguardando aprovação manual do Admin. |
| `ACTIVE` | Assinatura ativa. Empresa pode cadastrar aplicações e abrir projetos. |
| `SUSPENDED` | Assinatura suspensa (inadimplência ou violação). Empresa não pode criar novos projetos. |
| `CANCELED` | Assinatura cancelada definitivamente. |
| `REJECTED` | Proposta de assinatura recusada pelo Admin. |

## Campo no banco

Tabela `SUBSCRIPTION`, campo `status`:
```
status  VARCHAR / ENUM  NOT NULL
```

Valores válidos no Prisma:
```prisma
enum SubscriptionStatus {
  PENDING_APPROVAL
  ACTIVE
  SUSPENDED
  CANCELED
  REJECTED
}
```

## Fluxo de transições

### Fluxo principal
```
PENDING_APPROVAL → ACTIVE → CANCELED
```

### Fluxos alternativos
```
PENDING_APPROVAL → REJECTED
ACTIVE → SUSPENDED → ACTIVE   (regularização)
ACTIVE → SUSPENDED → CANCELED
```

Ver máquina de estados completa: [[Maquina - Subscription]]

## Quem pode transicionar

| Transição | Ator |
|---|---|
| `*` → `PENDING_APPROVAL` | Sistema (onboarding) |
| `PENDING_APPROVAL` → `ACTIVE` | Admin |
| `PENDING_APPROVAL` → `REJECTED` | Admin |
| `ACTIVE` → `SUSPENDED` | Admin |
| `SUSPENDED` → `ACTIVE` | Admin |
| `ACTIVE` → `CANCELED` | Cliente (OWNER) ou Admin |
| `SUSPENDED` → `CANCELED` | Admin |

## Impacto funcional

| Status | Capacidade da empresa |
|---|---|
| `PENDING_APPROVAL` | Conta criada, mas sem acesso operacional |
| `ACTIVE` | Acesso total dentro dos limites do plano |
| `SUSPENDED` | Leitura permitida; criação bloqueada |
| `CANCELED` | Acesso encerrado |
| `REJECTED` | Onboarding negado; sem acesso |

## Regras associadas
- [[RN07 - Projeto exige assinatura ativa]] — `ACTIVE` é pré-requisito para criar Project
- [[RN03 - Limite de aplicacoes por plano]] — limite só vale quando `ACTIVE`
- [[RN22 - Nova assinatura notifica Admin]] — `PENDING_APPROVAL` dispara notificação ao Admin

## Links relacionados
[[Maquina - Subscription]]
[[Subscription]]
[[Plan]]
[[RN07 - Projeto exige assinatura ativa]]
[[RN22 - Nova assinatura notifica Admin]]
[[MOC - Dominio]]
