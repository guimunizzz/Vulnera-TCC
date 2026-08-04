# BACKLOG.md — Vulnera

> **v4 · 2026-08-03.** Substitui a versão por sprints com divisão por pessoa (Rafael/Guilherme/Iann). Agora é **fase e checkpoint**, execução solo-delegada.
> Estimativas em horas-equivalentes — servem para dimensionar risco e revisão, não para prever o tempo do agente.
> **Entrega: 25/10/2026.**

## Status

| Fase               | Escopo                                             | Estado         |
| ------------------ | -------------------------------------------------- | -------------- |
| 0 Refactor         | Alinhamento com CLAUDE.md                          | ✅             |
| 1 Fundação         | Infra, schema, CI, migrations, seed, testes        | ✅ backend     |
| 2 Auth + User      | JWT, refresh rotativo, CRUD, factories             | ✅ backend     |
| 3 Empresas         | Refactor plural + Subscription + bootstrap web     | ✅ concluída 2026-08-04 |
| 4 Projetos         | Application + Project + Member + telas             | ✅ concluída 2026-08-04 |
| **5 Findings**     | **Vulnerability + Evidence** ⭐                    | 📋 **próxima** |
| 6 Relatórios       | report-data + PDFs pdf-lib + dashboards            | 📋             |
| 7 Mobile           | Expo enxuto + Push                                 | 📋             |
| 8 Maturidade + TCC | Checklist + demo + Sonar/ZAP + docs                | 📋             |

✅ **Frontend web bootstrapado na Fase 3** (2026-08-04) — `app/web` tem Vite+React+TS+Tailwind+Radix+TanStack Query+Zustand+Axios, com Login/Register/Dashboard/Plans/Onboarding/PendingSubscriptions funcionando ponta a ponta (smoke E2E manual validado no navegador). Próximas fases só adicionam telas, não infraestrutura.

Restante estimado: **~200h-equivalente** em 12 semanas.

---

## Cronograma

| Semanas | Período       | Fase                         |
| ------- | ------------- | ---------------------------- |
| 1–2     | 04/08 → 17/08 | 3 — Empresas + bootstrap web |
| 3–4     | 18/08 → 31/08 | 4 — Projetos                 |
| 5–7     | 01/09 → 21/09 | 5 — Findings ⭐              |
| 8–9     | 22/09 → 05/10 | 6 — Relatórios               |
| 10–11   | 06/10 → 15/10 | 7 — Mobile                   |
| 12      | 16/10 → 25/10 | 8 — Maturidade + fechamento  |

> **Sem buffer.** Válvula de escape: atraso acumulado > 1 semana até o fim da Fase 6 → a Fase 7 encolhe primeiro (mobile vira demo de telas com seed, sem push funcional).

---

## FASE 3 — Empresas + bootstrap web (~44h) — ✅ concluída em 2026-08-04

| #    | Task                                                            | h   | Estado |
| ---- | --------------------------------------------------------------- | --- | ------ |
| 3.0  | Auditoria: schema, completude de company/plan, `npm run check`  | 2   | ✅     |
| 3.1  | Refactor plural (`git mv` + imports + docs/architecture.md)     | 3   | ✅     |
| 3.2  | Completar schema com os models faltantes + migration            | 3   | ✅ não precisou — schema já tinha os 19 models |
| 3.3  | `require-role` middleware                                       | 1   | ✅     |
| 3.4  | AuditLog repository                                             | 2   | ✅     |
| 3.5  | Completar Plan (GET público, CUD admin, BASIC/PRO/Enterprise)   | 3   | ✅     |
| 3.6  | Completar Company + vínculo de owner                            | 4   | ✅     |
| 3.7  | Subscription + approve/reject + invariante 1-ACTIVE + auditoria | 7   | ✅     |
| 3.8  | Testes PLAN/COMP/SUB                                            | 5   | ✅     |
| 3.9  | Bootstrap web: Vite, Tailwind, Radix, TanStack, Zustand, Axios  | 5   | ✅     |
| 3.10 | UI base + client.ts com fila de refresh + auth store            | 5   | ✅     |
| 3.11 | Login, Register, ProtectedRoute, Dashboard stub                 | 4   | ✅     |
| 3.12 | Plans pública + Onboarding wizard + PendingSubscriptions        | 10  | ✅     |

## FASE 4 — Projetos (~33h) — ✅ concluída em 2026-08-04

| #   | Task                                                    | h   | Estado |
| --- | ------------------------------------------------------- | --- | ------ |
| 4.1 | Application CRUD + gate de limite do plano              | 7   | ✅     |
| 4.2 | Project CRUD + máquina de estados + `/transition`       | 7   | ✅     |
| 4.3 | ProjectMember subrota (gestão ADMIN, leitura ampliada)  | 5   | ✅ leitura ampliada pra CLIENT/PENTESTER-membro além de ADMIN — não estava no texto original, necessário pra ProjectDetail funcionar |
| 4.4 | Testes APP/PROJ + TEN-01..05                            | 7   | ✅ 20 testes novos, cobertura services 85-100% |
| 4.5 | Applications + wizard NewAnalysis                       | 8   | ✅     |
| 4.6 | ProjectDetail com abas + gestão de membros + breadcrumb | 6   | ✅     |

## FASE 5 — Findings ⭐ (~46h)

