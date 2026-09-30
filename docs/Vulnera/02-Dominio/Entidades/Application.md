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
- companyId obrigatório e imutável depois da criação
- is_active

## Criação por papel

- `ADMIN` escolhe explicitamente uma empresa existente ao criar a aplicação. A
  API valida o alvo e preserva os gates de assinatura ativa e limite do plano.
- `CLIENT` não escolhe empresa: a API deriva o vínculo do usuário autenticado e
  ignora `companyId` enviado manualmente.
- `PENTESTER` não cria aplicações.
- `companyId` não pode ser transferido por update.

Ver [[ADR-043 - Alvo administrativo explicito na criacao de Application]].

## Regras associadas
- [[RN03 - Limite de aplicacoes por plano]]
- [[RN04 - Application pertence a uma unica Company]]
- [[RN05 - Project 1 para 1 com Application]]

## Relacionado
[[Company]]
[[Project]]
[[Fluxo - Criacao de Aplicacao]]
