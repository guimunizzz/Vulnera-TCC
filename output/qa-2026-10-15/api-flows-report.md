<!-- Relatório de QA HTTP para Rafael: registra provas funcionais, limites e recursos de teste da apresentação. -->
# QA funcional da API — 15/10/2026

Stack real: `http://localhost:3001/api`, com o frontend em `http://localhost:8086`. Sem mocks, consultas diretas ao banco, reset, migrations ou mudanças de código. Todo recurso alterado pertence aos tenants novos `QA-20261015-mv9hcuic`. Registros demo foram usados somente para login/leitura e abertura/revogação das sessões criadas por este roteiro.

## Resultado normalizado

| Rodada | Verificações | Resultado esperado | Inesperado | Não avaliado |
| --- | ---: | ---: | ---: | ---: |
| Primária | 113 | 101 | 10 | 2 |
| Adicional, sem ADMIN | 43 | 43 | 0 | 0 |
| Adicional, ADMIN | 30 | 29 | 1 | 0 |
| Limite de DTO Company | 6 | 4 | 2 | 0 |
| **Total** | **192** | **177** | **13** | **2** |

São verificações HTTP e asserções de resposta, não 192 fluxos completos. As 13 verificações inesperadas se agrupam nos problemas abaixo; o problema de Company produz duas falhas para uma mesma causa. Duas asserções da rodada inicial usaram `items[]` em vez do contrato `data[]` e ficaram explicitamente **não avaliadas**. A rodada adicional verificou listas de tenant/pentester usando `data[]` corretamente.

Algumas expectativas iniciais foram corrigidas após conferir o contrato real, preservando `originalExpected` e `reviewNote` no JSON: CLIENT pode listar usuários da própria Company; busca salva alheia recebe 404; transição inválida de finding recebe 400; projeto PENDING recebe 422 ao pedir report-data; playbook por categoria exige companyId; GET /notifications não existe. Esses resultados **não** são bugs do produto.

## Problemas confirmados

### API-01 · P1 · Company aceita escrita em relações fora do DTO

**Prova dinâmica:** CLIENT recém-cadastrado criou sua própria Company. `PUT /companies/:id` com o corpo abaixo retornou **200**; o GET `/users/me` confirmou que o nome do usuário mudou. O nome foi restaurado pelo endpoint legítimo PATCH User. O usuário permaneceu CLIENT/OWNER durante toda a prova.

```json
{
  "users": {
    "update": {
      "where": { "id": "ID_DO_USUARIO_QA_DA_EMPRESA" },
      "data": { "name": "QA-20261015-mv9hcuic Nome alterado pela relação Company" }
    }
  }
}
```

**Causa:** `CompanyController.update` usa cast de `req.body` como DTO e repassa o objeto integral; Service e Repository também o repassam, até `prisma.company.update({data})`. O cast TypeScript não filtra propriedades em runtime. Referências: `app/api/src/controllers/company.controller.ts:93`, `app/api/src/controllers/company.controller.ts:131`, `app/api/src/services/company.service.ts:71`, `app/api/src/repositories/company.repository.ts:28`.

**Impacto inferido e separado da prova:** a relação Prisma `UserUpdateWithoutCompanyInput` também admite `role`, `password` e `companyRole` (`node_modules/.prisma/client/index.d.ts:47752`). A superfície para alterar campos privilegiados está exposta pelo mesmo caminho, mas **não foi executada elevação de papel, alteração de senha ou escrita em outro tenant**. A prova se limitou a nome de um usuário QA. Corrigir a whitelist do DTO é prioritário antes de disponibilizar a instância a terceiros.

Evidência: `api-flows-extra-boundary.json`, casos `company-nested-user-update-should-reject` e `company-dto-blocks-nested-user-write`.

### API-02 · P2 · Lote de maturidade recusado grava dados parciais e média incorreta

