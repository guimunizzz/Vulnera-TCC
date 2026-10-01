# Issue #19 — relatório final de validação

**Data:** 2026-09-30
**Status:** concluído — implementação e validação funcional 100%, CP-0 a CP-3 concluídos. Ressalva: `npm run check` global da API permanece com falha de lint preexistente; o gate global da API não está verde.
**Branch/HEAD do baseline:** `fix/19-admin-create-application` / `fecacab3`
**Referência comparada:** `dev` em `f301fd0`.

Este relatório registra a revisão do planejamento e as evidências finais da Issue #19. O estado parcial de CP-2/CP-3 abaixo foi preservado como histórico e substituído pelo fechamento final registrado ao fim deste documento.

## Problema e aceite

A [Issue #19](https://github.com/guimunizzz/Vulnera-TCC/issues/19) exige que
ADMIN selecione uma empresa existente ao criar uma aplicação, que a API use a
seleção validada, que CLIENT continue limitado à própria empresa mesmo se
forjar o corpo, que o estado sem empresas tenha mensagem adequada e que a
listagem seja atualizada após sucesso.

O planejamento acertou que a tentativa de backend não concluía o fluxo porque os contratos e o formulário web ainda não enviavam `companyId`. O schema não precisa de migration: `User.companyId` é opcional e `Application.companyId` é obrigatório. `GET /api/companies` e `companiesApi.list` já estão disponíveis para ADMIN e foram reutilizados. O `Select` customizado mostrou conflito no Dialog por portal externo e foi substituído por `<select>` nativo estilizado, conforme o desvio documentado e L-19. A aplicação mobile não oferece criação de Application e é read-only para CLIENT, então não há consumidor mobile de escrita a migrar.

## Decisão de domínio e autorização

Conforme [ADR-043](../docs/Vulnera/07-Decisoes/ADR-043%20-%20Alvo%20administrativo%20explicito%20na%20criacao%20de%20Application.md):

- somente `ADMIN` pode escolher `companyId`, e somente no POST de criação;
- a API valida existência da empresa e mantém os gates atuais de assinatura
  `ACTIVE` e limite do plano;
- CLIENT sempre usa `User.companyId` do banco e o body não troca o tenant;
- PENTESTER não cria Application;
- `companyId` permanece imutável em update, em linha com RN04;
- JWT, schema e migrations permanecem fora do escopo.

Essa é uma exceção estreita à regra geral do guia que proíbe aceitar
`companyId` do body. Ela não transforma o campo em parte de um DTO genérico de
update ou em mecanismo de escolha de tenant para CLIENT.

## Trabalho registrado

| Checkpoint | Estado | Resultado disponível |
| --- | --- | --- |
| CP-0 — Baseline | ✅ | Branch/HEAD e comparação com `dev` registrados. API tinha resolução administrativa no service; a UI ainda enviava apenas nome, URL e descrição. |
| CP-1 — Contratos | ✅ | `CreateApplicationInput` inclui alvo opcional; `UpdateApplicationInput` exclui `companyId`; API de update usa o novo tipo; erro `MISSING_COMPANY_ID` recebe mensagem específica. |
| CP-2 — Modal | ✅ | Seletor ADMIN, payload por papel, estados de lista, reset/invalidação e proteção contra resposta tardia/envio duplicado implementados e smoke real reportado. |
| CP-3 — Aceite | ✅ | Web serial 257/257 em 21 suítes, focal 20/20, lint 0 erros/9 avisos preexistentes, contraste 66/66 e build aprovados; API 588/588, focal 42/42 e build aprovados. Check global da API ainda acusa somente dois imports preexistentes não usados. |

## Desvio de CP-2

O plano previa reutilizar o `Select` customizado no modal. Durante a integração
foi identificado que esse Select monta seu painel em um portal sibling fora do
conteúdo do `Dialog` (`z-dropdown` abaixo de `z-modal`). O modal torna os
siblings inertes e o dismiss classifica o clique no portal externo como clique
fora, impedindo a seleção. Por decisão do orquestrador, a tela usa um
`<select>` nativo dentro do modal, estilizado com `CLASSES_CONTROLE`. Ele mantém
a interação dentro do foco do diálogo e oferece teclado nativo. A validação
Chrome reportada confirmou seleção por teclado e foco contido. Não houve
mudança nos componentes compartilhados; a correção geral de portais/overlays
fica no backlog como L-19.

## Smoke real de CP-2

O orquestrador reportou 44 verificações em Chrome temporário, contra Web em
`8089`, API HTTP real em `3019` e banco `vulnera_test`. Três vínculos foram
confirmados no banco antes da limpeza das fixtures:

- ADMIN com `companyId=null` selecionou empresa B e criou nela;
- ADMIN vinculado à empresa A selecionou B e criou nela;
- CLIENT criou na empresa A sem seletor; um POST manual com empresa B também
  criou na empresa A.

Também foram confirmados atualização da listagem, reset do formulário, ausência
das consultas `/subscriptions/current` e de capacidade empresarial para ADMIN,
ausência de listagem global de empresas para CLIENT, seleção por teclado, foco
contido no modal e viewport de 375 px sem overflow. O orquestrador inspecionou
screenshots em 1440 px e 375 px. Artefatos do orquestrador, não alterados:
`output/issue-19-smoke.cjs`, `output/issue-19-smoke-result.json`,
`output/issue-19-desktop.png` e `output/issue-19-mobile.png`.

## CP-3 — resultados parciais de API (snapshot intermediário, supersedido pelo fechamento final abaixo)

Em 2026-09-30, o orquestrador executou validação final de API para esta
correção:

- API focal: **42/42** — Application 23; risk-context e Company somam 19.
- Cobertura de `application.service`: **100% linhas, 100% funções, 85,71%
  branches e 94,44% statements**.
- Suíte API completa: **588/588 testes em 43 suítes**, uma execução com sibling
  CVSS, em 258,783 s.
- Build API final: aprovado.
- `npm run check --workspace=app/api`: ainda falha somente pelos imports não
  usados `UserEntity` e `UserResponseDTO` em
  `app/api/src/services/vulnerability.service.ts:45`. É lint preexistente e
  fora do escopo desta issue; os testes API executados passaram.
- Logs do orquestrador, não alterados: `output/issue-19-api-focused.log` e
  `output/issue-19-api-full.log`.

Naquele marco, os testes, checks e build finais do Web ainda não tinham chegado. O estado foi substituído pelo fechamento final abaixo; preserve-se este snapshot como histórico.

## Validação intermediária até CP-2 e baseline de CP-1 (histórico; resultado final abaixo)

- No baseline de CP-1, duas execuções complementares totalizaram **580/580 testes aprovados em
  43 suítes** (523 + 57). A primeira execução em harness que continha só API
  não carregou `cvss.util.test.ts`, que importa um arquivo do workspace Web;
  a execução complementar cobriu essa suíte. A falha inicial era limitação do
  harness, não falha de teste do produto.
- `npm run build` da API: aprovado.
- `tsc` do Web após CP-1: aprovado.
- Lint focal da página e `tsc` Web após CP-2: aprovados.
- Smoke Chrome de CP-2: 44 verificações reportadas, com validação de banco,
  autorização/tenancy, listagem, teclado/foco e viewport mobile. As fixtures
  foram removidas após conferir os vínculos.
- Baseline paralelo de Web: build aprovado, lint sem erros (9 avisos),
  contraste 66/66 e testes 237/240. Uma falha em Remediação e duas em SLA
  aguardam execução serial para distinguir contenção de recurso.
- Lint API mantém dois imports não usados preexistentes em
  `vulnerability.service.ts`; ESLint não está instalado no host.
- O agente responsável por CP-1 não executou testes/build; os resultados acima
  vieram das execuções de validação do orquestrador.

## Fechamento final de CP-3 — 2026-09-30

- Web focal: **20/20**.
- Web `npm run check -- -- --maxWorkers=1 --silent`: **257/257 testes em 21 suítes**, 54,59 s. Remediação e SLA passaram nesta execução serial. As falhas vistas no baseline paralelo 237/240 não persistiram; não foi determinada uma causa para as falhas anteriores.
- Lint Web: **0 erros e 9 avisos preexistentes**; contraste **66/66**; build Web (`tsc + vite`) aprovado com aviso conhecido de tamanho do bundle.
- API focal: **42/42**; full: **588/588 em 43 suítes**; build aprovado. Cobertura de `application.service`: **100% linhas, 100% funções, 85,71% branches e 94,44% statements**.
- Check global da API: continua falhando somente nos imports preexistentes não usados `UserEntity` e `UserResponseDTO` em `app/api/src/services/vulnerability.service.ts:45`. Esta ressalva está fora do escopo; não declarar o gate global API verde.
- Smoke Chrome real: **44/44 verificações**, evidências e confirmações descritas acima; fixtures removidas após conferência.
- `git diff --check`: exit 0, conforme validação do orquestrador.

A implementação e validação funcional da Issue #19 estão concluídas (100%; CP-0 a CP-3). Branch `fix/19-admin-create-application`, base `fecacab3`; PR ainda não aberta nesta atualização. O select nativo dentro do Dialog e o follow-up L-19 estão registrados no ADR-043 e no backlog.


### Marco administrativo posterior - commit e publicacao

O commit local de implementacao e `7b847c473e10ed1ca93e787704ed9a91dd1f70ab`. O push final foi deixado explicitamente a cargo do usuario; nenhum push ocorreu e nenhuma PR foi aberta. Tentativas de publicacao foram bloqueadas pela revisao automatica de destino/autorizacao, sem relacao com os resultados de codigo ou testes.
