<!--
Relatório técnico da Etapa 5 da Issue #51: contratos e evidências de ativação.
Existe para manter decisões, ownership, validações e limites conferíveis.
Consumidores: Rafael, mantenedores da API e revisores da Issue #51.
-->
# Issue #51 — Etapa 5: validação e ativação de convite

**Estado:** Etapa 5 concluída em 2026-11-17 (100% do recorte), aprovada com ressalvas. A rodada final de domínio passou 23/23, incluindo `REJECTED` e `EXPIRED`; não foi necessária nem permitida nova execução da suíte completa.

**Base:** merge local `44feabe9021ebf970b4388801687a15527b01230`, pais
`27d7b59` e `aafbc2b`; sem push. O worktree original foi preservado.

### Histórico de estado — pendência substituída em 2026-11-17

Versões anteriores deste relatório e dos documentos relacionados registravam os dois casos `REJECTED`/`EXPIRED` como pendentes. A validação final executada pelo orquestrador passou 23/23 casos de domínio em 11,242 s e inclui esses estados. Esse resultado substitui a pendência sem apagar seu registro histórico. A suíte completa permanece em 70/70 suítes e 1152/1152 testes (558,037 s), executada antes dos dois casos adicionais; não somar os dois casos ao total da suíte completa.

## Escopo e ownership

- **E — documentação:** PRD, BACKLOG, ROADMAP, ADR-057, changelog e este
  relatório. Não altera fontes, testes ou artefatos de frontend.
- **A — domínio/repositories (4 arquivos):** `models/account-activation.model.ts`,
  `services/account-activation.service.ts`, `repositories/access-request.repository.ts`,
  `repositories/user.repository.ts`.
- **B — HTTP/configuração (11 arquivos):** `.env.example`, `src/app.ts`,
  `routes/routes.ts`, `config/enum/EnvKeys.ts`,
  `config/account-activation-rate-limit.config.ts`,
  `controllers/account-activation.controller.ts`,
  `factories/account-activation.factory.ts`,
  `routes/account-activation.routes.ts`,
  `services/account-activation-rate-limit.service.ts`,
  `middlewares/account-activation-body.middleware.ts` e
  `middlewares/account-activation-rate-limit.middleware.ts`.
- **C — testes/fixtures (5 arquivos):** fixture de ativação; três novas suítes
  `account-activation{,-http,-protections}.test.ts`; e a adaptação pontual de
  `access-request.test.ts` para retirar o canário 404 que ficou obsoleto quando a
  rota da mesma Issue #51 passou a existir. A adaptação valida 400
  `INVALID_BODY` e ausência de consumo pelos contadores de ativação.
- **E — documentação:** PRD, BACKLOG, ROADMAP, ADR-057, changelog, relatório do
  merge e este relatório. Total: 27 arquivos no recorte.
- Nesta etapa: validar convite e criar `User` CLIENT ao ativar, consumindo o
  convite uma única vez e encerrando `AccessRequest` atomicamente; o login já
  existente após ativação também integra o fluxo e teve HTTP validado.
- Fora do escopo: schema/migration, `AuthService`, `/auth/register`, cutover do
  cadastro público, UI frontend, Company/Subscription e outbox. JWT/sessão não
  são criados durante ativação; o usuário pode autenticar depois pelo login
  existente.

## Contratos registrados

### Validação consultiva

`POST /api/account-activation/validate`, corpo `{ "token": string }`:

- `200 { "valid": boolean }`, sem PII. Token canônico malformado:
  `400 { "error": "INVALID_ACTIVATION_TOKEN" }`.
- Convite desconhecido, expirado, revogado, usado, não aprovado ou em conflito
  com User existente: `200 { "valid": false }`, sem distinguir a causa.
- A resposta é consultiva; não reserva nem consome o convite. A ativação sempre
  refaz elegibilidade sob locks e com o relógio atual.

### Ativação autoritativa

`POST /api/account-activation/activate`, corpo `{ "token": string,
"password": string }`:

- Sucesso: `204` sem corpo. Token ou convite semanticamente inválido:
  `400 { "error": "INVALID_ACTIVATION_TOKEN" }` de forma neutra.
- A senha deve ser string, ter ao menos 8 caracteres e no máximo 72 bytes UTF-8.
  Tipo inválido ou limite superior excedido: `400 INVALID_PASSWORD`; senha
  curta: `400 WEAK_PASSWORD`. Campos extras ou corpo inválido:
  `400 INVALID_BODY`.
- Respostas levam `Cache-Control: no-store`. As rotas são públicas e não
  dependem de autenticação prévia.

### Parser e proteção contra abuso

- O parser JSON específico limita o corpo a 8 KiB e é aplicado apenas ao prefixo
  `/api/account-activation` (comparação case-insensitive), após o limiter de IP.
  JSON malformado: `400 INVALID_BODY`; corpo grande: `413 PAYLOAD_TOO_LARGE`;
  charset/encoding não aceito: `415 UNSUPPORTED_BODY_ENCODING` conforme o
  middleware atual. Erros não refletem payload, token ou senha.
