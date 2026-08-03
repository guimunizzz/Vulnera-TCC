---
type: conceito
tags: [domain]
status: ativo
---

# Remediation Service

## Definição
Flag opcional de um `Project` (`hasRemediationService`) que define se o serviço de remediação está incluso na análise. Altera quem pode mover o status de uma `Vulnerability` durante o ciclo de remediação.

## Impacto no fluxo de Vulnerability

### Com `hasRemediationService = true`
O analista (PENTESTER/ADMIN) conduz a remediação:
- Pentester pode mover `Vulnerability` para `IN_PROGRESS`, `FIXED` e `REVALIDATION`
- Cliente acompanha e pode aceitar risco (`RISK_ACCEPTED`)

### Sem `hasRemediationService = false`
O cliente conduz a remediação:
- Cliente deve mover para `FIXED` após corrigir
- Apenas Pentester/Admin valida (move para `REVALIDATION` e `CLOSED`)

## Onde é configurado
- no momento da criação do `Project` — campo `has_remediation_service`
- vinculado ao plano: o `Plan` tem o campo `includes_remediation` que indica se o serviço está disponível

## Links relacionados
[[Project]]
[[Vulnerability]]
[[RN13 - Fluxo com remediation service]]
[[RN14 - Fluxo sem remediation service]]
[[Maquina - Vulnerability]]
[[Plan]]
[[Projetos]]
