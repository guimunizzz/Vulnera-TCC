# Issue #51 — Etapa 3: endpoints públicos de acesso controlado

> Relatório final do recorte, atualizado em 2026-10-23. Etapa concluída e pronta para revisão/consolidação; Etapa 4 não iniciada.

## Ownership Registry

| Agente | Modelo / reasoning | Responsabilidade | Arquivos exclusivos | Resultado |
| --- | --- | --- | --- | --- |
| A | LUNA6 / HIGH | Harness SMTP real e evidência local isolada | `app/api/scripts/smoke-access-email.ts`; `output/issue51-mailhog-smoke.json` | APROVADA — 11/11 cenários por rodada; duas rodadas operacionais |
| B/C | LUNA6 / XHIGH | Contrato CAPTCHA, adapter Turnstile, rate limit e fixture/testes de proteção | `app/api/src/models/captcha.model.ts`; `app/api/src/adapters/turnstile-captcha.adapter.ts`; `app/api/tests/fixtures/fake-captcha-verifier.ts`; `app/api/src/services/access-request-rate-limit.service.ts`; `app/api/src/middlewares/access-request-rate-limit.middleware.ts`; `app/api/tests/integration/access-request-protections.test.ts` | APROVADA COM RESSALVAS — 8/8; adapter testado com fetch simulado, sem chamada real à Cloudflare |
| D | LUNA6 / MAX | Serviço/repositório e transações de AccessRequest e verificação | `app/api/src/services/access-request.service.ts`; `app/api/src/repositories/access-request.repository.ts`; `app/api/src/services/email-verification.service.ts`; `app/api/src/repositories/access-transaction.repository.ts` somente se necessário; `app/api/tests/integration/access-request-public-service.test.ts` | APROVADA — 12/12 |
| F | LUNA6 / XHIGH | Contratos HTTP de ponta a ponta e atualização de canário histórico | `app/api/tests/integration/access-request-public-http.test.ts`; `app/api/tests/integration/access-request.test.ts` (somente substituir as duas expectativas de 404 das rotas já implementadas e manter 404 de ativação futura) | APROVADA — 18/18; canário histórico ajustado, 404 de ativação futura preservado |
| G/E/H | LUNA6 / HIGH | Merge, instalação isolada, configuração, controller/factory/routes centralizadas, wiring do app e documentação | `app/api/src/config/enum/EnvKeys.ts`; `app/api/.env.example`; `app/api/package.json` e instalação sem edição manual de lockfile; `app/api/src/app.ts`; `app/api/src/config/rate-limit.config.ts`; `app/api/src/middlewares/rate-limit.middleware.ts`; `app/api/src/routes/routes.ts`; `app/api/src/config/turnstile.config.ts`; `app/api/src/config/access-request-rate-limit.config.ts`; `app/api/src/controllers/access-request.controller.ts`; `app/api/src/routes/access-request.routes.ts`; `app/api/src/factories/access-request.factory.ts`; este relatório; `PRD_VIVO.md`; `docs/BACKLOG.md`; `docs/ROADMAP_PROMPTS.md`; `docs/Vulnera/07-Decisoes/ADR-047 - Fundacao do acesso controlado.md`; `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md` | Build, lint focal, wiring e documentação aprovados |

O restante dos arquivos incorporados de `origin/dev` pertence à integração mecânica do merge, sem autorização para alterar funcionalidades fora dos caminhos G/E/H acima. `AGENTS.md`, schema, `tests/setup.ts`, endpoints de autenticação e cadastro existente não fazem parte desta frente.

Grafo de dependências: A valida o transporte consumido por D; B/C fornece verificação e limites para G/E/H e F; D fornece os contratos de domínio consumidos por G/E/H e F; G/E/H publica a interface de injeção e o wiring consumidos por F. A, B/C e D iniciaram trabalho em paralelo enquanto A preparava o smoke; as dependências foram integradas ao wiring conforme ficaram disponíveis. Foram cinco agentes únicos, com até três subagentes ativos além do root (limite do ambiente); todos trabalharam com full-history none. O Ownership Registry não tem sobreposição de arquivos entre agentes. Root coordenou e executou validações, sem editar fontes ou documentação.

