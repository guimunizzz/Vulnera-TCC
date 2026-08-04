---
type: estrutura-projeto
tags: [architecture, frontend, nextjs]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

> [!warning] Correção em 2026-08-04 (ver [[ADR-020 - Stack final do frontend web e CORS]])
> A estrutura abaixo (`app/`, grupos de rota `(public)/(admin)/(pentester)/(client)`, `components.json` do shadcn/ui) é o desenho **Next.js App Router** que não foi o que acabou implementado no bootstrap real da Fase 3. `app/web` é uma **SPA Vite**: código em `src/`, roteamento com `react-router-dom` (guards por role via `<ProtectedRoute roles={[...]} />` aninhado, não por pasta de grupo), componentes Radix+Tailwind direto (sem CLI do shadcn/ui). A estrutura real ficou:
> ```text
> app/web/src/
> ├── components/{ui,layout}/
> ├── pages/{auth,admin}/
> ├── lib/{api,cn.ts,query-client.ts}
> ├── store/auth.store.ts
> ├── hooks/use-api-error.ts
> ├── types/*.types.ts
> ├── App.tsx
> └── main.tsx
> ```
> O restante desta nota (papel de cada camada conceitual, segurança) continua válido — só a árvore de pastas concreta diverge do que está descrito abaixo.

# Estrutura - Web React

## Objetivo

Definir a estrutura esperada para o front-end web do Vulnera.

O front-end usa:

- React + Vite App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts
- Axios ou fetch wrapper
- Zustand ou TanStack Query
- Socket.IO client

## Estrutura principal

```text
apps/web/
├── app/
├── components/
├── lib/
├── public/
├── styles/
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json
├── package.json
└── Dockerfile
```

## `app/`

Contém as rotas do React + Vite App Router.

A estrutura é separada por grupos de rota:

```text
app/
├── (public)/
├── (admin)/
├── (pentester)/
└── (client)/
```

## Rotas públicas

```text
(public)/
├── page.tsx
├── login/
├── register/
├── forgot-password/
└── reset-password/
```

Usadas para:

- landing page
- login
- cadastro
- recuperação de senha
- onboarding inicial

## Área Admin

```text
(admin)/
├── dashboard/
├── companies/
├── users/
├── projects/
├── pentesters/
├── subscriptions/
└── support/
```

Usada por administradores para:

- gerir empresas
- aprovar assinaturas
- acompanhar projetos
- atribuir pentesters
- visualizar dashboard global
- responder tickets

## Área Pentester

```text
(pentester)/
├── dashboard/
├── projects/
└── chat/
```

Usada por pentesters para:

- acessar projetos atribuídos
- registrar findings
- anexar evidências
- gerar relatórios
- interagir via chat

## Área Cliente

```text
(client)/
├── dashboard/
├── applications/
├── projects/
├── maturity/
├── chat/
├── support/
└── settings/
```

Usada por clientes para:

- cadastrar aplicações
- abrir projetos
- acompanhar findings
- baixar relatórios
- abrir tickets
- configurar notificações

## `components/`

Organiza componentes reutilizáveis.

```text
components/
├── ui/
├── layout/
├── dashboard/
├── vulnerabilities/
├── projects/
├── maturity/
├── chat/
├── reports/
└── shared/
```

## Componentes principais

### `ui/`

Componentes base, preferencialmente compatíveis com shadcn/ui.

### `layout/`

Componentes estruturais:

- sidebar
- header
- navbar
- notification bell

### `dashboard/`

Componentes de indicadores:

- KPI card
- gráficos de findings
- radar de maturidade
- activity feed

### `vulnerabilities/`

Componentes de findings:

- tabela
- card
- badges
- CVSS calculator
- formulário
- uploader
- comentário

### `projects/`

Componentes de projeto:

- card
- badge de status
- formulário
- modal de atribuição

## `lib/`

Contém lógica compartilhada do front-end.

```text
lib/
├── api/
├── hooks/
├── store/
├── utils/
└── auth.ts
```

## `lib/api/`

Centraliza chamadas para a API:

- `auth.api.ts`
- `companies.api.ts`
- `applications.api.ts`
- `projects.api.ts`
- `vulnerabilities.api.ts`
- `maturity.api.ts`
- `reports.api.ts`
- `chat.api.ts`
- `support.api.ts`
- `notifications.api.ts`

## `lib/hooks/`

Hooks reutilizáveis:

- `use-auth.ts`
- `use-socket.ts`
- `use-notifications.ts`
- `use-projects.ts`
- `use-vulnerabilities.ts`

## `lib/store/`

Estado global, se necessário:

- `auth.store.ts`
- `notification.store.ts`
- `ui.store.ts`

## Relação com produto

Esta estrutura implementa:

- [[Web Admin]]
- [[Web Cliente]]
- [[Autenticacao]]
- [[Projetos]]
- [[Findings]]
- [[Relatorios]]
- [[Dashboard]]
- [[Chat e Comentarios]]
- [[Notificacoes]]

## Segurança no front-end

O Claude deve considerar:

- prevenção de XSS
- não expor tokens indevidamente
- não confiar em validação apenas no front-end
- esconder informações conforme role
- não renderizar HTML arbitrário

Notas relacionadas:

- [[Padrao - Prevencao de XSS]]
- [[Padrao - Autenticacao e JWT]]
- [[Padrao - Logs e Dados Sensiveis]]

## Regra para o Claude

Ao gerar front-end, o Claude deve:

- respeitar separação por perfil
- manter componentes pequenos
- evitar telas complexas demais no primeiro MVP
- priorizar fluxo funcional
- manter consistência visual simples
- conectar telas aos módulos documentados