---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN10
criticidade: alta
---

# RN10 - Severidade via CVSS com override justificado

## Enunciado
A severidade de uma Vulnerability é calculada a partir do CVSS v3.1, podendo receber override manual com justificativa.

## Motivação
Equilibrar padronização técnica com julgamento contextual do analista.

## Impacta
[[Vulnerability]]
[[CVSS]]
[[AuditLog]]

## Regras associadas
- mudança de severidade deve ser auditada
- justificativa é obrigatória em override