---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# Subscription

## Definição
Representa a assinatura de um plano por uma Company.

## Papel no sistema
Controla ativação, elegibilidade de uso, limites e estado comercial da empresa no sistema.

## Estados
[[Maquina - Subscription]]

## Regras associadas
- [[RN03 - Limite de aplicacoes por plano]]
- [[RN07 - Projeto exige assinatura ativa]]
- [[RN22 - Nova assinatura notifica Admin]]

## Status relevantes
- PENDING_APPROVAL
- ACTIVE
- REJECTED
- SUSPENDED
- CANCELED

## Observação
A assinatura é aprovada manualmente por Admin.