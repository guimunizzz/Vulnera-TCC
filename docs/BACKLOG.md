# BACKLOG.md — Sprints e tasks pro JIRA (project KAN)

## ⚠️ Status de execução (11/09)

| Sprint           | Foco                                    | Estado                                                                                                                   |                                                                         |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **0 — Refactor** | Alinhar código com CLAUDE.md v2         | ✅ **CONCLUÍDA** (merged em develop)                                                                                     |                                                                         |
| **1 — Fundação** | Infra, schema, server, CI, testes, seed | 🚧 **EM ANDAMENTO** — código 100% pronto, ~75% executado (pendente Docker local pra finalizar `migrate dev` + `db:seed`) | > **Como usar:** copie cada task pra criar uma issue tipo Task no JIRA. |
| 2 — Auth + User  | JWT, register, login, CRUD User         | 📋 Próxima                                                                                                               |                                                                         |
| 3 a 8            | —                                       | 📋 Backlog                                                                                                               |                                                                         |

KANs concluídas até agora: **KAN-001** (refactor), **KAN-102/103/104/105/106/111** (parcial Sprint 1).
KANs com código pronto aguardando execução: **KAN-101, KAN-107**.

---

> Campo Sprint: usar o nome da sprint como label ou campo nativo do JIRA.
> Estimativa: em **horas**, baseada em 4h/dia disponível.
>
> Time:
>
> - **R** = Rafael (40h/sprint)
> - **G** = Guilherme (20h/sprint)
> - **I** = Iann (20h/sprint)

---

## Sprint 0 — Refactor (1 semana ou paralelo)

> Não é sprint contada. É o trabalho descrito em `REFACTOR_PLAN.md`.
> Faça antes de iniciar a Sprint 1.

| Task                                              | Estimativa | Owner |
| ------------------------------------------------- | ---------- | ----- |
| KAN-001: Refactor estrutura conforme CLAUDE.md v2 | 6h         | R     |

---

## Sprint 1 — Fundação (semanas 1-2)

**Objetivo:** Repositório com infra mínima, schema final, server rodando, CI verde, frontend setup paralelo.

| Task                                                              | Estimativa | Owner | Descrição resumida                                                                                           |
| ----------------------------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| KAN-101: Aplicar schema.prisma revisado e rodar migrations        | 2h         | R     | Substitui schema atual, roda `prisma migrate dev --name initial`, verifica criação de todas as tabelas       |
| KAN-102: docker-compose.yml com MySQL + Mailhog + SonarQube       | 2h         | R     | Cria arquivo, sobe via `docker compose up -d`, valida ping no banco                                          |
| KAN-103: Server.ts mínimo com healthcheck /api/health             | 2h         | R     | Endpoint que devolve `{status:"ok",timestamp,uptime}`                                                        |
| KAN-104: Configurar Jest + Supertest + .env.test + banco de teste | 4h         | R     | Setup jest.config.ts, globalSetup que roda migrate deploy no banco de teste, primeiro teste smoke do /health |
| KAN-105: GitHub Actions com lint + build + test                   | 3h         | R     | Workflow build.yml com 3 jobs: lint, build, test (com serviço mysql)                                         |
| KAN-106: ESLint + tsconfig strict configurados                    | 2h         | R     | `npm run lint` e `npm run build` passam sem erro                                                             |
| KAN-107: Seed inicial com TechNova + Admin + Plans                | 3h         | R     | prisma/seed.ts cria 3 Plans (BASIC, PRO, PRO_PLUS), 1 admin, 1 company TechNova com subscription PRO ativa   |
| KAN-108: Setup React+Vite+Tailwind em app/web                     | 4h         | I     | Vite create, instala Tailwind+Radix, configura tailwind.config + global.css com tema dark cyberpunk          |
| KAN-109: Componentes base (Button, Input, Card, Badge, Layout)    | 6h         | I     | Wrappers de Radix com Tailwind, exportados em components/ui/                                                 |
| KAN-110: Landing page do Vulnera                                  | 8h         | I     | Implementar a partir do prompt cyberpunk dark cinematic. Visual matriz/neon.                                 |
| KAN-111: Documentar PRD_VIVO.md com status inicial das features   | 2h         | R     | Marca Sprint 1 como em progresso, demais como backlog                                                        |

