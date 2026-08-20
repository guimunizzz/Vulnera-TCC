---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN12
criticidade: alta
---

# RN12 - Transicoes seguem maquina de estados

## Enunciado
As transições de status de Vulnerability devem obedecer à máquina de estados definida para o projeto.

> [!info] Qual máquina, na prática
> A máquina vigente no MVP tem **4 estados** (`OPEN → IN_PROGRESS → FIXED →
> CLOSED`), definida em [[ADR-021 - Maquina de Vulnerability com 4 estados]].
> A regra está satisfeita: o código recusa toda transição fora dessa máquina
> com `INVALID_STATUS_TRANSITION`.

## Impacta
[[Vulnerability]]
[[Maquina - Vulnerability]]
[[ADR-021 - Maquina de Vulnerability com 4 estados]]
[[Projetos]]

## Objetivo
Evitar transições arbitrárias e preservar coerência operacional.