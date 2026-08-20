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

| Campo | Valor |
|---|---|
| **Prazo** | **3 meses** (~13 semanas), entrega 25/10/2026 |
| Progresso | **Fases 0-7 concluídas** (incluindo a 6.5, inserida no meio pra o mobile herdar tokens prontos) + **Fase 8 em andamento** (checklist de maturidade completo — backend, tela, radar no PDF — e seed de demo da TechNova; Sonar/ZAP/documentação final em progresso). Backend: schema completo (19 models + `User.expoPushToken`), Auth+User, Company+Plan+Subscription, Application+Project+ProjectMember, Vulnerability+Evidence+VulnerabilityComment (núcleo — CVSS 3.1 manual, upload validado por magic number, AuditLog completo), report-data (RN18, **maturidade real desde a Fase 8**) + Report metadata, métricas/dashboard analítico (ADR-025), push notification via Expo (`utils/push.util.ts` + hook em CRITICAL), **recurso Maturity completo (Fase 8)**. Frontend web: design system próprio em OKLCH (ADR-023/024, `docs/DESIGN_SYSTEM.md`), Login/Register/Dashboard(3 roles)/Plans/Onboarding/Applications/Projects/ProjectDetail(+Relatórios)/Findings/FindingEditor/FindingDetail/dashboard analítico/**Maturidade (Fase 8)**, PDFs client-side (pdf-lib, ADR-003, **radar desenhado à mão desde a Fase 8**). **App mobile (Expo, Fase 7)**: 5 telas read-only exclusivas do CLIENT (Login/Home/ProjectDetail/FindingDetail/Configurações), tema herdado dos tokens do web, push de findings CRITICAL. |
| Fase atual | **Fase 8 — Maturidade + TCC**, a última antes da entrega. |
| Modo de execução | Solo-delegado: Rafael supervisiona, Claude Code executa |
| Branch de integração | `dev` — **não** `develop` como o resto deste documento e o `CLAUDE.md` chamam. Divergência real do repositório descoberta na Fase 8 (2026-08-11): o workflow de CI sempre disparou em push/PR pra `develop`, que nunca existiu no GitHub — nenhuma PR das Fases 3-7 rodou o pipeline de verdade. Corrigido em `.github/workflows/build.yml` (agora aceita os dois nomes); as menções a "develop" neste documento ficam como estão até uma limpeza dedicada, mas na prática **use `dev`**. |

> [!info] Nota sobre a divergência vault × código de 2026-07-26 (histórico)
> A auditoria de 2026-07-26 encontrou o código real muito atrás do que o vault documentava na época (schema com só 9 models, controllers vazios). Isso **já não é mais verdade** — corrigido nas sessões de 2026-08-04 (Fases 3 e 4). Ver [[Changelog do Projeto]], sessões 21 e 22, para o estado real por fase. **Lição registrada:** antes de confiar num diagnóstico anterior do vault sobre o estado do código, confira o código — documentação pode ficar desatualizada mais rápido do que se espera.

Detalhamento em [[Roadmap Fases]] e [[Roadmap MVP]] — ambos também pendentes da mesma correção, se ainda não atualizados.

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
React + Vite + Tailwind + TanStack Query + Zustand + Axios + Recharts + **pdf-lib** + **motion**.

> [!warning] **Radix removido na Fase 6.5** (2026-08-09)
> A biblioteca de componentes é própria — ~30 componentes em
> `app/web/src/components/ui/`, com contrato de acessibilidade escrito e testado.
> Ver [[ADR-023 - Biblioteca de componentes propria em vez de Radix]].
> Design tokens em OKLCH com três temas: [[ADR-024 - Sistema de temas com tokens OKLCH]].
> Especificação completa em `docs/DESIGN_SYSTEM.md` — **é o que a Fase 7 consome**.

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
| Docker Compose | **Stack completa** desde a Fase 8 (`docker compose up --build` sobe MySQL + Mailhog + API + Web num comando) — o modo enxuto original (só MySQL + Mailhog, com `npm run dev` local pra hot reload) continua disponível e é o do dia a dia. Ver [[ADR-022 - Stack completa no Docker Compose]] (substitui a linha antiga desta tabela) |
| SonarQube | **Pipeline separado no GitHub Actions** — saiu do compose ([[ADR-012 - SonarQube como pipeline separado]]). Modo informativo, não bloqueia merge ([[ADR-007 - Sonar informativo e ZAP manual]]) |
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
| ~~**F-03**~~ | ~~Quais domínios e controles de maturidade?~~ **Resolvida na Fase 8** | [[ADR-013 - Dominios de maturidade em aberto]], [[Adr 018 maturidade como checklist simplificado]] |

> [!note] F-01 respondida na prática
> O Factory Method segue obrigatório e foi aplicado também ao recurso de métricas da Fase 6.5 (`metrics.factory.ts`) e ao de maturidade da Fase 8 (`maturity.factory.ts`). Ver [[Adr 019 factory method confirmado]].

> [!note] F-03 resolvida na Fase 8 (2026-08-11)
> 7 domínios × 4 perguntas cada (Gestão de Acesso, Backup e Recuperação, Segurança de Rede, Gestão de Vulnerabilidades, Monitoramento e Logs, Conscientização, Segurança no Código), catálogo em `prisma/seed.ts`. Checklist simplificado (decisão de 2026-08-03, [[Adr 018 maturidade como checklist simplificado]]): resposta 1-5, média simples por domínio e geral — sem scoring ponderado, sem nível por domínio, sem comparativo histórico.

---

## Processo

- **Equipe:** Rafael, Guilherme e Iann — mantidos para delegação no JIRA ([[Distribuicao da Equipe]])
- **JIRA:** board `KAN` · `rafaelscrum.atlassian.net` · movimentação manual ao fim de cada fase
- **Branches:** `main` ← `dev` (o repositório real usa esse nome, não `develop` — ver linha "Branch de integração" acima) ← `feat/fase-N-<nome>` · **1 branch e 1 PR por fase**
- **Testes:** toda PR de CRUD inclui integração — happy path + erros de validação + 1 regra de negócio · canários `TEN-xx` de tenancy · cobertura ≥80% nos services
- **Documentos vivos:** mantidos para consumo por agentes · documentação desatualizada é bug · o código é a verdade

Ordem de limpeza no `cleanDatabase()`:
`auditLog → evidence → vulnerabilityComment → vulnerability → projectMember → project → application → subscription → company → refreshToken → user`

> [!warning] Divergência com `CLAUDE.md` §12 (Fase 8, 2026-08-11)
> `CLAUDE.md` diz "Plan e Maturity* ficam (vêm do seed)" — ou seja, essas
> tabelas não deveriam ser limpas entre testes, só populadas uma vez.
> **Na prática, `maturity.test.ts` cria seu próprio catálogo (domínio +
> controles) a cada teste**, e `cleanDatabase()` precisa apagar
> `maturityAssessment → maturityScore → maturityControl → maturityDomain`
> pra não colidir com a constraint de nome único a cada corrida (bug real
> encontrado e corrigido em `tests/setup.ts` na Fase 8 — a ausência de
> `maturityAssessment.deleteMany()` não dava erro porque a FK não é
> declarada no schema, só acumulava linha órfã pra sempre). `CLAUDE.md` não
> foi editado por causa da regra "nunca editar sozinho" (§0) — fica
> registrado aqui pro Rafael decidir se atualiza o texto ou o teste.

---

## Fora do escopo do MVP

Chat em tempo real (Socket.IO) · tickets de suporte · e-mail transacional · reset de senha · pagamento real · Redis/filas · i18n · deploy em produção · Prometheus · Grafana · zod `[FUTURO]` · middleware global de erro `[FUTURO]`.

> ~~toggle de tema~~ — **restaurado na Fase 6.5**, ver [[ADR-024 - Sistema de temas com tokens OKLCH]].

Ver [[Fora do Escopo]].

---

## Relacionado
[[MOC - Vulnera]] · [[Claude - Guia Operacional]] · [[Roadmap Fases]] · [[Fora do Escopo]] · [[Changelog do Projeto]]
