---
type: documentacao-tecnica
tags: [architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

> [!warning] Correção em 2026-08-04 (ver [[ADR-020 - Stack final do frontend web e CORS]])
> A refatoração de 2026-07-26 trocou os nomes de tecnologia (NestJS→Express etc.) mas manteve, sem querer, pressupostos de uma stack Next.js (App Router, `shadcn/ui` via CLI, Socket.IO, Recharts) que **não é o que foi implementado**. O bootstrap real do `app/web` (Fase 3) é uma **SPA Vite** com `react-router-dom`, componentes montados com primitivas Radix + Tailwind direto (sem o CLI do shadcn/ui), e **sem** Socket.IO/Recharts nesta fase — nenhuma tela até agora precisa de tempo real ou gráfico. Este arquivo foi corrigido abaixo; se você achar outra nota do vault ainda citando App Router/shadcn CLI/Socket.IO pro web, ela está desatualizada.

# Front-end Web React

## Papel
Interface principal web para operação administrativa e uso do cliente.

## Stack
- React + Vite (SPA, **não** Next.js — roteamento via `react-router-dom`)
- TypeScript
- Tailwind
- Radix UI (primitivas diretas — Dialog, Label, Slot — sem o CLI do shadcn/ui)
- TanStack Query **e** Zustand (servidor e cliente, não "ou")
- Axios (client central com interceptor de refresh + fila de requests concorrentes)
- pdf-lib (Fase 6, ainda não implementado)
- 🚧 Socket.IO client / Recharts — adiados; entram só quando alguma fase precisar de fato de tempo real ou gráfico

## Responsabilidades
- dashboards
- formulários
- gestão de projetos
- visualização de findings
- geração de relatórios client-side