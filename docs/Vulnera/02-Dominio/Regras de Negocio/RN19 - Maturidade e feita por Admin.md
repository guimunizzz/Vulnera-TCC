---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN19
criticidade: media
---

# RN19 - Maturidade e feita por Admin

## Enunciado
A avaliação de maturidade é feita por Admin. Clientes e Pentesters apenas visualizam os resultados.

## Motivação
A avaliação de maturidade requer julgamento técnico especializado e representa a posição oficial da consultoria sobre a segurança do cliente. Delegar esse poder a clientes ou pentesters quebraria a integridade da avaliação como entregável profissional.

## Escopo
Aplica-se a todas as operações de criação e edição de `MaturityAssessment` e `MaturityScore`.

## Condições
- criação de `MaturityAssessment` exige `role = ADMIN`
- atualização de scores (`MaturityScore`) exige `role = ADMIN`
- leitura de assessment e scores é permitida para CLIENT e PENTESTER atribuídos
- o campo `evaluated_by` no `MaturityAssessment` registra o Admin responsável

## Impacta
[[MaturityAssessment]]
[[MaturityScore]]
[[MaturityDomain]]
[[MaturityControl]]

## Casos de teste
- Admin cria assessment e define scores com sucesso
- CLIENT tenta criar assessment e recebe erro 403
- PENTESTER tenta editar score e recebe erro 403
- CLIENT consegue visualizar o assessment do próprio projeto

## Relacionado
[[Maturidade]]
[[Roles]]
[[Matriz de Permissoes]]
