---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN16
criticidade: alta
---

# RN16 - Cliente so ve dados da propria Company

## Enunciado
O cliente só pode acessar dados de Projects, Applications e Findings vinculados à sua própria Company.

## Impacta
[[User]]
[[Company]]
[[Project]]
[[Application]]
[[Vulnerability]]
[[Regras de Ownership]]

## Motivação
Garantir isolamento lógico e segurança multi-tenant por escopo.