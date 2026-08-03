---
type: estrutura-projeto
tags: [architecture, docs]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Estrutura - Docs do Projeto

## Objetivo

Definir a pasta `docs/` do repositório de código do Vulnera.

Esta pasta não substitui o vault do Obsidian.

## Diferença entre `docs/` e `Vault_TCC`

### `docs/`

Documentação próxima ao código.

Exemplos:

- OpenAPI
- diagramas técnicos
- decisões arquiteturais do repositório
- status técnico do projeto
- documentação para desenvolvedores

### `Vault_TCC`

Memória ampla do TCC.

Inclui:

- domínio
- produto
- arquitetura
- decisões
- histórico
- prompts
- documentação acadêmica
- fonte original do MVP

## Estrutura

```text
docs/
├── vulnera.md
├── PRD.md
├── STATUS.md
├── api/
├── architecture/
└── decisions/
```

## `docs/vulnera.md`

Cópia ou referência ao documento base do projeto.

No vault, a fonte original é:

- [[Fonte Original - MVP Vulnera]]
- [[vulnera]]

## `docs/PRD.md`

Documento de requisitos de produto.

Pode ser gerado a partir das notas de:

- [[MOC - Produto]]
- [[Objetivos]]
- [[Visao Geral]]
- [[Visao Geral]]

## `docs/STATUS.md`

Status técnico do desenvolvimento.

Pode resumir:

- features implementadas
- pendências
- riscos
- próximos passos

## `docs/api/openapi.yaml`

Especificação OpenAPI gerada pelo Swagger do Express.

## `docs/architecture/`

Documentos técnicos de arquitetura:

- diagrama de contexto
- modelo de dados
- máquinas de estado

## `docs/decisions/`

ADRs próximos ao código.

Devem manter coerência com:

- [[ADR-001 - Plataforma foca gestao e nao execucao real]]
- [[ADR-002 - Project 1 para 1 com Application]]
- [[ADR-003 - PDF gerado no cliente]]
- [[ADR-004 - Mobile cliente e read-mostly]]
- [[ADR-005 - Desenvolvimento local com Docker minimo]]
- [[ADR-006 - Gemini com rate limit agressivo]]
- [[ADR-007 - Sonar informativo e ZAP manual]]

## Regra para o Claude

Ao gerar documentação no repositório de código, o Claude deve manter consistência com o vault.

O vault é a memória principal.

A pasta `docs/` é documentação técnica derivada para acompanhar o código.