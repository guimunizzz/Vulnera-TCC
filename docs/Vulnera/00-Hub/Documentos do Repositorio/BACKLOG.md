# BACKLOG.md — Vulnera

> Recalculado em 2026-07-26 para o prazo de **3 meses**. Substitui a versão de 4 meses.
> Divisão por **fase e checkpoint**, não por pessoa. Estimativas em horas-equivalentes — servem para dimensionar risco e revisão, não para prever o tempo do agente.

## Status de execução

| Fase | Escopo | Estado | Jira |
|---|---|---|---|
| 0 Refactor | Alinhamento com CLAUDE.md | ✅ | KAN-1..24 (parcial) |
| 1 Fundação | Infra, schema, CI, seed, UI base | ✅ | KAN-56..64 |
| 2 Auth + User | JWT, refresh rotativo, CRUD, frontend auth | ✅ | KAN-65..74 |
| **3 Empresas** | **Plan + Company + Subscription** | 📋 **próxima** | KAN-75..80 |
| 4 Projetos | Application + Project + Member | 📋 | KAN-81..85 |
| 5 Findings | Vulnerability + Evidence ⭐ | 📋 | KAN-86..92 |
| 6 Relatórios | report-data + PDFs + dashboards | 📋 | KAN-93..97 |
| 7 Mobile + IA | Expo + Push + Gemini | 📋 | KAN-98..102 |
| 8 Maturidade + TCC | Maturity + demo + Sonar/ZAP + docs | 📋 | KAN-103..109 |

Progresso: **3/9 fases** (~33%). Restante estimado: **~215h-equivalente**.

---

## Cronograma — 13 semanas

**Início:** 2026-07-27 · **Entrega:** 2026-10-25

| Semanas | Período | Fase |
|---|---|---|
| 1–2 | 27/07 → 09/08 | 3 — Empresas |
| 3–4 | 10/08 → 23/08 | 4 — Projetos |
| 5–7 | 24/08 → 13/09 | 5 — Findings ⭐ |
| 8–9 | 14/09 → 27/09 | 6 — Relatórios |
| 10–11 | 28/09 → 11/10 | 7 — Mobile + IA |
| 12–13 | 12/10 → 25/10 | 8 — Maturidade + TCC |

> ⚠️ **Sem buffer.** O plano de 4 meses tinha 2 semanas de folga; este não tem.
> **Válvula de escape:** com atraso acumulado > 1 semana até o fim da Fase 6, a Fase 7 encolhe primeiro — mobile vira demo de telas com seed, sem push funcional.

---

## FASE 3 — Empresas (~36h)

| # | Task | h | Estado |
|---|---|---|---|
| 3.1 | `require-role` middleware | 1 | 📋 |
| 3.2 | AuditLog repository | 2 | 📋 |
| 3.3 | Plan CRUD (GET público, CUD admin) | 5 | 📋 |
| 3.4 | Company CRUD + vínculo de owner | 7 | 📋 |
| 3.5 | Subscription + approve/reject + invariante 1-ACTIVE + auditoria | 7 | 📋 |
| 3.6 | Testes PLAN/COMP/SUB (20 canários) | 5 | 📋 |
| 3.7 | UI: Table, Modal, Spinner | 3 | 📋 |
| 3.8 | Frontend: página pública de planos | 3 | 📋 |
| 3.9 | Frontend: wizard de onboarding | 7 | 📋 |
| 3.10 | Frontend: admin/PendingSubscriptions | 5 | 📋 |

> 🚩 **Decidir antes de começar:** Factory Method permanece? Esta fase cria 3 recursos — o custo de reintroduzir depois triplica. Ver flag F-01.

## FASE 4 — Projetos (~33h)

| # | Task | h | Estado |
|---|---|---|---|
| 4.1 | Application CRUD + gate de limite do plano | 7 | 📋 |
| 4.2 | Project CRUD + máquina de estados + `/transition` | 7 | 📋 |
| 4.3 | ProjectMember subrota (só PENTESTER) | 5 | 📋 |
| 4.4 | Testes APP/PROJ + TEN-01..05 | 7 | 📋 |
| 4.5 | Frontend: Applications + wizard NewAnalysis | 8 | 📋 |
| 4.6 | Frontend: ProjectDetail com abas + gestão de membros | 5 | 📋 |

## FASE 5 — Findings ⭐ (~45h)

