# ROADMAP_PROMPTS.md — Prompts de execução por fase

> **v4 · 2026-08-03.** Substitui a versão por sprints (8 sprints de 2 semanas, tarefas divididas entre Guilherme e Iann). Agora é **execução solo-delegada**: Rafael supervisiona, Claude Code implementa tudo — backend e frontend.
>
> **Como usar:** abra o Claude Code **na raiz do repositório** e cole o prompt da fase. Cada prompt é autocontido. Se a sessão morrer no meio, cole o **mesmo** prompt — ele lê o `PRD_VIVO.md`, descobre onde parou e continua.
>
> **Entrega: 25/10/2026.** 12 semanas, 6 fases, sem buffer.

---

## Cronograma

| Fase  | Escopo                                         | Semanas | Período       | Status         |
| ----- | ---------------------------------------------- | ------- | ------------- | -------------- |
| 0–2   | Refactor · Fundação · Auth + User (backend)    | —       | até 15/06     | ✅             |
| 3     | Refactor plural + Subscription + bootstrap web | 1–2     | 04/08 → 17/08 | ✅ Concluída em 2026-08-04 |
| 4     | Application + Project + Member + telas         | 3–4     | 18/08 → 31/08 | ✅ Concluída em 2026-08-04 |
| **5** | **Vulnerability + Evidence** ⭐                | 5–7     | 01/09 → 21/09 | 📋 **próxima** |
| 6     | Relatórios (pdf-lib) + Dashboards              | 8–9     | 22/09 → 05/10 | 📋             |
| 7     | Mobile enxuto + Push                           | 10–11   | 06/10 → 15/10 | 📋             |
| 8     | Maturidade (checklist) + fechamento TCC        | 12      | 16/10 → 25/10 | 📋             |

**Cortado do escopo:** IA / Gemini · chat · tickets · e-mail transacional · Prometheus/Grafana.
**Enxugado:** mobile (só o essencial pra demo) · maturidade (checklist de perguntas, não SAMM completo).

> ⚠️ Sem buffer. Se acumular mais de uma semana de atraso até o fim da Fase 6, **a Fase 7 encolhe primeiro** — mobile vira demonstração de telas com dados de seed, sem push funcional.

---

## Leitura obrigatória em toda sessão

Todo prompt assume que você leu, nesta ordem:

1. `PRD_VIVO.md` — onde o projeto parou
2. `CLAUDE.md` — §0.1 (docs vivos), §0.2 (modo solo), §2 (pastas), §5 (padrão de código)
3. `docs/Vulnera/00-Hub/Contexto Mestre v4.md` — fonte de verdade do domínio
4. `app/api/prisma/schema.prisma` — **os campos reais** (o schema vence qualquer suposição)

Ignore `docs/Vulnera/repomix-output.xml`. Ignore `docs/Vulnera/vulnera.md` e `docs/Vulnera/00-Hub/Fonte Original - MVP Vulnera.md` — são histórico (NestJS, PostgreSQL, 7 meses) e não valem mais.

---

# FASE 3 — Refactor plural + Subscription + bootstrap web ✅ Concluída em 2026-08-04

**Branch:** `feat/fase-3-empresas` (de `develop`) · **Período:** 04/08 → 17/08

```
Execute a Fase 3 do Vulnera. Sessão aberta na raiz do repositório.

LEITURA OBRIGATÓRIA antes de tocar em qualquer arquivo:
- PRD_VIVO.md
- CLAUDE.md (§0.1, §0.2, §2 estrutura de pastas, §5 walkthrough)
- docs/Vulnera/00-Hub/Contexto Mestre v4.md
- docs/Vulnera/07-Decisoes/ADR-009 - Pastas no plural e cadeia de camadas.md
- app/api/prisma/schema.prisma  ← campos REAIS

CHECKPOINT 0 — Auditoria (faça ANTES de escrever código)
Me diga, sem alterar nada:
a) Quais models existem em schema.prisma? Liste. Faltam Vulnerability, Evidence,
   VulnerabilityComment, AuditLog, Notification, Report, MaturityDomain,
   MaturityControl, MaturityAssessment, MaturityScore?
b) Os arquivos de company e plan (model/service/repository/controller/factory)
   estão completos ou são stubs? Abra e confira.
c) Existe subscription em algum lugar? Existe require-role.middleware?
d) O que `npm run check` retorna hoje em app/api?
PARE e reporte antes do Checkpoint 1.

CHECKPOINT 1 — Refactor para plural
Renomeie as pastas de recurso em app/api/src:
  controller/ → controllers/
  model/      → models/
  repository/ → repositories/
  service/    → services/
  factory/    → factories/
  middleware/ → middlewares/
Mantenha config/ e database/ no singular (convenção fixa do CLAUDE.md §2).
Use `git mv` para preservar histórico. Atualize TODOS os imports.
Atualize também docs/architecture.md, que documenta a convenção antiga.
Critério: `npm run build` e `npm run test` passam igual antes do rename.

CHECKPOINT 2 — Schema completo
Se faltarem models (ver Checkpoint 0), complete o schema.prisma com os 19 do
domínio — a especificação de cada um está em docs/Vulnera/02-Dominio/Entidades/.
Rode `npx prisma migrate dev --name complete_domain_models`.
⚠️ Isso é alteração de schema: me mostre o diff e ESPERE minha confirmação
antes de rodar a migration.

CHECKPOINT 3 — Backend: require-role, AuditLog, Subscription
1. middlewares/require-role.middleware.ts — requireRole(...roles), 403 FORBIDDEN
2. repositories/audit-log.repository.ts — create(actorUserId, entity, entityId,
   action, metadata), append-only. Confira no schema se metadata é Json ou String.
3. Plan: complete o que faltar. GET / e GET /:id PÚBLICOS (sem authMiddleware);
   POST/PUT/DELETE com authMiddleware + requireRole("ADMIN").
   Planos: BASIC, PRO, Enterprise (NÃO PRO_PLUS — nome antigo).
4. Company: complete o que faltar. Criador vira owner (User.companyId setado na
   criação). CNPJ único, regex de formato apenas (14 dígitos ou máscara), SEM
   dígito verificador. GET /companies/me ANTES de /:id no router.
   CLIENT vê/edita só a própria; ADMIN vê todas.
5. Subscription completa (5 camadas + factory + routes):
   - POST /subscriptions → cria PENDING + AuditLog SUBSCRIPTION_REQUESTED
   - GET /subscriptions/pending → admin-only, ANTES de /:id
   - GET /subscriptions/current → a ACTIVE da company do usuário
   - POST /:id/approve → ACTIVE + activatedAt + AuditLog
   - POST /:id/reject → REJECTED + AuditLog
   REGRA DE OURO: 1 subscription ACTIVE por company, validada NO REQUEST E DE
   NOVO NO APPROVE (o estado pode mudar entre os dois).
   Erros: ALREADY_HAS_ACTIVE_SUBSCRIPTION 409, INVALID_STATUS_TRANSITION 400.
6. Plugue tudo em routes/routes.ts.
NÃO IMPLEMENTAR: notificação por e-mail / Nodemailer (fora de escopo).

CHECKPOINT 4 — Testes backend
tests/integration/{plan,company,subscription}.test.ts cobrindo:
- PLAN: GET público sem token 200; POST sem admin 403; maxApplications<1 400;
  nome duplicado 409; update admin 200; delete admin 204
- COMP: criar vincula owner; CNPJ inválido 400; CNPJ duplicado 409;
  CLIENT não vê company de outro 404; GET /me devolve a própria; ADMIN lista todas
- SUB: cria PENDING; segunda ACTIVE 409; approve muda estado e gera AuditLog;
  approve de REJECTED 400; reject funciona; não-admin approve 403; /pending admin-only
Estenda cleanDatabase() em tests/setup.ts na ordem de FK do CLAUDE.md §12.
`npm run check` verde, cobertura ≥80% nos três services.

CHECKPOINT 5 — Bootstrap do frontend web
app/web hoje só tem package.json. Monte do zero:
1. Vite + React + TypeScript + Tailwind + Radix + TanStack Query + Zustand + Axios
2. Tema dark: bg #0a0a0a, accent emerald #10b981. Severidades (usar da Fase 5 em
   diante): critical #dc2626, high #ea580c, medium #f59e0b, low #10b981, info #3b82f6
3. components/ui/: Button, Input, Card, Badge, Table, Modal, Spinner, Layout
4. api/client.ts — Axios com interceptor de refresh e FILA de requisições
   concorrentes (se dois requests recebem 401 juntos, só um refresh dispara)
5. store/auth.store.ts — Zustand com persist em localStorage
6. pages/Login.tsx, pages/Register.tsx, ProtectedRoute, pages/Dashboard.tsx (stub)
7. hooks/useApiError.ts — mapeia código SCREAMING_SNAKE para mensagem PT-BR

CHECKPOINT 6 — Telas da Fase 3
1. pages/Plans.tsx — PÚBLICA, 3 cards comparativos, PRO destacado.
   CTA → /onboarding?plan=<id> se logado, /register se não
2. pages/Onboarding.tsx — wizard de 3 passos com useState (SEM lib de wizard):
   dados da empresa → escolha de plano (pré-seleciona ?plan=) → confirmação.
   Ao confirmar: createCompany + requestSubscription → /dashboard com aviso
   "assinatura pendente de aprovação"
3. pages/admin/PendingSubscriptions.tsx — só ADMIN (redireciona senão).
   TanStack Query em /subscriptions/pending, botões Aprovar/Rejeitar com Modal
   de confirmação + invalidation. Estado vazio amigável.
4. Rotas no App.tsx + item "Aprovações" na Sidebar visível só pra ADMIN

CHECKPOINT 7 — Smoke E2E e encerramento
Roteiro manual: abrir /plans deslogado → registrar CLIENT → onboarding cria
company + subscription PENDING → logar como admin do seed → aprovar → some da
lista → tentar segunda subscription → 409 tratado na UI → CLIENT não acessa
/admin/subscriptions → conferir AuditLog no Prisma Studio.
Depois: protocolo CLAUDE.md §0.1 completo (PRD_VIVO, BACKLOG, este arquivo com
badge + Histórico, Changelog do vault) + relatório §0.2 S5 + PR
"[Fase 3] Refactor plural + Subscription + bootstrap web" para develop.

NÃO FAZER NESTA FASE: e-mail, dígito verificador de CNPJ, zod, qualquer coisa
de Application/Project (Fase 4), IA (cortada do escopo).
```

