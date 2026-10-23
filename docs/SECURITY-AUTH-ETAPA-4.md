# Issue #51 — Etapa 4: fila administrativa e convites

> Relatório final do recorte, concluído em 2026-10-23. Etapa 4: 100%, aprovada com ressalvas e pronta para revisão. Etapa 5 não iniciada.

## Ownership Registry

| Frente | Modelo / reasoning | Responsabilidade | Arquivos exclusivos | Resultado focal |
| --- | --- | --- | --- | --- |
| A/B | LUNA6 / XHIGH | DTOs sanitizados, consultas e autorização ADMIN atual | `app/api/src/models/admin-access-request.model.ts`; `app/api/src/repositories/admin-access-request.repository.ts`; `app/api/src/services/admin-access-request-query.service.ts`; `app/api/src/services/access-request-admin-authorization.service.ts`; `app/api/src/middlewares/access-request-admin.middleware.ts`; `app/api/tests/integration/admin-access-request-authorization.test.ts` | 2/2 |
| C | LUNA6 / MAX | Decisão transacional de aprovação/rejeição | `app/api/src/services/admin-access-request-decision.service.ts`; `app/api/src/repositories/access-request.repository.ts` (somente novos métodos transacionais para decisão/auditoria); `app/api/tests/integration/admin-access-request-decision.test.ts` | 12/12 |
| D | LUNA6 / XHIGH | Slot de convite, rotação/reenvio, template e entrega | `app/api/src/models/access-invitation.model.ts`; `app/api/src/repositories/access-invitation.repository.ts`; `app/api/src/services/access-invitation.service.ts`; `app/api/src/utils/access-invitation-message.util.ts`; `app/api/tests/integration/access-invitation-delivery.test.ts` | 12/12 |
| F | LUNA6 / XHIGH | Contrato HTTP e autorização ponta a ponta | `app/api/tests/integration/admin-access-request-http.test.ts` | 9/9 |
| E/G/H | LUNA6 / HIGH | Configuração, controller, factory, rotas/wiring e documentação | `app/api/src/controllers/admin-access-request.controller.ts`; `app/api/src/routes/admin-access-request.routes.ts`; `app/api/src/factories/admin-access-request.factory.ts`; `app/api/src/config/access-invitation.config.ts`; `app/api/src/app.ts`; `app/api/src/routes/routes.ts`; `app/api/src/config/enum/EnvKeys.ts`; `app/api/.env.example`; este relatório; `PRD_VIVO.md`; `docs/BACKLOG.md`; `docs/ROADMAP_PROMPTS.md`; `docs/Vulnera/07-Decisoes/ADR-047 - Fundacao do acesso controlado.md`; `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md` | Build, Prisma, lint focal e wiring aprovados |

Total de cinco subagentes nesta etapa (`/root/protections`, `/root/domain`, `/root/invitation`, `/root/http_tests`, `/root/integration`), todos `gpt-6-luna`, com reasoning XHIGH/MAX/HIGH conforme tabela; máximo três subagentes simultâneos além do root. A/B, C e D começaram em paralelo; F e G integraram os contratos depois. Ownership não se sobrepôs; o root coordenou e validou, sem editar nenhum dos 29 arquivos do registry. Entrega: 29 arquivos, 23 API (18 `src`, quatro testes, `.env.example`) e seis docs; 17 novos e 12 existentes. Baseline: build aprovado e 176/176 testes em cinco suítes; Prisma validate/generate aprovados. A fixture MySQL corrigida alinhou `createdAt`/`issuedAt` ao relógio fixo e deixou `expiresAt` posterior.

### Matriz de ownership e dependências por arquivo

