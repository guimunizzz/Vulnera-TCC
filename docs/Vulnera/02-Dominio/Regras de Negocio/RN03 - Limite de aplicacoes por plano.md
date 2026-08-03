---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN03
criticidade: alta
---

# RN03 - Limite de aplicacoes por plano

## Enunciado
A quantidade de Applications de uma Company é limitada pelo plano ativo.

## Motivação
Garantir coerência com o modelo comercial e controlar o uso da plataforma.

## Impacta
[[Company]]
[[Application]]
[[Plan]]
[[Subscription]]

## Casos de teste
- plano Basic respeita limite 2
- plano Pro respeita limite 5
- plano inativo bloqueia criação