**Total estimado:** R: 18h · G: 0h · I: 18h
**Saída esperada:** Repositório bootado, banco com seed, CI verde, landing visível em localhost.

---

## Sprint 2 — Auth + User (semanas 3-4)

**Objetivo:** Sistema de autenticação completo. CRUD de User. Tokens JWT funcionais. Canários AUTH passando.

| Task                                                                    | Estimativa | Owner | Descrição resumida                                                                                                |
| ----------------------------------------------------------------------- | ---------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| KAN-201: Criar utils/jwt.util.ts e utils/hash.util.ts                   | 2h         | G     | signAccessToken, verifyAccessToken, signRefreshToken; bcrypt cost 12                                              |
| KAN-202: Criar middleware/auth.middleware.ts                            | 2h         | G     | Extrai Bearer, valida, popula req.user, 401 em caso de erro                                                       |
| KAN-203: Implementar user.model.ts (type+DTOs+entity)                   | 2h         | G     | RegisterDTO, LoginDTO, AuthResponseDTO, UserResponseDTO (sem password); UserEntity com toResponse()               |
| KAN-204: user.repository.ts                                             | 2h         | G     | findByEmail, findById, findAll, create, update, delete                                                            |
| KAN-205: refresh-token.repository.ts                                    | 2h         | G     | create (com hash SHA-256), findByHash, revoke, deleteAllForUser                                                   |
| KAN-206: auth.service.ts                                                | 5h         | G     | register, login, refresh, logout. Valida email único, hash bcrypt, salva refresh hasheado, rotação a cada refresh |
| KAN-207: auth.controller.ts                                             | 4h         | G     | Endpoints register, login, refresh, logout. Validação manual de email/senha. Status corretos.                     |
| KAN-208: user.service.ts e user.controller.ts (CRUD)                    | 4h         | G     | CRUD com regra: admin lista todos, client vê só sua company, pentester vê só si mesmo                             |
| KAN-209: factory/auth.factory.ts e factory/user.factory.ts              | 2h         | G     | makeAuthController, makeUserController                                                                            |
| KAN-210: routes/auth.routes.ts (público) e user.routes.ts (autenticado) | 2h         | G     | Plug em routes.ts central                                                                                         |
| KAN-211: Testes de integração — Auth                                    | 4h         | R     | tests/integration/auth.test.ts: register, login válido/inválido, refresh, logout. Cobre AUTH-01 a 09              |
| KAN-212: Testes de integração — User CRUD                               | 3h         | R     | tests/integration/user.test.ts: list, getById, update self, delete forbidden                                      |
| KAN-213: Frontend — página de Login                                     | 4h         | I     | Form com email/senha, chama POST /api/auth/login, salva token, redireciona pra dashboard mockada                  |
| KAN-214: Frontend — página de Register                                  | 4h         | I     | Form com nome/email/senha, chama POST /api/auth/register, redireciona pra login                                   |
| KAN-215: Frontend — interceptor Axios com JWT                           | 3h         | I     | Configura axios global com Bearer token, refresh automático em 401                                                |

**Total estimado:** R: 7h · G: 25h (excede 20h, dividir) · I: 11h

⚠️ **Atenção:** carga do Guilherme estourou. Mover KAN-211 e KAN-212 pra Rafael (já estão) e adiar KAN-205 (refresh-token repo) pra início da Sprint 3 se necessário.

---

## Sprint 3 — Company + Plan + Subscription (semanas 5-6)

**Objetivo:** Empresa cliente cadastrada, planos disponíveis, assinatura criada com aprovação.