## Histórico

**Branch:** `feat/fase-3-empresas` · **Data:** 2026-08-04 · **PR:** aberto manualmente pelo Rafael (ver mensagem sugerida no fim desta sessão)

Todos os 8 checkpoints concluídos em uma única sessão contínua (com pausas de confirmação nos Checkpoints 0→1 e 1→3; do Checkpoint 3 em diante o Rafael autorizou seguir sem pausar).

Desvios do prompt original:
- **Checkpoint 0 revelou que o Checkpoint 2 (schema completo) era desnecessário** — os 19 models do domínio já estavam completos em `schema.prisma` desde antes (a documentação do vault, incluindo o Changelog da sessão 20, afirmava o contrário — 9 models, arquivos vazios — mas isso já não era verdade no código; a divergência doc-vs-código foi corrigida nesta sessão, ver `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md`).
- **AuditLog**: o schema usa `actorId`/`entityType`/`diffJson: String?` (não `actorUserId`/`entity`/`metadata: Json` como o prompt supunha). Implementado conforme o schema real.
- **Subscription**: `status` default é `"PENDING_APPROVAL"` (não `"PENDING"`); não existe campo `activatedAt` — o approve reutiliza `startDate`. `reject` reaproveita o campo `approvedBy` pra guardar quem rejeitou (schema não tem `rejectedBy` separado).
- **CORS foi adicionado ao backend** (`cors` + env `CORS_ORIGIN`, não estava no prompt) — sem isso a SPA não conseguiria chamar a API a partir do navegador; tratado como bug bloqueante da própria task (CLAUDE.md §0.2 S6).
- **Stack do frontend diverge da descrição legada do vault** (`Front-end Web React.md`/`Estrutura - Web React.md`, que ainda descreviam Next.js App Router + shadcn/ui CLI + Socket.IO + Recharts, herdados da era pré-pivô Express/Vite). Implementado: Vite SPA + React Router (não Next.js), Radix primitives direto + Tailwind (não shadcn CLI), TanStack Query + Zustand juntos (não "ou"), sem Socket.IO/Recharts nesta fase (não usados em nenhuma tela da Fase 3). Ver ADR-020 e correção nas duas notas do vault.
- Dev DB tinha uma linha órfã `PRO_PLUS` de seed anterior à correção do `seed.ts` — limpa manualmente durante o Checkpoint 6.
- Testes cobrem 31/31 (13 pré-existentes + 18 novos de PLAN/COMP/SUB), cobertura de linha nos 3 services novos entre 94% e 100%.
- Smoke E2E do Checkpoint 7 foi feito com navegador real (Chrome via extensão) contra backend+frontend rodando, não só roteiro manual descrito em texto — cobriu registro → onboarding → aprovação admin → bloqueio de rota admin pra CLIENT → console sem erros.

---

# FASE 4 — Application + Project + ProjectMember ✅ Concluída em 2026-08-04

**Branch:** `feat/fase-4-projetos` · **Período:** 18/08 → 31/08 · **Depende de:** Fase 3