**Reprodução:** criar assessment vazia no tenant QA; enviar `scores` com primeiro controle válido (`score:4`) e segundo controle inválido (`score:6`). O POST respondeu **400 INVALID_SCORE_VALUE**, porém GET latest devolveu **1 resposta salva**, `overallScore:0` e `level:BASIC`. A operação recusada já tinha alterado dados e a média deixou de representar as respostas.

**Causa:** `MaturityService.submitScores` valida e persiste cada item dentro do mesmo `for`, sem transação, e só recalcula a média depois do loop. Referências: `app/api/src/services/maturity.service.ts:72`, `:81`, `:92`.

**Estado final do QA:** enviado lote válido de scores 4 e 2; média **3 / INTERMEDIATE**, coerente novamente. Evidência: `api-flows-extra-admin.json`, `maturity-rejected-batch-atomic` contém `scoreCount:1`, `overallScore:0`, `level:BASIC`.

### API-03 · P2 · Perfil aceita nome vazio e email inválido

`PATCH /users/:id` do próprio CLIENT QA aceitou **200** para `{"email":"not-an-email"}` e para `{"name":""}`. Os campos foram restaurados em seguida. O controller extrai nome/email sem validar formato, tipo ou nome mínimo; `UserService.update` verifica autorização, mas não há validação de shape antes do Repository.

Impacto: conta pode ficar com identificador de login fora do formato aceito no cadastro; nome vazio prejudica autores, membros e trilhas que esperam rótulo humano. Referências: `app/api/src/controllers/user.controller.ts:63`, `app/api/src/services/user.service.ts:57`. Evidência primária: `user-update-invalid-email`, `user-update-empty-name`.

### API-04 · P2 · Application aceita nome composto apenas por espaços

`PUT /applications/:id` de CLIENT QA com `{"name":"   "}` respondeu **200**. O nome normal foi restaurado. Project rejeitou o mesmo caso em 400, mostrando inconsistência de validação entre recursos.

Impacto: aplicação fica visualmente sem nome em cards/seletores e perde identificação. Referência: `app/api/src/controllers/application.controller.ts:123`; a criação usa a mesma verificação sem trim em `:90`. A prova dinâmica foi de atualização. Evidência primária: `app-blank-name-validation`.

### API-05 · P3 · Campos opcionais com tipo inválido viram erro interno

`PUT /applications/:id` e `PUT /projects/:id`, em recursos QA, com `{"description":{"test":true}}` responderam **500 INTERNAL_ERROR**. O tipo foi enviado ao Prisma depois de casts TypeScript. Esperado: validação 400 e mensagem de campo inválido. Não houve gravação válida para esses corpos.

Referências: `app/api/src/controllers/application.controller.ts:47`, `:136`; `app/api/src/controllers/project.controller.ts:126`. Evidência primária: `app-description-type`, `project-description-type`.

### API-06 · P3 · Login com email de tipo inválido responde 500

`POST /auth/login` com `{"email":{"bad":true},"password":"qa-not-a-password"}` respondeu **500 INTERNAL_ERROR**. O controller só verifica presença (`if (!email || !password)`) e não confere strings antes de `findByEmail`. Não foi usada senha real nessa prova negativa.

Esperado: 400 de input. Referência: `app/api/src/controllers/auth.controller.ts:59`. Evidência primária: `login-type-email`.

### API-07 · P3 · Paginação aceita valores fracionários e Infinity provoca 500

`GET /vulnerabilities?page=Infinity` respondeu **500 INTERNAL_ERROR**. `page=1.5`, `pageSize=1.5` e `/vulnerabilities/:id/comments?page=1.5` receberam **200**. A normalização usa Number + Math.max/Math.min sem garantir inteiro finito. O Infinity alcança o cálculo de skip da consulta.

Esperado: rejeitar valores não finitos e normalizar/rejeitar fracionários com contrato consistente. Referências: `app/api/src/controllers/vulnerability.controller.ts:173`; `app/api/src/controllers/vulnerability-comment.controller.ts:19`. Evidência primária: quatro casos `finding-filter-*`/`finding-comment-pagination`.