| Task                                                                              | Estimativa | Owner | Descrição resumida                                                                                          |
| --------------------------------------------------------------------------------- | ---------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| KAN-301: company.model.ts + repository + service + controller                     | 6h         | G     | CRUD básico. Admin lista todas; cliente vê só a própria                                                     |
| KAN-302: factory/company.factory.ts + routes/company.routes.ts                    | 1h         | G     | Plug em routes.ts                                                                                           |
| KAN-303: plan.model.ts + repository + service + controller (já parcial)           | 4h         | R     | Completar conforme schema (maxProjects, includesRemediation). Validações §5 do CLAUDE.md                    |
| KAN-304: factory/plan.factory.ts + routes/plan.routes.ts                          | 1h         | R     | Plug em routes.ts                                                                                           |
| KAN-305: subscription.model.ts + repository + service + controller                | 6h         | R     | CRUD + endpoints especiais: POST /:id/approve, POST /:id/reject, GET /current. Regra: 1 ACTIVE por company. |
| KAN-306: factory/subscription.factory.ts + routes/subscription.routes.ts          | 1h         | R     |                                                                                                             |
| KAN-307: Notificar admin de nova subscription pendente (log + e-mail via Mailhog) | 3h         | R     | Service envia e-mail simples (Nodemailer + Mailhog) e cria registro em AuditLog                             |
| KAN-308: Testes integração Company + Plan + Subscription                          | 5h         | R     | Cobertura mínima dos 3 CRUDs + fluxo de aprovação                                                           |
| KAN-309: Frontend — onboarding (Company + Owner + Subscription pendente)          | 8h         | I     | Wizard de 1 página: dados da empresa + usuário owner + escolha de plano                                     |
| KAN-310: Frontend — página de planos pública                                      | 4h         | I     | Tabela de comparação dos 3 planos, alinhada com landing                                                     |
| KAN-311: Frontend — dashboard admin com lista de subscriptions pendentes          | 5h         | I     | Lista, botão Aprovar/Rejeitar (placeholder, integra depois)                                                 |
| KAN-312: Atualizar PRD_VIVO.md com features da Sprint 3 ✅                        | 1h         | R     |                                                                                                             |

**Total estimado:** R: 21h · G: 7h · I: 17h

---

## Sprint 4 — Application + Project + ProjectMember (semanas 7-8)

**Objetivo:** Catálogo de aplicações, projetos abertos, atribuição de pentesters. Isolamento multi-tenant validado.

| Task                                                                         | Estimativa | Owner | Descrição resumida                                                                   |
| ---------------------------------------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------ |
| KAN-401: application.model.ts + repository + service + controller            | 6h         | R     | Service valida: subscription ACTIVE + count < maxApplications                        |
| KAN-402: factory/application.factory.ts + routes/application.routes.ts       | 1h         | R     |                                                                                      |
| KAN-403: project.model.ts + repository + service + controller                | 6h         | R     | 1-1 com Application. Service valida companyId herdado. Endpoint POST /:id/transition |
| KAN-404: factory/project.factory.ts + routes/project.routes.ts               | 1h         | R     |                                                                                      |
| KAN-405: project-member.model.ts + repository + service + controller         | 4h         | G     | CRUD básico. Validação: user a adicionar tem role=PENTESTER                          |
| KAN-406: project-member como subrota: POST /projects/:projectId/members      | 2h         | G     | Configurar nested route em project.routes.ts                                         |
| KAN-407: Testes integração Application (gate de limite, isolamento)          | 4h         | R     | Cobertura: limite de plano + canários TEN-01 a TEN-03                                |
| KAN-408: Testes integração Project (transição, isolamento)                   | 4h         | R     | Cobertura: máquina mínima + TEN-04, TEN-05                                           |
| KAN-409: Frontend — lista de aplicações por company                          | 4h         | I     | Tabela com filtro, botão criar nova app                                              |
| KAN-410: Frontend — wizard de nova análise (cria Project)                    | 5h         | I     | Form com escopo, tipo, nível, flag remediation                                       |
| KAN-411: Frontend — detalhe de projeto com tabs (visão/findings/chat futuro) | 6h         | I     | Layout completo, tabs apenas com "visão geral" preenchida                            |
| KAN-412: Atualizar PRD_VIVO.md ✅                                            | 1h         | R     |                                                                                      |

**Total estimado:** R: 22h · G: 6h · I: 15h

---

