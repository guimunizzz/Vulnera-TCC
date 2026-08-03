---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Criacao de Aplicacao

## Objetivo
Permitir que o cliente cadastre uma aplicação (sistema alvo de análise) dentro dos limites do plano ativo.

## Ator principal
Cliente (OWNER ou MEMBER) · Admin também pode cadastrar

## Pré-condições
- `Subscription` ativa (status `ACTIVE`)
- quantidade atual de Applications da Company está abaixo do limite do plano

## Passos principais

1. Cliente acessa a área de aplicações da sua empresa
2. Clica em "Nova aplicação"
3. Preenche os campos:
   - `name` — nome da aplicação
   - `url` — URL do sistema
   - `environment` — `PROD`, `HOMOL` ou `DEV`
   - `tech_stack` — stack tecnológico (texto livre)
   - `description` — descrição funcional
4. Sistema valida se a assinatura está ativa e se o limite de Applications não foi atingido
5. Se válido: cria a `Application` vinculada à `Company` com `is_active = true`
6. Se inválido (limite atingido): retorna `422 Unprocessable Entity` com mensagem explicativa
7. Se sem assinatura ativa: retorna `403 Forbidden`

## Regras de negócio relacionadas
- [[RN03 - Limite de aplicacoes por plano]] — gate principal deste fluxo
- [[RN04 - Application pertence a uma unica Company]] — a Application é vinculada à Company no ato
- [[RN07 - Projeto exige assinatura ativa]] — pré-requisito indireto

## Pós-condições
- `Application` criada com `company_id` da empresa do cliente
- Application disponível para vincular em novos Projects

## Notas
- a Application é reutilizável: pode ser usada em múltiplos Projects ao longo do tempo
- desativação é soft delete via `is_active = false` — não remove histórico de projetos

## Relacionado
[[Fluxo - Abertura de Projeto]]
[[Aplicacoes]]
[[Application]]
[[Company]]
[[Plan]]
[[Subscription]]
[[RN04 - Application pertence a uma unica Company]]