### API-08 · P2 · Pentester recebe ação de duplicar playbook que não consegue concluir

Bruno tem `companyId:null` e foi atribuído ao Project QA. Mesmo assim criar ou clonar playbook responde **422 USER_HAS_NO_COMPANY**. A UI oferece **Duplicar e adaptar** a todo ADMIN/PENTESTER, pois `podeEscrever` só verifica o papel.

As duas respostas 422 são esperadas pelo contrato atual da API e passam nos testes; o problema é a oferta de ação incompatível com o contexto do usuário. É particularmente relevante para o pentester do seed usado na apresentação. A prova de API foi real; presença do botão foi conferida por código, ficando a confirmação visual com o roteiro do navegador.

Referências: `app/api/src/services/remediation-playbook.service.ts:323`; `app/web/src/pages/playbooks-page.tsx:60`, `:217`. Evidência: `api-flows-extra-nonadmin.json`, `playbook-pentester-create-no-company`/`playbook-pentester-clone-no-company`.

## Cobertura dos fluxos e permissões

| Área | Exercitado nesta rodada HTTP |
| --- | --- |
| Saúde e planos | Health200; catálogo público200; seleção do plano ativo para onboarding QA |
| Auth | Login ADMIN/OWNER/MEMBER/2 PENTESTER; cadastro CLIENT ignorando role injetada; token ausente/inválido; refresh rotativo; replay recusado; logout e idempotência |
| Usuários | Projeção sem password/hash; leitura própria e lista do tenant; acesso a usuário alheio403; atualização de perfil QA e validação negativa |
| Empresas | Cadastro de 3 Companies QA; vínculo OWNER; CLIENT não lista Companies globais; tenancy SLA; prova segura de limite do DTO |
| Assinaturas | Solicitação QA201; aprovação ADMIN200; gate de assinatura ativa validado ao criar Application/Project; CLIENT sem lista administrativa403 |
| Applications | Criação201; tenant derivado ignorando companyId demo enviado pelo CLIENT; leitura/lista; update; contexto de risco aumentado; redução recusada; enum/URL inválidos400 |
| Projects | Criação201 herdando tenant; RN05 duplicação409; acesso de membro/cliente; metadados; PENDING→IN_PROGRESS→IN_REVIEW; transições e gate de report |
| ProjectMembers | Atribuição ADMIN201; duplicação409; nome humano `userName`; leitura autorizada; outro tenant403 |
| Findings | Criação201 por PENTESTER atribuído; CVSS5.4/MEDIUM derivado; filtros válidos/inválidos; listagem de tenant; canários de acesso/escrita alheia; CLIENT sem create403 |
| Remediação | Responsável de outro tenant422; atribuição a CLIENT QA200; OPEN→IN_PROGRESS→FIXED→CLOSED; trilha de auditoria200 |
| Comentários/evidências | Comentário CLIENT201; vazio400; leitura alheia403; paginação de comentários; upload/download ficou com navegador |
| SLA | Deadline inicial; política QA versionada; janela fracionária400; salvar não reaplica prazo existente; histórico200; MEMBER/PENTESTER bloqueados |
| Aceite | Pedido PENTESTER201; duplicação409; PENTESTER não decide403; ADMIN aprova200; finding permanece OPEN/SLA ACCEPTED; revogação200 retoma SLA e acumula pausa |
| Maturidade | Catálogo200; criação ADMIN201; CLIENT sem create403; score fora de1..5; lote válido com média3/INTERMEDIATE; leitura por PENTESTER atribuído; lote inválido parcial expôs API-02 |
| Playbooks | Catálogo200; categoria com companyId200; categoria inválida400; System imutável403; CLIENT sem write403; caso de pentester sem company422 |
| Buscas salvas | COMPANY por CLIENT QA201; PRIVATE por PENTESTER201; nome/pinned atualizados; query canônica duplicada409; PENTESTER sem share403; outro usuário/tenant404 |
| Métricas | Summary real200 com OWNER; nenhuma carga de stress ou repetição deliberada do limiter |
| Relatórios | Project PENDING bloqueia422; IN_REVIEW entrega consolidação com findings/maturidade200; metadata EXECUTIVE201; tipo inválido400; acesso de outro tenant403 |
| DAST | CLIENT403; status/lista PENTESTER200. Criação simulada, PDF e triagem ficaram com navegador; não iniciado scan real nesta rodada |

