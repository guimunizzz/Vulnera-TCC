# Issue #51 — Fundação e hardening do domínio de acesso

Registro técnico de 2026-10-22. Consumidores: Rafael, revisores e próximas sessões.
O estado vigente é a Etapa 1.1 abaixo; a entrega inicial foi preservada como
histórico, incluindo seus resultados de testes e decisões posteriormente substituídas.

## Etapa 1.1 — estado vigente

Recorte: hardening do domínio e persistência, sem iniciar a implementação de
e-mail, EmailSender, SMTP, HTTP novo, frontend ou criação de User por convite.
Branch `refactor/security-auth-gated-access`, base `28c48ef`, sem commit/push.
Os seis arquivos não rastreados anteriores continuam fora da entrega.
Preflight desta execução: a árvore já continha a entrega 0–1 sem commit;
essas alterações relacionadas foram preservadas e endurecidas, sem incorporar
os seis arquivos alheios. Issue #51, AGENTS, PRD, ADR-047, documentação da
fundação, schema/migrations, models/repositories e testes foram consultados.

### Política definitiva desta etapa

- Estados: PENDING_EMAIL_VERIFICATION → PENDING_REVIEW → APPROVED → ACTIVATED;
  rejeição sai de PENDING_REVIEW e expiração sai de qualquer um dos três estados
  reservados. REJECTED, EXPIRED e ACTIVATED são terminais e liberam a reserva.
- Janela da solicitação: 7 dias para confirmar e-mail; 30 dias para revisão;
  7 dias após aprovação para ativar. `expiresAt` é persistido e muda apenas ao
  ingressar na etapa seguinte. Reenvio não prorroga a solicitação/aprovação.
- Token: até 1 hora para verificação e 48 horas para convite, limitados pelo
  prazo do pedido. Convite vencido não expira automaticamente uma aprovação
  ainda válida. Reemitir no mesmo pedido; ao vencer a aprovação, encerrar.
- Pedido sem token pode receber o primeiro slot enquanto válido. Token vencido
  admite rotação. Pedido abandonado vencido pode ser encerrado e substituído na
  mesma transação, preservando todas as tentativas. Não há worker automático.
- Reserva e histórico usam `utf8mb4_unicode_ci`, igual a User.email; armazenamento
  continua com trim/caixa baixa, preservando aliases e caracteres Unicode. O MySQL
  arbitra equivalências e duplicidades, inclusive sob concorrência.
- `createIfEmailAvailable` retorna NULL para conta já existente. ACTIVATED libera
  a reserva do pedido, mas não autoriza criar uma conta duplicada. Conta antiga
  excluída e histórico terminal permitem nova solicitação. Os casos A–G e suas
  operações estão detalhados no ADR-047, seção vigente da Etapa 1.1.

### Contratos e garantias

`createIfEligible` emite o primeiro slot apenas para estado/janela adequados.
`rotateIfAvailable` exige hash atual e revokedAt esperados, novo hash e prazo
válido. Atualiza emissão/validade e invalida o link antigo. Um slot consumido não
pode ser rotacionado; um comando antigo não desfaz revogação concorrente. Reemissão
intencional após revogação exige reler seu estado. Todo novo segredo deve ser
gerado novamente; não há ledger de todos os hashes retirados de circulação.

`revokeIfAvailable` e `consumeIfAvailable` são condicionais e devolvem booleano.
Todos esses caminhos, incluindo transições, bloqueiam o pedido com SELECT FOR
UPDATE antes de escrever no slot. O escopo transacional reutiliza o mesmo client;
erros ou false de operação obrigatória devem abortar o callback no futuro service.
Estados terminais revogam tokens não consumidos e liberam reserva com seu evento
na mesma transação. `createdAt` preserva o slot original, `issuedAt` identifica a
geração atual e `revokedAt` registra invalidação sem falsificar expiração.