| Arquivo | Proprietário / reasoning | Dependências principais |
| --- | --- | --- |
| `app/api/src/models/admin-access-request.model.ts` | `/root/protections` · XHIGH | Schema Prisma e DTOs seguros consumidos por consulta, service e controller. |
| `app/api/src/repositories/admin-access-request.repository.ts` | `/root/protections` · XHIGH | Model/Prisma; consumido pelo service de consulta. |
| `app/api/src/services/admin-access-request-query.service.ts` | `/root/protections` · XHIGH | Repository de consulta, model sanitizado e autorização ADMIN. |
| `app/api/src/services/access-request-admin-authorization.service.ts` | `/root/protections` · XHIGH | `UserRepository.findById`; usado pelo middleware e services administrativos. |
| `app/api/src/middlewares/access-request-admin.middleware.ts` | `/root/protections` · XHIGH | Authorization service; encaixado nas rotas após JWT/role. |
| `app/api/tests/integration/admin-access-request-authorization.test.ts` | `/root/protections` · XHIGH | Middleware, authorization service e banco de teste. |
| `app/api/src/services/admin-access-request-decision.service.ts` | `/root/domain` · MAX | Repository de AccessRequest, convite, autorização e relógio; compartilha transação de aprovação. |
| `app/api/src/repositories/access-request.repository.ts` | `/root/domain` · MAX | Métodos transacionais adicionais para decisão/auditoria, consumidos pelos services C/D. |
| `app/api/tests/integration/admin-access-request-decision.test.ts` | `/root/domain` · MAX | Service de decisão, repositories e banco de teste. |
| `app/api/src/models/access-invitation.model.ts` | `/root/invitation` · XHIGH | Schema/DTO do convite; usado pelo repository e service de convite. |
| `app/api/src/repositories/access-invitation.repository.ts` | `/root/invitation` · XHIGH | Model e client transacional fornecido pela camada de repository. |
| `app/api/src/services/access-invitation.service.ts` | `/root/invitation` · XHIGH | Repository de convite/pedido, sender, autorização, URL pública e cooldown; chamado por C e controller. |
| `app/api/src/utils/access-invitation-message.util.ts` | `/root/invitation` · XHIGH | Conteúdo/template de convite consumido pelo service D. |
| `app/api/tests/integration/access-invitation-delivery.test.ts` | `/root/invitation` · XHIGH | Service D, fake sender e banco de teste. |
| `app/api/tests/integration/admin-access-request-http.test.ts` | `/root/http_tests` · XHIGH | App/rotas/factory injetáveis e serviços/repos; testa contratos HTTP integrados. |
| `app/api/src/controllers/admin-access-request.controller.ts` | `/root/integration` · HIGH | Services A/C/D; valida entrada, mapeia erros e serializa allowlists. |
| `app/api/src/routes/admin-access-request.routes.ts` | `/root/integration` · HIGH | Controller/factory, JWT, limiter e autorização ADMIN; montado pelo centralizador. |
| `app/api/src/factories/admin-access-request.factory.ts` | `/root/integration` · HIGH | Repository → services → controller; configuração SMTP lazy para decisões que enviam convite. |
| `app/api/src/config/access-invitation.config.ts` | `/root/integration` · HIGH | `EnvKeys`/`EnvVar`; lida pela factory para cooldown estrito. |
| `app/api/src/app.ts` | `/root/integration` · HIGH | Express e `makeApiRoutes`; expõe injeção opcional sem quebrar consumidores existentes. |
| `app/api/src/routes/routes.ts` | `/root/integration` · HIGH | Registro único; recebe rotas administrativas e dependências opcionais. |
| `app/api/src/config/enum/EnvKeys.ts` | `/root/integration` · HIGH | Chave `ACCESS_INVITATION_RESEND_COOLDOWN_MS` consumida pela configuração. |
| `app/api/.env.example` | `/root/integration` · HIGH | Documenta a variável definida em EnvKeys/config. |
| `docs/SECURITY-AUTH-ETAPA-4.md` | `/root/integration` · HIGH | Consolida contratos, ownership, dependências, resultados e limites desta matriz. |
| `PRD_VIVO.md` | `/root/integration` · HIGH | Resultados finais deste relatório; marca SEC-AUTH-4 feito e SEC-AUTH-5+ futuro. |
| `docs/BACKLOG.md` | `/root/integration` · HIGH | Mesmo estado do PRD em forma de backlog/histórico. |
| `docs/ROADMAP_PROMPTS.md` | `/root/integration` · HIGH | Contrato da etapa, badge de conclusão e histórico branch/merge/validação. |
| `docs/Vulnera/07-Decisoes/ADR-047 - Fundacao do acesso controlado.md` | `/root/integration` · HIGH | Decisões vigentes de autorização, transação, auditoria e limites. |
| `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md` | `/root/integration` · HIGH | Registro cronológico de conclusão e evidências confirmadas. |

Fluxo entre frentes: A/B fornece consulta e autorização; C e D compartilham o
contrato transacional do pedido; os contratos C/D alimentam a integração HTTP de
F e G. Factory/config/rotas compõem as dependências para a suíte HTTP; testes e
validações concluídos alimentam os seis documentos. Cada arquivo da matriz teve
um único proprietário.

## Escopo e contratos

Endpoints sob `/api/admin/access-requests`:

- `GET /` lista com paginação, `page=1`, `pageSize=20` por padrão (máximo 100) e status opcional; sem status, lista `PENDING_REVIEW`.
- `GET /:id` retorna detalhe sanitizado, incluindo apenas datas do convite.
- `GET /:id/events` pagina eventos em ordem cronológica sem hashes.
- `POST /:id/approve`, `POST /:id/reject` e `POST /:id/resend-invitation` executam decisões/reenvio.

Todas as rotas exigem `authRateLimitMiddleware`, `requireRole("ADMIN")` e validação do papel ADMIN atual no banco. O middleware de autorização também é reutilizado nos services para cobrir chamadas que não passem pelo HTTP. Controllers validam ID, página, tamanho/status e motivo de rejeição; não duplicam validação no service. Respostas são DTOs allowlisted sem token, hash ou linha Prisma. Erros previstos: pedido ausente 404; transição inválida, expirada, e-mail não verificado ou convite usado 422; conflito com User existente 409; cooldown 429 com `Retry-After`; falha inesperada 500 genérico.