## Recursos criados e estado final

Todos os nomes têm prefixo `QA-20261015-mv9hcuic`. Foram criados **3 usuários CLIENT, 3 Companies, 2 assinaturas aprovadas, 2 Applications, 2 Projects, 1 ProjectMember, 2 findings, 1 comentário, 2 buscas salvas, 1 política SLA da Company A, 1 assessment com 2 respostas, 1 aceite revogado e 1 metadata de relatório executivo**. Sessões e AuditLogs decorrentes também são novos. Senhas aleatórias e tokens não foram gravados em evidências.

| Recurso | ID / estado |
| --- | --- |
| Company A | `cmv9hd79c000fph012iomwajn` |
| Application A | `cmv9hda2r000nph012g2hu7q9` — PROD/HIGH/internet-facing/CONFIDENTIAL, donos QA |
| Project A | `cmv9hdb8i000pph01zb0tb5c4` — **IN_REVIEW**, Bruno atribuído |
| Finding original A | `cmv9hdgf60019ph01d1q43fuf` — **CLOSED**, após todas as transições |
| Finding Aceite/SLA | ID em `api-flows-extra-admin.json → resources.tenantA.riskFindingId` — **OPEN**, atribuído ao OWNER QA A |
| Aceite | ID em `resources.tenantA.acceptanceId` — **REVOKED** |
| Assessment | ID em `resources.tenantA.assessmentId` — **3 / INTERMEDIATE** |
| Project B | `cmv9hdfne0015ph01lswcu2pf` — **PENDING**, sem atribuição a Bruno |
| Company B | `cmv9hdc8j000vph01tez6ofrk` |
| Company da prova DTO | ID em `api-flows-extra-boundary.json → resources.boundary.companyId` — sem assinatura/Application/Project |

## Limites

Não foram executadas exclusões, alterações de catálogo/plano global, resets, migrações, mudança de permissões/senha dos usuários, scans reais, tráfego de teste a terceiros ou envio de email/push. A ação SLA foi somente versionar a política da Company QA, sem reaplicação global ou em massa. O lote inválido de maturidade foi corrigido por um lote válido apenas na assessment QA.

As rodadas compartilharam a mesma instância com o navegador e podem somar consumo de rate limit de ADMIN. Os scripts respeitaram Retry-After e usam pausas entre requests. A interpretação de 429 visuais requer a janela isolada do navegador; nenhum 429 desta rodada foi classificado como bug de produto. Encerrado o tráfego HTTP ao final, antes da janela isolada solicitada.

Não se declara cobertura integral do aplicativo/mobile por estes testes. Exclusões, suspensão/rejeição de assinatura, push em aparelho real, concorrência de refresh, expiração de 15min/7dias, falhas de rede e stress ficam fora desta rodada; PDFs, responsividade e fluxos visuais têm evidências próprias no relatório principal.

## Arquivos de evidência

- `api-flows-results.json` — primária, expectativas normalizadas e notas das correções.
- `api-flows-extra-nonadmin.json` — 43 verificações de auth, escopo, aceite, catálogo e buscas.
- `api-flows-extra-admin.json` — 30 verificações de SLA, maturidade, aceite e report.
- `api-flows-extra-boundary.json` — 6 verificações com prova segura do DTO Company.
- `api-flows.cjs` e `api-flows-extra.cjs` — roteiros locais. Não reexecutar inadvertidamente: o modo principal/boundary cadastra novos recursos QA.