## Sprint 5 — Vulnerability + Evidence (semanas 9-10)

**Objetivo:** Núcleo do produto. Findings com CVSS automático, evidências, comentários, auditoria.

| Task                                                                       | Estimativa | Owner | Descrição resumida                                                                                                 |
| -------------------------------------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| KAN-501: utils/cvss.util.ts — calcula score → severidade                   | 3h         | R     | Função que recebe CVSS vector, retorna {score, severity}. Implementa tabela 0.1-3.9/4-6.9/7-8.9/9-10               |
| KAN-502: vulnerability.model.ts + repository + service + controller        | 8h         | R     | CRUD completo + transition de status. Service calcula severidade ao salvar. Override exige justificativa ≥20 chars |
| KAN-503: factory/vulnerability.factory.ts + routes/vulnerability.routes.ts | 1h         | R     |                                                                                                                    |
| KAN-504: evidence.model.ts + repository + service + controller (upload)    | 6h         | G     | POST /vulnerabilities/:id/evidences (multipart). Validação MIME + magic + tamanho. Nome reescrito UUID             |
| KAN-505: factory/evidence.factory.ts + nested routes                       | 2h         | G     |                                                                                                                    |
| KAN-506: vulnerability-comment como nested resource                        | 4h         | G     | POST /vulnerabilities/:id/comments. List paginada                                                                  |
| KAN-507: audit-log.repository.ts + helper para registrar mudanças          | 4h         | R     | createLog(actor, entity, action, diff). Chamado por VulnerabilityService no override e status change               |
| KAN-508: Testes integração Vulnerability (CVSS calc, isolamento)           | 5h         | R     | Cobre BIZ-03 a BIZ-08 + TEN-04                                                                                     |
| KAN-509: Testes integração Evidence (MIME, upload)                         | 3h         | R     | BIZ-09 + happy path                                                                                                |
| KAN-510: Frontend — lista de findings por projeto                          | 5h         | I     | Tabela com filtros (severidade, status, OWASP)                                                                     |
| KAN-511: Frontend — editor de finding (criar/editar)                       | 8h         | I     | Form complexo: CVSS, OWASP, descrição, evidências (upload drag-drop), comentários                                  |
| KAN-512: Atualizar PRD_VIVO.md ✅                                          | 1h         | R     |                                                                                                                    |

**Total estimado:** R: 24h · G: 12h · I: 13h

---

## Sprint 6 — Relatórios + Dashboard (semanas 11-12)

**Objetivo:** Relatórios PDF executivo e técnico, dashboards por perfil.

| Task                                                                      | Estimativa | Owner | Descrição resumida                                                                          |
| ------------------------------------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------------- |
| KAN-601: Endpoint GET /projects/:id/report-data                           | 3h         | R     | Retorna JSON consolidado: dados do projeto, findings agregados por severidade, maturidade   |
| KAN-602: report.model.ts + repository + service + controller (metadados)  | 3h         | R     | Tabela Report registra cada geração (auditoria)                                             |
| KAN-603: factory + routes                                                 | 1h         | R     |                                                                                             |
| KAN-604: Frontend — instalar @react-pdf/renderer e criar Report base      | 3h         | G     | Setup, componente PDFDownloadLink, layout de página A4                                      |
| KAN-605: Frontend — Relatório Executivo (PDF)                             | 8h         | G     | 3-5 páginas: capa, sumário, gráfico de severidade, top 5 riscos, conclusão. Fontes nativas. |
| KAN-606: Frontend — Relatório Técnico (PDF)                               | 8h         | G     | 20+ páginas: lista completa de findings, evidências thumbnail, CVSS, OWASP                  |
| KAN-607: Frontend — dashboard cliente (KPIs + gráfico severidade)         | 5h         | I     | Cards de KPI animados, gráfico Recharts de findings por severidade                          |
| KAN-608: Frontend — dashboard pentester (meus projetos)                   | 4h         | I     | Lista projetos atribuídos, findings da semana                                               |
| KAN-609: Frontend — dashboard admin (visão global)                        | 5h         | I     | Métricas agregadas: companies ativas, subscriptions pendentes, findings críticos abertos    |
| KAN-610: Testes integração de geração de relatório (endpoint report-data) | 3h         | R     | Cobre BIZ-10 + dados consolidados corretos                                                  |
| KAN-611: Atualizar PRD_VIVO.md ✅                                         | 1h         | R     |                                                                                             |

