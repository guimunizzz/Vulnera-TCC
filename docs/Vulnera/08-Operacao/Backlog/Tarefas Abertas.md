---
type: backlog
tags: [task]
status: ativo
---

> [!warning] Revisado em 2026-07-26
> Tarefas ligadas a chat, tickets, e-mail transacional, Prometheus e Grafana **saíram do escopo** — ver [[Fora do Escopo]] e [[ADR-014 - Escopo reduzido para prazo de 3 meses]].
> O backlog vigente por fase está em [[Roadmap Fases]] e no `docs/BACKLOG.md` do repositório.

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Tarefas Abertas

> Atualizado em: 2026-05-18
> Estado atual: Ondas 1, 2, 3 e 4 **arquitetadas**. Ondas 2, 3 e 4 **aguardam ambiente** (Docker / MySQL ou MySQL + `npm install` + `prisma migrate`).

---

## Status das Ondas de implementação

| Onda | Tema | Status | Observação |
|---|---|---|---|
| 1 | Bootstrap do monorepo | ✅ concluída (sessão 15) | apps, packages, infra, CI prontos |
| 2 | Autenticação, usuários, empresas | 🟡 **arquitetada, aguardando ambiente** (sessão 16) | código pronto; não executado por falta de Docker/DB local; ver [[ADR-008 - MySQL temporario com migracao planejada para PostgreSQL]] |
| 3 | Camada comercial — Plans + Companies (expandido) + Subscriptions + ActiveSubscriptionGuard | 🟡 **arquitetada, aguardando ambiente** (sessão 17) | CRUD de planos, gestão de membros da empresa, criação/aprovação de subscriptions, guard de RN07 pronto para Onda 4 |
| 4 | Applications + Projects + ProjectMember | 🟡 **arquitetada, aguardando ambiente** (sessão 18) | CRUD com RN03/05/06/07/08/16/17 aplicados; máquina mínima de estados do Project (4 estados); RN08 + RN17 via ProjectMember |
| 5 | Vulnerabilities, evidências, comentários | ⏳ não iniciada | core de findings |
| 6 | Maturidade + relatórios | ⏳ não iniciada | conteúdo da Fase 5 do roadmap |

---

## Contexto

O vault do Vulnera está completamente documentado. As tarefas abaixo são de **implementação de código**, não de documentação. A Onda 1 entregou a base física do monorepo; a Onda 2 entregou o código de autenticação, mas só será validada quando houver banco de dados local.

---

## Alta prioridade — Fase atual (Fase 5 / semana ~16)

Com base no roadmap, o projeto está no início da Fase 5 (Maturidade e relatórios). As fases anteriores devem estar concluídas ou em finalização.

### Onda 2 — pendências para validação (precisa ambiente)
- [ ] subir banco MySQL ou MySQL local (Docker ou nativo)
- [ ] `npm install` na raiz e em `apps/api`
- [ ] atualizar `DATABASE_URL` em `apps/api/.env`
- [ ] gerar hash bcrypt real de `Vulnera@2025` e substituir placeholder em `prisma/seed.ts`
- [ ] `npx prisma migrate dev --name init-auth`
- [ ] `npx prisma db seed`
- [ ] testar fluxo login → refresh → logout
- [ ] testar fluxo forgot-password → reset-password (verificar link no log)
- [ ] testar que `@Public()` libera rotas e demais rotas exigem Bearer

### Onda 3 — pendências para validação (precisa ambiente)
- [ ] regenerar `prisma migrate` com os novos índices (`[companyId, status]` em Subscription)
- [ ] testar `GET /plans` público vs `POST /plans` ADMIN-only
- [ ] testar `GET /companies` ADMIN-only e ownership do CLIENT em `GET /companies/:id`
- [ ] testar criação de Company → Subscription ACTIVE em transação
- [ ] testar `POST /companies/:id/members` com usuário já vinculado (deve falhar — RN02)
- [ ] testar `isActive(companyId)` retornando true/false conforme status da última Subscription
- [ ] testar `ActiveSubscriptionGuard` em rota dummy antes da Onda 4
- [ ] (opcional) verificar log de RN22 ao criar Subscription `PENDING_APPROVAL`

