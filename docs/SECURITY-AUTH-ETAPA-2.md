# Issue #51 — Etapa 2: verificação de e-mail

Registro técnico da implementação concluída em 2026-10-22. Consumidores:
Rafael, revisores e próximas sessões. **Status: concluída em 100% do recorte,
pronta para revisão e consolidação.** A validação completa passou; os limites de
provedor externo e inbox estão descritos abaixo. A Etapa 3 não foi iniciada.

## Escopo e fronteiras

Etapa limitada à emissão inicial, reenvio e confirmação do e-mail de um
`AccessRequest`, incluindo composição de mensagem, configuração e transporte
SMTP. Não adiciona endpoints HTTP nem frontend e não ativa revisão administrativa,
convite, criação de User, JWT, Company ou Subscription. O cadastro público e a
autenticação anteriores permanecem fora desta mudança.

O estado validado no código fonte é:
`EmailVerificationService` faz a orquestração e aceita `EmailSender` injetável;
`SmtpEmailAdapter` encapsula Nodemailer; a factory combina configuração,
repository e adapter. A factory não registra rota nem é ligada ao fluxo de
cadastro nesta etapa.

## Ownership registry

Cada grupo é dono exclusivo dos caminhos listados. Mudanças cruzadas precisam
ser encaminhadas ao proprietário, sem edição concorrente dos mesmos arquivos.
Todos os caminhos são relativos à raiz do repositório. Os caminhos de código
começam por `app/api/`; `package-lock.json` fica na raiz e é ignorado/não
rastreado pelo Git.

| Agente | Ownership | Reasoning | Arquivo exclusivo (raiz do repositório) |
| --- | --- | --- | --- |
| A | `email_contracts` | HIGH | `app/api/src/models/email.model.ts` |
| A | `email_contracts` | HIGH | `app/api/src/utils/email-verification-message.util.ts` |
| A | `email_contracts` | HIGH | `app/api/tests/fixtures/fake-email-sender.ts` |
| B | `smtp_adapter` | XHIGH | `app/api/src/adapters/smtp-email.adapter.ts` |
| B | `smtp_adapter` | XHIGH | `app/api/package.json` |
| B | `smtp_adapter` | XHIGH | `package-lock.json` (raiz; ignorado/não rastreado pelo Git, gerado localmente pelo npm) |
| C | `email_config_factory` | HIGH | `app/api/src/config/enum/EnvKeys.ts` |
| C | `email_config_factory` | HIGH | `app/api/src/config/email.config.ts` |
| C | `email_config_factory` | HIGH | `app/api/.env.example` |
| C | `email_config_factory` | HIGH | `app/api/src/factories/email-verification.factory.ts` |
| D | `verification_orchestration` | MAX | `app/api/src/services/email-verification.service.ts` |
| D | `verification_orchestration` | MAX | `app/api/src/models/email-verification.model.ts` |
| D | `verification_orchestration` | MAX | `app/api/src/repositories/access-request.repository.ts` |
| D | `verification_orchestration` | MAX | `app/api/src/repositories/email-verification-token.repository.ts` |
| D | `verification_orchestration` | MAX | `app/api/prisma/schema.prisma` |
| D | `verification_orchestration` | MAX | `app/api/prisma/migrations/20261022180000_add_email_verification_events/migration.sql` |
| E | `email_tests` | XHIGH | `app/api/tests/integration/email-verification.test.ts` |
| E | `email_tests` | XHIGH | `app/api/tests/integration/email-infrastructure.test.ts` |
| E | `email_tests` | XHIGH | `app/api/tests/fixtures/smtp-test-server.ts` |
| H | documentação | HIGH | `PRD_VIVO.md` |
| H | documentação | HIGH | `docs/BACKLOG.md` |
| H | documentação | HIGH | `docs/ROADMAP_PROMPTS.md` |
| H | documentação | HIGH | `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md` |
| H | documentação | HIGH | `docs/Vulnera/07-Decisoes/ADR-047 - Fundacao do acesso controlado.md` |
| H | documentação | HIGH | `docs/SECURITY-AUTH-ETAPAS-0-1.md` |
| H | documentação | HIGH | `docs/SECURITY-AUTH-ETAPA-2.md` |
| H | documentação | HIGH | `docs/Vulnera/04-Arquitetura/Email SMTP.md` |

Os seis agentes usaram modelo `gpt-6-luna`: A, C e H com reasoning HIGH; B e E
com XHIGH; D com MAX. Grafo: A fornece contratos para B, D e E; C fornece
configuração para B; B e D convergem na factory de C. A forneceu contratos cedo
para permitir B→E sem esperar todas as frentes. Fakes foram combinados com A e a
factory com C para reduzir fragmentação. D recebeu reasoning MAX pela
concorrência, uso de tokens entre entidades e atomicidade de transações. A
execução usa workspace compartilhado; ownership é exclusivo por arquivo.

## Contratos decididos

