---
type: decisao
tags: [decision, security, auth, access-request]
status: vigente
codigo: ADR-047
data: 2026-10-22
---

# ADR-047 - Fundação do acesso controlado

## Contexto

A Issue #51 determina substituir o cadastro público por solicitação, verificação
de e-mail, revisão administrativa e convite. As Etapas 0, 1 e 1.1 estabeleceram
e endureceram o domínio; a Etapa 2 adicionou emissão/reenvio e confirmação de
e-mail, sem HTTP, proteção do cadastro, revisão, convite ou ativação. Portanto o
fluxo público antigo continua operacional até etapas futuras. O banco real é
MySQL, com Prisma 6.19.3; `AuditLog.actorId` é obrigatório e referencia `User`.

> **Atualização de 2026-10-22:** o lifecycle, a reserva, a collation e as
> primitivas de tokens da Etapa 1.1 permanecem a base vigente do domínio; o
> contrato e o resultado da verificação por e-mail estão na seção **Etapa 2**.
> Decisões das Etapas 0–1 permanecem históricas onde foram substituídas.

## Decisão inicial — Etapas 0–1 (substituída pela Etapa 1.1)

### Ciclo de vida e e-mail

- `AccessRequest` não é `User`, não tem senha, JWT, Company ou Subscription.
- Máquina de estados: `PENDING_EMAIL_VERIFICATION → PENDING_REVIEW → APPROVED | REJECTED`.
  A entidade centraliza as transições; revisão exige contexto ADMIN. O futuro
  service deverá resolver esse ator autenticado no servidor, nunca pelo body.
- `APPROVED` e `REJECTED` são decisões terminais. Ativação/expiração do convite
  não acrescentam estados redundantes ao pedido. A aprovação continua reservando
  o e-mail; reemissão futura usa o mesmo pedido. Expiração/cancelamento de pedidos
  ainda não foram implementados.
- Normalização exclusiva do novo domínio: `trim().toLowerCase()`. Não remover
  pontos, aliases `+` ou acentos; não reescrever e-mails dos usuários existentes.
  Limite de armazenamento: 191 caracteres, alinhado a `User.email`.
- `email` não é unique. `activeEmail` é unique e deve ser igual ao e-mail
  normalizado nos dois estados pendentes e em APPROVED; deve ser NULL em REJECTED.
  O `CHECK` torna essa duplicação consistente mesmo em escritas diretas. O índice
  arbitra inserções concorrentes e múltiplos NULL permitem histórico de rejeições.
- Comparações binárias protegem normalização, estados exatos e igualdade da chave.
  A collation binária dos e-mails evita fundir endereços que diferem em acentos.
  `IS NULL`/`IS NOT NULL` explícitos evitam aceitar UNKNOWN nos `CHECK`s.

### Tokens e convites

- `EmailVerificationToken` e `AccessInvitation` têm tabelas distintas, hash
  SHA-256 hexadecimal único, expiração, `usedAt` e FK obrigatória para o pedido.
- Um slot por pedido em cada tabela (`accessRequestId @unique`). A futura
  reemissão deverá substituir o hash de forma transacional, invalidando o link
  anterior. Rotação, revogação, envio e TTL de produto ainda não foram implementados.
- A utilitária gera 32 bytes criptograficamente aleatórios, codificados em
  base64url. Só o hash é aceito pelos DTOs de persistência; não registrar segredos.
- O banco valida formato de hash e coerência das datas. Entropia do segredo e
  correspondência segredo/hash são responsabilidades do emissor, não do banco.
- Consumo é `UPDATE ... WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?`,
  condicionado também ao estado do pai (inicial para verificação, APPROVED para
  convite). Retorna se exatamente uma linha foi alterada. O relógio deve vir do
  servidor. Nenhuma dessas primitivas cria User ou emite JWT.

### Histórico e transações

- `AccessRequestEvent` registra criação e transições (origem, destino, data,
  motivo opcional e ator). `actorId` NULL representa a ação anônima; quando
  informado, precisa referenciar um User real. Revisões exigem ator não nulo.
- `AuditLog` permanece intacto. Nenhum usuário fictício e nenhuma FK enfraquecida.
  O repository da trilha oferece leitura e inserção acoplada ao pedido, sem
  update/delete. Isso é append-only pela API interna, não uma proibição de DELETE
  para administradores SQL. FKs RESTRICT preservam referências históricas.
