---
type: maquina-estado
tags: [state-machine, source-of-truth]
status: ativo
---

# Maquina - Project

## Estados
- REQUESTED
- TRIAGE
- PLANNED
- IN_PROGRESS
- IN_REVIEW
- DELIVERED
- CLOSED

## Fluxo principal
REQUESTED -> TRIAGE -> PLANNED -> IN_PROGRESS -> IN_REVIEW -> DELIVERED -> CLOSED

## Retornos possíveis
- IN_REVIEW -> IN_PROGRESS
- DELIVERED -> IN_PROGRESS

## Observação
A volta para IN_PROGRESS ocorre quando há necessidade de ajustes ou revalidação.