- Token canônico de 32 bytes aleatórios, codificado base64url; só SHA-256 é
  persistido. Validade máxima de uma hora, limitada por `AccessRequest.expiresAt`.
- O link aponta para `/verify-email#token=<token>` sob origem pública estrita.
  O fragmento evita enviar o token automaticamente em requisições HTTP de
  navegação/referrer; a tela frontend ainda não existe.
- `issueVerification(id)` emite o primeiro token; `resendVerification(id)` faz
  rotação condicional. Ambos retornam `SENT`, `DELIVERY_FAILED`, `NOT_ELIGIBLE`
  ou `CONFLICT`. Pedido ausente, status não elegível ou prazo encerrado não
  emitem; expiração encerra o pedido em vez de recriar outro.
- Reenvio não estende a validade do pedido. Pedidos APPROVED ou já em revisão
  não recebem e-mail de verificação.
- `confirmEmail(rawToken)` retorna booleano. Hash atual e token válido são
  consumidos e a transição `PENDING_EMAIL_VERIFICATION → PENDING_REVIEW`, com
  evento, ocorrem na mesma transação. Token inválido, expirado, usado, revogado
  ou substituído retorna false; falha obrigatória da transação aborta o conjunto.
- Commit do token/evento precede chamada SMTP. Em falha de envio, o hash da
  tentativa é revogado condicionalmente e um evento genérico
  `VERIFICATION_DELIVERY_FAILED` é gravado. Falha no cleanup sobe código seguro;
  não é reportada como entrega concluída.
- SMTP bem-sucedido significa aceitação do destinatário pelo servidor SMTP,
  sem garantia de entrada na caixa. Não há outbox, retry automático ou garantia
  de ordem entre envios concorrentes. Após crash depois do commit, reenvio é a
  recuperação manual; só o hash atualmente persistido é válido.
- Não registrar token cru, hash, credenciais ou conteúdo sensível. TLS valida
  certificado e exige TLS em produção; URL pública usa HTTPS em produção.
  Configuração é lazy para que os fluxos antigos não dependam das novas variáveis.
- Configuração operacional: `SMTP_HOST`, `SMTP_FROM` e `PUBLIC_WEB_URL` são
  obrigatórias quando a factory cria o adapter SMTP. `SMTP_USER` e `SMTP_PASS`
  são opcionais, mas devem vir juntos. `SMTP_PORT` é opcional (default 1025),
  assim como `SMTP_SECURE` (false), `SMTP_REQUIRE_TLS` (false fora de produção) e
  `SMTP_CONNECTION_TIMEOUT_MS` (10000), `SMTP_GREETING_TIMEOUT_MS` (10000),
  `SMTP_SOCKET_TIMEOUT_MS` (20000). Em produção, transporte deve usar TLS e
  `PUBLIC_WEB_URL` deve ser HTTPS. Os exemplos locais ficam em `app/api/.env.example`.
- A factory cria o serviço internamente e resolve SMTP de forma lazy; ainda não
  há registro de rota, endpoint HTTP nem frontend. A tela futura deverá ler o
  token do fragmento da URL e submetê-lo ao endpoint que vier a ser definido.

## Instalação e ambiente de validação

A primeira tentativa de instalar Nodemailer foi afetada por indisponibilidade de
rede e então falhou com `npm ERR! Invalid Version` por metadados preexistentes de
`autoprefixer` e `tailwindcss`. Após diagnóstico do Arborist (`node.js:1137`, comparação de versão vazia), a tentativa dirigida com
`--prefer-dedupe` instalou Nodemailer 10.2.0 e `@types/nodemailer` 8.0.2. Não houve
edição manual de lockfile nem correção de código-fonte web. A instalação alterou
18 pacotes em `node_modules`. O `package-lock.json` da raiz é ignorado pelo
`.gitignore` (linha 68), não é rastreado e permanece fora da política de Git;
o arquivo local foi gerado/atualizado pelo npm, sem force-add. Os arquivos de
dependência da API e o adapter entram no diff; a futura consolidação deverá
seguir a política atual do repositório.

Preflight registrado pelo root: branch `refactor/security-auth-gated-access`,
HEAD inicial `0e0c59b`, sem arquivos rastreados alterados antes da etapa; seis
arquivos não rastreados alheios foram preservados. Nenhum commit, push,
migration em banco real, reset ou seed. Um container MySQL descartável e dedicado
foi criado pelo root para testes, com nome `vulnera-issue51-email-test`, imagem
`mysql:8`, label `vulnera.purpose=issue51-email-tests`, tmpfs e bind apenas em
loopback `33354` para `vulnera_test`; nenhum outro container foi alterado.
Após a suíte completa, somente esse container foi parado. Uma primeira guarda
de cleanup usou label digitado incorretamente; a inspeção confirmou o label
literal acima e o stop seguro concluiu. Os demais containers não foram alterados.

## Estado da validação

