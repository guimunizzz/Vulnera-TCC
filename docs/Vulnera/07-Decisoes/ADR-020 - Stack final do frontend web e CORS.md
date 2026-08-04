---
type: decisao
tags: [decision, architecture, frontend]
status: vigente
codigo: ADR-020
data: 2026-08-04
---

# ADR-020 - Stack final do frontend web e CORS

## Contexto

O `app/web` nunca tinha sido inicializado (só um `package.json` vazio) até o bootstrap feito na Fase 3. As notas do vault [[Front-end Web React]] e [[Estrutura - Web React]] ainda descreviam uma stack herdada da era pré-pivô Express/MySQL: Next.js com App Router e grupos de rota `(public)/(admin)/(pentester)/(client)`, `shadcn/ui` via CLI, Socket.IO client, Recharts. Essas notas foram "refatoradas" na sessão de 2026-07-26 só na camada de nomes de tecnologia (NestJS→Express, PostgreSQL→MySQL), sem revisar se o resto do conteúdo ainda fazia sentido — o roteamento por App Router e o Socket.IO continuaram implícitos.

O prompt de execução da Fase 3 (`docs/ROADMAP_PROMPTS.md`) especificava, de forma mais enxuta e específica: Vite + React + TypeScript + Tailwind + **Radix** + TanStack Query + Zustand + Axios — sem mencionar Next.js, shadcn CLI, Socket.IO ou Recharts. Nada disso é necessário para as telas da Fase 3 (Login, Register, Dashboard stub, Plans pública, Onboarding, PendingSubscriptions), e chat/tickets/tempo-real já estão fora do escopo do MVP (`CLAUDE.md` §15).

Separadamente, ao construir o cliente Axios do Checkpoint 5, ficou evidente que a API não tinha CORS habilitado (`app/api/src/app.ts` só tinha `express.json()` + rotas) — qualquer chamada feita pelo navegador a partir do Vite dev server seria bloqueada. Isso bloqueava a própria entrega da Fase 3 (não dava pra validar as telas), então foi corrigido na mesma sessão em vez de virar item de backlog (`CLAUDE.md` §0.2 S6, exceção "a menos que bloqueie a task atual").

## Decisão

**Frontend web é uma SPA Vite (não Next.js):**
- Roteamento client-side com `react-router-dom` (`BrowserRouter` + `<Routes>`), não App Router. Grupos de rota por perfil viram simplesmente `<Route element={<ProtectedRoute roles={[...]} />}>` aninhadas.
- Componentes base montados com primitivas `@radix-ui/react-*` (Dialog, Label, Slot) + Tailwind direto — sem o CLI do `shadcn/ui`. Mais simples de auditar e sem gerar arquivos de template que precisariam ser revisados um a um.
- `@tanstack/react-query` (estado de servidor) **e** `zustand` (estado de cliente/auth) juntos, não um "ou outro" — cada um resolve um problema diferente e o prompt já indicava os dois.
- Sem Socket.IO nem Recharts nesta fase — nenhuma tela da Fase 3 precisa de tempo real ou gráfico. Entram quando (e se) alguma fase futura precisar de fato (ex.: Recharts no dashboard/radar de maturidade, Fase 6/8).

**CORS habilitado na API:**
- Pacote `cors` instalado em `app/api`.
- Nova env `CORS_ORIGIN` (já existia em `.env.example` mas não estava conectada em lugar nenhum) adicionada ao `EnvKeys` enum.
- `app.use(cors({ origin: EnvVar.getOptional(EnvKeys.CORS_ORIGIN, "http://localhost:3000") , credentials: true }))` em `app.ts`, antes das rotas.
- Vite dev server configurado pra rodar na porta `3000` (`vite.config.ts` → `server.port`), casando com o default já documentado.

## Consequências

- As notas [[Front-end Web React]] e [[Estrutura - Web React]] foram corrigidas nesta mesma sessão com um callout apontando a divergência (mesmo padrão da nota de 2026-07-26).
- Telas futuras (Fase 4+) devem seguir o padrão real implementado (React Router + Radix + Tailwind direto), não o texto ainda não corrigido de notas mais específicas que citem Next.js/shadcn, se alguma escapou da correção.
- Se uma fase futura precisar de fato de tempo real (chat, notificações push in-app) ou gráficos, a decisão de qual biblioteca usar (Socket.IO/outra; Recharts/outra) fica em aberto — não foi tomada aqui, só adiada.
- `CORS_ORIGIN` precisa ser ajustada em produção (o default `http://localhost:3000` só serve para dev local).

## Relacionado
[[Front-end Web React]]
[[Estrutura - Web React]]
[[ADR-009 - Pastas no plural e cadeia de camadas]]
[[Padrao - Autenticacao e JWT]]