A aprovação transiciona e prepara token/hash/auditoria no mesmo transaction context; só envia SMTP depois do commit. Falha de configuração ou preparação antes do commit não deixa aprovação parcial. Falha de entrega é representada como `DELIVERY_FAILED`, sem expor credencial, e o serviço revoga o token preparado. Rejeição aceita motivo opcional/null, trim e limite de 2000 caracteres.

Factory Method registra as rotas somente no centralizador `routes/routes.ts`. `createApp({ adminAccessRequestDependencies })` permite injetar doubles HTTP. O runtime padrão é lazy por app: consultas e rejeição não carregam SMTP. `ACCESS_INVITATION_RESEND_COOLDOWN_MS` tem default estrito de 60000 ms; o link de convite usa `PUBLIC_WEB_URL/activate-account#token=...`, sem introduzir frontend ou rota de ativação.

## Decisões e limites

- Não há schema nem migration nesta etapa. Transições de aprovação, rejeição e expiração são `STATUS_TRANSITION` em `AccessRequestEvent`; eventos de convite `ISSUED`, `REISSUED` e `DELIVERY_FAILED` são gravados no `AuditLog` existente com ator ADMIN, pois não cabem no CHECK de `AccessRequestEvent`.
- Nenhum endpoint consome convite, cria User/JWT/Company/Subscription ou faz cutover do cadastro público legado. Etapa 5/ativação continua pendente.
- Registro do estado atual: merge de `origin/dev` em `9f7e23a`; Etapas 2–4 consolidadas em commit local separado, sem push. Os três outputs das Issues #19/#20 ficaram fora da consolidação. No inventário prévio, 25 dos 35 hashes locais permaneceram iguais; 10 foram alterados apenas pelos owners autorizados em wiring, documentação e repository compartilhado. Os seis itens alheios permaneceram inalterados.
- Imports antigos `UserEntity` e `UserResponseDTO` em `vulnerability.service.ts:46` continuam fora do escopo.

## Validação final coordenada

- Build TypeScript: PASS. Lint focal em 22 caminhos alterados: PASS. Prisma
  validate/generate: PASS. Regressões e correção de C passaram 7/7 suítes,
  245/245 testes em 138,257 s.
- Quatro suítes novas: **4/4 suítes, 35/35 testes PASS, 60,965 s** — A/B 2,
  C 12, D 12 e F 9. A fixture MySQL da primeira rodada foi corrigida para
  `createdAt`/`issuedAt` alinhados ao relógio fixo, com `expiresAt` posterior.
  Rejeição de pedido expirado persiste estado `EXPIRED` antes de responder 422;
  rollback real após falha ao gravar AuditLog foi verificado. O parser HTTP aceita CUIDs
  reais do schema; rejeição valida body JSON não objeto e offset de paginação.
- Coverage dos quatro services: **88,26% statements, 68,49% branches, 96,77%
  functions e 95,03% lines**. Branch coverage agregada é 68,49%, abaixo de 80%.
  Lines por service: decisão C 92,72%, convite D 95,23%, query e autorização
  100% cada. O valor de branches permanece abaixo de 80%, sem mascarar a
  cobertura parcial.
- Suíte completa: **57/57 suítes, 995/995 testes PASS, 454,05 s, exit 0**. Inclui
  regressões Auth/login/refresh/logout/register, Company/Subscription,
  RBAC/tenancy, DAST e exportação Excel, além das Etapas 1–4.
- `npm run check`: exit 1 somente pelos imports antigos `UserEntity` e
  `UserResponseDTO` não usados em `src/services/vulnerability.service.ts:46`;
  o script encerrou no lint e não executou Jest. O comando de Jest separado
  passou com 57/57 suítes e 995/995 testes.
- Os testes SMTP desta etapa usam `FakeEmailSender`; não houve smoke real
  MailHog. O container MailHog permaneceu preservado.
- Testes de integração/DB e a suíte completa foram executados pelo orquestrador
  no `vulnera_test` isolado em MySQL descartável/tmpfs, porta 33354. Esta frente
  não executou testes DB/Jest, limpeza de dados ou containers. O banco de app
  na porta 3307 não foi tocado; os serviços e dados descartáveis foram
  preservados pelo root.

Limites ainda válidos: sem outbox, uma queda após o commit e antes do envio pode
deixar convite preparado sem mensagem; o reenvio administrativo recupera esse
caso. Cadastro público legado continua ativo e a corrida de unicidade cruzada
entre `User` e `AccessRequest` só termina no cutover futuro. Não há ativação nem
criação de User/JWT nesta etapa. A Etapa 4 está concluída (100% do recorte), sem
blocker próprio; ressalvas são limites aceitos do escopo. Merge de `origin/dev`
em `9f7e23a`; Etapas 2–4 consolidadas em commit local separado, sem push. Os
três outputs das Issues #19/#20 ficaram fora. Do inventário de 35 hashes, 25 ficaram
iguais e 10 foram alterados pelos owners autorizados; os seis itens alheios
permaneceram inalterados.