**VALIDAÇÃO FINAL APROVADA em 2026-10-22 — 46/46 suítes, 844/844 testes PASS,
415,437 s, exit 0.** A suíte incluiu 112 testes de domínio da Etapa 1.1, os 84
testes novos da Etapa 2 (26 service e 58 infraestrutura), além das regressões de
Auth, User, Company e Subscription; esses recursos, permissões, tenants e seeds
não foram alterados pela Etapa 2.

| Verificação | Resultado final |
| --- | --- |
| TypeScript build | PASS, duas execuções após atualização das fontes |
| Regressões + domínio Etapa 1.1 | 144/144 PASS, 5 suítes, 77,536 s |
| Novos testes Etapa 2 | 84/84 PASS no conjunto final; 26 service + 58 infraestrutura |
| Lint focal | PASS em fontes, fixtures e testes |
| Prisma validate/generate 6.19.3 | PASS; 17 migrations aplicadas e diff sem diferenças |
| Suíte completa API | `npm test -- --silent`: 46/46 suítes, 844/844 testes PASS, 415,437 s, exit 0 |
| `npm run check` global | Lint global falha apenas nos imports não usados preexistentes `UserEntity`/`UserResponseDTO` em `vulnerability.service.ts:45`; Jest desse script não executou. Suíte completa foi executada separadamente e passou. |
| Prisma / MySQL | Prisma validate/generate 6.19.3 PASS; 17 migrations up-to-date, diff sem diferenças; MySQL 8.4.11 reportou 11 CHECKs enforced |

Revisões especializadas cobriram: CHECK nullable/rollback SQL antes de aplicar;
unicidade e normalização sem cadastro ilusório, marcas Unicode e origem segura;
comparação correta de destinatário SMTP com IDN; validação de controles e lint;
fixture SMTP com timer/login e rollback real. Passaram o teste integrado de
factory real → SMTP + banco e, separadamente, o teste SMTP com IDN decomposto;
o cenário da factory usou e-mail ASCII gerado por UUID. A primeira execução falhou em uma
asserção MIME porque Nodemailer codificou o corpo em quoted-printable
(`=3D`/soft break), embora o transporte tenha enviado a mensagem corretamente.
O fixture passou a decodificar quoted-printable, validar o hash e confirmar
`confirmEmail` até `PENDING_REVIEW`; após o ajuste, a suíte completa passou e
incluiu os 84 testes novos da Etapa 2.

Suíte completa executada fora do sandbox contra o MySQL descartável na porta
33354 usando `npm test -- --silent` e variáveis de processo:
`DATABASE_URL=mysql://root:<senha-sintética>@127.0.0.1:33354/vulnera_test`,
`NODE_ENV=test`, `BCRYPT_COST=4`, `DAST_FORCE_SIMULATE=true` e
`DAST_SCAN_TIMEOUT_MS=1800000`. `.env.test` não foi alterado e mantém o timeout
de 3000 ms. Não foi executado Docker ZAP real.

Os testes SMTP usam servidor fixture local e cobrem autenticação, aceitação e
recusa, timeout e exigência de TLS na configuração. Não foram usadas credenciais
reais de provedor, não houve handshake com certificado público e não foi
verificada entrega em inbox. SMTP configurável em produção não significa que um
provedor externo tenha sido exercitado.

A árvore registrada nesta entrega contém 26 arquivos versionáveis (13 alterados
e 13 novos), mais `package-lock.json` na raiz gerado localmente pelo npm e
ignorado/não rastreado. Os seis arquivos alheios do preflight foram preservados.
Sem commit/push, sem migration em banco real, reset ou seed. Etapa concluída,
pronta para revisão e consolidação; Etapa 3 não iniciada.

### Falhas transitórias resolvidas

- Instalação inicial offline/`Invalid Version` por metadados preexistentes npm;
  diagnóstico do Arborist e `--prefer-dedupe` concluíram a instalação.
- Ajustes de regex de controles no lint (C) e timer/login da fixture (E) foram
  feitos e a lint focal final passou.
- A asserção MIME do teste integrado foi ajustada para decodificar
  quoted-printable; o teste e a suíte completa passaram após o ajuste.
- O único bloqueio conhecido de `npm run check` é a lint global nos imports
  preexistentes `UserEntity`/`UserResponseDTO` em `vulnerability.service.ts:45`;
  essa chamada não chegou a executar Jest.

O recorte foi concluído e está pronto para revisão/consolidação. O gate
`npm run check` permanece bloqueado apenas pelos dois imports antigos em
`vulnerability.service.ts:45`; a suíte completa separada de 46 arquivos passou.

## Relacionado

- [ADR-047 — Fundação do acesso controlado](Vulnera/07-Decisoes/ADR-047%20-%20Fundacao%20do%20acesso%20controlado.md)
- [Relatório das Etapas 0–1.1](SECURITY-AUTH-ETAPAS-0-1.md)
- [Issue #51](https://github.com/guimunizzz/Vulnera-TCC/issues/51)
