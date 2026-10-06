<!--
O QUE FAZ: mapeia os dez critérios da issue #20 para implementação e evidências de QA.
POR QUE EXISTE: registra o aceite reproduzível e separa validação concluída de ressalvas técnicas.
QUEM CONSOME: revisão da issue #20, banca e manutenção do fluxo de Project.
-->

# Issue #20 — matriz de QA

**Data:** 2026-10-01 · **Branch:** `fix/20-create-project-flow` · **Estado:** concluída (CP-0 a CP-4, 5/5, 100%). PR ainda não aberta; sem commit/push.

Smoke Playwright CLI passou 1/1 contra a stack real, sem mocks nem trace. A confirmação de persistência foi feita pelo root com consulta Prisma somente leitura; não houve alteração manual de dados nem consulta SQL afirmada.

## Validação

- **Web:** 297/297 testes em 22 suítes; wizard 32/32, Projects 11/11, Applications 21/21; lint com 0 erros e 9 avisos preexistentes; contraste 66/66; builds TypeScript/Vite/Docker aprovados.
- **API:** Project focal 24/24; cobertura de `project.service` 100% linhas/funções, 84,31% branches e 93,2% statements; builds API host/Docker aprovados.
- **API completa:** 598/601 em 43 suítes. As três falhas foram `spawn EPERM` ao inicializar DAST no sandbox; repetição isolada/escalada do grupo DAST passou 17/17. `npm run check` global permanece não verde por `UserEntity` e `UserResponseDTO` preexistentes não usados em `vulnerability.service.ts:45`; não corrigidos nesta issue.
- **Smoke:** duas criações responderam 201; ADMIN sem empresa pessoal e CLIENT foram exercitados pelas origens Projetos/Aplicações. Prisma confirmou exatamente os dois Projects do marcador, IDs esperados e `Project.companyId = Application.companyId = Company esperada`. Cancelar nos quatro passos sem POST, lista sem reload, pré-seleção, teclado/foco, PENTESTER sem CTA e viewports 1440/375 foram aprovados.
- **Rate limit:** a primeira tentativa encontrou HTTP 429 em GET de elegibilidade após burst do dashboard ADMIN; a UI apresentou “Tentar novamente”. O spec passou a respeitar `Retry-After`, inclusive nos GETs de confirmação, e o smoke final passou sem desativar o limiter nem repetir POST.

## Dez critérios de aceite

| # | Critério | Implementação e evidência | Resultado |
| --- | --- | --- | --- |
| 1 | “Novo projeto” disponível para quem pode criar, com lista vazia ou cheia. | CTA no hero e estado vazio ADMIN/CLIENT; PENTESTER sem CTA. Projects 11/11 e smoke confirmaram os papéis. | ✅ |
| 2 | A ação abre o fluxo de criação. | CTA reutiliza `/new-analysis`; origem restrita a `/projects` ou `/applications`. Applications 21/21; smoke percorreu as duas entradas. | ✅ |
| 3 | Seleção de Application válida, com ocupação/inatividade/pré-seleção tratadas. | Wizard valida elegibilidade e `applicationId`, lista conflitos inclusive COMPLETED; Application B usa URL local válida longa, sem acessar o alvo. Wizard 32/32; mobile 375 sem overflow, screenshot revisada. | ✅ |
| 4 | Project pertence à empresa da Application, inclusive para ADMIN sem empresa pessoal. | Service deriva `companyId`; não aceita empresa no payload. Duas criações 201; Prisma somente leitura confirmou os vínculos exatos e os dois registros do marcador. | ✅ |
| 5 | Regras comerciais de assinatura e Plan são respeitadas. | O ProjectService/API aplica ACTIVE/Plan da empresa da Application; cota conta PENDING/IN_PROGRESS/IN_REVIEW; COMPLETED não ocupa capacidade; remediação requer `includesRemediation`; Application ativa; nome após trim de 1–191 code points. PUT protege a transição de remediação e vínculos/status. O wizard valida seleção/nome e apresenta erros, mas não consulta assinatura/Plan para desabilitar o checkbox de remediação. API focal 24/24. | ✅; corrida permanece sem garantia |
| 6 | Aplicações ocupadas ou indisponíveis são identificadas; conflito é tratado. | Wizard exibe motivo/link para Application usada e trata inatividade/409. Testes Web 297/297; regra RN05 da API cobre COMPLETED. Screenshot mobile revisada. | ✅ |
| 7 | Erros compreensíveis preservam dados e direcionam foco. | Nome vazio e erros de negócio/consulta recebem orientação; foco vai ao campo. Web 297/297; smoke conferiu erro/foco; retry de 429 via UI. | ✅ |
| 8 | Novo Project aparece na lista sem refresh manual. | Cache de projetos é invalidado após sucesso; navegação SPA volta à lista atualizada. Smoke confirmou para ADMIN e CLIENT sem reload. | ✅ |
| 9 | Cancelar em qualquer etapa não cria registros parciais. | Cancelar retorna à origem, sem POST antes do submit. Smoke confirmou passos 1–4 sem POST; só os dois submits finais criaram Project. | ✅ |
| 10 | API mantém autorização e isolamento por papel/tenant. | Tenant deriva da Application; PENTESTER continua sem criar. Focal API 24/24; smoke cobriu ADMIN global, CLIENT isolado e PENTESTER sem CTA. | ✅ |

