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

## Nota de implementação — Issue #20 (decisão em 2026-10-01)

Para criar Project, `ACTIVE` deve ser consultada pela empresa da Application
selecionada (`Application.companyId`). O `companyId` pessoal do usuário não é o
alvo comercial: ADMIN pode escolher uma Application de outra empresa. A
subscription determina também o Plan aplicável. Ver [[ADR-044 - Regras comerciais para criar Project]].

**Implementação — CP-3 da Issue #20 (validada em 2026-10-01):** o serviço
consulta a subscription `ACTIVE` e o Plan pela empresa da Application
selecionada. O gate também verifica Application ativa, capacidade de projetos
simultâneos e opção de remediação conforme o Plan. Testes focais API: 24/24;
`project.service` com 100% linhas/funções, 84,31% branches e 93,2% statements;
build API host aprovado.

A checagem da RN05 e a contagem de capacidade não são serializadas com a criação.
Requests concorrentes ainda podem ultrapassar os limites; hardening e garantia
de concorrência permanecem fora desta implementação. Ver [[ADR-044 - Regras comerciais para criar Project]].
