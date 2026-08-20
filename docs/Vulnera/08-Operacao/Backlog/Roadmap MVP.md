---
type: roadmap
tags: [backlog, operacao]
status: ativo
---

> [!warning] Revisado em 2026-07-26 — prazo de 3 meses
> O cronograma e a numeração de fases desta nota foram substituídos. A referência válida é [[Roadmap Fases]], recalculada para **13 semanas** (27/07 → 25/10/2026).
> Escopo cortado: chat, tickets, e-mail transacional, Prometheus/Grafana, testes E2E — ver [[ADR-014 - Escopo reduzido para prazo de 3 meses]].

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Roadmap MVP

## O que é o MVP

O MVP do Vulnera cobre as Fases 0 a 2 do roadmap de desenvolvimento — a fundação técnica e o núcleo do produto. Permite que uma empresa contrate uma análise, um pentester registre findings com severidade CVSS e máquina de estados, e o cliente acompanhe o andamento.

**Marco do MVP**: plataforma web funcional com fluxo completo de ponta a ponta:
`Onboarding → Assinatura → Aplicação → Projeto → Finding → Evidência`

---

## Fase 0 — Fundação (semanas 1–2)

**Objetivo**: ambiente de desenvolvimento funcionando para todos os integrantes.

| Entregável | Responsável | Status |
|---|---|---|
| Setup do monorepo | R | — |
| Docker Compose base (api + web + db) | R | — |
| Schema Prisma inicial (User, Company, Plan, Subscription) | R | — |
| Auth JWT completo (register, login, refresh, logout) | R | — |
| CI básico (lint + test) | R | — |
| SonarQube local | R | — |
| README e docs iniciais | I | — |

**Critério de done**: qualquer integrante consegue clonar o repo e rodar `docker compose up -d` + `npm run dev` sem configuração manual adicional.

---

## Fase 1 — Core cliente-empresa (semanas 3–5)

**Objetivo**: empresas podem se cadastrar e contratar um plano.

| Entregável | Responsável | Status |
|---|---|---|
| CRUD Company (admin) | I (mentoria R) | — |
| Onboarding público (cadastro empresa + user owner) | G | — |
| Seed de Plans (BASIC, PRO, Enterprise) | I | — |
| Fluxo de Subscription (criar → notificar admin → aprovar) | R | — |
| CRUD Application (com gate de limite do plano) | G | — |
| Dashboard inicial por role | G | — |

**Critério de done**: cliente consegue se cadastrar, Admin aprova a assinatura, e cliente cadastra sua primeira aplicação.

---

## Fase 2 — Projetos e findings (semanas 6–9) — ⭐ núcleo do produto

**Objetivo**: o core da análise de segurança está implementado.

| Entregável | Responsável | Status |
|---|---|---|
| CRUD Project com escopo e flag de remediação | G | — |
| Máquina de estados de Project | R | — |
| Atribuição de pentesters a projetos | R | — |
| CRUD Vulnerability | G | — |
| Cálculo CVSS v3.1 → severidade (com override justificado) | R | — |
| Categoria OWASP Top 10 | R | — |
| Máquina de estados de Vulnerability | R | — |
| Upload de evidências (Multer + validação MIME) | G | — |
| Comentários em findings | G | — |

**Critério de done**: pentester consegue registrar uma vulnerabilidade com severidade CVSS, evidências e comentários; cliente vê o finding no dashboard; Admin consegue mover o status do projeto.

---

## Regras do MVP

- apenas plataforma web (sem mobile no MVP)
- relatório não precisa existir para o MVP funcional — pode ser fase 5
- IA Gemini não é requisito do MVP
- observabilidade não é requisito do MVP
- o MVP está completo ao final da Fase 2

---

## Links relacionados
[[Roadmap Fases]]
[[Tarefas Abertas]]
[[ADR-001 - Plataforma foca gestao e nao execucao real]]
[[ADR-002 - Project 1 para 1 com Application]]
[[MOC - Operacao]]