No banco: índice único de reserva; NULL obrigatório nos estados terminais;
seis estados exatos; metadados, prazo e histórico coerentes; FKs RESTRICT;
hashes/slots únicos; datas de emissão/uso/revogação válidas e uso mutuamente
exclusivo de revogação. São 11 CHECKs enforced. TTL máximo e elegibilidade por
estado/janela do pai são aplicados pelos models/repositories com lock.

### Migration incremental

Nova `20261022160000_harden_access_request_lifecycle`. A inicial
`20261022120000_add_access_request_foundation` ficou byte a byte intacta
(SHA-256 `C9D54470653AD1ADA6A891928974CE260A76301A9B8BE0661491C8E57CFCD0A4`).
O histórico local só comprova aplicação anterior em descartáveis; escolheu-se
incremental para não depender de conhecer todos os ambientes externos.

O pré-check de collation recusa reservas equivalentes antes de DDL permanente,
sem escolher vencedor ou apagar dados. Backfill adiciona prazos aos quatro
estados antigos e issuedAt aos tokens, sem expirar pedidos silenciosamente.
Nenhuma coluna, dado ou collation de User foi alterada. Não houve reset/seed.

Validação exclusivamente em `vulnera-issue51-hardening-test`, imagem local mysql:8
(MySQL 8.4.11), sem volume existente, loopback `127.0.0.1:33353/vulnera_test`.
O banco recebeu as 15 migrations anteriores, fixtures anteriores ao upgrade e
depois a migration 16. `.env` e `.env.test` permaneceram intactos.
Ao terminar, somente esse container, confirmado por nome e label de finalidade,
foi parado; seus dados de teste eram mantidos em tmpfs descartável.

### Arquivos da Etapa 1.1

Três novos: migration incremental, `src/models/access-token.model.ts` e
`src/repositories/access-transaction.repository.ts`, todos em `app/api`.

Atualizados: schema; models AccessRequest/EmailVerificationToken/AccessInvitation;
os três repositories desses recursos; teste `access-request.test.ts`; ADR-047;
este relatório; PRD, BACKLOG, ROADMAP_PROMPTS e Changelog do Projeto.
São 17 arquivos nesta etapa. A árvore conjunta da Issue #51 tem 20 arquivos,
incluindo os três da fundação inicial que não mudaram nesta execução (migration
inicial, utilitária criptográfica e setup de testes). Nenhum arquivo alheio incluído.

### Validação da Etapa 1.1

| Verificação | Resultado desta execução |
| --- | --- |
| Prisma validate / generate | Aprovados, Client 6.19.3 |
| Upgrade real sobre migration anterior | Aprovado; todos os valores antigos de User/RefreshToken/AuditLog/AccessRequest/Event/tokens preservados |
| Pré-check SQL real de colisão | Acentos equivalentes recusados com ER_DUP_ENTRY antes de existir a nova coluna expiresAt |
| Backfill / metadata MySQL | Prazos e issuedAt válidos; 11 CHECKs enforced; três colunas de e-mail/reserva com a mesma collation |
| Build TypeScript | Aprovado |
| Lint focal | Aprovado nos models, repositories e teste alterados |
| Bateria de domínio anterior ao último reforço de CHECKs | 110/110; junto com Auth/User/Company/Subscription, 142/142 em cinco suítes |
| Domínio final, incluindo escritas diretas inválidas de datas | 112/112 aprovados na execução final; os 32 testes de regressão passaram na bateria anterior de cinco suítes |
| Regressões existentes | Auth/User/Company/Subscription: 32/32, sem alteração desses recursos |
| Estado/diff de migrations | 16 aplicadas; schema sem diferença representável no Prisma |
| Suíte global de 44 arquivos | Não executada nesta etapa; resultado histórico das Etapas 0–1 não é reutilizado como resultado do hardening |
| Check global | Lint global mantém os dois imports anteriores em vulnerability.service.ts:45; testes executados separadamente |