**Total estimado:** R: 11h · G: 19h · I: 14h

---

## Sprint 7 — Mobile + IA Gemini (semanas 13-14)

**Objetivo:** App mobile do cliente funcional. Assistente IA integrado.

| Task                                                                             | Estimativa | Owner | Descrição resumida                                                                       |
| -------------------------------------------------------------------------------- | ---------- | ----- | ---------------------------------------------------------------------------------------- |
| KAN-701: Setup Expo em app/mobile com TypeScript                                 | 3h         | I     | Expo create, configura tema dark, expo-secure-store, axios                               |
| KAN-702: Mobile — tela de Login                                                  | 3h         | I     | Form simples, salva token em SecureStore, deep link pra Home                             |
| KAN-703: Mobile — Home com lista de projetos                                     | 4h         | I     | TanStack Query lista projetos da company do usuário                                      |
| KAN-704: Mobile — Detalhe de projeto + lista de findings                         | 5h         | I     | Tabs: visão, findings, status                                                            |
| KAN-705: Mobile — Detalhe de finding (read-only)                                 | 4h         | I     | Severidade, descrição, evidências (carrossel), comentários                               |
| KAN-706: Mobile — viewer de PDF do relatório                                     | 4h         | I     | Instala expo-print + expo-sharing, baixa PDF do back, exibe                              |
| KAN-707: Mobile — Expo Push setup + token registration                           | 4h         | R     | Pede permissão, registra token no back, salva no User                                    |
| KAN-708: Back — POST /notifications/register-push (salva expoPushToken no User)  | 2h         | R     | Adicionar coluna expoPushToken em User via migration. Endpoint protegido                 |
| KAN-709: Back — service que envia push pra Expo quando finding CRITICAL é criado | 4h         | R     | Hook no VulnerabilityService.create — se severity=CRITICAL, dispara push                 |
| KAN-710: utils/gemini.util.ts — cliente Gemini autenticado                       | 3h         | R     | Wrapper do @google/generative-ai. Lê GEMINI_API_KEY do env                               |
| KAN-711: ai.controller.ts + service.ts — endpoints de sugestão                   | 6h         | R     | POST /ai/suggest-finding (título + stack → JSON estruturado). Rate limit por user (10/h) |
| KAN-712: Frontend — botão "Sugerir com IA" no editor de finding                  | 4h         | I     | Chama endpoint, preenche campos, marca aiAssisted=true                                   |
| KAN-713: Atualizar PRD_VIVO.md ✅                                                | 1h         | R     |                                                                                          |

**Total estimado:** R: 19h · G: 0h · I: 24h (excede — adiar KAN-706 ou KAN-712 se preciso)

⚠️ Guilherme com 0 horas nesta sprint. Pode pegar tarefas atrasadas da Sprint 6 (relatórios PDF).

---

## Sprint 8 — Maturidade + Polimento + Apresentação (semanas 15-16)

**Objetivo:** Avaliação de maturidade, testes finais, demo, slides do TCC.