### Onda 4 — pendências para validação (precisa ambiente)
- [ ] `prisma migrate dev` com os novos models (`Application`, `Project`, `ProjectMember`) e índices
- [ ] testar `POST /applications` respeitando RN03 (criar até o limite do plano e ver erro 422 ao exceder)
- [ ] testar `POST /applications` sem Subscription ACTIVE (deve retornar 403 — RN07)
- [ ] testar `POST /projects` com Application sem Project (sucesso) e com Application já vinculada (Conflict — RN05)
- [ ] testar `POST /projects` confirmando `companyId` herdado da Application (RN06)
- [ ] testar `POST /projects/:id/members` com user PENTESTER (sucesso) e com CLIENT/ADMIN (BadRequest — RN08)
- [ ] testar `GET /projects` para PENTESTER mostrando apenas projetos onde é membro (RN17)
- [ ] testar `GET /projects` para CLIENT mostrando apenas projetos da própria company (RN16)
- [ ] testar `PATCH /projects/:id/status` com transições válidas/invalidas para ADMIN vs PENTESTER
- [ ] testar `DELETE /applications/:id` com Project vinculado (deve retornar 409)

### Verificar estado das fases anteriores
- [ ] Fase 0 (Fundação) — confirmar conclusão: monorepo, Docker, auth JWT, CI, SonarQube
- [ ] Fase 1 (Core empresa) — confirmar: CRUD Company, onboarding, Subscription, Application
- [ ] Fase 2 (Projetos e findings) — confirmar: Project, Vulnerability, CVSS, uploads, comentários
- [ ] Fase 3 (Comunicação) — confirmar: chat, tickets, e-mails, notificações
- [ ] Fase 4 (Mobile) — confirmar: Expo, telas base, push notifications

### Fase 5 em andamento
- [ ] Seed de domínios e controles de maturidade (Iann)
- [ ] Tela de avaliação de maturidade no admin (Guilherme)
- [ ] Radar chart com Recharts (Guilherme)
- [ ] Relatório executivo PDF client-side (Guilherme)
- [ ] Relatório técnico PDF client-side (Guilherme + Iann)

---

## Média prioridade — Próximas fases

### Fase 6 — IA (semanas 18–19)
- [ ] Módulo AI no Express com rate limit por usuário
- [ ] Integração Gemini 1.5 Flash
- [ ] Sugestão de finding via IA (UI + back)
- [ ] Resumo executivo automático via IA

### Fase 7 — Observabilidade (semanas 20–22)
- [ ] Prometheus exporters no Express (`prom-client`)
- [ ] `docker-compose.observability.yml` com Prometheus + Grafana
- [ ] Dashboards Grafana (operacional + negócio)
- [ ] Execução de OWASP ZAP baseline scan — relatório como evidência
- [ ] Hardening: revisar todos os Security Hotspots do SonarQube
- [ ] AuditLog: verificar cobertura em todos os eventos críticos

---

## Baixa prioridade — Entrega (Fase 8)

- [ ] Testes E2E com Playwright (Guilherme)
- [ ] Seed com dados realistas para demo (Iann)
- [ ] Documentação final — slides TCC (Iann)
- [ ] Checklist de ambiente para banca
- [ ] Ensaio de apresentação (todos)
- [ ] Plano B de demo (screenshots/vídeo gravado)

---

## Backlog de documentação — pendências residuais

Pequenas lacunas que podem enriquecer o vault mas não são bloqueantes:

- [ ] `09-TCC/` — preencher estrutura da monografia, evidências para banca, referências teóricas
- [ ] Atualizar `Tarefas Abertas` ao final de cada fase do roadmap
- [ ] Registrar achados do ZAP em `Hipoteses em Validacao` quando rodado
- [ ] Criar entradas em `Decisoes Recentes` quando decisões importantes forem tomadas durante o desenvolvimento

---

## Como usar este arquivo

- **ao iniciar uma fase**: mover itens relevantes para "Alta prioridade" com data
- **ao concluir uma fase**: mover itens para a seção de "Concluídos" no Changelog
- **ao surgir nova tarefa fora do roadmap**: avaliar se entra em backlog ou em risco de escopo
- **ao finalizar o projeto**: arquivar este arquivo no histórico do vault

---

## Links relacionados
[[Roadmap MVP]]
[[Roadmap Fases]]
[[Riscos]]
[[Changelog do Projeto]]
[[MOC - Operacao]]