```
Execute a Fase 4 do Vulnera. Sessão na raiz do repositório.
Leituras de sempre (PRD_VIVO, CLAUDE.md, Contexto Mestre v4, schema.prisma).
Regras de domínio: docs/Vulnera/02-Dominio/Regras de Negocio/RN03..RN08.

CHECKPOINT 1 — Application
CRUD completo (models → repositories → services → controllers → factories → routes).
Regra crítica no service.create:
  - buscar subscription ACTIVE da company; se não houver → 422 NO_ACTIVE_SUBSCRIPTION
  - contar applications da company; se count >= plan.maxApplications
    → 422 PLAN_LIMIT_REACHED
  - companyId vem do req.user, NUNCA do body
URL validada por regex. Isolamento: CLIENT só a própria company; ADMIN todas.

CHECKPOINT 2 — Project
CRUD + máquina de estados.
  - 1-para-1 com Application → 409 APPLICATION_ALREADY_HAS_PROJECT
  - companyId SEMPRE herdado da Application, nunca do body (RN06)
  - POST /projects/:id/transition {toStatus}
    PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED, e IN_REVIEW → IN_PROGRESS
    Qualquer outra → 400 INVALID_STATUS_TRANSITION
  - PENTESTER lista só projetos onde é membro (RN17)
Toda transição gera AuditLog STATUS_CHANGE.

CHECKPOINT 3 — ProjectMember
Subrota dentro de routes/project.routes.ts:
  router.use("/:projectId/members", projectMemberRoutes)
Endpoints: POST / · GET / · DELETE /:userId
  - só ADMIN gerencia
  - usuário alvo precisa ter role PENTESTER → 400 USER_NOT_PENTESTER
  - par (projectId, userId) único → 409 MEMBER_ALREADY_EXISTS

CHECKPOINT 4 — Testes
APP-01..04: gate de limite estoura no plano BASIC; sem subscription ativa 422;
URL inválida 400; TEN-01..03 isolamento entre companies.
PROJ-01..05: 1-para-1; companyId herdado da Application (não do body);
máquina completa feliz; transição inválida 400; TEN-04..05 pentester não-membro.
Estenda cleanDatabase(): projectMember → project → application antes de subscription.
Cobertura ≥80% nos services novos.

CHECKPOINT 5 — Frontend
1. pages/Applications.tsx — tabela por company, filtro, botão "Nova aplicação"
   (modal com nome + URL + descrição). Erro PLAN_LIMIT_REACHED renderizado de
   forma amigável, com o limite do plano atual.
2. pages/NewAnalysis.tsx — wizard: escolher aplicação → tipo (PENTEST/DAST/SAST)
   → nível e escopo → flag de remediação → cria Project em PENDING
3. pages/ProjectDetail.tsx — header com badge de status e botão de transição
   (respeitando a máquina e a role); abas:
   Visão geral (metadados + membros, com gestão de membros se ADMIN) /
   Findings (placeholder "Fase 5") / Relatórios (placeholder "Fase 6")
4. Sidebar: "Aplicações" e "Projetos" ativos. Breadcrumb company → app → projeto
   (ajuda muito na demo).

CHECKPOINT 6 — Smoke e encerramento
Criar aplicações até estourar o limite do BASIC → 422 amigável → criar projeto →
transitar estados pela UI → adicionar pentester como membro (e confirmar que
CLIENT não consegue) → logar como pentester e ver só o projeto atribuído.
Protocolo §0.1 + relatório §0.2 S5 + PR para develop.

NÃO FAZER: vulnerabilities (Fase 5), upload, chat.
```

## Histórico

**Branch:** `feat/fase-4-projetos` · **Data:** 2026-08-04 · **PR:** aberto manualmente pelo Rafael

Todos os 6 checkpoints concluídos numa sessão contínua, sem pausas intermediárias (autorização já dada nas fases anteriores para seguir sem parar a cada checkpoint quando o trabalho está indo bem).

Desvios do prompt original:
- **ProjectMember GET foi aberto além de ADMIN.** O prompt dizia "só ADMIN gerencia", e a primeira implementação gateou o subrouter inteiro (GET+POST+DELETE) com `requireRole("ADMIN")`. Isso quebrava o requisito do Checkpoint 5 de a aba "Visão geral" do ProjectDetail mostrar os membros pra CLIENT e PENTESTER também — só a *gestão* (adicionar/remover) é ADMIN-only, a *leitura* segue a mesma regra de visibilidade do próprio Project (RN16/RN17). Corrigido antes de escrever o frontend; `ProjectMemberService.list()` agora recebe o actor e valida com a mesma lógica de `assertCanView` do ProjectService.
- **Tipo de análise**: o prompt do frontend dizia "tipo (PENTEST/DAST/SAST)", mas `analysisType` no schema é `SAST | DAST | MATURITY | COMBO` (sem "PENTEST"). Segui o schema — é a fonte de verdade (CLAUDE.md R5) — e usei os 4 valores reais no wizard.
- **PENTESTER não gerencia Applications** (list/create bloqueados com FORBIDDEN) — não estava explícito no prompt pra esse recurso; decisão por analogia com RN17 (pentester interage via Project, não diretamente com o catálogo de aplicações da company).
- **Application.delete() é soft delete** (`isActive=false`), não `DELETE` físico — exigido pela RN04, não estava no texto literal do Checkpoint 1 mas é regra de negócio pré-existente.
- **Sem DELETE para Project** — não pedido explicitamente no Checkpoint 2, e apagar um engagement de segurança em andamento não faz sentido de produto; anotado, não implementado.
- Testes: 20 novos (6 Application + 11 Project + 3 ProjectMember), total 51/51. Cobertura de linha: application 85.4%, project 100%, project-member 100%.
- Smoke E2E do Checkpoint 6 foi feito com navegador real, cobrindo os 3 roles: CLIENT criando aplicação e projeto, ADMIN transicionando status e atribuindo pentester, PENTESTER vendo só o projeto atribuído (RN17 confirmada visualmente), e o gate visual de `PLAN_LIMIT_REACHED` com uma empresa de teste no plano BASIC (mensagem "Limite de 2 aplicações do plano BASIC atingido..." confirmada na tela).
- Durante o smoke E2E, dois processos `vite`/`node` órfãos de sessões anteriores ficaram presos nas portas 3000/3001 (um deles chegou a fazer o Vite cair pra 3001, colidindo com a API) — identificados via `netstat` e finalizados via `taskkill`. Não é um bug do código, só higiene de ambiente de dev local no Windows.

---

# FASE 5 — Vulnerability + Evidence ⭐ NÚCLEO ✅ Concluída em 2026-08-05 · 🔒 Endurecida em 2026-08-07

**Branch:** `feat/fase-5-findings` · **Período:** 01/09 → 21/09 (3 semanas) · **Depende de:** Fase 4

```
Execute a Fase 5 do Vulnera — o núcleo do produto e a fase mais pesada.
Leituras de sempre. Regras: docs/Vulnera/02-Dominio/Regras de Negocio/RN09..RN12,
RN20, RN21 e docs/Vulnera/02-Dominio/Conceitos/CVSS.md.
Instalar no backend: multer + @types/multer.

CONCEITO CRÍTICO: cada Vulnerability é INSTÂNCIA INDIVIDUAL, ligada a 1 Project,
1 Application e 1 Company. NÃO existe catálogo compartilhado de CVEs. A mesma SQL
Injection em duas empresas são dois registros independentes.

CHECKPOINT 1 — CVSS
utils/cvss.util.ts — calculateCvss(vector: string) → { score, severity }
Parser MANUAL do vector CVSS 3.1 (AV/AC/PR/UI/S/C/I/A) com as fórmulas oficiais
da FIRST, comentadas em PT-BR (a banca vai perguntar como calcula).
Faixas: 0.1–3.9 LOW · 4.0–6.9 MEDIUM · 7.0–8.9 HIGH · 9.0–10 CRITICAL.
Vector inválido → INVALID_CVSS_VECTOR.
Teste com pelo menos 4 vectors conhecidos. Canônico:
  AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H = 9.8 CRITICAL

CHECKPOINT 2 — Vulnerability
CRUD completo. Service:
  - create/update recalcula score e severidade a partir do vector
  - applicationId e companyId desnormalizados, herdados do Project
  - owaspCategory obrigatória (OWASP Top 10 2021) — RN11
  - POST /:id/transition: OPEN → IN_PROGRESS → FIXED → CLOSED + AuditLog
  - POST /:id/override-severity {newSeverity, justification}
    justification ≥ 20 caracteres, senão 400 MISSING_JUSTIFICATION
    gera AuditLog SEVERITY_OVERRIDE com valores antes/depois no metadata
Quem escreve: PENTESTER membro do projeto ou ADMIN. CLIENT é read-only.

CHECKPOINT 3 — Evidence e Comment
1. Evidence: POST /vulnerabilities/:vulnId/evidences (multipart)
   multer memoryStorage → validação → gravação manual
   - MIME whitelist: image/png, image/jpeg, application/pdf, text/plain
   - MAGIC NUMBER nos primeiros bytes (não confiar no header declarado):
     PNG 89 50 4E 47 · JPEG FF D8 FF · PDF 25 50 44 46 · txt valida UTF-8
   - máximo 10MB → 400 FILE_TOO_LARGE; tipo errado → 400 INVALID_FILE_TYPE
   - renomear para UUID + extensão, salvar em uploads/{companyId}/{vulnId}/
   - GET autenticado que valida o acesso do ator à company antes de servir
2. VulnerabilityComment: POST/GET /vulnerabilities/:id/comments (GET paginado),
   DELETE só do autor ou admin

CHECKPOINT 4 — Testes
BIZ-03: CVSS calculado corretamente · BIZ-04: severidade derivada do score
BIZ-05: override sem justificativa 400 · BIZ-06: justificativa curta (<20) 400
BIZ-07: override válido gera AuditLog · BIZ-08: transição inválida 400
BIZ-09: upload .exe 400 INVALID_FILE_TYPE + upload PNG válido 201
TEN-06: vulnerability da company A invisível para B
Estenda cleanDatabase(): evidence → vulnerabilityComment → vulnerability antes
de projectMember. Cobertura ≥80%.

CHECKPOINT 5 — Frontend
1. ProjectDetail aba Findings: tabela com filtros (severidade, status, OWASP),
   badges coloridos por severidade, paginação, contador "X críticos abertos"
   no header do projeto
2. pages/FindingEditor.tsx:
   - título, campo de vector CVSS com cálculo EM TEMPO REAL (espelhe o cvss.util
     em TypeScript no front — não faça round-trip ao servidor a cada tecla)
   - select de OWASP Top 10 2021
   - descrição, impacto, recomendação (textarea)
   - upload drag-drop multi-arquivo com preview e barra de progresso
   - timeline de comentários
   - botões de transição de status e de override (modal pedindo justificativa
     com contador de caracteres, desabilitado abaixo de 20)
3. pages/FindingDetail.tsx — versão read-only para o CLIENT

CHECKPOINT 6 — Smoke e encerramento
Pentester cria finding com vector real → severidade calcula sozinha → sobe duas
evidências (uma PNG válida, um .exe bloqueado) → comenta → faz override com
justificativa → CLIENT abre e vê read-only → conferir AuditLog no Studio.
Protocolo §0.1 + relatório + PR.

NÃO FAZER: relatórios (Fase 6), IA (cortada), antivírus no upload (anote como
limitação conhecida na documentação).
```

