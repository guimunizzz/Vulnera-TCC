---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN01
criticidade: media
---

# RN01 - Empresa pode ter multiplos usuarios cliente

## Enunciado
Uma `Company` pode ter múltiplos `Users` com role `CLIENT`.

## Motivação
Reflete a realidade operacional: uma empresa contratante tem várias pessoas que precisam acompanhar o andamento das análises. O controle de quem tem poder de decisão vs quem apenas consulta é feito via `CompanyRole`.

## Escopo
Aplica-se a qualquer `User` criado com `role = CLIENT`. Não há limite máximo definido para a quantidade de usuários por empresa no MVP.

## Condições
- cada usuário CLIENT tem exatamente um `companyRole`: `OWNER` ou `MEMBER`
- o primeiro usuário cadastrado no onboarding recebe `companyRole = OWNER`
- usuários adicionais são convidados pelo OWNER e recebem `companyRole = MEMBER`

## Impacta
[[Company]]
[[User]]
[[CompanyRole]]

## Relacionado
[[RN02 - Usuario pertence a no maximo uma Company]]
[[Roles]]
[[Matriz de Permissoes]]
