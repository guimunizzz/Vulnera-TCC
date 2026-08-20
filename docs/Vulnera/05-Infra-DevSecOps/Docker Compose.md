---
type: documentacao-tecnica
tags: [devsecops]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Docker Compose

## Papel
Subir infraestrutura mínima local do projeto com um único comando.

## Serviços principais
- MySQL
- SonarQube
- Mailhog

## Estratégia
Código roda localmente.
Infra auxiliar roda em containers.

## Decisão associada
[[ADR-005 - Desenvolvimento local com Docker minimo]]