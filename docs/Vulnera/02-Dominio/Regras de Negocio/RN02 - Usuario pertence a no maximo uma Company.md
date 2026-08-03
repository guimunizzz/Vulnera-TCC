---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN02
criticidade: media
---

# RN02 - Usuario pertence a no maximo uma Company

## Enunciado
Um `User` pertence a no máximo uma `Company`.

## Motivação
Garante isolamento de dados e simplifica a lógica de ownership. Um usuário nunca opera em contextos de empresas diferentes simultaneamente — elimina necessidade de controle de contexto ativo e evita vazamento de dados entre empresas.

## Escopo
Aplica-se a usuários com `role = CLIENT`. Usuários com `role = ADMIN` ou `PENTESTER` não pertencem a nenhuma Company (`company_id = null`).

## Condições
- campo `company_id` no `User` é `null` para Admin e Pentester
- campo `company_id` é obrigatório e único por usuário para role CLIENT
- não é possível transferir um usuário de uma empresa para outra no MVP

## Exceções
- não se aplica a ADMIN e PENTESTER, que operam em escopo global ou por atribuição de projeto

## Impacta
[[User]]
[[Company]]

## Casos de teste
- tentativa de criar segundo vínculo de empresa para um CLIENT retorna erro
- Admin sem company_id consegue acessar dados de todas as empresas

## Relacionado
[[RN01 - Empresa pode ter multiplos usuarios cliente]]
[[Regras de Ownership]]
