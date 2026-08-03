---
type: guia-operacional
tags: [core, source-of-truth, master]
status: ativo
versao: 4.0
data: 2026-07-26
---

# Contexto Mestre v4

> [!important] Esta é a nota de maior autoridade do vault
> Em caso de conflito entre esta nota e qualquer outra, **esta vence** — a outra é que está desatualizada.
> Substitui as decisões conflitantes de [[Fonte Original - MVP Vulnera]] e [[vulnera]], que passam a ser **registro histórico**.

---

## Hierarquia de verdade (revisada)

1. **[[Contexto Mestre v4]]** ← esta nota · decisões vigentes
2. Notas canônicas do vault por domínio (`02-Dominio/`, `03-Produto/`, `04-Arquitetura/`…)
3. [[vulnera]] e [[Fonte Original - MVP Vulnera]] · **histórico** — documentam o MVP original (NestJS, PostgreSQL, 7 meses, Socket.IO). Servem de material para a monografia contar a evolução do projeto, **não** para orientar implementação.

---

## O que o Vulnera é

Plataforma SaaS de gestão de análises de segurança, no modelo Tenable/Wiz simplificado. Empresas contratam um plano, cadastram aplicações, abrem projetos de análise. Pentesters registram vulnerabilidades com evidências e severidade CVSS. O sistema gera relatórios executivos e técnicos em PDF, além de avaliação de maturidade.

- **Contexto acadêmico:** TCC · Técnico em Desenvolvimento de Sistemas · SENAI
- **Cliente fictício da demo:** TechNova Solutions
- **Superfícies:** web (React), mobile (Expo), landing page, uma API REST
- **Regra de ouro:** isolamento multi-tenant absoluto — nenhuma empresa enxerga dado de outra, em nenhuma rota

Atores: `ADMIN` · `CLIENT` · `PENTESTER` → ver [[Roles]] e [[Matriz de Permissoes]].

---

## Prazo e estado

| Campo | Valor |\n|---|---|\n| **Prazo** | **3 meses** (~13 semanas) — revisado em 2026-07-26 |\n| Progresso | **Fase 0 concluída** (refactor de stack e do vault). **Fases 1 e 2 NÃO estão concluídas no código Express atual** — auditoria de 2026-07-26 encontrou apenas arquivos-stub vazios (0 bytes) em `app/api/src/` e nenhuma linha de auth. A implementação NestJS anterior de Auth + Users + Companies + Plans + Applications + Projects (sessões 16–18, "Ondas 2–4") foi **apagada** pelo commit `654fd80 refactoring` no mesmo dia em que o vault foi atualizado para declarar essas fases como prontas. |\n| Fase atual | **Fase 1/2 — Fundação + Auth (retrabalho em Express)**, não Fase 3 |\n| Modo de execução | Solo-delegado: Rafael supervisiona, Claude Code executa |\n| Branch de integração | `develop` |\n\n> [!warning] Divergência vault × código — auditoria de 2026-07-26\n> `schema.prisma` tem **9 models** implementados (User, Company, Plan, Subscription, RefreshToken, PasswordResetToken, Application, Project, ProjectMember), não 19. `src/` está em **singular** (`controller/`, `model/`, `repository/`, `service/`), não plural como manda [[ADR-009 - Pastas no plural e cadeia de camadas]]. Não existem `middlewares/`, `utils/`, `database/`, testes, `docker-compose`, migrations nem seed. `app/web` e `app/mobile` têm apenas `package.json`, sem código. Ver sessão de auditoria em [[Changelog do Projeto]].\n\nDetalhamento em [[Roadmap Fases]] e [[Roadmap MVP]].

## Stack definitiva

### Backend
| Item | Escolha |
|---|---|
| Linguagem | TypeScript (strict) |
| Framework | **Express** |
| ORM | Prisma |
| Banco | **MySQL 8** |
| Testes | Jest + Supertest (integração) |

### Frontend web
React + Vite + Tailwind + Radix + TanStack Query + Zustand + Axios + Recharts + **pdf-lib**.

### Mobile
Expo + React Native + Expo Router + expo-secure-store.

### IA
Gemini 1.5 Flash — 🚩 ver [[ADR-011 - Provedor de IA em revisao]].

---

## Arquitetura em camadas

```
config → database → repositories → models → services → controllers → routes → server
                                                            ↕
                                                       middlewares
```

### Regras invioláveis

1. Cada camada conhece apenas a imediatamente abaixo
2. **Somente `repositories/` importa `@prisma/client`**
3. Service não conhece HTTP — lança string-código (`throw new Error("PLAN_NOT_FOUND")`); controller traduz para status HTTP
4. Nunca devolver tipo bruto do Prisma — sempre serializar via entity/DTO (senão vaza `passwordHash`)
5. `routes/routes.ts` é o único ponto de registro de rotas
6. Rotas literais (`/me`, `/current`, `/pending`) sempre antes das paramétricas (`/:id`)

🚩 O Factory Method **não** consta nesta cadeia — ver [[ADR-010 - Factory Method pendente de confirmacao]].

Detalhes em [[Back-end Express]] e [[Middlewares e Ownership]].

---

## Convenções de código

### Pastas — plural quando há mais de um arquivo

