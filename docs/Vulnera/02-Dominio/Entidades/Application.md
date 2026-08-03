---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# Application

## Definição
Sistema alvo de análise pertencente a uma Company.

## Papel no sistema
É o ativo analisado pelos projetos do Vulnera.

## Campos importantes
- nome
- url
- environment
- tech_stack
- description
- is_active

## Regras associadas
- [[RN03 - Limite de aplicacoes por plano]]
- [[RN04 - Application pertence a uma unica Company]]
- [[RN05 - Project 1 para 1 com Application]]

## Relacionado
[[Company]]
[[Project]]
[[Fluxo - Criacao de Aplicacao]]