## Histórico

**Branch:** `feat/fase-5-findings` · **Data:** 2026-08-05 · **PR:** a abrir pelo Rafael

Todos os 6 checkpoints concluídos numa sessão contínua, com "esforço adicional" pedido explicitamente pelo Rafael — cada checkpoint foi validado com testes reais antes de seguir pro próximo (13 vectors CVSS conferidos à mão, 97 testes automatizados, smoke E2E completo no navegador com upload de arquivo real e conferência do AuditLog no Prisma Studio).

Desvios do prompt original:
- **Máquina de estados simplificada (4 estados, igual ao Project na Fase 4).** O vault documenta uma máquina de 6 estados pra Vulnerability (OPEN/IN_PROGRESS/FIXED/REVALIDATION/CLOSED/RISK_ACCEPTED — `Maquina - Vulnerability.md`) com transições que dependem de `project.hasRemediation` (RN13/RN14: quem move pra FIXED muda se o projeto tem serviço de remediação). O Checkpoint 2 pediu literalmente `OPEN → IN_PROGRESS → FIXED → CLOSED`, então segui isso — mesma decisão e mesmo racional da simplificação do Project. REVALIDATION/RISK_ACCEPTED e a bifurcação por `hasRemediation` ficam como trabalho futuro.
- **DELETE de Vulnerability é ADMIN-only, físico (hard delete).** "CRUD completo" não detalhava quem podia apagar. Diferente de Application (RN04 exige soft-delete explícito), Vulnerability não tem `isActive` no schema — o comentário do schema.prisma já diz "soft-delete não-implementado" como padrão do projeto. Restringi a ADMIN (não PENTESTER) porque apagar um finding é mais sensível que editá-lo num produto de auditoria de segurança; sempre gera AuditLog DELETE.
- **PUT com novo cvssVector reseta o override anterior.** RN21 fala em auditar `SEVERITY_CHANGE` quando o vetor muda; não estava explícito o que acontece com um override manual pré-existente. Decidi que mudar o vetor invalida o override (a justificativa foi escrita pro score antigo) — `severityFinal` volta a acompanhar `severityCalculated` e `severityOverrideReason` é limpo. Gera AuditLog `SEVERITY_CHANGE` com from/to.
- **VulnerabilityComment: qualquer ator que pode VER o finding pode comentar**, não só ADMIN/PENTESTER-membro (que é a regra de escrita do finding em si). CLIENT comenta normalmente — é canal de comunicação, testado no smoke (CLIENT comentando funcionou). DELETE continua restrito ao autor ou ADMIN, como pedido.
- **Validação do upload ignora o `Content-Type` declarado por completo** — não só como "dupla checagem", é a ÚNICA fonte de verdade pro tipo aceito (a whitelist e a detecção por magic number são a mesma função). Testado explicitamente no smoke: um `.exe` disfarçado de `.png` (Content-Type: image/png) foi bloqueado do mesmo jeito.
- **Bug pré-existente corrigido (bloqueava o Checkpoint 6):** o `.gitignore` da raiz apontava pra `apps/api/uploads/*` (plural, resquício de estrutura antiga) — nunca bateu com o caminho real `app/api/uploads/`. Corrigido nos dois `.gitignore` (raiz e `app/api/`), senão evidências reais de upload seriam commitadas por engano.
- **UPLOADS_DIR nova env var** (`EnvKeys`/`EnvVar`, como manda o CLAUDE.md §6) — testes gravam em `uploads-test/` em vez de `uploads/`, pra nunca poluir o volume real de dev com arquivo de teste.
- Testes: 24 novos (13 unitários de CVSS + 11 de integração: vulnerability/evidence/vulnerability-comment), total 97/97. Cobertura de linha nos 3 services novos: vulnerability 97.6%, evidence 95%, vulnerability-comment 96.4% (todos ≥80% em statements também).
- Smoke E2E do Checkpoint 6 feito com navegador real e arquivos binários de verdade (PNG com assinatura válida + "executável" com cabeçalho MZ): pentester criou o finding com o vetor canônico (score calculado em tempo real no cliente = 9.8 CRITICAL, igual ao backend), subiu as duas evidências (PNG aceito, .exe bloqueado por magic number mesmo com Content-Type forjado), comentou, fez override pra MEDIUM com justificativa — CLIENT abriu a mesma URL e viu tudo read-only (sem botão Editar, sem zona de upload, com o override e a severidade calculada original visíveis). AuditLog conferido no Prisma Studio: 3 registros (Project STATUS_CHANGE + Vulnerability CREATE + Vulnerability SEVERITY_OVERRIDE), todos com o actor e o diff corretos.
- ⚠️ **Limitação conhecida (documentar no README/DEMO, conforme pedido):** não há varredura antivírus/malware no upload — a validação é de tipo (magic number) e tamanho, não de conteúdo malicioso embutido num arquivo do tipo aceito (ex: polyglot files, exploit em parser de imagem).
- Observação de bibliotecas (não bloqueou nada, só registro): `npm audit` no backend aponta 4 vulnerabilidades pré-existentes (2 baixas, 2 altas) em dependências de ferramenta (`eslint`/`jest`/`esbuild` transitivos) — nenhuma nova, nenhuma em dependência de runtime além do `body-parser` do Express. Não corrigido nesta sessão (fora do escopo da Fase 5); considerar `npm audit fix` numa sessão de manutenção.