- Criação usa nested write de pedido+evento. Transições usam atualização
  condicional pelo estado de origem e inserção de evento na mesma transação;
  somente o vencedor registra o evento. Falha na trilha reverte a mudança.
- `AccessRequestRepository.transaction` fornece os três repositories ligados ao
  mesmo `TransactionClient`, sem expor Prisma a services. Transações já abertas
  são reutilizadas. O futuro service deve lançar erro se uma operação necessária
  devolver false, para reverter o conjunto; não basta retornar false após consumo.
- Eventos de envio/rotação/ativação e sua política de retenção permanecem para as
  etapas correspondentes. Nesta entrega a trilha cobre criação/estado do pedido;
  os tokens registram apenas suas datas de criação, expiração e uso.

### Limites das garantias

O banco garante unicidade da reserva, relações, estados e metadados coerentes,
formato/datas dos tokens e formato válido das transições da trilha. O repository
garante atomicidade da transição com o evento e exclusividade de cada consumo.

Não há garantia de fluxo completo: a criação de um convite ainda pode ser feita
internamente para pedido não aprovado, embora seu consumo seja recusado. A futura
aprovação deverá criar o convite dentro da mesma transação da decisão. O banco
não verifica `User.role = ADMIN`, não exige que a gravação direta de um pedido
tenha evento, nem protege contra SQL administrativo que reescreva o histórico.
Verificação + transição e consumo + criação de User ainda não são operações
implementadas; nenhum teste declara essas jornadas concluídas.

### Compatibilidade e migração

- Migration somente aditiva: quatro tabelas novas; User recebe apenas relações
  virtuais no schema Prisma, sem novas colunas, backfill ou mudança de defaults.
- Contas ADMIN, PENTESTER e CLIENT existentes continuam usando login/refresh/logout
  sem AccessRequest. Nenhuma normalização retroativa ou invalidação de sessão.
- Aprovação de acesso e aprovação de Subscription continuam decisões distintas.
  Company só será criada após ativação no onboarding autenticado, em etapa futura.
  CNPJ não participa de autenticação ou antiabuso.
- `CHECK`s requerem MySQL >= 8.0.16 e são mantidos no SQL da migration, pois não
  são expressáveis no schema Prisma. Aplicar com `migrate deploy`, nunca substituir
  esta migration por `db push`; revisar constraints/collations em migrations futuras.

## Consequências iniciais — histórico das Etapas 0–1

A fundação é utilizável por futuros services transacionais e permanece sem rota,
controller ou factory HTTP. As factories existentes não precisam mudar. O endpoint
`POST /api/auth/register`, AuthService, landing, CompanyService e SubscriptionService
permanecem no comportamento anterior. A propriedade final da épica — nenhum
cadastro público sem aprovação — ainda não está ativa.

Testes integram MySQL real em container exclusivo e recusam cleanup se NODE_ENV
não for test ou o nome do banco não for `vulnera_test`. Nenhuma migration desta
entrega deve ser aplicada automaticamente em um banco de ambiente existente.

## Decisão vigente — Etapa 1.1 (2026-10-22)

### Lifecycle e prazos persistidos

Máquina final desta etapa:

```text
PENDING_EMAIL_VERIFICATION → PENDING_REVIEW → APPROVED → ACTIVATED
          ↓                    ↓    ↓           ↓
       EXPIRED             REJECTED EXPIRED    EXPIRED
```

- `REJECTED`, `EXPIRED` e `ACTIVATED` são terminais e liberam `activeEmail`.
  Os três estados pendentes/aberto à ativação reservam o endereço.
- `expiresAt` é a data-limite da etapa atual: **7 dias** para confirmar o
  e-mail, **30 dias** para revisão e **7 dias** para ativar após aprovação.
  Verificação e aprovação iniciam a janela seguinte; reenvios não a estendem.
- Expiração só é permitida quando `now >= expiresAt`. Demais transições exigem
  `now < expiresAt`. A entidade valida e o UPDATE condicional repete o limite.
  Horários são argumentos internos do servidor, nunca dados do visitante.
- Revisão pendente admite expiração por abandono administrativo. Rejeição por
  ADMIN já representa encerramento administrativo; não adicionar CANCELLED.
