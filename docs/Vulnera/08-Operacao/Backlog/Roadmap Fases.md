---
type: roadmap
tags: [backlog, operacao]
status: ativo
---

> [!info] Roadmap recalculado em 2026-07-26
> Substitui o cronograma anterior de **28 semanas / 9 fases**, que usava numeração e conteúdo de fase diferentes (Fase 3 = Comunicação, Fase 7 = Observabilidade). A numeração abaixo é a única válida e bate com `docs/ROADMAP_PROMPTS.md` do repositório.

# Roadmap Fases

## Visão geral — 13 semanas · 6 fases restantes

**Início:** 2026-07-27 · **Entrega alvo:** 2026-10-25\n\n| Fase | Nome | Semanas | Período | Status |\n|---|---|---|---|---|\n| 0 | Refactor de alinhamento | — | — | ✅ concluída |\n| 1 | Fundação | — | — | ⚠️ **retrabalho** — código apagado, ver nota |\n| 2 | Auth + User | — | — | ⚠️ **retrabalho** — código apagado, ver nota |\n| **3** | **Plan + Company + Subscription** | 1–2 | 27/07 → 09/08 | 📋 bloqueada até 1 e 2 estarem refeitas |\n| 4 | Application + Project + Member | 3–4 | 10/08 → 23/08 | 📋 |\n| 5 | Vulnerability + Evidence ⭐ | 5–7 | 24/08 → 13/09 | 📋 |\n| 6 | Relatórios + Dashboards | 8–9 | 14/09 → 27/09 | 📋 |\n| 7 | Mobile + Push + IA | 10–11 | 28/09 → 11/10 | 📋 |\n| 8 | Maturidade + entrega TCC | 12–13 | 12/10 → 25/10 | 📋 |\n\n> [!danger] Fases 1 e 2 marcadas concluídas não correspondem ao código — auditoria de 2026-07-26\n> Existiu uma implementação NestJS funcional de Auth + Users + Companies + Plans + Applications + Projects (sessões 16–18 do changelog, "Ondas 2–4"), em `Vulnera/apps/api/`. O commit `654fd80 refactoring` (2026-07-26) **apagou essa árvore inteira** ao migrar para o esqueleto Express em `Vulnera-TCC/`. O que sobrou em `Vulnera-TCC/app/api/src/` é: `config/` real (EnvVar + EnvKeys), e `controller/model/repository/routes/service` de `user` **todos com 0 bytes**. `server.ts` também tem 0 bytes — a API não sobe. Não há middleware de auth, JWT, bcrypt, testes, docker-compose, migrations ou seed. `schema.prisma` tem 9/19 models. `app/web` e `app/mobile` só têm `package.json`, sem nenhum código-fonte.\n> Enquanto isso não for corrigido, a Fase 3 não deveria começar — ela depende de Company/User que ainda não existem em código.\n\n> [!warning] Cronograma sem buffer\n> 13 semanas para 6 fases não deixa folga para imprevisto. O plano anterior de 4 meses tinha 2 semanas de buffer; este não tem.\n> **Válvula de escape definida:** se houver atraso acumulado de mais de 1 semana até o fim da Fase 6, a **Fase 7 (Mobile + IA) é a primeira a encolher** — o mobile vira demonstração de telas com dados de seed, sem push funcional. Ver [[Riscos]].

## Fase 3 — Plan + Company + Subscription (semanas 1–2)

**Entregas:** middleware `require-role`, repository de `AuditLog`, CRUD de Plan (GET público, CUD admin), CRUD de Company com vínculo de owner, Subscription com aprovação/rejeição e invariante de 1 ACTIVE, componentes de UI (Table, Modal, Spinner), página pública de planos, wizard de onboarding, tela admin de assinaturas pendentes.

**Marco:** cliente se cadastra, escolhe plano, Admin aprova, empresa fica operacional.

**Canários:** `PLAN-01..06`, `COMP-01..06`, `SUB-01..08`

---

## Fase 4 — Application + Project + Member (semanas 3–4)