### Sessão de endurecimento — 2026-08-07

**Branch:** `fix/fase-5-hardening` (a partir de `fix/revisao-endurecimento-Fase5`) · **PR:** a abrir pelo Rafael

Sessão de hardening, sem features novas: o critério foi "o que uma banca de TCC em segurança atacaria neste código, e o que quebraria numa demo ao vivo". Testes 107 → **225**, todos verdes. Cobertura dos services da Fase 5 toda ≥90%.

**Vulnerabilidades encontradas e corrigidas**

- **[Média] Validação de texto aceitava binário.** O fallback `text/plain` do upload aprovava qualquer buffer cujos bytes fossem code points UTF-8 válidos — e bytes de controle **são** UTF-8 válido, então `Buffer.from([0x00,0x01,0x02])` passava como texto e era gravado como `.txt`. Substituído por `isPlainText()`, que rejeita controles fora de TAB/LF/CR.
- **[Baixa] 500 em nome de arquivo longo.** `originalName` é `VARCHAR(191)` e era gravado cru; nome de 300 caracteres estourava a coluna e virava `500 INTERNAL_ERROR`. Novo `sanitizeOriginalName()` (basename + remoção de controles + truncamento).
- **[Baixa] 500 em título longo.** Mesmo problema em `Vulnerability.title` (`VARCHAR(191)`). Novos `FIELD_LIMITS` no model, aplicados no POST e no PUT.
- **[Baixa] Duplicata de métrica CVSS não detectada.** `if (parsed[key])` é falsy para string vazia, então `C:/C:H` passava sem ser flagrado. Trocado por `key in parsed`.
- **[Baixa] Sem limites de partes no multipart.** Adicionados `files: 1`, `fields: 5`, `parts: 10` — sem eles o upload aceita quantidade arbitrária de partes mesmo com `fileSize` baixo.

**Endurecimentos sem falha correspondente** (defesa em profundidade / prova do que já funcionava)

- `resolveDentroDeUploads()` valida contenção do caminho sob `UPLOADS_ROOT` na leitura **e** na escrita. O caminho já derivava 100% do registro no banco; isto cobre registro adulterado por outra via.
- `X-Content-Type-Options: nosniff` no download (o `attachment` do `res.download` já existia).
- Rejeição **explícita** de versão do vetor CVSS (`assertSupportedVersion`). `CVSS:3.0/` já era recusado, mas **por acidente** — sem teste, e quebraria se alguém mexesse no parser. Métricas temporais/ambientais idem.
- Teto na justificativa de override (1000, novo `JUSTIFICATION_TOO_LONG`) e no conteúdo de comentário — os dois vão inteiros pro `diffJson` do AuditLog e pro PDF Técnico.

**Auditoria — buraco na trilha, corrigido**

O `PUT` com vetor novo descartava o override manual (decisão correta da Fase 5) mas registrava só um `SEVERITY_CHANGE` genérico. Na trilha do PDF Técnico, um `SEVERITY_OVERRIDE` simplesmente sumia sem explicação. Agora emite evento próprio **`SEVERITY_OVERRIDE_RESET`** com `reason: "CVSS_VECTOR_CHANGED"`, severidade descartada, **a justificativa que deixou de valer** e a severidade recalculada. O `SEVERITY_CHANGE` passou a registrar também vetor e score de origem/destino.

**CVSS — o parser estava correto**

Nenhum erro de cálculo. Validado contra **13 vetores oficiais** do FIRST/NVD (5 com Scope Changed): 13/13. Duas divergências na primeira rodada eram erro do vetor de teste (escrevi `S:C` onde o NVD publica `S:U`), não do código.

Achado que virou evidência: o arredondamento **já usava** a aritmética inteira do Apêndice A do 3.1. Enumerando os **2592 vetores base possíveis**, a aritmética do 3.1 e o `Math.ceil(x*10)/10` do 3.0 **coincidem em todos** — a diferença só aparece em valores intermediários, provada com o exemplo canônico do Apêndice A (`0.1+0.2` → 0.3 vs. 0.4). A mesma varredura prova que nenhum vetor legítimo gera NaN/Infinity ou sai de [0,10]. Para permitir o teste direto, `roundUp` passou a ser exportada.

**Paridade front/back:** teste novo importa `app/web/src/lib/cvss.ts` na suíte da API e roda os mesmos 2592 vetores nos dois — **0 divergências**, e ambos recusam as mesmas entradas malformadas.

**Isolamento multi-tenant:** existia só o TEN-06 (leitura de Vulnerability). Adicionados **TEN-07 a TEN-13** cobrindo Evidence, Comment e escrita de Vulnerability, nos dois vetores (CLIENT cross-tenant e PENTESTER não-membro), cada bloco com controle positivo e verificação de efeito colateral no banco. Nenhum furo encontrado — o valor é a prova, que não existia. TEN-13 prova que `companyId`/`projectId`/`severityFinal` forjados no corpo são ignorados (mass assignment).

**Alinhamento com a Fase 6:** novo `app/web/src/lib/font-safety.ts` + aviso **não-bloqueante** no `FindingEditorPage` listando os caracteres que virarão `?` no PDF. O `sanitizeForFont()` da Fase 6 continua sendo a rede de segurança; o aviso é a prevenção na origem.

**Máquina de estados:** escrito o [[ADR-021 - Maquina de Vulnerability com 4 estados]]. Argumento central encontrado na investigação: os dois estados faltantes dependem de regras que **também** não existem no código (RN13/RN14 para `REVALIDATION`; alçada de aceite de risco para `RISK_ACCEPTED`). Nota `Maquina - Vulnerability` reestruturada em "Implementado no MVP" × "Modelo conceitual"; RN12/RN13/RN14 com callouts.

**Validação no navegador real** — a extensão do Chrome conectou (não conectara na Fase 6), fechando as duas pendências herdadas:

- ✅ **Embed de evidência no PDF Técnico CONFIRMADO.** PNG 480×240 subido, PDF gerado pela UI e aberto no Chrome: imagem embutida e renderizada. Bytes: `/Subtype /Image`, `/Width 480 /Height 240`. **O fallback não foi acionado** — `axios` com `responseType: "blob"` produz Blob real no adapter XHR, como suspeitado na Fase 6.
- ✅ PDFs Executivo e Técnico e os 3 dashboards conferidos visualmente. Zero erros de console.
- ✅ CLIENT read-only testado via `fetch` no console (não só UI): PUT/transition/override/DELETE/upload todos **403**; GET 200; comentar 201 (permitido por design).
- ✅ Path traversal ao vivo (`../`, `%2e%2e%2f`, `....//`, caminho absoluto): todos 404.
- ✅ AuditLog conferido no banco de dev, incluindo o `SEVERITY_OVERRIDE_RESET` novo no fluxo real.

**Ambiente (o `npm run check` não rodava do zero):** `.env`/`.env.test` não existiam (ambos no `.gitignore`) e `jest.config.ts` em TypeScript exige `ts-node`, que não estava nas devDependencies — **adicionado ao `package.json`**. Sem ele, um clone limpo não roda a suíte.

**`DOTENV_CONFIG_QUIET`:** o banner do dotenv 17.x foi silenciado **no código versionado** (`quiet: true` em `tests/setup.ts` e `EnvVar.ts`), não numa variável de ambiente — `.env*` está no `.gitignore`, então quem clonasse o repo veria o banner de volta.