- Expiração usa ator NULL e mantém dados de quem já revisou, se houver. Não
  inventar User para representar sistema/visitante.
- Não adicionar `activatedAt`/`expiredAt`: a data de encerramento é o evento
  terminal. `expiresAt` permanece com o último prazo nos registros encerrados.
- Não há worker ou expiração automática nesta etapa. `findExpiredReservations`
  e transição condicional permitem a futura recuperação explícita, inclusive
  encerramento+nova solicitação no mesmo escopo transacional.

### Recuperação e reserva

| Situação | Operação interna permitida |
| --- | --- |
| A. Aguardando verificação com token válido | Reutilizar o pedido. Reenvio prepara segredo novo e rotaciona o slot, sem estender o pedido. |
| B. Token expirado, pedido ainda válido | Rotacionar o slot não consumido; o link anterior deixa de funcionar. |
| C. Pedido sem token | `createIfEligible` prepara o primeiro slot enquanto o pedido estiver válido. |
| D. Pedido antigo com prazo vencido | Transicionar para EXPIRED, liberar reserva e criar nova tentativa, preservando o histórico. |
| E. APPROVED com convite expirado | Reemitir no mesmo pedido enquanto a janela de aprovação de 7 dias estiver válida. Só o fim dessa janela permite EXPIRED. |
| F. ACTIVATED com User existente | Reserva do pedido liberada, mas `createIfEmailAvailable` retorna NULL pela existência da conta. |
| G. Conta antiga excluída | Se não há outro pedido reservado, a criação volta a ser permitida; históricos terminais permanecem. |

`email` e `activeEmail` passam a `utf8mb4_unicode_ci`, igual a `User.email`.
Continuar `trim().toLowerCase()` para armazenamento, sem remover aliases/acentos.
A comparação e a unicidade são do MySQL (incluem equivalências por acento,
Unicode composto/decomposto e pesos UCA), não de uma aproximação em JavaScript.
O CHECK continua exigindo igualdade binária entre o valor normalizado armazenado
e sua cópia em activeEmail. O índice único usa a collation de User.

`createIfEmailAvailable` retorna NULL se User já existir; reserva duplicada
continua produzindo P2002 do índice. A consulta de User não cria uma unicidade
global entre tabelas: o register antigo ainda pode criar conta em paralelo ou
posteriormente. A futura ativação deve tratar a unicidade de User dentro de sua
própria transação e preservar a conta anterior. Nenhuma alteração de Auth aqui.

### Tokens, rotação e revogação

- Limites: verificação **1 hora**, convite **48 horas**, sempre limitados por
  `AccessRequest.expiresAt`. Expiração do token não expira o pedido.
- Um slot por pedido/tipo continua único. `createdAt` registra a criação do slot;
  `issuedAt` registra a geração atual, permitindo rotação sem perder aquela data.
  `revokedAt` representa invalidação explícita sem adulterar o prazo de validade.
  Não adicionar contador de versão: hash esperado + revogação esperada são o CAS.
- `createIfEligible` retorna NULL para pedido/estado/janela inadequados. Não cria
  convite antes de APPROVED. Duplicidade de slot/hash continua barrada pelo banco.
- `rotateIfAvailable` exige id do pedido, hash atual esperado, revokedAt esperado,
  hash novo e nova expiração. O novo segredo deve ser gerado novamente pela
  utilitária criptográfica. Mesmo hash atual é recusado; o slot consumido nunca
  pode ser rotacionado. Não reutilizar deliberadamente hashes de gerações antigas:
  o slot não é um ledger de todos os hashes anteriores.
- A rotação substitui hash/validade/issuedAt e limpa revokedAt. Um comando antigo
  que esperava revokedAt NULL não pode desfazer revogação concorrente. Reemitir
  após revogação exige reler o slot e informar a revogação observada.
- `revokeIfAvailable` exige hash esperado, slot não consumido e ainda não revogado.
  Repetição retorna false. Rotação/consumo com hash antigo também retornam false.
- `consumeIfAvailable` exige hash atual, issuedAt <= now, prazo do token e do
  pedido válidos, estado adequado, usedAt NULL e revokedAt NULL. Uso é único.
- Encerramento terminal revoga os slots ainda não consumidos na mesma transação;
  uso confirmado permanece registrado, sem adicionar revogação ao token usado.