Falhas transitórias registradas separadamente: a primeira montagem manual do
harness de upgrade precisou corrigir divisão por ponto e vírgula em comentário
SQL e codificação Unicode do PowerShell; o SQL da migration não precisou mudar.
A primeira tentativa Jest executou as 32 regressões, mas não compilou a suíte
nova por união de delegates Prisma (TS2349) no teste de FKs; corrigido com chamadas
tipadas separadas. A rodada seguinte passou 101/101; a bateria ampliada passou
142/142; após os dois últimos casos de CHECKs, domínio final 112/112 e lint
focal aprovados novamente. Não houve falha funcional remanescente nesses resultados.

### Limites e prontidão

Primitivas preparadas para a Etapa 2; nenhuma implementação de e-mail iniciada.
A futura orquestração deve aplicar recuperação, enviar somente após commit,
tratar erros neutros e abortar transações em falha obrigatória. Não existem
SMTP, sender, endpoints, agendamento de expiração ou ativação com User.

O register antigo continua podendo criar User em paralelo ou depois da consulta
de disponibilidade; não existe índice único global entre tabelas. A futura
ativação deve respeitar o índice de User e reverter consumo/transição em conflito.
ACTIVATED isoladamente é uma primitiva, não prova de conta criada. SQL direto
privilegiado ainda pode reescrever histórico; a API interna não oferece isso.

## Histórico — entrega inicial das Etapas 0–1

As políticas e limites abaixo descrevem a entrega original, substituídos onde
indicado pelo estado vigente acima; seus resultados históricos foram preservados.

## Preflight

- Branch: `refactor/security-auth-gated-access`.
- Working tree inicial: nenhum arquivo rastreado alterado. Seis arquivos não
  rastreados anteriores preservados: `Discovery-Planejamento-Issue-19-Vulnera.md`,
  `Discovery-Planejamento-Issue-20-Vulnera.md`, `output/issue-19-pr-dev.md`,
  `output/issue-20-close-issue.md`, `output/issue-20-pr.md`, `repomix-output.xml`.
  Seus caminhos não colidem com esta entrega. Dumps repomix não foram lidos.
- A pedido do usuário, `git fetch origin dev` encontrou 32 commits novos.
  A dev local e a branch da issue avançaram por fast-forward de `e5d3411` para
  `28c48ef`, sem conflito, novo commit ou push. HEAD e origin/dev ficaram iguais.
- `origin/main` também foi consultada: `3c69181`, com 1 commit exclusivo de main
  e 7 exclusivos de HEAD (`git rev-list --left-right --count origin/main...HEAD`).
  A main local antiga ficou preservada; não foi usada como base da implementação.
- Lidos PRD, AGENTS, Contexto Mestre, arquitetura Express/MySQL, decisões
  pertinentes e os sete arquivos da inspeção dirigida. Esses sete arquivos,
  package.json, schema e migrations não mudaram na atualização da dev.
- Node 24.19.0, npm 11.17.0, Prisma/Client 6.19.3 e dependências locais já
  disponíveis. Nenhuma instalação de dependência ou edição de lockfile.
- Docker inicialmente parado. Inicializado em background; usados dois containers
  exclusivos com imagem local `mysql:8` (MySQL 8.4.11), sem volumes existentes.
  Primeiro: `vulnera-issue51-test`, porta 33351. Validação final:
  `vulnera-issue51-final-test`, porta 33352, banco `vulnera_test`, somente loopback.
  O primeiro foi parado antes da segunda execução. Não foi iniciada a stack da aplicação.
- `.env` local aponta a `localhost:3307/vulnera`; `.env.test` originalmente
  aponta a `localhost:3307/vulnera_test`. Ambos preservados. Cada comando de
  integração recebeu DATABASE_URL explícita para o container exclusivo e
  NODE_ENV=test/BCRYPT_COST=4. Nenhuma migration, reset ou seed nesses bancos existentes.

## Decisões e invariantes

A decisão completa está no [ADR-047](Vulnera/07-Decisoes/ADR-047%20-%20Fundacao%20do%20acesso%20controlado.md).

