---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN14
criticidade: alta
---

# RN14 - Fluxo sem remediation service

## Enunciado
Se `hasRemediationService = false`, apenas o cliente pode marcar como `FIXED` ou solicitar `REVALIDATION`.

## Impacta
[[Project]]
[[Vulnerability]]
[[Remediation Service]]