| Task                                                                      | Estimativa | Owner | Descrição resumida                                                                                                          |
| ------------------------------------------------------------------------- | ---------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| KAN-801: Seed dos 7 domínios e ~21 controles de maturidade                | 3h         | I     | Domínios: Gestão de Acesso, Backup, Rede, Vulnerabilidades, Monitoramento, Conscientização, Código. Cada um com 3 controles |
| KAN-802: maturity-assessment.model.ts + repository + service + controller | 6h         | R     | CRUD da avaliação + endpoint pra salvar scores em batch                                                                     |
| KAN-803: factory + routes /maturity                                       | 1h         | R     |                                                                                                                             |
| KAN-804: Frontend — tela de avaliação de maturidade (admin)               | 8h         | I     | Layout TechNova-like: domínios laterais, controles centrais, score + radar lateral                                          |
| KAN-805: Frontend — radar chart de maturidade com Recharts                | 3h         | I     | Spider chart de 7 eixos, comparativo com avaliação anterior se houver                                                       |
| KAN-806: Adicionar score de maturidade no relatório executivo PDF         | 2h         | G     | Incluir seção com radar (renderizado como imagem ou SVG inline)                                                             |
| KAN-807: Revisar e expandir seed de demo (TechNova com dados realistas)   | 4h         | I     | 5 aplicações fictícias, 10 findings de diferentes severidades, 1 maturidade preenchida                                      |
| KAN-808: Rodar SonarQube manualmente, capturar relatório                  | 2h         | R     | Salvar screenshots/relatório como evidência pro TCC                                                                         |
| KAN-809: Rodar OWASP ZAP baseline scan contra staging local               | 2h         | R     | Mesmo: capturar relatório como evidência                                                                                    |
| KAN-810: Smoke tests E2E manuais dos 3 perfis (script de demo)            | 4h         | R     | Documentar passo a passo da demo no docs/DEMO.md                                                                            |
| KAN-811: Documentação final — README + diagrama de arquitetura            | 4h         | R + I | README com setup, screenshots, diagrama                                                                                     |
| KAN-812: Slides do TCC                                                    | 6h         | I + R | Apresentação com problema, solução, demo, stack, resultados                                                                 |
| KAN-813: Ensaio de apresentação (3 sessões)                               | 6h         | Todos | 30min cada, com cronômetro e feedback                                                                                       |
| KAN-814: Atualizar PRD_VIVO.md final ✅ todas as features                 | 1h         | R     |                                                                                                                             |
| KAN-815: BUFFER pra imprevistos                                           | 5h         | R     |                                                                                                                             |

**Total estimado:** R: 25h · G: 2h · I: 21h

---

## Resumo geral

| Sprint    | Foco                           | R       | G      | I       | Total   |
| --------- | ------------------------------ | ------- | ------ | ------- | ------- |
| 0         | Refactor                       | 6       | 0      | 0       | 6       |
| 1         | Fundação                       | 18      | 0      | 18      | 36      |
| 2         | Auth + User                    | 7       | 25     | 11      | 43      |
| 3         | Company + Plan + Subscription  | 21      | 7      | 17      | 45      |
| 4         | Application + Project + Member | 22      | 6      | 15      | 43      |
| 5         | Vulnerability + Evidence       | 24      | 12     | 13      | 49      |
| 6         | Relatórios + Dashboard         | 11      | 19     | 14      | 44      |
| 7         | Mobile + IA                    | 19      | 0      | 24      | 43      |
| 8         | Maturidade + Apresentação      | 25      | 2      | 21      | 48      |
| **Total** |                                | **173** | **71** | **133** | **377** |

**Capacidade total disponível:**

- Rafael: 40h × 8 = 320h (sobra: ~150h pra imprevistos)
- Guilherme: 20h × 8 = 160h (sobra: 89h)
- Iann: 20h × 8 = 160h (sobra: 27h — apertado)

⚠️ **Iann tá no limite.** Se ele atrasar, descer features dele pra sprints posteriores. Não dar mais nada crítico pra ele.

---

## Como importar no JIRA

1. Crie o projeto **KAN** se ainda não existir
2. Crie cada Sprint manualmente no JIRA (Sprint 1, Sprint 2, etc.)
3. Para cada linha desta tabela:
   - Criar issue tipo **Task**
   - Título = código + descrição (ex: "KAN-101: Aplicar schema.prisma...")
   - Estimativa em horas
   - Atribuir owner
   - Atribuir à Sprint correspondente
   - Descrição = texto da coluna "Descrição resumida"
4. Quando concluir, mover para coluna "Done" no Kanban e atualizar `PRD_VIVO.md`

⚠️ Os IDs `KAN-XXX` aqui são **sugestões**. O JIRA vai numerar automaticamente conforme você cria.

---

_Documento vivo. Ajustar conforme sprints vão acontecendo. Tarefas que sobram migram pra sprint seguinte._