| # | Task | h | Estado |
|---|---|---|---|
| 5.1 | `cvss.util` — parser manual 3.1 + testes | 4 | 📋 |
| 5.2 | Vulnerability CRUD + transition + override justificado | 9 | 📋 |
| 5.3 | Evidence multipart (MIME + magic number + UUID) + GET autenticado | 8 | 📋 |
| 5.4 | VulnerabilityComment nested | 4 | 📋 |
| 5.5 | AuditLog integrado (override + transition) | 3 | 📋 |
| 5.6 | Testes BIZ-03..09 + TEN-06 | 8 | 📋 |
| 5.7 | Frontend: lista de findings com filtros | 4 | 📋 |
| 5.8 | Frontend: FindingEditor (CVSS live, drag-drop, comentários) | 9 | 📋 |

## FASE 6 — Relatórios (~32h)

| # | Task | h | Estado |
|---|---|---|---|
| 6.1 | `GET /projects/:id/report-data` consolidado | 5 | 📋 |
| 6.2 | Report metadata + AuditLog | 2 | 📋 |
| 6.3 | Testes RPT-01..03 | 3 | 📋 |
| 6.4 | PDF base + Executivo (**pdf-lib**) | 10 | 📋 |
| 6.5 | PDF Técnico | 7 | 📋 |
| 6.6 | Dashboards cliente / pentester / admin | 10 | 📋 |

> ⚠️ Mudança de biblioteca: **pdf-lib** substitui `@react-pdf/renderer`. A API é imperativa (desenha diretamente no documento), não declarativa por componentes React — o layout é escrito à mão. Reservar tempo de aprendizado na 6.4.

## FASE 7 — Mobile + IA (~36h)

| # | Task | h | Estado |
|---|---|---|---|
| 7.1 | Mobile: setup + Login + Home + ProjectDetail | 11 | 📋 |
| 7.2 | Mobile: FindingDetail + viewer de PDF | 7 | 📋 |
| 7.3 | Push: migration + endpoint + registro + trigger CRITICAL | 7 | 📋 |
| 7.4 | Gemini: util + endpoint + rate limit | 7 | 📋 |
| 7.5 | Frontend: botão "Sugerir com IA" | 4 | 📋 |

> 🚩 Provedor de IA sujeito a revisão (flag F-02) — decidir antes de 7.4.
> ⚠️ Primeira fase a encolher em caso de atraso.

## FASE 8 — Maturidade + TCC (~33h)

| # | Task | h | Estado |
|---|---|---|---|
| 8.1 | Seed de domínios e controles | 3 | 📋 |
| 8.2 | Maturity Assessment CRUD + scores em lote | 6 | 📋 |
| 8.3 | Frontend: tela de avaliação + radar | 7 | 📋 |
| 8.4 | Maturidade no PDF executivo | 3 | 📋 |
| 8.5 | Seed demo TechNova (5 apps, 10 findings) | 4 | 📋 |
| 8.6 | SonarQube (pipeline) + ZAP baseline — evidências | 3 | 📋 |
| 8.7 | `docs/DEMO.md` + README + diagrama final | 4 | 📋 |
| 8.8 | Smoke E2E via DEMO.md + tag `v1.0.0` | 3 | 📋 |

> 🚩 Domínios de maturidade não definidos (flag F-03) — bloqueia 8.1 e 8.3.
> Slides e ensaios ficam com o Rafael, fora da contagem de horas.

---

## Removido do backlog (corte de 3 meses)

Registrado para rastreabilidade — vira "trabalho futuro" na monografia:

| Task removida | Motivo |
|---|---|
| Chat em tempo real (Socket.IO) | `VulnerabilityComment` cobre a comunicação necessária |
| Tickets de suporte + máquina de estados | escopo administrativo sem valor de demonstração |
| E-mail transacional (Nodemailer) | `AuditLog` cobre a rastreabilidade |
| Prometheus + Grafana + dashboards | observabilidade não é critério de avaliação |
| Testes E2E (Playwright) | integração + smoke manual cobrem |

---

## Regras do backlog

- ✅ marcado pelo agente ao concluir (CLAUDE.md §0.1 R2)
- consolidar ou dividir task = editar a linha, nunca duplicar
- task descoberta no meio de uma fase → adicionar com `(descoberta)` na descrição
- JIRA sincronizado manualmente ao fim de cada fase, com as KANs listadas no relatório do agente