**⚠️ Bug encontrado fora do escopo (não corrigido, §0.2 S6):** no **PDF Executivo**, seção "Top 5 riscos", um título longo **sobrepõe** o texto `CVSS x.x · Axx · Categoria` — falta truncamento/reserva de espaço em `app/web/src/lib/pdf/executive.ts`. Preexistente, não causado pelo endurecimento.

**⚠️ Divergência de documentação sinalizada:** `CLAUDE.md` §2 exigia pastas **singulares**, contra o [[ADR-009 - Pastas no plural e cadeia de camadas]], o Contexto Mestre v4 e o código real. Rafael confirmou **plural** nesta sessão; `CLAUDE.md` §2 atualizado (R4 exige confirmação humana antes de editar regra eterna).

**⚠️ Colisão de numeração de ADR:** o `docker-compose.yml` referenciava um "ADR-021 - Stack completa no Docker Compose" que **nunca foi escrito** (commit `c131aef`, "não finalizado"). ADR-021 foi usado para a máquina de estados; o comentário do compose foi ajustado para registrar que o ADR do Docker deve ser **ADR-022**.

---

# FASE 6 — Relatórios + Dashboards ✅ Concluída em 2026-08-07

**Branch:** `feat/fase-6-relatorios` · **Período:** 22/09 → 05/10 · **Depende de:** Fase 5

```
Execute a Fase 6 do Vulnera. Leituras de sempre.
Instalar no app/web: pdf-lib  (⚠️ NÃO @react-pdf/renderer — decisão revertida)

CHECKPOINT 1 — Backend
1. GET /api/projects/:id/report-data — JSON consolidado num único request:
   { project, company, application,
     vulnerabilities: [...],
     stats: { total, bySeverity{...}, byStatus{...}, byOwasp{...} },
     topRisks: [5 maiores por score],
     maturity: <null até a Fase 8> }
   Permissão: CLIENT da company, PENTESTER membro, ADMIN. Senão 403/404.
2. Report metadata (5 camadas): POST /api/reports {projectId, type:
   EXECUTIVE|TECHNICAL} registra a geração + AuditLog REPORT_GENERATED.
   GET /api/reports?projectId= lista o histórico.
3. Testes RPT-01..03: números batem com o banco; isolamento cross-company;
   pentester não-membro 403.

CHECKPOINT 2 — PDFs com pdf-lib
⚠️ A API do pdf-lib é IMPERATIVA: você cria o PDFDocument, adiciona páginas e
desenha texto/retângulos por coordenada. Não existem componentes React como no
@react-pdf/renderer. Reserve tempo para isso.
1. lib/pdf/base.ts — helpers reutilizáveis: página A4, cabeçalho com nome da
   empresa, rodapé paginado, fontes StandardFonts.Helvetica, paleta de severidade,
   função drawText com quebra de linha automática e função drawBarChart
   (retângulos proporcionais — o gráfico é desenhado à mão)
2. lib/pdf/executive.ts — 3 a 5 páginas: capa, sumário executivo, gráfico de
   barras por severidade, top 5 riscos com recomendação curta, conclusão.
   Seção de maturidade fica como placeholder condicional (chega na Fase 8).
3. lib/pdf/technical.ts — capa, sumário, uma seção por finding (título,
   severidade, vector + score, OWASP, descrição, impacto, recomendação,
   evidências PNG/JPEG embutidas via embedPng/embedJpg, comentários),
   apêndice com glossário
4. Botões "Gerar PDF Executivo" e "Gerar PDF Técnico" na aba Relatórios do
   ProjectDetail: busca report-data → gera o PDF → download via Blob →
   registra POST /api/reports

CHECKPOINT 3 — Dashboards
Dashboard.tsx roteia o conteúdo pela role do Zustand.
- CLIENT: cards de KPI (total de findings, % remediados = FIXED+CLOSED/total,
  críticos abertos) + donut Recharts por severidade + 5 findings mais recentes
- PENTESTER: projetos atribuídos com status, findings registrados na semana
- ADMIN: companies ativas, subscriptions pendentes (link pra tela da Fase 3),
  findings críticos abertos globais, top companies por volume

CHECKPOINT 4 — Smoke e encerramento
Gerar os dois PDFs de um projeto com findings reais, abrir e conferir o visual;
dashboards corretos nos três perfis; Report registrado no banco.
Protocolo §0.1 + relatório + PR.

NÃO FAZER: agendamento de relatório, export CSV, envio por e-mail.
```

## Histórico

**Branch:** `feat/fase-6-relatorios` · **Data:** 2026-08-07 · **PR:** a abrir pelo Rafael

Todos os 4 checkpoints concluídos numa sessão contínua. Cada checkpoint foi validado antes de seguir pro próximo — inclusive um smoke headless dos dois PDFs (rodando `lib/pdf/*` fora do browser via `vite.ssrLoadModule`, já que a extensão do Chrome não conectou nesta sessão) que pegou e corrigiu um bug real antes de qualquer usuário ver.

Desvios do prompt original:
- **RN18 aplicada nos dois pontos do fluxo de relatório** (`GET report-data` e `POST /reports`), não só mencionada — o prompt não detalhava o gate de status, mas `docs/Vulnera/02-Dominio/Regras de Negocio/RN18` é explícita ("Relatórios só podem ser gerados com Project em IN_REVIEW ou superior") e `report-data` é o primeiro passo do próprio fluxo de geração (não existe outro consumidor hoje). Novo código de erro `PROJECT_NOT_READY_FOR_REPORT` → 422.
- **`GET /projects/:id/report-data` é montado em `project.routes.ts`** (não em `report.routes.ts`), porque a URL exigida pelo enunciado é aninhada em `/projects/:id` — a lógica continua 100% em `ReportService`/`ReportController`, só o *mount point* da rota é que segue a URL pedida em vez do recurso "dono" da lógica. Documentado em comentário no próprio arquivo.
- **Quem pode GERAR relatório inclui o CLIENT**, não só ADMIN/PENTESTER-membro. Diferente da escrita de Vulnerability (CLIENT é sempre read-only lá), aqui faz sentido porque o PDF é gerado no browser do próprio usuário — "gerar" e "baixar" são o mesmo clique, e a Matriz de Permissões lista "baixar relatório" como ação do Client Owner/Member.
- **Nenhum endpoint novo de agregação pros dashboards.** Reutilizei os endpoints já escopados por role da Fase 4/5 (`GET /vulnerabilities` e `GET /projects` sem filtro já retornam ADMIN=tudo/CLIENT=própria company/PENTESTER=projetos-membro) e computei os KPIs no frontend. Única adição real: `GET /subscriptions/active` (admin-only, mesma forma de `/pending`) porque `Company` não tem campo `isActive` no schema — "empresas ativas" só existe via `Subscription.status === ACTIVE`.
- **`sanitizeForFont()` em `lib/pdf/base.ts`** — não estava no prompt, descoberto durante o smoke: `StandardFonts.Helvetica` do pdf-lib só codifica WinAnsi/cp1252 (cobre acento PT-BR e pontuação tipográfica de sobra, mas não emoji nem setas unicode). Sem sanitizar, um finding com emoji no título ou comentário derrubaria a geração do PDF inteiro com uma exceção do pdf-lib. Corrigido testando caractere a caractere via `font.widthOfTextAtSize` (pergunta pro próprio pdf-lib em vez de manter tabela cp1252 à mão) e trocando por `?` o que não tem glifo — aplicado em `wrapText()` (cobre a maioria do texto de usuário) e nos ~5 pontos que desenham título direto sem quebra de linha.
- **Paleta do PDF: capa em tema escuro (replica a UI), corpo em fundo branco.** O enunciado pediu "layout temático"; usei a cor de destaque (`#10b981`) e a paleta de severidade EXATAMENTE iguais ao `tailwind.config.ts` do app/web (mesma fonte, `lib/severity-colors.ts` no frontend), mas não repliquei os tokens escuros de UI (`background`/`border`/`muted`) nas páginas de conteúdo — um relatório técnico de 20+ páginas em tema escuro seria ruim de imprimir e cansativo de ler. Capa dark + corpo claro com acentos de marca é o padrão de mercado pra esse tipo de documento.
- Testes: 10 novos (9 report + 1 subscription/active), total 107/107. Cobertura de `report.service.ts`: 89% statements / 97% lines.
- Smoke: dados sintéticos primeiro (pegou o bug do WinAnsi), depois PDFs gerados com dados REAIS do banco de dev (mesmo finding da TechNova da Fase 5, incluindo a evidência PNG real e o comentário do Bruno Pentester) via login programático + `report-data` real — conferido visualmente com o Read tool (que renderiza PDF). Dashboards validados via chamadas diretas à API nos 3 perfis (ADMIN/CLIENT/PENTESTER) contra o banco de dev real, já que a extensão do Chrome não conectou.
- ⚠️ **Não verificado no browser real:** o embed da evidência PNG no PDF Técnico (`embedPng`) usa `axios` com `responseType: "blob"`, que só produz um `Blob` de verdade no adapter XHR do browser — em Node (ambiente do smoke headless) isso não funciona e cai no fallback gracioso já previsto no código ("evidência não pôde ser carregada", sem derrubar o PDF). Arquitetura revisada e é o mesmo padrão já usado (e correto) desde a Fase 5 pro download de evidência; mesmo assim, vale um clique de confirmação visual da Rafael quando abrir o app de verdade.
- Efeito colateral do smoke: o projeto de demo da TechNova (`Análise DAST — Portal do Cliente`) foi transicionado de `IN_PROGRESS` para `IN_REVIEW` via API (ADMIN, RN15) pra poder testar `report-data`/RN18 com dado real — fica assim de propósito, pra Rafael já conseguir clicar em "Gerar PDF" na demo sem precisar mexer no status primeiro.

