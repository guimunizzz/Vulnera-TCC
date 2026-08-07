---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN14
criticidade: alta
---

# RN14 - Fluxo sem remediation service

> [!warning] Não implementada no MVP — trabalho futuro
> O estado `REVALIDATION` não existe no código, e o `CLIENT` é read-only na
> Fase 5 (não transiciona finding em hipótese nenhuma — RN16). A máquina
> implementada tem 4 estados e não varia conforme remediação contratada.
> Ver [[ADR-021 - Maquina de Vulnerability com 4 estados]].
>
> Esta regra permanece como especificação de domínio para a evolução
> pós-MVP; não está vigente no código da Fase 5.

## Enunciado
Se `hasRemediationService = false`, apenas o cliente pode marcar como `FIXED` ou solicitar `REVALIDATION`.

## Impacta
[[Project]]
[[Vulnerability]]
[[Remediation Service]]
[[ADR-021 - Maquina de Vulnerability com 4 estados]]