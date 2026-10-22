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
de e-mail, revisão administrativa e convite. A entrega atual cobre somente as
Etapas 0 e 1. O fluxo antigo continua operacional até a implementação posterior
dos serviços, das proteções públicas e da ativação. O banco real é MySQL, com
Prisma 6.19.3; `AuditLog.actorId` é obrigatório e referencia `User`.

> **Atualização de 2026-10-22:** a decisão operacional vigente é a seção
> **Etapa 1.1** abaixo. As decisões das Etapas 0–1 permanecem como histórico;
> lifecycle, reserva, collation e contratos de tokens foram substituídos.

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

## Relacionado

- [Issue #51](https://github.com/guimunizzz/Vulnera-TCC/issues/51)
- [[ADR-015 - MySQL definitivo]]
- [[ADR-040 - Rate limiting multi-tenant em memoria]]
- [CHECK e tratamento de NULL no MySQL](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)
- [Unicidade no MySQL](https://dev.mysql.com/doc/refman/8.0/en/constraint-primary-key.html)
- [Prisma: recursos detectados na introspecção, incluindo CHECKs](https://www.prisma.io/docs/orm/v6/prisma-schema/introspection)