---

# FASE 7 — Mobile enxuto + Push

**Branch:** `feat/fase-7-mobile` · **Período:** 06/10 → 15/10 · **Depende de:** Fase 5

```
Execute a Fase 7 do Vulnera. Leituras de sempre.
Instalar no app/mobile: expo, expo-router, expo-secure-store, expo-notifications,
@tanstack/react-query, axios. No backend: expo-server-sdk.

ESCOPO DELIBERADAMENTE ENXUTO. O mobile é read-only, exclusivo do CLIENT, e
existe para a demo. NÃO construa paridade com o web. Se algo estourar o prazo,
corte funcionalidade do mobile, nunca do backend.

CHECKPOINT 1 — Mobile base
app/mobile hoje só tem package.json. Bootstrap Expo + TypeScript + Expo Router.
Tema dark igual ao web. api/client.ts espelhando o interceptor do web, mas com
SecureStore no lugar de localStorage.
Telas (só estas cinco):
  1. Login
  2. Home — lista de projetos da company (TanStack Query)
  3. ProjectDetail — metadados + lista de findings
  4. FindingDetail — read-only: badge de severidade, descrição, evidências em
     carrossel, comentários
  5. Configurações — logout e status de notificações
NÃO FAZER no mobile: criar/editar nada, upload, geração de PDF, telas de admin,
telas de pentester.

CHECKPOINT 2 — Push
1. Migration: coluna expoPushToken (String?) no model User
   → npx prisma migrate dev --name add_expo_push_token
   (me mostre o diff e espere confirmação antes de rodar)
2. POST /api/notifications/register-push — autenticado, salva o token no usuário
3. Mobile: pede permissão no startup, captura o token, registra no backend
4. utils/push.util.ts — sendPushToUsers(userIds, title, body, data?) usando
   expo-server-sdk
5. Hook em VulnerabilityService.create: se severidade final é CRITICAL, dispara
   push para os CLIENT da company com token registrado.
   ⚠️ try/catch com log — falha de push NUNCA quebra a criação do finding.

CHECKPOINT 3 — Testes e smoke
PUSH-01: register-push salva o token no usuário
PUSH-02: criar finding CRITICAL chama o disparo (mock do envio; não bater na API
da Expo dentro do CI)
Smoke manual: abrir no Expo Go, logar, navegar até um finding, e criar um finding
CRITICAL pelo web para ver o push chegar no aparelho.
Protocolo §0.1 + relatório + PR.

NÃO FAZER: Firebase, mobile para PENTESTER ou ADMIN, viewer de PDF (cortado —
se sobrar tempo, um botão que abre o PDF no navegador do sistema resolve).
```

---

# FASE 8 — Maturidade (checklist) + fechamento do TCC

**Branch:** `feat/fase-8-maturidade-tcc` · **Período:** 16/10 → 25/10 · **Depende de:** Fase 6

```
Execute a Fase 8 do Vulnera — a última. Leituras de sempre.

ESCOPO DA MATURIDADE — SIMPLIFICADO (decisão de 2026-08-03):
É um CHECKLIST DE PERGUNTAS para avaliar o ambiente do cliente, não uma avaliação
SAMM completa. Estrutura: domínios → perguntas → resposta em escala simples.
NÃO implemente scoring ponderado, níveis de maturidade por domínio, nem
comparativo histórico. Média simples por domínio basta.

CHECKPOINT 1 — Maturidade backend
1. Estender prisma/seed.ts com os domínios e perguntas. Sugestão (ajuste se o
   Rafael tiver preferência): Gestão de Acesso · Backup e Recuperação ·
   Segurança de Rede · Gestão de Vulnerabilidades · Monitoramento e Logs ·
   Conscientização · Segurança no Código. 3 a 4 perguntas objetivas por domínio,
   respondíveis por quem conhece o ambiente. Ex. em Gestão de Acesso:
   "Existe MFA obrigatório para acessos administrativos?"
2. CRUD de MaturityAssessment (5 camadas):
   - POST /api/maturity/assessments — cria avaliação vazia para uma company
   - POST /api/maturity/assessments/:id/scores — batch [{controlId, score 1-5,
     notes?}]; recalcula a média geral
   - GET /api/maturity/assessments/:companyId/latest
   Só ADMIN preenche (RN19).
3. Testes MAT-01..03: batch persiste; latest devolve a mais recente;
   isolamento por company.

CHECKPOINT 2 — Maturidade frontend
pages/MaturityAssessment.tsx — lista de domínios na lateral, perguntas do domínio
ativo no centro com seletor 1–5 e campo de observação, média por domínio e média
geral, botão salvar (batch).
Radar Recharts de 7 eixos com a média por domínio.
Seção de maturidade no PDF executivo: tabela de médias por domínio + radar
desenhado à mão com pdf-lib (linhas e polígono por coordenada — o Recharts não
renderiza dentro do PDF).

CHECKPOINT 3 — Seed de demo TechNova
Esta é a demo que a banca vai ver. Estender o seed com dados verossímeis:
- 5 aplicações realistas (e-commerce, app mobile, API B2B, sistema interno,
  portal do cliente)
- 10 findings distribuídos: 2 CRITICAL, 3 HIGH, 3 MEDIUM, 2 LOW — descrições
  plausíveis, vectors CVSS reais, categorias OWASP variadas, pelo menos uma
  evidência anexada e comentários em alguns
- 1 avaliação de maturidade preenchida com respostas variadas
- 2 pentesters e 2 usuários CLIENT
O seed precisa ser idempotente (upsert) ou documentar o reset limpo.

CHECKPOINT 4 — Evidências de qualidade
1. Rodar o pipeline do SonarQube no GitHub Actions; capturar Quality Gate,
   cobertura e security hotspots em docs/evidencias/sonarqube/
2. OWASP ZAP baseline contra a stack local; relatório HTML em
   docs/evidencias/zap/
3. Corrigir o que for grave E barato. O que não for, listar como "limitações
   conhecidas" no README — isso RENDE na banca, demonstra maturidade de engenharia.

CHECKPOINT 5 — Documentação final
1. docs/DEMO.md — roteiro passo a passo da demo nos três perfis, com tempo
   estimado por passo (~10 min no total): landing → planos → onboarding →
   aprovação do admin → aplicação e projeto → pentester registra finding CRITICAL
   (push chega no celular) → evidência → relatórios PDF → maturidade → dashboards
2. README.md na raiz — pitch, stack, setup do zero (clone → docker → migrate →
   seed → três apps rodando), screenshots, diagrama de arquitetura em Mermaid,
   limitações conhecidas, trabalho futuro (IA, chat, tickets, observabilidade)
3. PRD_VIVO.md: todas as features ✅, progresso 100%, marco final
4. Atualizar docs/Vulnera/00-Hub/Contexto Mestre v4.md com o estado final

CHECKPOINT 6 — Encerramento
Rodar o docs/DEMO.md inteiro, do zero, cronometrando. Cada passo tem que
funcionar sem improviso — se algo falhar, conserte antes de seguir.
Depois: relatório final + PR para develop + PR develop → main + tag v1.0.0.
Sugira no relatório uma estrutura de slides (problema → solução → arquitetura →
demo → qualidade → lições aprendidas). Os slides o Rafael monta.

NÃO FAZER: qualquer feature nova. A Fase 8 é fechamento — bug fix, polimento,
documentação e demo. Escopo novo vira "trabalho futuro" no README.
```