## Ressalvas mantidas

- RN05 permanece um Project por Application, mesmo após `COMPLETED`. A checagem de duplicidade e a contagem de capacidade não são serializadas com create; requests concorrentes podem duplicar projetos ou ultrapassar `maxProjects`. Hardening separado, sem promessa de garantia nesta entrega.
- O gate global API não está verde: há três falhas ambientais `spawn EPERM` no DAST na suíte completa e dois imports de lint preexistentes em `vulnerability.service.ts:45`. A repetição isolada/escalada DAST passou 17/17; os imports não foram corrigidos fora do escopo.
- A primeira tentativa encontrou 429 após burst legítimo de requests do dashboard; a rodada final seguiu `Retry-After` e recuperou pela ação real da UI, sem modificar o limiter.
- Sem alteração de schema, migration, dependências ou lockfile. Branch `fix/20-create-project-flow`; sem commit, push ou PR.

## Evidências

- JSON: [issue20-smoke-evidence.json](issue-20/issue20-smoke-evidence.json). Marcador `E2E20-1790857379051-dgg1z9`; Company `cmupi8tnb0025ow018s67pn70`; Applications `cmupi8twd002fow01r81r8acg` e `cmupi8twv002how01iunwy3x8`; Projects `cmupi93xj002low01w0huund3` e `cmupi9pm3002pow016ngfsa20`.
- Screenshots revisadas: [Projetos 1440 px](issue-20/issue20-projects-1440.png), [wizard 375 px](issue-20/issue20-wizard-aplicacao-375.png), [formulário 1440 px](issue-20/issue20-wizard-passo-3-1440.png), [erro e foco 1440 px](issue-20/issue20-wizard-nome-invalido-1440.png).
- API coverage: `output/issue-20-api-coverage/`.

## Arquivos alterados na Issue #20

**API:** `app/api/src/controllers/project.controller.ts`, `app/api/src/factories/project.factory.ts`, `app/api/src/repositories/project.repository.ts`, `app/api/src/services/project.service.ts`, `app/api/tests/integration/project.test.ts`.

**Web:** `app/web/src/hooks/use-api-error.ts`, `app/web/src/pages/applications-page.tsx`, `app/web/src/pages/applications-page.test.tsx`, `app/web/src/pages/projects-page.tsx`, `app/web/src/pages/projects-page.css`, `app/web/src/pages/projects-page.test.tsx`, `app/web/src/pages/new-analysis-page.tsx`, `app/web/src/pages/new-analysis-page.test.tsx`, `app/web/e2e/create-project-flow.spec.ts`.

**Documentação e QA:** `PRD_VIVO.md`, `docs/BACKLOG.md`, `docs/ROADMAP_PROMPTS.md`, `docs/Vulnera/02-Dominio/Conceitos/Remediation Service.md`, `docs/Vulnera/02-Dominio/Entidades/Plan.md`, `docs/Vulnera/02-Dominio/Regras de Negocio/RN07 - Projeto exige assinatura ativa.md`, `docs/Vulnera/07-Decisoes/ADR-044 - Regras comerciais para criar Project.md`, `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md`, `output/issue-20-qa-report.md`, `output/issue-20/issue20-smoke-evidence.json` e as quatro screenshots listadas acima.
