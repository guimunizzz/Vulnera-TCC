---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN13
criticidade: alta
---

# RN13 - Fluxo com remediation service

> [!warning] Não implementada no MVP — trabalho futuro
> O estado `REVALIDATION` não existe no código. A máquina implementada tem 4
> estados (`OPEN → IN_PROGRESS → FIXED → CLOSED`) e não varia conforme
> remediação contratada. Ver
> [[ADR-021 - Maquina de Vulnerability com 4 estados]].
>
> Esta regra permanece como especificação de domínio para a evolução
> pós-MVP; não está vigente no código da Fase 5.

## Enunciado
Se `hasRemediationService = true`, o analista pode mover a Vulnerability para `FIXED` e `REVALIDATION`.

## Impacta
[[Project]]
[[Vulnerability]]
[[Remediation Service]]
[[ADR-021 - Maquina de Vulnerability com 4 estados]]