### Concorrência e limites das garantias

Todas as escritas em pedido/token usam a mesma ordem: `SELECT ... FOR UPDATE`
do pedido, depois escrita condicional no slot. Isso serializa transições,
reemissões, revogações e consumo; o filtro de hash/estado esperado evita comandos
obsoletos. `access-transaction.repository.ts` contém apenas essa infraestrutura
de persistência; regras de estados/janelas permanecem nos models.

Criação de pedido+evento é nested write; transição, liberação, revogação e evento
compartilham a transação. Repositories fornecidos por `transaction` reutilizam o
client transacional. O futuro service deve abortar o callback se uma operação
obrigatória devolver false e não engolir erros de persistência dentro dele.

O banco garante reserva única, integridade referencial, estados/metadados e datas
coerentes; formatos de hashes e slot único permanecem. Os locks/CAS dos repositories
garantem as primitivas concorrentes. TTLs máximos e elegibilidade por estado do
pai são regras dos models aplicadas com o pai bloqueado, não CHECKs entre tabelas.
SQL administrativo direto ainda pode ignorar a API e reescrever histórico/uso.

ACTIVATED é somente uma transição preparada. Nesta etapa não comprova User criado
nem consumo de convite. A futura ativação deverá unir consumo, criação de User
e transição terminal; o UserRepository ainda precisa participar desse contrato.
Nenhum teste desta entrega declara essa jornada completa. SMTP, EmailSender,
verificação HTTP e emissão de JWT continuam ausentes do novo domínio.

### Migração incremental e compatibilidade

Manter `20261022120000_add_access_request_foundation` intacta. O histórico local
e o relatório só evidenciam aplicação em descartáveis; não se presume conhecer
todos os ambientes externos. Criar `20261022160000_harden_access_request_lifecycle`
evita reescrever uma migration que alguém possa ter aplicado.

O pré-check com tabela temporária e índice na collation de User aborta antes de
DDL permanente se houver reservas equivalentes. Não escolher vencedor nem apagar
pedido automaticamente; qualquer colisão real exige decisão explícita prévia.
O backfill atribui prazos aos quatro estados antigos e issuedAt=createdAt nos
tokens, preservando valores anteriores e sem expirar pedidos silenciosamente.
Users, RefreshTokens e AuditLogs existentes não são modificados.

As validações e os casos A–G constam em `docs/SECURITY-AUTH-ETAPAS-0-1.md`.

## Etapa 2 — verificação de e-mail (contrato vigente desta etapa)

- Escopo: emissão inicial, reenvio e confirmação de e-mail para `AccessRequest`.
  Esta decisão não habilita endpoints, cadastro público, revisão administrativa,
  convite/ativação, criação de User, JWT, Company ou Subscription.
- O serviço persiste hash e evento na mesma transação antes de enviar SMTP.
  O token cru só existe durante a chamada; tem 32 bytes aleatórios, SHA-256 no
  banco, validade máxima de 1 hora limitada pelo pedido e link no fragmento
  `/verify-email#token=...`. Reenvio não estende o prazo do pedido.
- Confirmação consome o token e muda `PENDING_EMAIL_VERIFICATION` para
  `PENDING_REVIEW` com evento na mesma transação. Pedido vencido passa a EXPIRED;
  pedido ausente, estado inválido, token inválido ou expirado não confirma.
- API interna do serviço: `issueVerification` / `resendVerification` retornam
  `SENT`, `DELIVERY_FAILED`, `NOT_ELIGIBLE` ou `CONFLICT`; `confirmEmail` retorna
  booleano. Após falha SMTP, o hash da tentativa é revogado e evento genérico
  registrado; falha de cleanup sobe código seguro. Sem outbox, fila ou retry.
- `SENT` indica aceitação SMTP do destinatário pelo servidor, não entrega na
  caixa. Crash após commit pode deixar envio sem mensagem; reenvio manual recupera.
  Emissões concorrentes podem terminar fora de ordem, mas só o hash persistido
  por último é válido. Logs não devem conter token, hash, credenciais ou conteúdo.
