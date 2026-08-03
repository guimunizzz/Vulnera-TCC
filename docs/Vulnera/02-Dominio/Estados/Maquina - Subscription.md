---
type: maquina-estado
tags: [state-machine, source-of-truth]
status: ativo
---

# Maquina - Subscription

## Estados

- `PENDING_APPROVAL` — aguardando aprovação manual do Admin
- `ACTIVE` — assinatura ativa, empresa pode operar na plataforma
- `SUSPENDED` — suspensa por violação ou inadimplência
- `CANCELED` — cancelada definitivamente
- `REJECTED` — recusada pelo Admin no momento da aprovação

## Fluxo principal

```
PENDING_APPROVAL → ACTIVE → CANCELED
```

## Fluxos alternativos

- `PENDING_APPROVAL → REJECTED` (Admin recusa no processo de aprovação)
- `ACTIVE → SUSPENDED` (violação ou inadimplência)
- `SUSPENDED → ACTIVE` (regularização)
- `SUSPENDED → CANCELED` (cancelamento forçado sem regularização)

## Diagrama

```
[*] --> PENDING_APPROVAL : cliente contrata
PENDING_APPROVAL --> ACTIVE : admin aprova
PENDING_APPROVAL --> REJECTED : admin recusa
ACTIVE --> SUSPENDED : violação / inadimplência
SUSPENDED --> ACTIVE : regularização
ACTIVE --> CANCELED : cliente cancela
SUSPENDED --> CANCELED : cancelamento forçado
CANCELED --> [*]
REJECTED --> [*]
```

## Quem pode transicionar

| Transição | Ator |
|-----------|------|
| `*` → `PENDING_APPROVAL` | Sistema (onboarding do cliente) |
| `PENDING_APPROVAL` → `ACTIVE` | Admin |
| `PENDING_APPROVAL` → `REJECTED` | Admin |
| `ACTIVE` → `SUSPENDED` | Admin |
| `SUSPENDED` → `ACTIVE` | Admin |
| `ACTIVE` → `CANCELED` | Cliente (OWNER) ou Admin |
| `SUSPENDED` → `CANCELED` | Admin |

## Impacto no sistema
- Subscription `ACTIVE` é pré-requisito para abrir projetos (RN07)
- Subscription `ACTIVE` define o limite de Applications via Plan (RN03)
- Mudança para `ACTIVE` dispara e-mail de boas-vindas ao cliente (RN22)

## Relacionado
[[Subscription]]
[[Plan]]
[[Company]]
[[RN07 - Projeto exige assinatura ativa]]
[[RN22 - Nova assinatura notifica Admin]]