**Entregas:** CRUD de Application com gate de limite do plano, CRUD de Project com máquina de estados e endpoint `/transition`, subrota de membros (apenas PENTESTER), telas de aplicações, wizard de nova análise, detalhe de projeto com abas.

**Marco:** cliente cadastra aplicação até estourar o limite do plano, abre projeto, Admin atribui pentester.

**Canários:** `APP-01..04`, `PROJ-01..05`, `TEN-01..05`

---

## Fase 5 — Vulnerability + Evidence (semanas 5–7) ⭐

**Entregas:** util de CVSS 3.1 (parser manual das fórmulas FIRST), CRUD de Vulnerability com transição e override de severidade justificado, upload de evidências com validação de MIME e magic number, comentários, AuditLog integrado, lista de findings com filtros, editor de finding com CVSS em tempo real.

**Marco: MVP funcional** — ciclo completo de análise de ponta a ponta.

**Canários:** `BIZ-03..09`, `TEN-06`

> Fase mais pesada do projeto — 3 semanas reservadas. É o núcleo que a banca avalia.

---

## Fase 6 — Relatórios + Dashboards (semanas 8–9)

**Entregas:** endpoint consolidado `report-data`, metadados de Report, PDF executivo (3–5 páginas) e técnico (20+) com **pdf-lib** client-side, dashboards por perfil com Recharts.

**Marco:** cliente baixa relatório executivo e técnico; dashboards corretos nos três perfis.

**Canários:** `RPT-01..03`

---

## Fase 7 — Mobile + Push + IA (semanas 10–11)

**Entregas:** app Expo (login com SecureStore, home, detalhe de projeto e finding, viewer de PDF), migration de `expoPushToken`, endpoint de registro, disparo de push em finding CRITICAL, util Gemini, endpoint de sugestão com rate limit de 10/h, botão "Sugerir com IA" no editor.

**Marco:** cliente acompanha projeto pelo celular e recebe push de finding crítico; pentester usa IA para pré-preencher finding.

**Canários:** `AI-01..03`, `PUSH-01`

> 🚩 Provedor de IA sujeito a revisão — [[ADR-011 - Provedor de IA em revisao]]
> ⚠️ Primeira fase a encolher em caso de atraso.

---

## Fase 8 — Maturidade + entrega TCC (semanas 12–13)

**Entregas:** seed de domínios e controles de maturidade, CRUD de Assessment com scores em lote, tela de avaliação com radar, seção de maturidade no PDF executivo, seed demo TechNova realista (5 aplicações, 10 findings), SonarQube e OWASP ZAP com evidências capturadas, `docs/DEMO.md`, README final, tag `v1.0.0`.

**Marco:** apresentação para a banca com demo funcional de ponta a ponta.

**Canários:** `MAT-01..03` + smoke E2E documentado

> 🚩 Domínios e controles ainda não definidos — [[ADR-013 - Dominios de maturidade em aberto]]. Bloqueia esta fase, nenhuma anterior.

---

## Dependências

```
3 ──► 4 (Application exige subscription ACTIVE)
4 ──► 5 (Vulnerability pertence a Project)
5 ──► 6 (report-data agrega findings)
5 ──► 7 (IA preenche finding; push dispara em finding CRITICAL)
6 ──► 8 (maturidade entra no PDF executivo)
```

A Fase 7 depende apenas de 4 e 5 — pode correr em paralelo com a 6 se houver capacidade.

---

## Convenções de execução

- 1 branch por fase: `feat/fase-N-<nome>` a partir de `develop`
- 1 PR por fase, com checklist na descrição, merge após CI verde
- Prompt de execução de cada fase em `docs/ROADMAP_PROMPTS.md` do repositório
- Ao concluir: mover as KANs correspondentes para Done no JIRA

---

## Links relacionados
[[Contexto Mestre v4]]
[[Roadmap MVP]]
[[Tarefas Abertas]]
[[Riscos]]
[[ADR-014 - Escopo reduzido para prazo de 3 meses]]
[[Changelog do Projeto]]
[[MOC - Operacao]]