- SMTP é lazy; a configuração exige TLS em produção e HTTPS na origem pública.
  Variáveis novas não são obrigatórias para o fluxo antigo. O envio foi exercitado
  por fixture SMTP local, inclusive auth, recusa, timeout e exigência de TLS. Não
  houve uso de provedor externo com credenciais reais, confirmação de inbox nem
  teste de certificado público. Sem outbox, retry automático ou scheduler; após
  falha/crash o reenvio recupera, e mensagens concorrentes podem chegar fora de
  ordem. O relatório [Etapa 2](../../SECURITY-AUTH-ETAPA-2.md) contém resultados.

### Validação da Etapa 2

Concluída em 2026-10-22: `npm test -- --silent` passou **46/46 suítes e 844/844
testes**, em 415,437 s, exit 0. TypeScript build (duas execuções), lint focal,
Prisma validate/generate 6.19.3 e diff do schema passaram. As 17 migrations
estavam up-to-date no MySQL 8.4.11 descartável; 11 CHECKs aparecem como enforced.
`npm run check` ainda para no lint global por `UserEntity` e `UserResponseDTO`
não usados em `vulnerability.service.ts:45`; Jest daquele script não executa,
mas a suíte completa separada passou. A etapa está pronta para revisão e
consolidação, sem commit/push. Etapa 3 não iniciada.

## Etapa 3 — endpoints públicos de verificação (vigente; concluída em 2026-10-23)

### Contexto

A etapa passa a expor solicitação, reenvio e confirmação por HTTP. O cadastro
público legado ainda existe e não compartilha uma constraint única com a tabela
de `AccessRequest`; a integração precisa limitar dados públicos sem criar User,
Company, Subscription, sessão ou privilégio.

### Decisão

- Registrar `POST /api/access-requests`, `/resend-verification` e
  `/verify-email` somente pelo centralizador `routes/routes.ts`. Services não
  recebem `req`/`res`; cada stack é montada por Factory Method.
- Request e resend exigem CAPTCHA Turnstile Siteverify com segredo obrigatório,
  destino oficial fixo, timeout e checagem opcional de hostname/action. Falha,
  timeout ou resposta incoerente falha fechado. Verificação de e-mail usa o
  token de 32 bytes enviado no link e recebe somente limite por IP.
- Limites específicos usam buckets Token Bucket separados do limiter geral:
  request/IP burst 5 com refill 5/h, resend/IP burst 10 com refill 10/h,
  verify/IP burst 30 com refill 30/min, e e-mail burst 5 tentativas com refill
  5/dia. Não são janelas fixas nem cotas absolutas móveis. Tentativas válidas
  consomem quota por e-mail mesmo sem pedido elegível ou envio SMTP. O cooldown
  de 60 s é separado e há teto finito de chaves. Não há env de bypass.
- Chave IP usa `req.ip`/socket e respeita `TRUST_PROXY_HOPS`; o default 0 não
  confia em XFF. Aumentar hops só é correto atrás do ingresso confiável
  correspondente. Nenhum header de proxy é interpretado manualmente.
- O cooldown persistente do pedido usa o relógio injetável do service e `issuedAt`
  sob lock; o bucket local por IP/e-mail usa o relógio do processo e se limita à
  instância atual. Cooldown não substitui a serialização transacional.
- Request e resend devolvem status 202 e mensagem neutra idênticos quando a
  operação chega ao service, inclusive quando a entrega SMTP é recusada e o
  token/evento de falha são tratados pelo service. Erro de persistência ou
  cleanup que sobe ao controller retorna 500 genérico. Isso não promete tempo
  constante: a chamada SMTP ainda é síncrona após commit e não há outbox.
- O controller monta um DTO a partir de `name`, `email`, `companyName` e
  `phone`; IDs, papel e estado fornecidos no body são ignorados. Tokens e
  credenciais nunca entram em logs ou respostas.
- Configuração e adapter permanecem lazy: importar `app` e criar aplicações
  antigas não exige env SMTP/CAPTCHA. Testes injetam service, verifier e limiter
  por `createApp`, sem rotas de teste.

### Consequências e limites

A reserva de email reduz duplicidade dentro do domínio AccessRequest, mas o
fluxo de cadastro legado continua independente. Sem constraint cruzada entre
`User.email` e `AccessRequest.activeEmail`, uma corrida entre cadastro e
solicitação segue possível até a migração do cadastro público. Request/resend
não afirmam aceitação ou entrega SMTP; 202 é deliberadamente neutro. A segurança
temporal contra enumeração não é garantida por latência constante. A entrega está
validada para revisão, com as ressalvas registradas no [relatório da Etapa 3](../../../SECURITY-AUTH-ETAPA-3.md).

