---
type: estrutura-projeto
tags: [architecture, monorepo, shared-code]
status: ativo
---

# Estrutura - Packages Compartilhados

## Objetivo

Definir a estrutura de código compartilhado entre API, Web e Mobile.

A pasta `packages/` evita duplicação de:

- tipos
- enums
- validações
- utilitários

## Estrutura

```text
packages/
├── types/
├── validators/
└── utils/
```

## `packages/types`

Contém tipos TypeScript compartilhados.

```text
types/
├── src/
│   ├── index.ts
│   ├── user.types.ts
│   ├── company.types.ts
│   ├── application.types.ts
│   ├── project.types.ts
│   ├── vulnerability.types.ts
│   ├── maturity.types.ts
│   ├── report.types.ts
│   ├── chat.types.ts
│   ├── support.types.ts
│   ├── notification.types.ts
│   ├── subscription.types.ts
│   └── enums.ts
├── tsconfig.json
└── package.json
```

## `packages/validators`

Contém schemas reutilizáveis.

```text
validators/
├── src/
│   ├── index.ts
│   ├── auth.schema.ts
│   ├── company.schema.ts
│   ├── application.schema.ts
│   ├── project.schema.ts
│   ├── vulnerability.schema.ts
│   ├── maturity.schema.ts
│   └── support.schema.ts
├── tsconfig.json
└── package.json
```

## `packages/utils`

Contém funções utilitárias.

```text
utils/
├── src/
│   ├── index.ts
│   ├── cvss.ts
│   ├── date.ts
│   ├── string.ts
│   └── pagination.ts
├── tsconfig.json
└── package.json
```

## Cuidados

Packages compartilhados devem ser úteis, mas não devem virar complexidade desnecessária.

## O que pode ir para packages

- enums usados por múltiplas apps
- tipos de resposta
- schemas compartilhados
- calculadora CVSS
- helpers simples de data, paginação e string

## O que evitar

- regra de negócio pesada
- dependência excessiva entre apps
- lógica específica do back-end
- lógica específica de UI

## Relação com dados

Notas relacionadas:

- [[Enum - Roles]]
- [[Enum - CompanyRole]]
- [[Enum - ProjectStatus]]
- [[Enum - VulnerabilityStatus]]
- [[Enum - SubscriptionStatus]]
- [[Enum - TicketStatus]]
- [[Enum - AnalysisType e Level]]

## Regra para o Claude

Ao gerar código compartilhado, o Claude deve manter `packages/` simples e objetivo.

Se uma lógica só é usada em um app, ela deve permanecer dentro daquele app.