- Quatro buckets independentes: validate/IP, validate/hash do token,
  activate/IP e activate/hash do token. Defaults: 30/minuto nos buckets de
  validate, 5/minuto nos de activate, armazenamento até 5.000 chaves; variáveis
  `RATE_LIMIT_ACCOUNT_ACTIVATION_*` documentadas em `app/api/.env.example`.
  Fingerprints de token usam SHA-256. A capacidade rejeita novas chaves
  (fail-closed), `Retry-After` é retornado e TTL não é menor que o tempo máximo
  de refill. Os limites próprios continuam ativos mesmo se o limiter global for
  desligado.

### Transação de ativação

O hash bcrypt é preparado fora da transação, depois de pré-checagens de token e
conflito de e-mail. A decisão final ocorre em uma transação: lock do pedido
`AccessRequest`; lock do slot `AccessInvitation`; leitura do relógio após locks;
revalidação de status aprovado, verificação/revisão, prazo e slot ativo; busca de
User pela collation real do banco; consumo condicional do convite; criação de
User CLIENT com `companyId` e `companyRole` nulos; transição de pedido para
`ACTIVATED` com liberação da reserva; e `AuditLog` para
`ACCOUNT_ACTIVATED`/`ACCESS_INVITATION_USED`, ator igual ao novo User. Unique
conflict de User é normalizado para token inválido. Deadlock tem até três
tentativas. Falha em qualquer passo reverte consumo, User, transição e auditoria.

Nenhuma Company, Subscription, JWT ou sessão é criada durante a ativação. O
login e ciclo HTTP de autenticação já existentes foram exercitados após ativar:
login, refresh e logout passaram na suíte HTTP. O e-mail atual contém link com
token no fragmento `/activate-account#token=...`; a UI futura deverá ler o
fragmento e enviar o token ao endpoint HTTP. A UI e o cutover do cadastro legado
seguem para etapas posteriores.

## Estado das evidências

| Verificação | Resultado reportado |
|---|---|
| Build final da API | Aprovado após correções |
| ESLint focal em 14 arquivos de produção | Aprovado |
| Suítes focais dos 3 testes de Etapa 5 | 36/36, 53,806 s |
| Regressões focais em 14 suítes | Primeira execução 300/301; uma asserção canário antiga esperava 404 para endpoint que passou a existir. Owner C atualizou apenas `tests/integration/access-request.test.ts` para validar 400 `INVALID_BODY` e contadores sem consumo pelo limiter de ativação; repetição focal passou 112/112 em 24,258 s. Nenhuma fonte de produção foi alterada nessa correção. |
| Suíte completa API | Uma execução após estabilização: 70/70 suítes, 1152/1152 testes, 558,037 s. Não repetir a suíte completa. |
| Cobertura dos dois services novos | 84,68% statements; 76,62% branches; 93,33% functions; 94,25% lines. Domain: 84,26% / 76,66% / 87,50% / 96,96%; limiter: 86,36% / 76,47% / 100% / 85,71%. Branch coverage agregada abaixo de 80%. |
| Check global de lint | Exit 1 somente por dois imports preexistentes não usados (`UserEntity`, `UserResponseDTO`) em `vulnerability.service.ts:46`; 0 warnings. Mantidos fora de escopo. |
| Prisma/schema e migrations | Sem alteração nesta etapa; preflight Prisma validate do merge aprovado. |
| Matriz explícita `REJECTED` e `EXPIRED` | Owner C adicionando dois casos a teste de domínio já sob ownership; executar apenas focal de domínio e registrar resultado, sem repetir suíte completa. |
| Testes Web/UI | Não executados; arquivos de produto Web não foram alterados. |

A suíte completa usou apenas override process-local
`DAST_SCAN_TIMEOUT_MS=1800000` para evitar timeout ambiental conhecido. Nenhum
`.env`, teste ou fonte DAST foi alterado. O lint global permanece não verde pelos
dois imports antigos acima, sem outros warnings. A cobertura de branches dos
services novos é 76,62% e fica registrada como ressalva, sem alegar meta de 80%.

## Pendências para o fechamento

1. Receber e registrar o resultado dos dois casos finais de domínio para
   `REJECTED` e `EXPIRED`; não inferir aprovação antes da execução focal.
2. Após essa execução, marcar a etapa concluída no PRD/BACKLOG/ROADMAP/changelog
   e atualizar este relatório/ADR-057 com as evidências finais. Não repetir a
   suíte completa já executada.

## Matriz de estados a provar

| Estado do pedido | Resultado esperado na validação/ativação | Evidência |
|---|---|---|
| `REJECTED` | Token não elegível; resposta neutra/sem criação de User | Teste focal adicional pendente |
| `EXPIRED` | Token não elegível; resposta neutra/sem criação de User | Teste focal adicional pendente |

O owner C adicionou 23 casos focais de domínio para a matriz de lifecycle,
incluindo esses estados, sem alterar fonte de produção. Resultado dessa execução
focal ainda pendente. Eles não pertencem à suíte completa já executada (70/70,
1152/1152); após passarem, não repetir a suíte completa.

## Histórico

- 2026-11-17 — Relatório atualizado com build final, lint focal, testes focais e
  uma execução completa da API. Correção limitada a um canário de integração
  antigo da mesma Issue #51. Dois casos adicionais (`REJECTED`, `EXPIRED`)
  aguardam execução focal; fechamento e badge de conclusão permanecem pendentes.
