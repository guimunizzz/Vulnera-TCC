---
type: estrutura-projeto
tags: [architecture, mobile, expo]
status: ativo
---

# Estrutura - Mobile Expo

## Objetivo

Definir a estrutura esperada para o aplicativo mobile do Vulnera.

O mobile usa:

- Expo
- React Native
- Expo Router
- TypeScript
- Axios
- Zustand
- notificações push

## Escopo do mobile

O mobile é exclusivo para o perfil `CLIENT`.

Ele é propositalmente enxuto e read-mostly.

## Estrutura principal

```text
apps/mobile/
├── app/
├── components/
├── services/
├── store/
├── hooks/
├── constants/
├── assets/
├── .env
├── .env.example
├── app.config.ts
├── babel.config.js
├── tsconfig.json
└── package.json
```

## `app/`

Usa Expo Router.

```text
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
└── (app)/
```

## Área de autenticação

```text
(auth)/
├── _layout.tsx
├── login.tsx
└── forgot-password.tsx
```

## Área logada

```text
(app)/
├── _layout.tsx
├── dashboard.tsx
├── projects/
├── chat/
├── notifications.tsx
└── settings.tsx
```

## Telas principais

O mobile deve conter:

- login
- dashboard
- lista de projetos
- detalhe de projeto
- lista de findings
- maturidade
- chat ou visualização de mensagens, se viável
- notificações
- configurações

## `components/`

Componentes reutilizáveis:

```text
components/
├── ui/
├── dashboard/
├── vulnerabilities/
└── chat/
```

## `services/`

Serviços de comunicação com a API:

```text
services/
├── api.client.ts
├── auth.service.ts
├── projects.service.ts
├── vulnerabilities.service.ts
├── chat.service.ts
└── notifications.service.ts
```

## `store/`

Estado local:

```text
store/
├── auth.store.ts
└── notification.store.ts
```

## `hooks/`

Hooks principais:

```text
hooks/
├── useAuth.ts
├── useSocket.ts
└── useNotifications.ts
```

## Relação com decisões

Esta estrutura respeita:

- [[ADR-004 - Mobile cliente e read-mostly]]
- [[Mobile Cliente]]
- [[Notificacoes]]
- [[Relatorios]]

## O que o mobile não deve ter no MVP

- área Admin
- área Pentester
- criação administrativa de dados
- funções complexas de gestão
- edição completa de findings

## Regra para o Claude

Ao gerar mobile, o Claude deve:

- manter o escopo read-mostly
- priorizar consulta e acompanhamento
- não duplicar toda a web no mobile
- respeitar as permissões do cliente
- manter UI simples e funcional