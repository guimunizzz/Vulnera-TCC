---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN07
criticidade: alta
---

# RN07 - Projeto exige assinatura ativa

## Enunciado
Um Project só pode ser aberto se a Company possuir Subscription ativa.

## Motivação
Preservar a lógica de contratação e evitar uso indevido da plataforma.

## Impacta
[[Project]]
[[Subscription]]
[[Company]]

## Casos de teste
- Company com ACTIVE cria projeto
- Company com PENDING_APPROVAL não cria
- Company com CANCELED não cria