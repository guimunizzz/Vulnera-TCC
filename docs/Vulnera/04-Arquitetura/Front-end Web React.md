---
type: documentacao-tecnica
tags: [architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Front-end Web React

## Papel
Interface principal web para operação administrativa e uso do cliente.

## Stack
- React + Vite
- React
- Tailwind
- shadcn/ui
- TanStack Query ou Zustand
- Axios
- Socket.IO client
- pdf-lib

## Responsabilidades
- dashboards
- formulários
- gestão de projetos
- visualização de findings
- geração de relatórios client-side