---

## Prompt de retomada (sessão interrompida)

```
Retomando o Vulnera. Sessão na raiz do repositório.
1. Leia PRD_VIVO.md, rode `git status` e `git log --oneline -15`.
2. Abra o prompt da fase atual em docs/ROADMAP_PROMPTS.md e compare os
   checkpoints com o que existe de fato no código.
3. Me diga: checkpoints concluídos, checkpoint em andamento, próximo passo
   concreto. Não refaça o que já está pronto.
4. Continue de onde parou.
```

## Prompt de fechamento de fase

```
Fechar a fase atual do Vulnera:
1. cd app/api && npm run check ; cd ../web && npm run build
2. Rodar o smoke E2E do último checkpoint do prompt da fase
3. Protocolo CLAUDE.md §0.1 completo: PRD_VIVO (✅ + marco + %), docs/BACKLOG.md
   (tasks ✅), docs/ROADMAP_PROMPTS.md (badge + seção Histórico), Changelog do
   vault, ADR novo se houve decisão
4. Relatório §0.2 S5
5. Commits organizados + PR para develop com checklist na descrição.
   Liste as KANs do Jira correspondentes para eu mover para Done.
```

---

_Este arquivo é estável durante a execução. Quem rastreia o avanço é o `PRD_VIVO.md`. Ao concluir cada fase, acrescente aqui badge e histórico (CLAUDE.md §0.1 R3)._

---

# Fase 6.5 — Design System + Dashboards analíticos ✅ Concluída em 2026-08-09

> Fase inserida **entre a 6 e a 7**, de propósito: o mobile da Fase 7 herda os
> tokens definidos aqui em vez de inventar os próprios.

**Objetivo do prompt:** transformar o frontend utilitário em produto. Quatro
entregas: design system próprio com temas, biblioteca de componentes sem Radix,
camada de movimento, e dashboards analíticos por aplicação.

## Histórico

| Campo | Valor |
|---|---|
| Branch | `feat/fase-6.5-design-system` |
| PR | — (o prompt pediu explicitamente para **não** commitar nem abrir PR) |
| Data | 2026-08-09 |
| Testes | backend 225 → **247** · frontend 0 → **24** |

### O que foi entregue

- **CP0** auditoria com números: 11 componentes / 257 linhas, 3 importações de
  Radix (uma delas morta), zero agregação no backend.
- **CP1** `tokens.css` com 7 rampas OKLCH, escalas de tipografia/espaçamento/
  raio/elevação/movimento, 3 temas sem flash, `check-contrast.mjs` e
  `/styleguide`.
- **CP2** ~30 componentes próprios, Radix removido, contrato de acessibilidade
  por componente.
- **CP3** `motion` 13 com hook central de `prefers-reduced-motion` e 8 padrões.
- **CP4** 4 endpoints de métricas, histórico reconstruído do `AuditLog`,
  agregação no banco, 22 testes novos.
- **CP5** dashboard de 4 abas com 5 gráficos tematizados.
- **CP6** filtros na URL com filtragem cruzada e chips.
- **CP7** migração das 13 telas (parcial — ver desvios).
- **CP8** 24 testes de frontend; **validação no navegador bloqueada**.
- **CP9** ADRs 022-025, `DESIGN_SYSTEM.md` e docs vivos.

### Desvios do plano

1. **O prompt mandava `cd app/api && docker compose up`.** Não existe compose em
   `app/api` — o arquivo sempre esteve na raiz. Adaptado e registrado no ADR-022.
2. **CP7 ficou parcial.** As 13 telas usam os tokens e os componentes novos, e o
   build e os tipos estão limpos. Login, Register, Plans e o layout foram
   **reescritos** com skeleton, estado vazio e estado de erro. As demais
   receberam a migração mecânica (tokens, variantes, API dos componentes) mas
   **não** o polimento tela a tela que o CP7 pedia. Registrado como task 6.5.11
   em `docs/BACKLOG.md`.
3. **CP8 parcialmente bloqueado.** A extensão do Chrome não conectou (mesmo
   bloqueio da Fase 6). Substituído por validação headless: 24 testes com
   jsdom + `axe-core`, mais a medição matemática de contraste. Isso cobre
   acessibilidade e contraste, mas **não** cobre aparência real, responsividade
   nem console do navegador. Limitações L-10 e L-09 no `BACKLOG.md`.
4. **`Field` e `Label` coexistem.** O plano previa só `Field`; o `Label` avulso
   foi mantido para formulários que já controlam os próprios ids — igualmente
   correto em acessibilidade, só mais manual.

### Bugs encontrados e corrigidos durante a execução

| Onde | O quê |
|---|---|
| `tailwind.config.ts` | `borderWidth` e `borderColor` com a mesma chave `strong` faziam `border-strong` emitir largura **e** cor: todo `border border-strong` virava 2px em silêncio |
| `metrics.service.ts` | `{ applicationId, de, ate, ...opcoes }` — o spread sobrescrevia as datas com `undefined`. O Prisma ignora `undefined`, mas em SQL cru `>= NULL` não casa nada: risk score e aging zeravam sem erro |
| `metrics.service.ts` | lia `actor.companyId`, que **não existe no JWT** (`authMiddleware` popula só `{userId, role}`). Todo CLIENT recebia 403 |
| `use-focus-trap.ts` | usava `offsetParent === null` para checar visibilidade — errado para todo elemento `position: fixed`, ou seja, todo overlay |
| `tabs.tsx` | não funcionava sem controle externo nem `paramUrl`: os cliques chamavam um `aoMudar` inexistente |