## Estado e evidências de integração

- Base local: branch `refactor/security-auth-gated-access`, `HEAD=c9f731f`; merge sem commit de `origin/dev` (`MERGE_HEAD=44f9c58`).
- O merge trouxe uma exportação Excel com `ADR-047`, enquanto este branch já possui `ADR-047 - Fundacao do acesso controlado.md`. A colisão de numeração foi identificada e permanece fora do escopo; nenhum ADR foi renumerado.
- O responsável pela frente A informou execução do harness real contra MailHog: 11/11 verificações, exit 0. As contagens baseline/final de Users, Companies, Subscriptions, RefreshTokens e Invitations foram zero somente no banco descartável `issue51_smoke`; `vulnera_test` recebe fixtures das suítes e não compartilha essa afirmação. Evidência: `output/issue51-mailhog-smoke.json`. Isso não representa execução da suíte Jest.
- Tentativas iniciais sem cache/rede (`ENOTCACHED`) e no workspace completo (ERESOLVE em peer `react@undefined` do web) falharam; foram superadas pela instalação isolada da API, sem lockfile manual ou gerado.

## Smoke operacional MailHog — harness da frente A executado pelo root

O JSON registra uma rodada de 11 cenários; o root executou o harness duas vezes,
ambas com 11/11 PASS, e confirmou 24 mensagens no total pela API do MailHog.
Isto é validação operacional com MySQL/MailHog descartáveis; não é Jest. Os
testes Jest de HTTP usam CAPTCHA fake e os testes do adapter simulam `fetch`.

| Cenário | Esperado | Obtido | Status |
| --- | --- | --- | --- |
| Emissão, commit pré-SMTP, hash e mensagem | `SENT`; commit anterior ao SMTP; hash/TTL/evento e MIME corretos | `SENT`; persistência/ordem confirmadas e remetente, destino, assunto, text/html e fragmento validados | PASS |
| Token inválido, confirmação e replay | inválido=false; válido=true; replay=false; pedido verificado | inválido=false; válido=true; replay=false; estado, horário, consumo e trilha confirmados | PASS |
| Token expirado | confirmação false, sem consumo; pedido preservado | false; token não consumido e pedido preservado | PASS |
| Reenvio e rotação | token anterior recusado; atual aceito | dois envios; hash atual confirmou; anterior recusado | PASS |
| Confirmações concorrentes | uma verdadeira e outra falsa; estado `PENDING_REVIEW` | uma aceita e uma recusada; estado final correto | PASS |
| Confirmação concorrente com reenvio | ordem serial válida única; `PENDING_REVIEW` | reenvio serializado; token anterior recusado e atual aceito | PASS |
| Reenvios concorrentes | ambos serializados; somente hash atual utilizável | dois aceitos; só hash persistido confirmou; dois eventos de rotação | PASS |
| Falha SMTP e recuperação | falha => `DELIVERY_FAILED`, revogação/evento; MailHog reenvia | falha capturada, hash revogado/evento gravado e reenvio confirmado | PASS |
| Pedido expirado | `NOT_ELIGIBLE`, `EXPIRED`, sem token/e-mail | inelegível, `EXPIRED`, sem token/e-mail | PASS |
| Pedido já verificado | reenvio `NOT_ELIGIBLE`, sem mensagem nova | inelegível, nenhum e-mail adicional | PASS |
| Isolamento sem identidade/assinatura | User, Company, Subscription, RefreshToken e AccessInvitation inalterados | contagens idênticas ao início | PASS |

## Contratos HTTP implementados