1. Quatro estados: verificação pendente → revisão pendente → aprovado/rejeitado.
   Sem estado de User ou Company dentro do pedido.
2. E-mail normalizado com trim/caixa baixa; preserva pontos, aliases e acentos.
3. `activeEmail UNIQUE` + CHECK obrigatório limita a um pedido reservado por
   e-mail. PENDENTES e APPROVED reservam; REJECTED libera a chave com NULL.
   `email` continua indexado sem unicidade permanente.
4. Rejeição preserva o pedido e seus eventos; nova tentativa cria outra linha.
5. `AccessRequestEvent` aceita visitante sem User. FK quando há ator real,
   revisão com ator obrigatório e sem alterar `AuditLog`.
6. Duas tabelas de tokens, cada uma com hash único e um slot por pedido.
   Segredos de 256 bits na utilitária; DB guarda apenas hash, validade e uso.
7. CHECKs protegem estados exatos, normalização/chave ativa, metadados de
   verificação/revisão, formato de hash, datas e formato da trilha. FKs RESTRICT
   impedem órfãos e preservam referências históricas. Existem 10 CHECKs enforced.
8. Criação e evento usam nested write; transição e evento usam transação e
   UPDATE condicional pelo estado de origem. Consumo usa UPDATE condicional por
   hash, expiração, ausência de uso e estado do pai. Repositories podem participar
   da mesma transação Prisma; as operações correspondentes têm testes concorrentes.
9. User não recebe novas colunas, defaults ou backfill. Contas atuais continuam
   válidas sem pedido ou convite. Access approval e Subscription approval continuam
   separadas; CNPJ não é usado como autenticação ou antiabuso.

## Arquivos

| Tipo | Arquivos |
| --- | --- |
| Schema alterado | `app/api/prisma/schema.prisma` |
| Migration nova | `app/api/prisma/migrations/20261022120000_add_access_request_foundation/migration.sql` |
| Models novos | `app/api/src/models/access-request.model.ts`, `email-verification-token.model.ts`, `access-invitation.model.ts` |
| Repositories novos | `app/api/src/repositories/access-request.repository.ts`, `email-verification-token.repository.ts`, `access-invitation.repository.ts` |
| Utilitária nova | `app/api/src/utils/access-token.util.ts` |
| Testes | Novo `app/api/tests/integration/access-request.test.ts`; alterado `app/api/tests/setup.ts` para cleanup em ordem de FK e guarda do banco |
| Decisão e relatório novos | ADR-047 e este documento |
| Documentação viva alterada | `PRD_VIVO.md`, `docs/BACKLOG.md`, `docs/ROADMAP_PROMPTS.md`, `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md` |

Sem service de fluxo, controller, factory ou rota nova. A migration cria somente
`AccessRequest`, `EmailVerificationToken`, `AccessInvitation` e `AccessRequestEvent`,
com índices/FKs/CHECKs nas tabelas novas. As relações adicionadas a User no schema
Prisma não produzem ALTER TABLE User.

## Validação

| Verificação | Resultado |
| --- | --- |
| Baseline Prisma validate | Aprovado |
| Baseline TypeScript build após atualização da dev | Aprovado |
| Baseline Auth/User/Company/Subscription | 32/32 testes em 4 suítes |
| Baseline lint | Dois erros preexistentes em `vulnerability.service.ts:45` (`UserEntity`, `UserResponseDTO`) |
| Schema final Prisma validate e generate | Aprovados, Client 6.19.3 |
| Migration no banco exclusivo | Aplicada após as 14 migrations anteriores; revisão final também aplicada em outro banco exclusivo com baseline limpa |
| Preservação na migration final | 3 Users (ADMIN/PENTESTER/CLIENT), 1 RefreshToken e 1 AuditLog criados antes; todos os campos, hashes e timestamps idênticos depois |
| Constraints efetivas | 10 CHECKs com ENFORCED=YES no information_schema |
| Testes focais iniciais | 48/48 antes do caso adicional de espaços finais em estados |
| Domínio final | 49/49 na suíte completa, incluindo espaços finais em estados |
| Suíte completa API no sandbox | 692/697 testes em 44 suítes; cinco falhas nas duas suítes DAST detalhadas abaixo |
| Repetição focal DAST | 104/104 nas duas suítes, fora do sandbox e com timeout global de 30 min; inclui as cinco falhas anteriores |
| Build TypeScript final | Aprovado |
| ESLint dos arquivos novos e setup/testes alterados | Aprovado, sem avisos |
| `npm run check` global | Para no lint pelos mesmos dois imports anteriores; testes executados separadamente |
| Guarda de testes | Banco fictício em porta fechada recusado com UNSAFE_TEST_DATABASE antes de qualquer cleanup |
| Estado das migrations | 15 migrations aplicadas; `migrate status` atualizado e `migrate diff --exit-code` sem diferenças representáveis pelo Prisma |