| #   | Task                                                              | h   | Estado |
| --- | ----------------------------------------------------------------- | --- | ------ |
| 5.1 | `cvss.util` — parser manual 3.1 + testes com vectors conhecidos   | 4   | 📋     |
| 5.2 | Vulnerability CRUD + transition + override justificado            | 9   | 📋     |
| 5.3 | Evidence multipart (MIME + magic number + UUID) + GET autenticado | 8   | 📋     |
| 5.4 | VulnerabilityComment nested paginado                              | 4   | 📋     |
| 5.5 | AuditLog integrado (override + transition)                        | 3   | 📋     |
| 5.6 | Testes BIZ-03..09 + TEN-06                                        | 8   | 📋     |
| 5.7 | Lista de findings com filtros e badges                            | 4   | 📋     |
| 5.8 | FindingEditor (CVSS live, drag-drop, comentários, override)       | 10  | 📋     |

## FASE 6 — Relatórios (~34h)

| #   | Task                                                 | h   | Estado |
| --- | ---------------------------------------------------- | --- | ------ |
| 6.1 | `GET /projects/:id/report-data` consolidado          | 5   | 📋     |
| 6.2 | Report metadata + AuditLog                           | 2   | 📋     |
| 6.3 | Testes RPT-01..03                                    | 3   | 📋     |
| 6.4 | `lib/pdf/base.ts` — helpers, gráfico de barras à mão | 6   | 📋     |
| 6.5 | PDF Executivo                                        | 6   | 📋     |
| 6.6 | PDF Técnico (com evidências embutidas)               | 7   | 📋     |
| 6.7 | Dashboards cliente / pentester / admin               | 5   | 📋     |

> ⚠️ **pdf-lib é imperativo.** Sem componentes React: cria-se o documento e desenha-se por coordenada. Gráficos são retângulos e linhas desenhados à mão. Reservar tempo de aprendizado na 6.4.

## FASE 7 — Mobile enxuto (~24h)

| #   | Task                                                     | h   | Estado |
| --- | -------------------------------------------------------- | --- | ------ |
| 7.1 | Bootstrap Expo + Router + client com SecureStore         | 6   | 📋     |
| 7.2 | Login + Home + ProjectDetail                             | 7   | 📋     |
| 7.3 | FindingDetail read-only + Configurações                  | 5   | 📋     |
| 7.4 | Push: migration + endpoint + registro + trigger CRITICAL | 6   | 📋     |

> Escopo deliberadamente cortado: sem criação/edição, sem upload, sem PDF, sem telas de admin ou pentester. Se estourar o prazo, corte mais do mobile — nunca do backend.

## FASE 8 — Maturidade + TCC (~32h)

| #   | Task                                                            | h   | Estado |
| --- | --------------------------------------------------------------- | --- | ------ |
| 8.1 | Seed de domínios e perguntas do checklist                       | 3   | 📋     |
| 8.2 | MaturityAssessment CRUD + scores em batch                       | 5   | 📋     |
| 8.3 | Tela de avaliação + radar                                       | 6   | 📋     |
| 8.4 | Maturidade no PDF executivo (radar à mão com pdf-lib)           | 3   | 📋     |
| 8.5 | Seed demo TechNova (5 apps, 10 findings, maturidade preenchida) | 4   | 📋     |
| 8.6 | SonarQube (pipeline) + ZAP baseline — evidências capturadas     | 3   | 📋     |
| 8.7 | `docs/DEMO.md` + README + diagrama + limitações conhecidas      | 5   | 📋     |
| 8.8 | Smoke E2E cronometrado + tag `v1.0.0`                           | 3   | 📋     |

> Slides e ensaios ficam com o Rafael, fora da contagem.
> **Maturidade simplificada:** checklist de perguntas por domínio, escala 1–5, média simples. Sem scoring ponderado, sem níveis por domínio, sem comparativo histórico.

---

## Removido do escopo

| Removido                                                       | Quando     | Motivo                                      |
| -------------------------------------------------------------- | ---------- | ------------------------------------------- |
| IA / Gemini (sugestão de finding, rate limit, botão no editor) | 2026-08-03 | Corte de prazo; não é o que a banca avalia  |
| Chat em tempo real (Socket.IO)                                 | 2026-07-26 | `VulnerabilityComment` cobre a comunicação  |
| Tickets de suporte                                             | 2026-07-26 | Escopo administrativo sem valor de demo     |
| E-mail transacional (Nodemailer/Mailhog)                       | 2026-07-26 | `AuditLog` cobre a rastreabilidade          |
| Prometheus + Grafana                                           | 2026-07-26 | Observabilidade não é critério de avaliação |
| Testes E2E (Playwright)                                        | 2026-07-26 | Integração + smoke manual cobrem            |
| Viewer de PDF no mobile                                        | 2026-08-03 | Corte do escopo mobile                      |
| Maturidade completa estilo SAMM                                | 2026-08-03 | Vira checklist simples                      |

Tudo isso entra como **trabalho futuro** no README — e a redução consciente de escopo sob restrição de prazo é material de defesa na banca.

---

## Regras

- ✅ marcado pelo agente ao concluir (CLAUDE.md §0.1 R2)
- Consolidar ou dividir task = editar a linha, nunca duplicar
- Task descoberta no meio de uma fase → adicionar com `(descoberta)` na descrição
- JIRA sincronizado manualmente ao fim de cada fase, com as KANs listadas no relatório do agente