Os endpoints públicos são `POST /api/access-requests`, `POST /api/access-requests/resend-verification` e `POST /api/access-requests/verify-email`. Pedido e reenvio respondem com o mesmo status 202 e a mesma mensagem neutra. Esse status também cobre `DELIVERY_FAILED` tratado pelo serviço; falha de persistência/cleanup que lança erro responde 500 genérico. Não há promessa de tempo constante: a chamada SMTP é síncrona depois do commit. A confirmação responde 200 quando o token é aceito e 400 `INVALID_VERIFICATION_TOKEN` nos demais casos. CAPTCHA obrigatório em request/resend, limites independentes do limiter global e ausência de bypass são requisitos da etapa.

Limitação conhecida: o cadastro público anterior segue fora desta etapa. Não existe constraint que imponha unicidade cruzada entre `User.email` e a reserva em `AccessRequest`; uma corrida entre o fluxo antigo e uma solicitação anônima permanece possível até a migração planejada do cadastro.

## Configuração e validação de entrada

`TURNSTILE_SECRET_KEY` é obrigatório quando o runtime público lazy é criado; `verifyUrl` é fixo em `https://challenges.cloudflare.com/turnstile/v0/siteverify`. `TURNSTILE_EXPECTED_HOSTNAME` e `TURNSTILE_EXPECTED_ACTION` são opcionais, e `TURNSTILE_TIMEOUT_MS` é inteiro estrito entre 1 e 10000 ms (default 5000). Ausência de segredo, configuração inválida, timeout ou resposta incoerente não libera a operação. A documentação oficial exige Siteverify no servidor; descreve token single-use válido por 300 segundos e limite de 2048 caracteres ([Cloudflare Turnstile — server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)).

Os limites default são buckets Token Bucket: `RATE_LIMIT_ACCESS_REQUEST_IP_MAX=5` dá burst 5 e refill 5/h (`RATE_LIMIT_ACCESS_REQUEST_IP_WINDOW_MS=3600000`); `RATE_LIMIT_ACCESS_RESEND_IP_MAX=10` dá burst 10 e refill 10/h (`RATE_LIMIT_ACCESS_RESEND_IP_WINDOW_MS=3600000`); `RATE_LIMIT_ACCESS_VERIFY_IP_MAX=30` dá burst 30 e refill 30/min (`RATE_LIMIT_ACCESS_VERIFY_IP_WINDOW_MS=60000`); `RATE_LIMIT_ACCESS_EMAIL_MAX=5` dá burst 5 e refill 5/dia (`RATE_LIMIT_ACCESS_EMAIL_WINDOW_MS=86400000`). São taxas de reposição, não janelas fixas ou cotas absolutas móveis. Tentativas com CAPTCHA válido consomem o bucket por e-mail mesmo quando não existe pedido ou conta elegível e não ocorre SMTP. `ACCESS_REQUEST_RESEND_COOLDOWN_MS=60000`; `RATE_LIMIT_ACCESS_STORE_MAX_KEYS=5000`. Os valores são validados como inteiros e os buckets usam storage dedicado, com TTL suficiente para refill completo e cooldown. Não dependem de `RATE_LIMIT_ENABLED`.

O limiter usa `req.ip` ou o endereço do socket; não lê `CF-Connecting-IP` nem `X-Forwarded-For` diretamente. `TRUST_PROXY_HOPS` continua default 0; configurá-lo só é seguro quando a aplicação recebe tráfego pelo número correspondente de proxies confiáveis. A suíte HTTP cobriu XFF ignorado com 0 e aceito quando um proxy é explicitamente confiado com 1. A configuração de proxy em produção não foi alterada.

Request aceita `name`, `companyName`, `email` e `phone` opcional; nome, empresa, telefone e e-mail têm limite de 191 caracteres. Email é trim/lowercase antes de validar com `isSingleEmailAddress`. Campos extras, como `status`, `companyId`, `userId` e `role`, são ignorados; o controller monta o DTO permitido. `captchaToken` de request/resend tem teto de 2048 caracteres. Confirmação só aceita `token` canônico de 43 caracteres base64url. `createApp({ accessRequestDependencies })` injeta service, verifier e limiter para testes sem adicionar rotas de teste; a composição real é criada pela factory apenas ao acessar o fluxo, mantendo import antigo do app sem SMTP/CAPTCHA env.