### Validação registrada em 2026-10-23

- Build aprovado e Jest completo **53/53 suítes, 960/960 testes**. Coverage dos
  três services do recorte: 91,52% statements, 80% branches, 93,33% functions e
  94,87% lines; os branches individuais variam de 65% a 86,79%.
- Harness SMTP real contra MailHog: duas rodadas de 11/11, 24 mensagens
  confirmadas. Testes Turnstile usam `fetch` simulado e HTTP usa fake CAPTCHA;
  não houve chamada real à Cloudflare.
- `npm run check` continua exit 1 antes do Jest por dois imports antigos não
  usados em `vulnerability.service.ts:46`; a suíte completa passou separada.
- Limites preservados: cadastro legado e possível corrida cross-table, SMTP
  síncrono sem garantia de tempo constante e ausência de outbox. Sem cutover do
  onboarding. Na conclusão desse marco, a Etapa 4 ainda não havia iniciado.
- A numeração ADR-047 colide com o ADR de exportação Excel trazido por `dev`;
  a colisão foi documentada e nenhum arquivo foi renumerado.

## Etapa 4 — revisão administrativa e convites (concluída, 2026-10-23)

### Contexto e decisão vigente

A fila administrativa passa a expor listagem, detalhe, eventos, aprovação,
rejeição e reenvio de convite sob autenticação e autorização atual. Cada request
exige JWT, `requireRole("ADMIN")` e conferência do papel ADMIN no banco, pois
uma role antiga no token não deve manter privilégio após rebaixamento/remoção.
Services reutilizam essa conferência para chamadas que não passam pelo HTTP.

A aprovação e o preparo do convite (hash/slot/auditoria) ocorrem no mesmo
transaction context; envio SMTP acontece depois do commit. Factory lazy carrega
SMTP e `PUBLIC_WEB_URL` apenas em approve/resend, sem bloquear consulta e
rejeição. Rejeição mantém motivo opcional/null com validação HTTP. Respostas são
allowlist: detalhe inclui somente datas do convite; evento não inclui hashes;
decisão não expõe credencial preparada. Link do convite leva token no fragmento
`/activate-account#token=...`, mas ativação continua futura.

Não haverá migration nesta etapa. Transições de aprovação, rejeição e expiração
ficam como `STATUS_TRANSITION` em `AccessRequestEvent`. Os eventos de convite
`ISSUED`, `REISSUED` e `DELIVERY_FAILED` usam o `AuditLog` existente com ator
ADMIN, pois o CHECK de `AccessRequestEvent` os rejeita. A validação final
passou: 57/57 suítes e 995/995 testes; build,
lint focal e Prisma validate/generate também passaram. Coverage dos quatro
services: 88,26% statements, 68,49% branches, 96,77% functions e 95,03% lines.
`npm run check` ainda termina com exit 1 antes do Jest por dois imports antigos
em `vulnerability.service.ts:46`; a suíte Jest completa passou separadamente.
Consultar [`SECURITY-AUTH-ETAPA-4.md`](../../../SECURITY-AUTH-ETAPA-4.md) para
ownership, resultados e limitações.

Sem outbox, uma falha de processo entre commit e entrega SMTP pode deixar um
convite preparado sem mensagem; o ADMIN pode recuperá-lo por reenvio. O cadastro
legado continua ativo, e a corrida de unicidade entre `User` e `AccessRequest`
segue até o cutover futuro. Ativação, consumo do convite e criação de User/JWT
não fazem parte desta etapa. A Etapa 4 está concluída; a Etapa 5+ permanece
futura.

## Relacionado

- [Issue #51](https://github.com/guimunizzz/Vulnera-TCC/issues/51)
- [[ADR-015 - MySQL definitivo]]
- [[ADR-040 - Rate limiting multi-tenant em memoria]]
- [CHECK e tratamento de NULL no MySQL](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)
- [Unicidade no MySQL](https://dev.mysql.com/doc/refman/8.0/en/constraint-primary-key.html)
- [Prisma: recursos detectados na introspecção, incluindo CHECKs](https://www.prisma.io/docs/orm/v6/prisma-schema/introspection)
