---
type: estrutura-projeto
tags: [architecture, monorepo, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Estrutura Geral do Monorepo

## Objetivo

Esta nota define a estrutura-alvo do repositório principal do Vulnera.

Ela serve como referência para o Claude entender como o projeto real deve ser organizado em código, separando:

- back-end Express
- front-end React + Vite
- mobile Expo
- pacotes compartilhados
- infraestrutura
- documentação técnica
- automações de GitHub

## Estrutura macro

```text
vulnera/
├── .github/
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── types/
│   ├── validators/
│   └── utils/
├── infra/
├── docs/
├── .editorconfig
├── .gitignore
├── .npmrc
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── turbo.json
└── README.md
```

## Papel de cada pasta

### `.github/`

Contém automações e templates do GitHub.

Inclui:

- workflows de CI
- scan OWASP ZAP
- release
- templates de issue e pull request
- CODEOWNERS

### `apps/`

Contém as aplicações principais do monorepo:

- `api`: back-end Express
- `web`: front-end React + Vite
- `mobile`: app Expo

### `packages/`

Contém código compartilhado entre as aplicações.

Inclui:

- tipos TypeScript
- schemas de validação
- utilitários reutilizáveis

### `infra/`

Contém arquivos de infraestrutura local e futura referência de produção.

Inclui:

- Docker Compose
- Prometheus
- Grafana
- Nginx

### `docs/`

Contém documentação técnica do projeto de código.

Não substitui o vault do Obsidian.

O vault é a memória documental ampla do TCC; a pasta `docs/` do repositório é documentação técnica próxima ao código.

## Regra de uso pelo Claude

Ao gerar código, o Claude deve usar esta estrutura como referência de organização.

Porém, deve sempre respeitar:

- [[Back-end Express]]
- [[Front-end Web React]]
- [[Mobile Expo]]
- [[Politica de Desenvolvimento Seguro]]
- [[Guia de Estilo de Codigo]]
- [[Escopo Realista para o TCC]]

## Observação importante

Esta estrutura representa a visão completa do projeto, mas nem todos os arquivos precisam ser implementados imediatamente.

A implementação deve acontecer por ondas, priorizando MVP funcional e evitando complexidade desnecessária.