## Validação final da etapa

- `npm install --prefix app/api --workspaces=false --no-save --no-package-lock --prefer-dedupe --ignore-scripts --no-audit --no-fund`: exit 0, `added 186 packages` em quatro minutos. Nenhum lockfile foi escrito. `require.resolve` confirmou `jest`, `ts-jest`, `exceljs`, `yauzl` e `yazl` em `app/api/node_modules`. As tentativas anteriores sem acesso à rede/cache e no workspace completo falharam com `ENOTCACHED` e `ERESOLVE` por `react@undefined` no web; a instalação isolada resolveu a dependência sem `--force`/`--legacy-peer-deps`.
- `npm run build` em `app/api`: exit 0 após a integração G/E/H.
- `npx eslint` focal nos arquivos G de configuração, controller, factory, rotas e app: exit 0.
- `npm run check`: exit 1 no lint antes de Jest, exclusivamente por `UserEntity` e `UserResponseDTO` não usados em `src/services/vulnerability.service.ts:46` (2 erros, 0 avisos). Imports anteriores e fora de ownership; o Jest completo foi executado separadamente.
- Build TypeScript: exit 0. Suíte completa: **53/53 suítes, 960/960 testes, exit 0**, incluindo regressões de Auth/User/Company/Subscription/tenancy, DAST simulado e exportação Excel. Os testes focais incluíram 38 novos (domínio 12, proteções 8, HTTP 18) e 196 regressões. O teste histórico mantém 404 para ativação futura; duas expectativas de 404 para endpoints agora ativos foram atualizadas.
- Cobertura somente dos três services incluídos no comando: agregada **91,52% statements, 80% branches, 93,33% functions, 94,87% lines**. Rate limiter: 94,44% / 75% / 100% / 94,11%; AccessRequestService: 88,37% / 65% / 85,71% / 91,89%; EmailVerificationService: 91,83% / 86,79% / 93,75% / 96,47% (na mesma ordem). Não se afirma cobertura de branches >=80% para cada service.
- Harness real SMTP escrito pela frente A e executado duas vezes pelo orquestrador: 11/11 em cada rodada, exit 0; MailHog recebeu mensagens em ambas, total de 24 confirmado por consulta à API. No banco isolado `issue51_smoke`, as contagens baseline/final dos cinco modelos citados permaneceram zero. Isso é verificação operacional separada, não Jest e não valida CAPTCHA externo.
- Adapter Turnstile usa `fetch` simulado nos testes do adapter; o HTTP usa fake CAPTCHA injetado. Não houve chamada real à Cloudflare nesta etapa.
- Teste HTTP verificou que `X-Forwarded-For` é ignorado com `TRUST_PROXY_HOPS=0` e considerado somente com a configuração explícita de 1 hop confiável.
- O root aplicou/validou migrations nos dois schemas MySQL descartáveis `issue51_smoke` e `vulnera_test` e verificou 11 CHECKs enforced em cada um. As suítes usam `vulnera_test` para fixtures; as contagens baseline/final zero de User, Company, Subscription, RefreshToken e Invitation são somente do smoke em `issue51_smoke`. MailHog, MySQL descartáveis e MySQL da aplicação foram observados em execução e preservados; esta frente G/E/H não executou os testes DB.

**Classificação final:** A APROVADA. B/C APROVADA COM RESSALVAS: sem chamada real à Cloudflare; o runtime fail-closed e os contratos foram exercitados com testes simulados. A entrega integrada está pronta para revisão, com limitações de cadastro legado ativo, corrida cross-table, ausência de garantia de tempo constante e de outbox. O lint global ainda falha somente pelos dois imports antigos indicados. Etapa 4, revisão administrativa, convite/ativação e migração do cadastro legado permanecem pendentes.
