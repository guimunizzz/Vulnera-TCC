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

---

> [!warning] Atualizado na Fase 6.5 (2026-08-09) — a stack mudou
>
> **Radix removido.** A biblioteca de componentes é própria: ~30 componentes em
> `app/web/src/components/ui/`, cada um com contrato de acessibilidade escrito e
> testado. Ver [[ADR-023 - Biblioteca de componentes propria em vez de Radix]].
>
> **Design tokens em OKLCH**, com três temas (dark/light/system) e contraste WCAG
> medido por ferramenta que falha o build. Ver
> [[ADR-024 - Sistema de temas com tokens OKLCH]].
>
> **`motion` adicionado** para a camada de movimento.
>
> **Testes de frontend passaram a existir**: Vitest + Testing Library +
> `axe-core`.

## Stack real (2026-08-09)

| Camada | Escolha |
|---|---|
| Build | Vite 5 |
| UI | React 18 · **biblioteca de componentes própria** (sem Radix) |
| Estilo | Tailwind 3.4 sobre design tokens em OKLCH (`src/styles/tokens.css`) |
| Fontes | Archivo Variable (interface) · JetBrains Mono Variable (dados) |
| Movimento | `motion` 13 |
| Roteamento | `react-router-dom` 6 |
| Estado de servidor | TanStack Query 5 |
| Estado de cliente | Zustand 5 |
| HTTP | Axios, com fila de refresh concorrente |
| Gráficos | Recharts 3, tematizado pelos tokens em tempo de execução |
| PDF | pdf-lib, client-side ([[ADR-003 - PDF gerado no cliente]]) |
| Testes | Vitest · Testing Library · axe-core |

**Especificação completa do design system: `docs/DESIGN_SYSTEM.md`.**
É o documento que a Fase 7 (mobile) consome.