A execução completa levou 472,506 s. As falhas foram DAST-LIFE-04 (`spawn EPERM`),
DAST-STAT-01 e ordem da rota `/status` (HTTP 500 ao consultar Docker no sandbox),
mais dois casos unitários do Spider (progresso e prazo de descoberta). Estes
últimos herdaram `DAST_SCAN_TIMEOUT_MS=3000` do `.env.test` local: o primeiro
precisa aguardar consultas com intervalos e o segundo avança o relógio 61 s para
verificar o prazo próprio do Spider, ultrapassando antes o timeout global de 3 s.
Os arquivos DAST estão idênticos à baseline `28c48ef`.

A repetição das duas suítes usa o mesmo banco exclusivo, fora do sandbox, com
`DAST_SCAN_TIMEOUT_MS=1800000` apenas no processo. Os testes de integração
continuam em modo simulado e o runner unitário mantém mocks de Docker/HTTP;
nenhum scan real é iniciado. O `.env.test` permanece intacto. Isso não transforma
o comando global original em verde: seu resultado inicial e o bloqueio de lint
permanecem registrados separadamente.

A repetição terminou em 77,402 s, com 2/2 suítes aprovadas. Todos os 697 casos
passaram ao menos uma vez entre a execução completa e a repetição focal; não se
declara uma execução única da suíte completa verde. Os containers descartáveis
foram parados ao final; nenhum container/volume de ambiente existente foi alterado.

Comandos de integração executados em `app/api`, sempre com ambiente explícito
do banco exclusivo: `npm test -- --runTestsByPath ...`, `npm test -- --silent` e
`prisma migrate deploy`. Build/lint/check via workspace da API. O download do
engine Prisma exigiu execução fora do sandbox por bloqueio de rede; não houve
upgrade de versão. O aviso da configuração legada `package.json#prisma` permanece.

## Limites e próxima etapa

- A garantia de exclusividade cobre cada primitiva implementada. Verificação
  completa, aprovação+convite e consumo+criação de User ainda não são jornadas
  implementadas. O futuro service deve uni-las em transação e abortar se o CAS
  devolver false. Não declarar o acesso controlado ativado em produção.
- A criação interna de convite ainda não exige pai APPROVED no banco; o consumo
  exige esse estado. Papel ADMIN é regra de domínio, não constraint de FK.
  A trilha é append-only pelos repositories, não por permissões SQL administrativas.
- Sem reemissão/rotação, revogação, cancelamento/expiração de pedidos, SMTP,
  Turnstile, políticas novas de rate limit, UI, ativação ou novas credenciais.
- `POST /api/auth/register`, AuthService.register, login/refresh/logout,
  CompanyService, SubscriptionService, onboarding e landing continuam intactos.
- A Etapa 2 deve começar somente após revisão desta fundação. Primeiro definir
  a orquestração de verificação/revisão/convite e os erros neutros, preservando
  as transações e factories ao introduzir rotas. Não avançada nesta execução.
- Nenhum commit, push, PR ou atualização da issue foi realizado automaticamente.