```
src/
├── config/          # EnvVar + enum/EnvKeys
├── database/        # cliente Prisma
├── repositories/    # única camada que toca Prisma
├── models/          # 1 arquivo por recurso (type + DTO + entity)
├── services/        # regras de negócio
├── controllers/     # entrada HTTP
├── routes/          # 1 por recurso + routes.ts central
├── middlewares/     # auth, require-role
├── utils/           # jwt, hash, cvss
└── server.ts
```

> Esta regra **inverte** a convenção anterior, que exigia `service/` e `factory/` no singular. Ver [[ADR-009 - Pastas no plural e cadeia de camadas]].

### Arquivos — kebab + role

`plan.repository.ts` · classe `PlanRepository` · método `findById` · rota `/api/project-members`

### Códigos de erro

| Padrão | HTTP |
|---|---|
| `MISSING_<CAMPO>` / `INVALID_<CAMPO>` | 400 |
| `<ENTIDADE>_NOT_FOUND` | 404 |
| `<ENTIDADE>_ALREADY_EXISTS` | 409 |
| `<ENTIDADE>_LIMIT_REACHED` / `INVALID_STATUS_TRANSITION` | 422 |
| `UNAUTHORIZED` / `INVALID_TOKEN` | 401 |
| `FORBIDDEN` | 403 |
| `INTERNAL_ERROR` | 500 |

Outras: cabeçalho comentado em PT-BR em todo arquivo novo · comentários explicam o **porquê** · validação manual com `if` (zod é `[FUTURO]`) · `try/catch` por método de controller (middleware global é `[FUTURO]`).

---

## Infraestrutura

| Item | Decisão |
|---|---|
| Docker Compose | **MySQL 8 + Mailhog apenas** |
| SonarQube | **Pipeline separado no GitHub Actions** — saiu do compose ([[ADR-012 - SonarQube como pipeline separado]]) |
| CI principal | lint → build → test (com serviço MySQL) |
| Auth | JWT HS256 · access 15min · refresh 7d rotativo · hash SHA-256 no banco · bcrypt cost 12 |
| PDF | **pdf-lib**, client-side ([[ADR-003 - PDF gerado no cliente]]) |
| Push | Expo Push API direto, sem Firebase · falha silenciosa |
| E-mail | **Fora do MVP** — Mailhog fica para uso futuro |

---

## Modelo de domínio — 19 models

### Tenancy
```
Plan ◄── Company ◄── User (ADMIN | CLIENT | PENTESTER)
           └──► Subscription (PENDING → ACTIVE | REJECTED)
```
Invariante: **1 subscription ACTIVE por company**, validada no request e na aprovação.

### Produto
```
Company ──► Application ──► Project (1-1) ──► Vulnerability ──► Evidence
                               │                    │
                               └► ProjectMember      └► VulnerabilityComment
```

### Suporte
`AuditLog` (append-only) · `RefreshToken` · `PasswordResetToken` (reservado) · `Notification` · `Report` · `MaturityDomain/Control/Assessment/Score`

> [!caution] Entidades removidas do escopo
> `ChatMessage` e `SupportTicket` **não existem** no `schema.prisma`. As notas permanecem marcadas como fora de escopo.

Detalhes em [[MER Conceitual]] e [[Entidades e Relacionamentos]].

---

## Planos

**BASIC · PRO · Enterprise** — ver [[Plan]].

Diferenciados por limite de aplicações, projetos simultâneos e inclusão de remediação. Catálogo público (GET aberto); criação/edição restrita a `ADMIN`.

---

## Decisões pendentes 🚩

Não resolver sozinho. Notas que dependem delas ficam marcadas como pendentes.

| Flag | Questão | ADR |
|---|---|---|
| **F-01** | Factory Method permanece na arquitetura? | [[ADR-010 - Factory Method pendente de confirmacao]] |
| **F-02** | Provedor de IA continua Gemini? | [[ADR-011 - Provedor de IA em revisao]] |
| **F-03** | Quais domínios e controles de maturidade? | [[ADR-013 - Dominios de maturidade em aberto]] |

---

## Processo

- **Equipe:** Rafael, Guilherme e Iann — mantidos para delegação no JIRA ([[Distribuicao da Equipe]])
- **JIRA:** board `KAN` · `rafaelscrum.atlassian.net` · movimentação manual ao fim de cada fase
- **Branches:** `main` ← `develop` ← `feat/fase-N-<nome>` · **1 branch e 1 PR por fase**
- **Testes:** toda PR de CRUD inclui integração — happy path + erros de validação + 1 regra de negócio · canários `TEN-xx` de tenancy · cobertura ≥80% nos services
- **Documentos vivos:** mantidos para consumo por agentes · documentação desatualizada é bug · o código é a verdade

Ordem de limpeza no `cleanDatabase()`:
`auditLog → evidence → vulnerabilityComment → vulnerability → projectMember → project → application → subscription → company → refreshToken → user`

---

## Fora do escopo do MVP

Chat em tempo real (Socket.IO) · tickets de suporte · e-mail transacional · reset de senha · pagamento real · Redis/filas · i18n · toggle de tema · deploy em produção · Prometheus · Grafana · zod `[FUTURO]` · middleware global de erro `[FUTURO]`.

Ver [[Fora do Escopo]].

---

## Relacionado
[[MOC - Vulnera]] · [[Claude - Guia Operacional]] · [[Roadmap Fases]] · [[Fora do Escopo]] · [[Changelog do Projeto]]
