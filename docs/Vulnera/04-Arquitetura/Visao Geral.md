---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota reescrita em 2026-07-26
> Alinhada com [[Contexto Mestre v4]]. A versão anterior descrevia arquitetura NestJS com Socket.IO e PostgreSQL.

# Visao Geral

## Resumo

O Vulnera é um monorepo com três aplicações cliente (web admin, web cliente, mobile) e um back-end **Express + TypeScript** centralizado. A comunicação é feita exclusivamente via **API REST** — não há canal em tempo real. Integrações externas cobrem push mobile (Expo) e IA assistiva (Gemini).

## Diagrama de alto nível

```
┌──────────────────────────────────────────────────────────────┐
│                          Clientes                             │
│   Web React + Vite (admin + cliente)      Mobile Expo         │
└─────────────────────┬────────────────────────┬───────────────┘
                      │ HTTP/REST              │ HTTP + Push
               ┌──────▼───────┐        ┌───────▼──────┐
               │  Express API │        │  Expo Push   │
               │  REST /api/* │        │   Service    │
               └──────┬───────┘        └──────────────┘
                      │ Prisma
          ┌───────────┼────────────────┐
          │           │                │
   ┌──────▼───┐  ┌────▼─────┐  ┌──────▼──────┐
   │ MySQL 8  │  │ Volume   │  │  Externos   │
   │ (Docker) │  │Evidências│  │   Gemini    │
   └──────────┘  └──────────┘  └─────────────┘
```

## Camadas do sistema

### Clientes

- **Web (React + Vite)** — interface principal para Admin, Cliente e Pentester: dashboard, projetos, findings, relatórios, maturidade. Estado de servidor em TanStack Query; estado de cliente em Zustand.
- **Mobile (Expo)** — interface *read-mostly* exclusiva do Cliente: acompanhamento de projetos e findings, recebimento de push. Ver [[ADR-004 - Mobile cliente e read-mostly]].

### Back-end (Express)

Organizado por **camadas**, não por módulos. A cadeia canônica:

```
config → database → repositories → models → services → controllers → routes → server
                                                            ↕
                                                       middlewares
```

Fluxo de uma requisição:

```
Request → Routes → Middlewares (auth + role) → Controller (valida entrada)
        → Service (regra de negócio) → Repository → Prisma → MySQL
        → Service → Controller (serializa) → Response
```

Regras invioláveis em [[Contexto Mestre v4]]. As três mais quebradas na prática:

1. **Somente `repositories/` importa `@prisma/client`**
2. **Service não conhece HTTP** — lança string-código; o controller traduz para status
3. **Nunca devolver tipo bruto do Prisma** — sempre serializar via entity

### Banco de dados

- **MySQL 8** como banco definitivo ([[ADR-015 - MySQL definitivo]])
- **Prisma** como ORM — schema centralizado, migrations versionadas
- Volume Docker para persistência local

### Comunicação em tempo real

**Fora do escopo.** Socket.IO foi removido do projeto — ver [[WebSocket e Tempo Real]] e [[ADR-014 - Escopo reduzido para prazo de 3 meses]]. Comentários em finding são persistidos via `VulnerabilityComment` e carregados por requisição REST normal.

### Integrações externas

| Integração | Tecnologia | Uso | Status |
|---|---|---|---|
| Push mobile | Expo Push API | Alerta de finding CRITICAL | ativo |
| IA assistiva | Gemini 1.5 Flash | Sugestão de finding | ativo · 🚩 [[ADR-011 - Provedor de IA em revisao]] |
| E-mail | Mailhog (dev) | — | **fora do escopo** |

## Estrutura do monorepo

```
vulnera/
├── app/
│   ├── api/        # Express + Prisma
│   ├── web/        # React + Vite
│   └── mobile/     # Expo
├── docs/           # documentação viva do repositório
├── CLAUDE.md       # regras de código para o agente
└── PRD_VIVO.md     # estado de implementação
```

## Princípios arquiteturais

- TypeScript em todas as camadas (`strict: true`)
- separação estrita entre camadas — cada uma conhece apenas a imediatamente abaixo
- regras de negócio concentradas no service
- persistência isolada no repository
- autenticação e role verificadas em **middleware**; ownership fino verificado no **service** — ver [[Middlewares e Ownership]]
- logs estruturados sem dados sensíveis
- configuração via variáveis de ambiente centralizadas em `config/`

## Decisões arquiteturais relacionadas

- [[ADR-001 - Plataforma foca gestao e nao execucao real]]
- [[ADR-002 - Project 1 para 1 com Application]]
- [[ADR-003 - PDF gerado no cliente]]
- [[ADR-004 - Mobile cliente e read-mostly]]
- [[ADR-005 - Desenvolvimento local com Docker minimo]]
- [[ADR-006 - Gemini com rate limit agressivo]]
- [[ADR-009 - Pastas no plural e cadeia de camadas]]
- 🚩 [[ADR-010 - Factory Method pendente de confirmacao]]
- [[ADR-012 - SonarQube como pipeline separado]]
- [[ADR-015 - MySQL definitivo]]

## Links relacionados
[[Contexto Mestre v4]]
[[Back-end Express]]
[[Front-end Web React]]
[[Mobile Expo]]
[[Banco de Dados MySQL]]
[[ORM Prisma]]
[[API REST]]
[[Middlewares e Ownership]]
[[DTOs e Validacao]]
[[Repositorios]]
[[Expo Push]]
[[Integracao Gemini]]
[[Logs Estruturados]]
[[Docker Compose]]
[[MOC - Arquitetura]]
