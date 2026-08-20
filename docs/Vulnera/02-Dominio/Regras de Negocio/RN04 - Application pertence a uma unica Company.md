---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN04
criticidade: alta
---

# RN04 - Application pertence a uma unica Company

## Enunciado
Uma `Application` pertence a uma única `Company` e é reutilizável entre projetos.

## Motivação
Isola os ativos de segurança por empresa. Uma application nunca pode ser compartilhada entre empresas distintas. O vínculo com Company (não com Project) permite que a mesma aplicação tenha vários projetos ao longo do tempo.

## Escopo
Aplica-se a todas as Applications cadastradas na plataforma.

## Condições
- campo `company_id` na tabela `APPLICATION` é não-nulo e imutável após criação
- uma Application pode estar vinculada a vários Projects ao longo do tempo (reutilizável)
- a exclusão de uma Application é soft delete via flag `is_active`

## Impacta
[[Application]]
[[Company]]
[[Project]]

## Casos de teste
- Application criada por empresa A não aparece na listagem de empresa B
- Admin vê Applications de qualquer empresa
- tentativa de mover Application para outra Company deve falhar

## Relacionado
[[RN05 - Project 1 para 1 com Application]]
[[RN06 - Project herda Company da Application]]
[[RN03 - Limite de aplicacoes por plano]]
