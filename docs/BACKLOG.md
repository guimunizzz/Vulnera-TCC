# BACKLOG.md — Vulnera

> **v4 · 2026-08-03.** Substitui a versão por sprints com divisão por pessoa (Rafael/Guilherme/Iann). Agora é **fase e checkpoint**, execução solo-delegada.
> Estimativas em horas-equivalentes — servem para dimensionar risco e revisão, não para prever o tempo do agente.
> **Entrega: 25/10/2026.**

## Status

✅ **2026-10-06 — CLIENT editar contexto de risco (100%).** Branch `codex/fix-client-risk-context`, base `origin/dev` em `0638c47` (PR #55 integrada). Select com portal reproduzido atrás do Dialog (`40`/`60`); três controles substituídos por `<select>` nativo com estilo compartilhado. Inputs dos donos e switch preservados e validados. Regressão APP-CTX-01 falha antes e passa depois; edição dos seis campos, salvar/reabrir, bloqueio de redução e recusa FORBIDDEN cobertos. Web focal 24/24, check final **340/340 em 30 suítes**, contraste 66/66, lint 0 erros/9 avisos anteriores e build aprovado. API focal **12/12** em `vulnera_test` isolado confirma persistência real por PUT+GET, OWNER/MEMBER/PENTESTER e TEN-29 com todos os campos de outra Company recusados. Chrome no build de produção com fixtures HTTP: clique/teclado, salvamento/reabertura e mobile 375 px sem overflow/erros JavaScript. Código de produção API/permissões/schema/dependências intactos; check global API segue bloqueado pelos dois imports não usados anteriores em `vulnerability.service.ts:45`. L-19 permanece como evolução da infraestrutura compartilhada.

- [x] **BUG-CLIENT-RISK-CONTEXT:** corrigir interação dos seletores no Dialog e validar os seis campos por CLIENT OWNER, persistência, reabertura e tenancy com regressão. Concluído em 2026-10-06 (100%); regras D2 existentes preservadas.

✅ **2026-10-06 — Publicação da correção dos cards para dev (100%).** [PR #55](https://github.com/guimunizzz/Vulnera-TCC/pull/55) aberto de `codex/fix-project-card-contrast` para `dev`. Commit reaplicado sobre `33f6438`, sem levar a revisão anterior do README. Árvore Web idêntica à já validada; somente página do projeto e docs vivos no diff, com `git diff --check` aprovado. Branch publicada; revisão/checks remotos e merge pendentes.

- [x] **UI-PROJECT-OVERVIEW-PR:** publicar a correção visual e abrir o PR para `dev`. Concluído em 2026-10-06.

✅ **2026-10-06 — Contraste dos cards na Visão geral do projeto (100%).** Branch `codex/fix-project-card-contrast`, base `origin/main` em `a73a926`. Metadados e Pentesters atribuídos usam `Card` com superfície opaca e tokens existentes, preservando textos secundários, controles e decoração externa. Chrome com fixtures locais: escuro desktop/mobile 375 px, estado vazio e claro revisados; alpha 100%, contraste principal 16,60:1/secundário 6,90:1 no escuro, sem overflow mobile ou erros JavaScript. Web `npm run check`: **337/337 em 30 suítes**, lint 0 erros/9 avisos anteriores, contraste 66/66; build TypeScript/Vite aprovado. Sem API, dados, RBAC, entidades, fluxo funcional, manifestos ou lockfile versionado alterados. Validação visual sem banco/API reais; evidências locais preservadas. Host mantém falha npm 10 `edgesOut` e inicialização Docker por socket, contornadas somente para validar com dependências locais/pacotes oficiais.

- [x] **UI-PROJECT-OVERVIEW-CONTRAST:** impedir que linhas/ondas decorativas atravessem Metadados e Pentesters atribuídos, usando superfícies do design system e validando o tema escuro. Concluído em 2026-10-06 (100%).

✅ **2026-10-02 — Plano de ação SAST HIGH preparado (100% do planejamento).** [Plano com impactos e checkpoints](PLANO-ACAO-SAST-HIGH.md): leitura estática concluiu `needs_review` para ambos os IDs, considerando os controles existentes. Matriz de impactos, CP-0 a CP-4, testes de navegador/filesystem/tenancy e fechamento por correção ou exceção individual documentados. **Execução pendente: 0/5 checkpoints; nenhum teste, build, navegador ou scanner executado nesta tarefa.**

- [x] **SAST-HIGH-PLANO:** documentar ação e impactos para XSS/Path Traversal, sem presumir exploração nem falso positivo. Concluído em 2026-10-02.

✅ **2026-10-01 — Texto de issue SAST preparado (100% da redação).** `output/sast-high-findings-issue.md` reúne dois alertas HIGH e critérios de resolução; abertura manual pelo usuário.

- [ ] **SAST-HIGH-XSS:** validar/resolver `d619f81f-c998-486d-9e0c-cc0752719ae4` no HTML de relatório DAST, considerando CSP sandbox existente e testes em navegador. Seguir CP-0/CP-1/CP-3/CP-4 do [plano de ação](PLANO-ACAO-SAST-HIGH.md); incluir consumidor `srcDoc`, subrecursos e prova de acesso à origem.
- [ ] **SAST-HIGH-PATH:** validar/resolver `61fbc613-427f-4676-aff9-c9ddfbbe90e0` no download de evidências, considerando autorização e confinamento de caminho existentes. Seguir CP-0/CP-2/CP-3/CP-4 do [plano de ação](PLANO-ACAO-SAST-HIGH.md); incluir confinamento físico, symlinks/junctions, caminho adulterado para outro tenant e Windows/Linux. Confirmar por regressões e nova execução do SAST; exceção apenas se falso positivo fundamentado.

✅ **2026-10-01 — Merge `dev` na `fix/landing-page` (100%).** A landing pública da branch de fix substitui a página antiga de `dev`; login/cadastro da fix permanecem, e as rotas privadas, módulos e infraestrutura de `dev` foram preservados. Web: build, contraste 66/66 e 268/268 testes aprovados; inspeção visual Chrome headless em 1440×900 e 375×812. API: build aprovado após regenerar o Prisma Client; o `check` segue bloqueado pelos dois imports não usados preexistentes em `vulnerability.service.ts:45`. Sem mudança de schema ou migration. Capturas: `output/landing-merge-desktop.png` e `output/landing-merge-mobile.png`.
✅ **2026-10-01 — Issue #20: criação de Project pela interface (100%; CP-0 a CP-4 validados, 5/5).** Na branch `fix/20-create-project-flow`; PR não aberta, sem commit/push. As regras comerciais usam assinatura ACTIVE e Plan da empresa da Application; `maxProjects` conta PENDING/IN_PROGRESS/IN_REVIEW, não COMPLETED; remediação requer `includesRemediation`; Application deve estar ativa; nome após trim deve conter 1–191 code points. RN05 mantém um Project por Application incluindo COMPLETED. A checagem de duplicidade/capacidade não é serializada com create; corridas permanecem como limitação e hardening concorrente está separado. Web: wizard 32/32, Projects 11/11, Applications 21/21 e suíte final 297/297 em 22 suítes; lint 0 erros/9 avisos preexistentes, contraste 66/66 e build TypeScript/Vite/Docker aprovados. API: Project focal 24/24; cobertura de `project.service`: 100% linhas/funções, 84,31% branches e 93,2% statements; builds host/Docker aprovados. API completa 598/601 em 43 suítes, com 3 falhas ambientais `spawn EPERM` de DAST; repetição isolada/escalada 17/17. `npm run check` global API não está verde por dois imports não usados preexistentes em `vulnerability.service.ts:45`. Smoke CLI real 1/1, sem mocks/trace; duas criações 201, cancelamentos nos passos 1–4 sem POST, cache/lista sem reload, keyboard/foco e mobile 375 sem overflow. Prisma somente leitura confirmou exatamente os dois Projects do marcador e igualdade dos vínculos de empresa esperados; quatro screenshots revisadas e aprovadas. O primeiro smoke encontrou 429 real após burst do dashboard ADMIN; a UI exibiu recuperação e o spec respeita `Retry-After`, sem repetir POST. Sem schema/migration, dependências ou lockfile. Relatório/matriz: `output/issue-20-qa-report.md`; evidência: `output/issue-20/issue20-smoke-evidence.json`.

| CP | Estado | Escopo |
| --- | --- | --- |
| CP-0 | ✅ | Baseline da branch e decisão sobre assinatura, capacidade, remediação, Application inativa, nome e concorrência; ADR-044 e notas de domínio registradas. |
| CP-1 | ✅ | CTA permanente com role em Projetos e estado vazio; `returnTo` restrito às origens Projetos/Aplicações, sem perder a pré-seleção. Focais relatados: Projects 11/11 e Applications 21/21. |
| CP-2 | ✅ | Wizard compartilhado validado: elegibilidade, nome, Cancelar, foco, origem segura e cache. Focal 32/32; Web final 297/297 em 22 suítes, lint 0 erros/9 warnings preexistentes, contraste 66/66 e build TypeScript/Vite/Docker aprovados. |
| CP-3 | ✅ | Gates comerciais no service e regras de atualização; API focal 24/24, cobertura `project.service` 100% linhas/funções, 84,31% branches, 93,2% statements; build API host aprovado. Corrida check/count permanece separada e sem garantia de serialização. |
| CP-4 | ✅ | Web/API builds, smoke CLI 1/1 sem mocks/trace, inspeção visual, evidência JSON/screenshots e confirmação Prisma somente leitura concluídos. API full permanece 598/601 por três `spawn EPERM` ambientais de DAST; repetição isolada/escalada 17/17. O check global API continua bloqueado pelos dois imports não usados preexistentes em `vulnerability.service.ts:45`. |

**Marco intermediário preservado — 2026-10-01 (80%, 4/5), supersedido pelo fechamento acima:** CP-0 a CP-3 estavam validados; o wizard/Web final tinham passado, e o smoke real ainda aguardava. A primeira execução encontrou HTTP 429 no GET de elegibilidade após o burst do dashboard ADMIN. O spec foi ajustado para usar Retry-After e retry real da UI; os resultados finais posteriores constam no fechamento 100% acima, sem remover este histórico.

### Trabalho futuro identificado na Issue #20

- [ ] **Hardening concorrente de Project (RN05 e `maxProjects`):** avaliar os dados existentes e, em tarefa própria, escolher uma estratégia de unicidade/serialização que proteja a regra de um Project por Application e a cota em criações concorrentes. A Issue #20 não escolheu estratégia nem migration; conferir impacto antes de decidir qualquer alteração de schema.
- [ ] **Consultas de elegibilidade e rate limiter:** avaliar o burst de GETs observado como HTTP 429 após o dashboard ADMIN e se a cadência/recuperação das consultas deve ser ajustada. O smoke final recuperou pelo `Retry-After` e pela ação real da UI; nenhum limite foi desativado ou alterado nesta issue.

**Fechamento — Issue #20 (2026-10-01, 100%).** Smoke Playwright real 1/1 em stack sem mocks/trace; Playwright testou as duas origens, os quatro Cancelamentos, resposta 201, listagem sem reload, focus/keyboard, PENTESTER sem CTA e mobile com URL longa. Prisma somente leitura confirmou os IDs de Company/Application/Project do JSON e exatamente dois Projects com empresa herdada corretamente. Quatro screenshots revisadas/aprovadas. Web 297/297 e builds aprovados; API focal 24/24 e builds aprovados. Full API 598/601 pelas três falhas ambientais `spawn EPERM` do DAST, com repetição isolada/escalada 17/17. Check global da API continua não verde por dois imports antigos de lint. Sem migration/dependências; branch `fix/20-create-project-flow`, PR ainda não aberta.
✅ **2026-10-01 — Carregamento na navegação (100%; 4/4).** `codex/fix-page-loading` parte de `origin/dev` em `36fcaec`. Causa HTTP comprovada: quatro métricas simultâneas excedem burst três; retry anterior ignora espera de seis segundos. Recuperação central respeita a API, cache fresco 30 s com invalidação e limpeza por sessão, métricas por aba, contexto da transição preservado e spinner depois de 200 ms. Web 286/286, lint 0 erros/9 avisos conhecidos, contraste 66/66 e build no contêiner. Chrome 17/17 contra API real, incluindo retry real de 6,276 s e 375 px. ADR-044 e `output/page-loading-validation.md`; L-16 concluída. Sem mudança de dependências, banco ou rate limiter; sem push/PR.

| Task | Estado | Entrega |
| --- | --- | --- |
| NAV-01 | ✅ | Diagnóstico e reprodução HTTP do 429, APIs já assíncronas |
| NAV-02 | ✅ | Retry/cache central, invalidações e isolamento de sessão |
| NAV-03 | ✅ | Métricas sob demanda, transição e spinner acessível |
| NAV-04 | ✅ | 286 testes, contraste/build, Chrome 17 checks e docs |

✅ **2026-09-30 — Issue #19: ADMIN criar Application sem `companyId` próprio (100%; CP-0 a CP-3 concluídos, 4/4).** Baseline da branch `fix/19-admin-create-application` (`fecacab3`) comparado a `dev` (`f301fd0`). ADMIN escolhe a empresa no modal; CLIENT permanece confinado à empresa do banco e `companyId` não pode ser atualizado. Smoke Chrome real passou 44/44 verificações. Web: `npm run check -- -- --maxWorkers=1 --silent` aprovado, 257/257 testes em 21 suítes (54,59 s), lint 0 erros/9 avisos preexistentes, contraste 66/66 e build `tsc + vite` aprovado com aviso conhecido de tamanho de bundle. API: focal 42/42, full 588/588 em 43 suítes, build aprovado e cobertura de `application.service` 100% linhas/funções, 85,71% branches, 94,44% statements. **Ressalva:** o `npm run check` global da API continua falhando somente pelos imports preexistentes não usados `UserEntity`/`UserResponseDTO` em `vulnerability.service.ts:45`; o gate global da API não está verde. O lint da API é fora do escopo e não invalida os testes/build aprovados. O smoke confirmou ADMIN sem vínculo e ADMIN vinculado a A criando em B, CLIENT criando em A mesmo com body forjado com B, além de lista, reset, teclado/foco e responsividade. PR ainda não aberta.

| CP | Estado | Escopo |
| --- | --- | --- |
| CP-0 | ✅ | Confirmar branch, HEAD, comparação com `dev` e baseline informado. |
| CP-1 | ✅ | `CreateApplicationInput` aceita alvo opcional; tipo de update exclui empresa; API web de update usa tipo específico; `MISSING_COMPANY_ID` tem mensagem própria. |
| CP-2 | ✅ | Modal e estados ADMIN/CLIENT, proteção de resposta tardia/envio duplicado e smoke Chrome real de 44 verificações. |
| CP-3 | ✅ | API focal 42/42 e full 588/588; Web focal 20/20 e serial 257/257 em 21 suítes; builds Web/API e contraste 66/66 aprovados. Ressalva: `npm run check` global da API acusa somente dois imports preexistentes não usados em `vulnerability.service.ts:45`. |

**Implementação e validação funcional da issue #19 concluídas (100%).** A PR ainda não foi aberta. O resultado serial Web substitui o baseline paralelo de 237/240: Remediação e SLA passaram na execução final; não há causa comprovada para as falhas anteriores.

### Marco intermediário — CP-0 a CP-2 (75%), substituído pelo resultado final acima

O estado intermediário e o baseline paralelo de 237/240 foram registrados antes da validação serial final. As falhas de Remediação/SLA não persistiram na execução final; a causa das falhas paralelas não foi determinada.

### Marco administrativo - 2026-09-30

Commit local `7b847c4` (`7b847c473e10ed1ca93e787704ed9a91dd1f70ab`), mensagem `fix(application): complete admin company selection flow`. O push final ficara com o usuario; nenhum push ocorreu e PR ainda nao foi aberta.

### Registro histórico — estado após CP-1, substituído em 2026-09-30 após CP-2

O snapshot abaixo preserva o progresso inicial de 50% registrado antes da
implementação e do smoke real do modal.

> 🚧 **2026-09-30 — Issue #19 (50%; CP-0 e CP-1 concluídos, 2/4).** Baseline da branch `fix/19-admin-create-application` (`fecacab3`) comparado a `dev` (`f301fd0`); contratos web de create/update e tradução de `MISSING_COMPANY_ID` alinhados. O agente de CP-1 não executou testes/build. A validação ocorreu depois: duas execuções complementares da API somaram 580/580 testes em 43 suítes, com build API e `tsc` Web aprovados. No baseline Web paralelo, build aprovado, lint 0 erros/9 avisos, contraste 66/66 e testes 237/240, ainda aguardando execução serial.

| CP | Estado naquele marco | Escopo |
| --- | --- | --- |
| CP-0 | ✅ | Confirmar branch, HEAD, comparação com `dev` e baseline. |
| CP-1 | ✅ | Contrato web create/update e mensagem `MISSING_COMPANY_ID`. |
| CP-2 | 🚧 | Modal e fluxo ADMIN/CLIENT ainda não implementados. |
| CP-3 | 📋 | Testes, validação final, evidências e fechamento. |

✅ **2026-09-29 — Aceite final DAST:** todos os requisitos solicitados de modo explícito, consentimento, retry, falha tratada e relatório real validados. Fila/watchdog atual mantida; mensageria externa não adicionada. Relatório `docs/DAST-VALIDACAO-2026-09-28.md` e evidências versionadas; pendências técnicas ampliadas abaixo não são apresentadas como concluídas.

**✅ 2026-09-28 — DAST explícito e baseline real (100% do escopo solicitado).** Branch `feat/dast-real-explicit-mode`: escolha Simulado/Real, segundo aviso e confirmação exigida também pela API; demo sem tráfego, falha real sem fallback; GET limitado com análise passiva do ZAP, retries de leitura e diagnóstico de rede/memória. Padrão de um ZAP de 2 GiB/2 CPUs para WSL de 4 GB. Scan real executado em alvo local controlado. Validação, limites e pendências preexistentes em `docs/DAST-VALIDACAO-2026-09-28.md`; decisão ADR-042. Sem migration ou alteração de dependências.

✅ **2026-09-28 — Diagnóstico OWASP ZAP na WSL de 4 GB (100% da análise):** três falhas reais confirmadas nos logs/banco, seguidas de fallback simulado. Configuração permite 2 × 2 GiB; execução isolada também falha, sem prova de OOM. Relatório: `docs/DAST-DIAGNOSTICO-2026-09-28.md`. Registro histórico da análise inicial; as correções posteriores estão na entrega acima.

Pendências derivadas desta análise (não alteram os marcos históricos de entrega do DAST):

- [x] DAST-DIAG-01a — Separar demo explícita de falha real; impedir promoção/comparação operacional de simulado. Inclui segundo aviso e confirmação da API.
- [x] DAST-DIAG-02 — Baseline sem active scan, sem formulários, com allowlist GET/origem/subárvore e validação local de tráfego/redirects.
- [x] DAST-DIAG-03a — Perfil WSL 4 GB: um scan, teto de 2 GiB/2 CPUs e crawling limitado; execução real pequena comprovada.
- [x] DAST-DIAG-04a — Diagnóstico por fase/endpoint, logs e OOM antes da limpeza, retries limitados de leitura e heartbeat durante espera.
- [x] DAST-DIAG-05a — Drenar fila passiva antes de publicar, falhar explicitamente se não drenar; validar relatório real sem simulação em alvo local.
- [ ] DAST-DIAG-01b — Preservar/publicar achados reais parciais com cobertura identificada, sem tratá-los como scan completo.
- [ ] DAST-DIAG-03b — Medir picos contínuos de RAM/CPU por escopo; amostra pontual não dimensiona sites grandes.
- [ ] DAST-DIAG-04b — Ampliar diagnóstico de encerramento por exit code além de OOM/heap/rede; retenção automática de relatórios/logs.
- [ ] DAST-DIAG-05b — Fixar versão/digest do ZAP para reprodução; imagem `stable` observada como 2.17.0.
- [ ] DAST-FUT-01 — Confinamento por IP resolvido/egress contra DNS rebinding; permanece limitação anterior, não resolvida por filtros de URL.
- [ ] WEB-TEST-REM-01 — Investigar `remediation-page-flow.test.tsx:47`: falha de carregamento/region reproduzida na suíte completa e isolada em 2026-09-28; fora do escopo DAST.
- [ ] DAST-FUT-02 — Identificar cobertura de baseline versus scans ativos históricos na comparação (sem mudança de schema nesta sessão).

✅ **2026-09-23 — Área autenticada unificada (100%; branch `feat/visual-overhaul-authenticated`):** fundo padrão no `AppLayout` com grade, luz e cena opcional única; identidade de aplicação, projeto, finding, DAST, maturidade, playbook e governança por superfícies semânticas; wizards com transição Motion e redução de movimento; hash CSP do tema corrigido para CRLF. Web versionado 237/237, contraste 66/66, lint 0 erros e build Docker verde. Browser 1440/768/375 px, dark/light/reduced-motion sem overflow/canvas duplicado; detalhe DAST sem scan demo. Suíte completa 237/239 porque dois testes não rastreados preexistentes falham. Ver `docs/FRONTEND_WEB.md`, ADR-041 e `output/frontend-visual-overhaul-report.md`.

✅ **2026-09-23 — Ajuste visual de Remediação e SLA (100%; commit local em `feat/remediation-sla-visual`):** quadro de três etapas com movimento após confirmação e atribuição lazy; política de quatro severidades com Salvar/Reaplicar separados e histórico responsivo. Web 236/236 em contêiner, contraste 66/66, lint 0 erros e build Docker verde; validação real em desktop/tablet/mobile e dark/light. Sem alterações de API, banco, RBAC, dependências ou lockfile. Ver `output/remediation-sla-visual-report.md`.

✅ **2026-09-23 — Ajuste visual de Findings (100%)**: hero de triagem, ondas Three.js e órbitas nos resumos com um único canvas lazy; fundo CSS discreto, pausa manual e movimento reduzido. Filtros, tabela canônica e contagens do recorte preservados. Web 231/231, contraste 66/66, lint 0 erros (9 avisos preexistentes) e build Docker verde. Validação visual desktop/mobile 375 px, claro/escuro, pausa e filtro de severidade. Sem alteração de API, banco, RBAC ou dependências.

✅ **2026-09-23 — Ajuste visual de Aplicações e Projetos (100%)**: ocupação real do plano e recuperação de erro no inventário; portfólio com contagens pelos quatro estados reais, links acessíveis e estados de carregamento/vazio/erro. As tabelas viram cartões no celular usando o mesmo DOM. Web 228/228, contraste 66/66, lint 0 erros (9 avisos preexistentes) e build Docker verde. Sem alteração de API, banco, RBAC ou dependências.

✅ **2026-09-22 — Ajuste visual do dashboard (100%)**: hero compartilhado nos três perfis, refinamento ADMIN, ondas Three.js no fundo e órbitas nos KPIs usando um único canvas lazy. Fallback estático para mobile/reduced-motion/ausência de WebGL, cleanup e pausa por visibilidade. Build Docker verde; 221 testes web e 66 pares de contraste aprovados; validação visual ADMIN em 1440/1024/768/375 px e dark/light/system. Sem alteração de API, banco, RBAC ou dependências. Relatório em `docs/DASHBOARD_VISUAL.md`.

✅ **2026-09-22 — Ajuste visual de Aplicações (100%)**: inventário com hero CSS estático, capacidade e resultado da busca derivados de dados existentes, skeleton, tabela mais legível e `ScrollArea` acessível para colunas largas no mobile. Entrada curta de linhas por Motion; nenhuma cena Three.js adicionada. Cobertura `APP-VIS-01/02`, build Docker aprovado, Web 223/223, contraste 66/66 e lint 0 erros (9 avisos preexistentes). Sem alteração de API, banco, RBAC ou dependências.

| Fase               | Escopo                                             | Estado         |
| ------------------ | -------------------------------------------------- | -------------- |
| 0 Refactor         | Alinhamento com CLAUDE.md                          | ✅             |
| 1 Fundação         | Infra, schema, CI, migrations, seed, testes        | ✅ backend     |
| 2 Auth + User      | JWT, refresh rotativo, CRUD, factories             | ✅ backend     |
| 3 Empresas         | Refactor plural + Subscription + bootstrap web     | ✅ concluída 2026-08-04 |
| 4 Projetos         | Application + Project + Member + telas             | ✅ concluída 2026-08-04 |
| **5 Findings**     | **Vulnerability + Evidence** ⭐                    | ✅ concluída 2026-08-05 |
| 6 Relatórios       | report-data + PDFs pdf-lib + dashboards            | ✅ concluída 2026-08-07 |
| **6.5 Design System** | **Tokens OKLCH, componentes próprios, temas, métricas, dashboards** | ✅ concluída 2026-08-09 |
| 7 Mobile           | Expo enxuto + Push                                 | ✅ concluída 2026-08-10 |
| 8 Maturidade + TCC | Checklist + demo + Sonar/ZAP + docs                | 🚧 CP1-3 + CP4(ZAP) + docs concluídos 2026-08-11; Sonar bloqueado em Rafael |
| **9 Findings Globais** | **Busca global + query wizard + tabela canônica** | ✅ concluída 2026-09-14 |
| **9 DAST (OWASP ZAP)** | **Scans automatizados: runner Docker, pipeline de findings, API, UI, PDF** | ✅ concluída 2026-09-05 |
| **9.1 DAST: scan real na stack** | **ZAP em modo daemon por scan, watchdog (máx. 2), % de progresso, simulado visível** | 🚧 código pronto 2026-09-09, em revisão |
| **9.2 DAST: o que fazer com o resultado** | **Triagem, promoção para `Vulnerability`, comparação entre execuções + limites de recurso por container** | 🚧 código pronto 2026-09-09, em revisão |

✅ **Frontend web bootstrapado na Fase 3** (2026-08-04) — `app/web` tem Vite+React+TS+Tailwind+Radix+TanStack Query+Zustand+Axios, com Login/Register/Dashboard/Plans/Onboarding/PendingSubscriptions funcionando ponta a ponta (smoke E2E manual validado no navegador). Próximas fases só adicionam telas, não infraestrutura.

Restante estimado: **~200h-equivalente** em 12 semanas.

---

## Cronograma

| Semanas | Período       | Fase                         |
| ------- | ------------- | ---------------------------- |
| 1–2     | 04/08 → 17/08 | 3 — Empresas + bootstrap web |
| 3–4     | 18/08 → 31/08 | 4 — Projetos                 |
| 5–7     | 01/09 → 21/09 | 5 — Findings ⭐              |
| 8–9     | 22/09 → 05/10 | 6 — Relatórios               |
| 10–11   | 06/10 → 15/10 | 7 — Mobile                   |
| 12      | 16/10 → 25/10 | 8 — Maturidade + fechamento  |

> **Sem buffer.** Válvula de escape: atraso acumulado > 1 semana até o fim da Fase 6 → a Fase 7 encolhe primeiro (mobile vira demo de telas com seed, sem push funcional).

---

## FASE 3 — Empresas + bootstrap web (~44h) — ✅ concluída em 2026-08-04

| #    | Task                                                            | h   | Estado |
| ---- | --------------------------------------------------------------- | --- | ------ |
| 3.0  | Auditoria: schema, completude de company/plan, `npm run check`  | 2   | ✅     |
| 3.1  | Refactor plural (`git mv` + imports + docs/architecture.md)     | 3   | ✅     |
| 3.2  | Completar schema com os models faltantes + migration            | 3   | ✅ não precisou — schema já tinha os 19 models |
| 3.3  | `require-role` middleware                                       | 1   | ✅     |
| 3.4  | AuditLog repository                                             | 2   | ✅     |
| 3.5  | Completar Plan (GET público, CUD admin, BASIC/PRO/Enterprise)   | 3   | ✅     |
| 3.6  | Completar Company + vínculo de owner                            | 4   | ✅     |
| 3.7  | Subscription + approve/reject + invariante 1-ACTIVE + auditoria | 7   | ✅     |
| 3.8  | Testes PLAN/COMP/SUB                                            | 5   | ✅     |
| 3.9  | Bootstrap web: Vite, Tailwind, Radix, TanStack, Zustand, Axios  | 5   | ✅     |
| 3.10 | UI base + client.ts com fila de refresh + auth store            | 5   | ✅     |
| 3.11 | Login, Register, ProtectedRoute, Dashboard stub                 | 4   | ✅     |
| 3.12 | Plans pública + Onboarding wizard + PendingSubscriptions        | 10  | ✅     |

## FASE 4 — Projetos (~33h) — ✅ concluída em 2026-08-04

| #   | Task                                                    | h   | Estado |
| --- | ------------------------------------------------------- | --- | ------ |
| 4.1 | Application CRUD + gate de limite do plano              | 7   | ✅     |
| 4.2 | Project CRUD + máquina de estados + `/transition`       | 7   | ✅     |
| 4.3 | ProjectMember subrota (gestão ADMIN, leitura ampliada)  | 5   | ✅ leitura ampliada pra CLIENT/PENTESTER-membro além de ADMIN — não estava no texto original, necessário pra ProjectDetail funcionar |
| 4.4 | Testes APP/PROJ + TEN-01..05                            | 7   | ✅ 20 testes novos, cobertura services 85-100% |
| 4.5 | Applications + wizard NewAnalysis                       | 8   | ✅     |
| 4.6 | ProjectDetail com abas + gestão de membros + breadcrumb | 6   | ✅     |

## FASE 5 — Findings ⭐ (~46h) — ✅ concluída em 2026-08-05

| #   | Task                                                              | h   | Estado |
| --- | ----------------------------------------------------------------- | --- | ------ |
| 5.1 | `cvss.util` — parser manual 3.1 + testes com vectors conhecidos   | 4   | ✅     |
| 5.2 | Vulnerability CRUD + transition + override justificado            | 9   | ✅ máquina simplificada de 4 estados (mesmo padrão do Project); DELETE ADMIN-only |
| 5.3 | Evidence multipart (MIME + magic number + UUID) + GET autenticado | 8   | ✅ Content-Type declarado é ignorado — magic number é a única fonte de verdade |
| 5.4 | VulnerabilityComment nested paginado                              | 4   | ✅ qualquer ator com acesso de leitura comenta, não só ADMIN/PENTESTER |
| 5.5 | AuditLog integrado (override + transition)                        | 3   | ✅ + CREATE (RN20) e SEVERITY_CHANGE em edição de vetor (RN21) |
| 5.6 | Testes BIZ-03..09 + TEN-06                                        | 8   | ✅ 24 testes novos (13 unit CVSS + 11 integração), 97/97 total |
| 5.7 | Lista de findings com filtros e badges                            | 4   | ✅ + contador de críticos abertos no header do projeto |
| 5.8 | FindingEditor (CVSS live, drag-drop, comentários, override)       | 10  | ✅ + FindingDetail read-only separado pro CLIENT |

## FASE 6 — Relatórios (~34h) — ✅ concluída em 2026-08-07

| #   | Task                                                 | h   | Estado |
| --- | ---------------------------------------------------- | --- | ------ |
| 6.1 | `GET /projects/:id/report-data` consolidado          | 5   | ✅ RN18 aplicada (Project precisa IN_REVIEW/COMPLETED, 422 PROJECT_NOT_READY_FOR_REPORT) |
| 6.2 | Report metadata + AuditLog                           | 2   | ✅ AuditLog REPORT_GENERATED; quem gera inclui CLIENT (PDF client-side: gerar = baixar) |
| 6.3 | Testes RPT-01..03                                    | 3   | ✅ 9 testes de report (+1 subscription/active), 107/107 total |
| 6.4 | `lib/pdf/base.ts` — helpers, gráfico de barras à mão | 6   | ✅ + `sanitizeForFont` (achado no smoke: WinAnsi não cobre emoji/setas) |
| 6.5 | PDF Executivo                                        | 6   | ✅ capa + sumário + KPIs + gráfico + top 5 riscos + maturidade placeholder + conclusão |
| 6.6 | PDF Técnico (com evidências embutidas)               | 7   | ✅ embedPng/embedJpg + comentários + glossário |
| 6.7 | Dashboards cliente / pentester / admin               | 5   | ✅ + `GET /subscriptions/active` (novo, admin-only) pro KPI "empresas ativas" |

> ⚠️ **pdf-lib é imperativo.** Sem componentes React: cria-se o documento e desenha-se por coordenada. Gráficos são retângulos e linhas desenhados à mão. Reservar tempo de aprendizado na 6.4.

## FASE 6.5 — Design System + Dashboards analíticos (~50h) — ✅ concluída em 2026-08-09

| #    | Task                                                          | h  | Estado |
| ---- | ------------------------------------------------------------- | -- | ------ |
| 6.5.1 | Tokens OKLCH (7 rampas × 11 passos) + escalas + 3 temas       | 8  | ✅ primitivo × semântico imposto por build: `bg-iris-500` não compila |
| 6.5.2 | `check-contrast.mjs` + calibragem WCAG dos dois temas         | 5  | ✅ 66 pares, 0 falhas; pegou 4 reprovações e 15 cores fora do gamut |
| 6.5.3 | `/styleguide` com os dois temas lado a lado                   | 3  | ✅ só em dev (`import.meta.env.DEV`) |
| 6.5.4 | ~30 componentes próprios + remoção do Radix                   | 14 | ✅ ADR-023; `react-select` era dependência morta |
| 6.5.5 | Contrato de acessibilidade documentado e testado              | 5  | ✅ A11Y-01..14 + axe-core; achou bug no `offsetParent` |
| 6.5.6 | Camada de movimento (`motion`) + `prefers-reduced-motion`     | 4  | ✅ hook central, 8 padrões |
| 6.5.7 | Backend de métricas: 4 endpoints, agregação no banco          | 8  | ✅ ADR-025; sem migration |
| 6.5.8 | Testes MET-01..18 + TEN-14..17 + desempenho com 500 findings  | 5  | ✅ 225 → 247; 9–17 ms por endpoint |
| 6.5.9 | Dashboard de 4 abas + 5 gráficos tematizados                  | 8  | ✅ estado vazio desenhado, skeleton com a forma final, tooltip absoluto+relativo |
| 6.5.10 | Filtros na URL + filtragem cruzada + chips                   | 5  | ✅ `useSearchParams` como fonte única; URL vence localStorage |
| 6.5.11 | Migração das telas para os tokens                            | 6  | 🚧 tokens e componentes em todas as 13; **falta polimento de skeleton/vazio/erro** nas telas que só receberam a migração mecânica |
| 6.5.12 | `seed-demo.ts` (90 findings em 90 dias)                      | 3  | ✅ semente fixa, idempotente, `--volume=500` |
| 6.5.13 | Validação visual no navegador real                           | 3  | ❌ **bloqueada** — extensão do Chrome não conectou |
| 6.5.14 | ADRs 022-025 + `docs/DESIGN_SYSTEM.md`                       | 4  | ✅ ADR-024 reverte o corte de "toggle de tema" |

## FASE 7 — Mobile enxuto (~24h) — ✅ concluída em 2026-08-10

| #   | Task                                                     | h   | Estado |
| --- | -------------------------------------------------------- | --- | ------ |
| 7.1 | Bootstrap Expo + Router + client com SecureStore         | 6   | ✅ Expo SDK 57 + expo-router + tema portado de `tokens.css` (OKLCH→hex convertido, ver histórico) |
| 7.2 | Login + Home + ProjectDetail                             | 7   | ✅ + bloqueio explícito de ADMIN/PENTESTER no login (mobile é exclusivo do CLIENT) |
| 7.3 | FindingDetail read-only + Configurações                  | 5   | ✅ evidências em carrossel com header autenticado; Configurações com status de push + logout |
| 7.4 | Push: migration + endpoint + registro + trigger CRITICAL | 6   | ✅ diff da migration mostrado e só aplicado após confirmação explícita do Rafael |

> Escopo deliberadamente cortado: sem criação/edição, sem upload, sem PDF, sem telas de admin ou pentester. Se estourar o prazo, corte mais do mobile — nunca do backend.
>
> **Deviations conscientes do `docs/DESIGN_SYSTEM.md` §8** ("o que portar pra Fase 7"): motion/`prefers-reduced-motion` e fontes customizadas (Archivo/JetBrains Mono via `expo-font`) NÃO foram portados — fora do escopo enxuto pedido no prompt da fase (o app usa a fonte padrão do sistema e não tem nenhuma transição animada). Cor, escala tipográfica/espaçamento/raio e vocabulário `-ink`/`-surface` foram portados à risca. Contrato de acessibilidade: pass básico feito (`accessibilityRole`/`accessibilityLabel`/`accessibilityState` nos componentes interativos principais — Button, Card), mas não tem o mesmo rigor da Fase 6.5 (sem teste automatizado de a11y no mobile, sem auditoria completa) — trabalho futuro se o mobile ganhar mais telas.

## FASE 8 — Maturidade + TCC (~32h)

| #   | Task                                                            | h   | Estado |
| --- | --------------------------------------------------------------- | --- | ------ |
| 8.1 | Seed de domínios e perguntas do checklist                       | 3   | ✅ 7 domínios × 4 perguntas, upsert |
| 8.2 | MaturityAssessment CRUD + scores em batch                       | 5   | ✅ RN19; 10 testes MAT-01..03; achou/corrigiu bug em `cleanDatabase()` (faltava `maturityAssessment`) |
| 8.3 | Tela de avaliação + radar                                       | 6   | ✅ `maturity-assessment-page.tsx` + `MaturityRadar` (Recharts); entrada nos 3 dashboards |
| 8.4 | Maturidade no PDF executivo (radar à mão com pdf-lib)           | 3   | ✅ `drawRadarChart` novo (coordenada de `drawSvgPath` validada em smoke isolado antes); `report.service.ts` parou de devolver `maturity: null` fixo |
| 8.5 | Seed demo TechNova (5 apps, 10 findings, maturidade preenchida) | 4   | ✅ 2C/3H/3M/2L exato, 2 evidências, 4 comentários, 1 avaliação (28 respostas); idempotente, contagens conferidas |
| 8.6 | SonarQube (pipeline) + ZAP baseline — evidências capturadas     | 3   | 🚧 ZAP ✅ (0 FAIL/5 WARN/62 PASS, `docs/evidencias/zap/`); Sonar bloqueado — CI nunca rodou (mismatch `dev`/`develop`, corrigido), falta abrir PR (ação do Rafael) |
| 8.7 | `docs/DEMO.md` + README + diagrama + limitações conhecidas (base pronta: ver "Limitações conhecidas — Fase 5" no fim deste arquivo) | 5   | ✅ README.md + docs/DEMO.md, screenshots reais via Playwright, diagrama Mermaid |
| 8.9 | (descoberta 2026-08-07) Rota DELETE de Evidence — hoje não existe (L-05) | 1 | 📋 |
| 8.10 | (descoberta 2026-08-07) Rate limiting em upload e login (L-07)  | 2   | ✅ Concluída em 2026-09-21 — camadas global/tenant/user/write/endpoint/auth, Token Bucket limitado, testes e cenários k6/JMeter; ver ADR-040 |
| 8.11 | (descoberta 2026-08-07) PDF Executivo: título longo sobrepõe o texto de CVSS/OWASP no "Top 5 riscos" (`lib/pdf/executive.ts`) | 1 | 📋 |
| 8.12 | (descoberta 2026-08-18, `fix/landing-publica`) Landing "cena Three.js" completa (efeito ASCII, samurai procedural, mergulho de câmera por scroll) — nunca foi implementada em nenhum formato neste repositório. KAN-110 ganhou só o placeholder mínimo (ver PRD_VIVO.md); a versão 3D descrita na issue original fica como feature nova, não bugfix. Exige `useHeroScene` com `dispose()`/`cancelAnimationFrame`/descarte de render targets no unmount (evitar vazar contexto WebGL a cada navegação landing↔dashboard) | 8 | ✅ Concluída em 2026-08-19 — ver PRD_VIVO.md §6 e ADR-026 |
| 8.8 | Smoke E2E cronometrado + tag `v1.0.0`                           | 3   | 📋     |

> Slides e ensaios ficam com o Rafael, fora da contagem.
> **Maturidade simplificada:** checklist de perguntas por domínio, escala 1–5, média simples. Sem scoring ponderado, sem níveis por domínio, sem comparativo histórico.

## FASE 9 — DAST (OWASP ZAP) — ✅ concluída em 2026-09-05

| #    | Task                                                             | Estado |
| ---- | ----------------------------------------------------------------- | ------ |
| 9.0  | Reconhecimento: flags do `zap-full-scan.py`, exit codes, estrutura do JSON | ✅ exit code ≠ 0 confirmado como normal (WARN sem FAIL); JSON real capturado virou fixture de teste |
| 9.1  | Schema `DastScan`/`DastFinding` + migration                       | ✅ enum nativo (exceção à filosofia do schema, confirmada com o Rafael) |
| 9.2  | `zap-runner.service.ts` — execFile, SSRF, timeout, cancelamento, fallback simulado | ✅ achado real: timeout de `isDockerAvailable()` (5s) baixo demais nesta máquina, subido pra 10s |
| 9.3  | `dast-findings.service.ts` — parse, normalização, fingerprint, escopo | ✅ validado contra JSON real (24 findings, contadores batendo) |
| 9.4  | API REST (model/repo/service/controller/factory/routes) + RBAC   | ✅ 7 rotas, ownership fina no service, `requestedByName` resolvido pro PDF |
| 9.5  | Testes SEC/RBAC/PIPE/LIFE                                        | ✅ 42 testes novos (315/315 total), cobertura 89-96% nos 3 services novos, sem depender de Docker (`DAST_FORCE_SIMULATE`) |
| 9.6  | Interface `/dast` (lista) + `/dast/scans/:id` (detalhe + polling) + `/dast/scans/:id/report` (iframe ZAP) | ✅ tabela HTML manual (mesmo padrão de `applications-page.tsx`), linha expansível construída do zero (não existia no design system) |
| 9.7  | PDF client-side (`lib/pdf/dast-report.ts`)                       | ✅ reaproveita 100% `lib/pdf/base.ts`; validado com dado real + emoji + texto longo (13 páginas, PDF válido) |
| 9.8  | Validação end-to-end (Juice Shop + testasp.vulnweb.com)          | ✅ ver `docs/DAST.md` §9 e PRD_VIVO.md §6 |
| 9.9  | `docs/DAST.md` + 3 ADRs (028-030) + docs vivos                   | ✅ |

> **Achado de infra (não específico do DAST):** `npm run check` do backend estava quebrado ANTES de qualquer código do módulo — Prisma Client desatualizado + `expo-server-sdk` ausente do `node_modules` + migration `add_expo_push_token` não aplicada no banco de teste. Resolvido como pré-requisito. Ver PRD_VIVO.md §7 (bloqueios).
>
> **Validação visual:** extensão do Chrome não conectou nesta sessão (mesmo bloqueio recorrente de sessões anteriores) — resolvido com o MESMO fallback já comprovado no projeto (Playwright ad-hoc, instalado no scratchpad): 26/26 checks contra a stack de dev real (`npm run dev` nos dois workspaces), cobrindo RBAC visual, responsivo (375/768/1440), polling ao vivo, expansão de linha, filtro/busca, download de PDF via clique real e abertura do relatório HTML do ZAP em nova aba — nenhum erro de console.

## FASE 9.1 — DAST: scan real na stack Docker + watchdog + progresso — 🚧 código pronto, em revisão (2026-09-09)

> Motivada pelo diagnóstico `docs/DAST-DOCKER-GAP.md` (2026-09-06: dentro do
> `docker compose`, TODO scan caía silenciosamente no simulado) somada ao
> requisito novo do Rafael: container do ZAP criado sob demanda, **máximo 2
> scans por vez com aviso em caso de erro**, e **percentual de progresso na
> UI** — mantendo o resultado simulado, com mensagem amigável, quando o real
> falhar. Decisão: `ADR-031`.

| #     | Task                                                        | Estado |
| ----- | ----------------------------------------------------------- | ------ |
| 9.1.1 | Runner em modo daemon conduzido pela API HTTP do ZAP        | ✅ único jeito de obter % real; `zap-full-scan.py` não expõe progresso. Continua 1 container por scan. O bind mount de relatório sumiu — a "Causa 3" do relatório deixou de existir |
| 9.1.2 | DooD: `docker-cli` na imagem da API + socket do host montado | ✅ Causas 1 e 2. Usuário `vulnera` no GID 0 (socket do Docker Desktop é `root:root 0660`). Rede fixa `vulnera-net` |
| 9.1.3 | Watchdog: fila FIFO, máx. 2 simultâneos, abort de travado, alertas | ✅ `dast-watchdog.service.ts`, singleton injetado pela factory |
| 9.1.4 | Migration `progress`/`phase`/`simulated`/`warningMessage` + `GET /status` | ✅ escrita de progresso com throttle; rota literal registrada antes de `/:id` |
| 9.1.5 | UI: barra de progresso, posição na fila, selo "simulado", banner do módulo | ✅ `dast-status-banner.tsx` novo; polling 5s → 3s |
| 9.1.6 | Fallback amigável (falha do real mantém o simulado)          | ✅ exceto cancelamento |
| 9.1.7 | Testes                                                       | ✅ 315 → **333** (runner reescrito, watchdog novo com DAST-WD-01..07, +4 de integração) |
| 9.1.8 | Validação real na stack                                      | ✅ `example.com` em 47s com 7 alertas reais (ZAP 2.17.0); na stack, 3 scans disparados juntos → 2 rodando + 1 na fila, progresso real por fase |
| 9.1.9 | ADR-031 + `DAST.md` + cabeçalho ✅ no `DAST-DOCKER-GAP.md` + docs vivos | ✅ |

> **Achado de ambiente, corrigido como pré-requisito:** `.env.test` local não
> tinha `DAST_FORCE_SIMULATE=true` (embora `dast.test.ts` afirmasse que sim) e
> o banco `vulnera_test` estava sem as tabelas do DAST — a suíte inteira estava
> vermelha por motivo alheio ao código. Ver PRD_VIVO §3 (FEAT-09.1).

---

## FASE 9.2 — DAST: o que o pentester faz com o resultado — 🚧 código pronto, em revisão (2026-09-09)

> Pedido do Rafael: garantir que o watchdog respeita os limites, que o scan
> funciona de verdade, e dar ao pentester o que fazer com o resultado. As três
> frentes foram escolhidas por ele. Decisão em **ADR-032**.

| #     | Task                                                         | Status / notas |
| ----- | ------------------------------------------------------------ | -------------- |
| 9.2.0 | Verificar na stack real o que a 9.1 entregou                 | ✅ DooD confirmado dentro do container; **3 scans juntos → exatamente 2 containers ZAP + 1 na fila**, FIFO end-to-end; 3 scans reais com `simulated: false` em 39-52s |
| 9.2.1 | Limites de RAM/CPU por container do ZAP **(descoberta)**     | ✅ o watchdog limitava *quantos*, nada limitava *quanto*: 2 scans ocupavam ~960% de 1200% de CPU sem teto de RAM. `DAST_ZAP_MEMORY`/`DAST_ZAP_CPUS` + `-Xmx` derivado (o `zap.sh` lê a RAM do host, não do cgroup — sem `-Xmx` a JVM morre por OOM) |
| 9.2.2 | Dois buracos de heartbeat do watchdog **(descoberta)**       | ✅ `withKeepAlive()`: pull da imagem no 1º scan de uma máquina (~3.7GB) e download dos relatórios (2×120s) passavam dos 2min de silêncio e seriam abortados |
| 9.2.3 | Triagem de finding no silo (enum + nota + autor + data)      | ✅ `PATCH /dast/scans/findings/:id/triage`; UI salva no clique; coluna "Triagem" na tabela |
| 9.2.4 | Promoção de finding → `Vulnerability`                        | ✅ fecha os 4 pontos abertos do ADR-029. Vetor CVSS **sugerido e revisado por humano**, nunca inventado — RN10 intacta. Dedup pelo `@unique` do banco; FK `SetNull` pra vulnerability sobreviver ao scan |
| 9.2.5 | Comparação entre duas execuções do mesmo alvo                | ✅ diff por `fingerprint`; validado com 2 scans reais: 11 persistentes, 0 resolvidos, 0 novos |
| 9.2.6 | Testes de integração e unidade                               | ✅ 333 → **353** (`dast-triage.test.ts`: 16 casos) |
| 9.2.7 | Playwright E2E contra a stack real                           | ✅ 6 casos; **pegou um bug que Vitest/Supertest não pegariam** (rota `/vulnerabilities/:id` inexistente) |
| 9.2.8 | ADR-032 + `DAST.md` §11 + docs vivos                         | ✅ |
| 9.2.9 | **Sincronizar o vault (`docs/Vulnera/`) com o módulo DAST**   | ✅ 2026-09-10 — o vault era o único documento vivo que ainda não sabia da existência do DAST. Notas novas: `DastScan`, `DastFinding`, `DAST` (módulo), `Fluxo - Scan DAST`, `Enum - DAST`; changelog do vault com as sessões 28/29/30; `Vulnerability`, `MER`, `Matriz de Permissoes`, `Jornada - Pentester`, `OWASP ZAP`, `Docker Compose`, `Dockerfiles`, `Testes`, `Evidencias para Banca`, `Roadmap Fases` e `Contexto Mestre v4` atualizados. Contradições internas do `DAST.md` (§1 e §10 diziam "não importa para Vulnerability" depois do §11 existir) corrigidas |

---

## FASE 9 — Findings Globais + Query Wizard (~28h) — ✅ concluída em 2026-09-14

> Fecha o finding de auditoria **`BACKEND-002`**. Decisão em **ADR-028**;
> guia de uso em `docs/FINDINGS_QUERY.md`.

| #    | Task                                                              | h   | Estado |
| ---- | ----------------------------------------------------------------- | --- | ------ |
| 9.0  | Auditoria: schema, endpoint atual, listagens existentes, baseline | 2   | ✅     |
| 9.1  | `GET /api/vulnerabilities` com filtros, paginação e facetas       | 6   | ✅     |
| 9.2  | Ordenação por ranking de severidade (`FIELD()` do MySQL)          | 2   | ✅     |
| 9.3  | Leitura do `AuditLog` (era append-only **e** write-only)          | 2   | ✅ (descoberta) |
| 9.4  | Testes: VULN-LIST-01..14, TEN-19..22, AUD-01..03                  | 4   | ✅     |
| 9.5  | Parser do query wizard (`lib/finding-query.ts`)                   | 4   | ✅     |
| 9.6  | Componente canônico `findings-table.tsx` + hooks                  | 5   | ✅     |
| 9.7  | Página `/findings` + detalhe enriquecido                          | 4   | ✅     |
| 9.8  | Remover a listagem antiga e migrar os consumidores                | 3   | ✅     |
| 9.9  | Validação no navegador (extensão conectou) + correção de 4 bugs   | 3   | ✅     |
| 9.10 | Documentação: ADR-028, `FINDINGS_QUERY.md`, PRD, vault            | 2   | ✅     |

---

## INICIATIVA — Exposure & Remediation Management (CP-0 a CP-7) — ✅ CP-0 a CP-7 concluídos em 2026-09-16

> Branch `feat/exposure-remediation-management`. Documento técnico:
> `docs/EXPOSURE_REMEDIATION.md`. Decisões: **ADR-033 a ADR-039** e a seção de
> decisões de implementação em `docs/DECISIONS.md`.

| #    | Task                                                                    | Estado |
| ---- | ----------------------------------------------------------------------- | ------ |
| CP-0 | Baseline: branch, build do web destravado, ADR-033, decisões D1–D10      | ✅ |
| CP-1 | Application Context (ambiente, criticidade, exposição, sensibilidade)    | ✅ |
| CP-1b| Contexto embutido no DTO do finding (PENTESTER não lê `/applications`)   | ✅ |
| CP-2 | SLA Engine: `SlaPolicy`, ciclo por finding, estados derivados           | ✅ |
| CP-2b| Filtro `slaState` nos DOIS construtores + `slaDueSoonAt` persistido     | ✅ |
| CP-3 | Vulnera Risk Score aditivo + faixas + `vrsFactors` auditável            | ✅ |
| CP-4 | Risk Acceptance: entidade, alçada, pausa de SLA, expiração preguiçosa   | ✅ |
| CP-4b| FK de `revokedById` por migration ADITIVA (a aplicada não foi editada)  | ✅ (descoberta) |
| CP-5 | Playbooks + importação OWASP por CLI + snapshot offline com sha256      | ✅ |
| CP-5b| Três camadas contra XSS (escrita, renderização, CSP real no preview)    | ✅ |
| CP-5c| Parser tolerante à tradução pt-BR divergente do A10                     | ✅ (descoberta) |
| CP-6 | Saved Queries / Watchlists com canonização da query                     | ✅ |
| CP-7 | Quadro de remediação por menu (sem arrastar) + `assignedTo` ponta a ponta| ✅ |
| CP-7b| Correção do `where()`: chaves `AND` concorrentes apagavam filtros        | ✅ (descoberta) |
| CP-7c| `config/` faltando no `COPY` do Dockerfile do web                       | ✅ (descoberta) |
| VAL-01 | Critérios de aceite, seis cruzamentos e matriz de evidências CP-1–CP-7 | ✅ `docs/EXPOSURE_REMEDIATION_ACCEPTANCE.md`; histórias, UCs, critérios e evidências documentados; specs E2E-EXP-01..09 revisados, com reexecução local do Playwright ainda bloqueada por dependência ausente |
| VAL-02 | Hardening P2 e validação final CP-1–CP-7 | ✅ Locks transacionais em SLA/Saved Query; candidatos mínimos e lazy no quadro; playbook customizado para PENTESTER membro; filtros/expiração; cleanup E2E-EXP-05/06 por marcador único. **API focal 75/75 · Web serial 128/128 · lint 0 erros · contraste 66/66**; `docker compose build --no-cache` API/Web verde e stack saudável; validação manual moveu/restaurou cartão. Playwright E2E não reexecutado no host (`@playwright/test` ausente); dependências foram instaladas normalmente nas imagens Docker. Sem alteração de schema, migration ou lockfile nesta validação |
| CP-8 | Exposure Graph / Cadeias de Exposição                                   | ⛔ **não implementado** — era condicional; ver `docs/EXPOSURE_REMEDIATION.md` §9 |

---

## Findings de auditoria

> Os achados da auditoria consolidada, com o estado de cada um. Antes desta
> entrega os finding IDs (`BACKEND-00x`) eram citados em prompts mas não tinham
> registro no repositório — esta seção passa a ser o registro.

| # | Finding | Estado | Fechado por |
| --- | --- | --- | --- |
| `BACKEND-002` | **A listagem de findings não filtra no servidor** — *"controller aceita apenas `projectId`; queries não têm severity/status/OWASP/skip/take"*. Era a causa raiz das duas implementações de listagem no frontend: sem filtro no backend, filtrar em memória era a única saída. | ✅ **Fechado em 2026-09-14** | Fase 9. `GET /api/vulnerabilities` passou a aceitar `projectId`, `applicationId`, `companyId`, `createdBy`, `severity`, `status`, `owaspCategory`, `search`, `createdFrom`/`createdTo`, `page`/`pageSize` e `sortBy`/`sortOrder`, com facetas por `groupBy`. **Canários que provam:** `VULN-LIST-01` (paginação), `VULN-LIST-02/03` (severidade, OR dentro do campo), `VULN-LIST-04` (AND entre campos), `VULN-LIST-05` (busca em título e descrição), `VULN-LIST-06` (intervalo de datas), `VULN-LIST-07` (ordenação por ranking de severidade) e `07b` (os dois construtores de filtro concordam), `VULN-LIST-08` (página 2 não repete a 1), `VULN-LIST-09` (facetas refletem os outros filtros), `VULN-LIST-10` (enum inválido → 400), `VULN-LIST-11` (`pageSize` clampado), `VULN-LIST-12/14` (projeto, aplicação, OWASP, autor). Isolamento preservado por `TEN-19..22` |

⚠️ `docs/FINDINGS_REMEDIATION.md` **não existe** neste repositório, e nenhum
outro `BACKEND-00x` está registrado em lugar nenhum. Se a auditoria consolidada
tiver outros achados, eles precisam ser trazidos para cá — hoje vivem só nos
prompts.

---

## Removido do escopo

| Removido                                                       | Quando     | Motivo                                      |
| -------------------------------------------------------------- | ---------- | ------------------------------------------- |
| IA / Gemini (sugestão de finding, rate limit, botão no editor) | 2026-08-03 | Corte de prazo; não é o que a banca avalia  |
| Chat em tempo real (Socket.IO)                                 | 2026-07-26 | `VulnerabilityComment` cobre a comunicação  |
| Tickets de suporte                                             | 2026-07-26 | Escopo administrativo sem valor de demo     |
| E-mail transacional (Nodemailer/Mailhog)                       | 2026-07-26 | `AuditLog` cobre a rastreabilidade          |
| Prometheus + Grafana                                           | 2026-07-26 | Observabilidade não é critério de avaliação |
| ~~Testes E2E (Playwright)~~ **revertido**                      | 2026-07-26 → **de volta em 2026-09-09** | Voltou ao escopo na Fase 9.2: `app/web/e2e/` roda contra a stack real; fora do `npm run check` |
| Viewer de PDF no mobile                                        | 2026-08-03 | Corte do escopo mobile                      |
| Maturidade completa estilo SAMM                                | 2026-08-03 | Vira checklist simples                      |
| Varredura antivírus/malware no upload de Evidence               | 2026-08-05 | Validação é de tipo (magic number) e tamanho, não de conteúdo malicioso — limitação conhecida, documentar no README/DEMO |

Tudo isso entra como **trabalho futuro** no README — e a redução consciente de escopo sob restrição de prazo é material de defesa na banca.

---

## Limitações conhecidas — Fase 5 (Vulnerability + Evidence)

> L-01..L-08 levantadas na sessão de endurecimento de **2026-08-07**; L-09..L-11 na Fase 6.5, em **2026-08-09**.
> Contexto original: Todas foram
> **encontradas, avaliadas e conscientemente não corrigidas** — cada uma tem o
> motivo registrado. Material direto para a seção de limitações do README/DEMO
> (task 8.7) e para a defesa na banca: saber onde o sistema não protege vale
> mais que fingir que protege em tudo.

| # | Limitação | Por que não foi corrigida | Mitigação existente |
| --- | --- | --- | --- |
| L-01 | **Sem varredura antivírus/malware no upload.** A validação é de tipo e tamanho, não de conteúdo. | Exigiria integrar engine de AV — fora do escopo do MVP (já registrado em "Removido do escopo" em 2026-08-05). | Tipo restrito a 4 formatos por magic number; nome reescrito com UUID; nada é executado no servidor. |
| L-02 | **Polyglot é aceito.** Arquivo com header PNG/JPEG/PDF válido seguido de payload arbitrário passa na validação. | Bloquear exigiria parse completo de cada formato. A assinatura prova como o arquivo se apresenta, não que o resto seja inofensivo. | Nome UUID (nunca executável pelo nome), extensão derivada do tipo **detectado**, download sempre `attachment` + `nosniff`, nenhum caminho de código que interprete o conteúdo. Comportamento coberto por teste (SEC-EV-07). |
| L-03 | **PDF com bytes antes do `%PDF` é recusado.** A spec do PDF tolera até 1024 bytes de lixo antes do header; exigimos offset 0. | Falso-negativo **preferido de propósito**: aceitar assinatura em offset arbitrário é justamente o que facilita polyglot (L-02). | PDFs de ferramentas normais começam em offset 0. Coberto por teste que documenta a escolha. |
| L-04 | **Acesso negado responde 403, não 404.** Um atacante com um ID válido de outra company aprende que o recurso existe. | O `CLAUDE.md` §9 define `FORBIDDEN`→403 como padrão do projeto, e as Fases 3/4 já usam 403 em TEN-01..06. Mudar só a Fase 5 criaria inconsistência; mudar tudo quebraria contrato já mergeado. | IDs são `cuid()`, não enumeráveis por força bruta — o ganho do 404 é marginal. Isolamento em si é total e provado por TEN-07..13. |
| L-05 | **Não há rota de DELETE para Evidence.** Uma evidência anexada por engano não pode ser removida pela API. | Criar a rota é **feature nova**, fora do escopo de uma sessão de endurecimento. | Anexar evidência errada exige refazer o finding ou remoção manual no banco. **Candidata a task da Fase 8.** |
| L-06 | **`text/plain` aceita qualquer texto UTF-8**, inclusive HTML, SVG, JS ou script shell renomeados para `.txt`. | Texto não tem assinatura binária própria; distinguir "texto de log" de "texto que é código" exigiria heurística frágil e cheia de falso-positivo. | Servido sempre como `attachment` + `nosniff` + `Content-Type: text/plain` — o navegador não renderiza. Bytes de controle são recusados desde 2026-08-07. |
| L-07 | **Rate limiting é local à instância.** Em memória, portanto um restart zera os buckets e várias réplicas não compartilham a cota. | O MVP opera em instância única; Redis/store compartilhado permanece fora do escopo atual. | A proteção cobre global/tenant/user/escrita/endpoints e autenticação; escalar horizontalmente exige trocar somente a implementação do store. Ver ADR-040. |
| L-09 | **A paridade de acessibilidade foi provada em jsdom, não em leitor de tela real.** NVDA e VoiceOver não foram testados. | Exigiria máquina com leitor de tela instalado e um protocolo de teste manual — fora do que uma sessão automatizada alcança. | 14 testes cobrindo role/ARIA/teclado/foco item a item do contrato, mais `axe-core` sem violações. O que NÃO se prova é a experiência de escuta: ordem de anúncio, verbosidade, se o texto faz sentido em voz alta. **Candidata a task da Fase 8.** |
| L-10 | **A validação visual no navegador real não foi feita na Fase 6.5.** Aparência, responsividade em 375/768/1440 e console limpo não foram conferidos. | A extensão do Chrome não conectou na sessão (mesmo bloqueio da Fase 6). | Build e tipos limpos; 24 testes de frontend em jsdom; contraste medido matematicamente. **Pendente para o Rafael** — os 10 itens estão no bloqueio de 2026-08-09 do `PRD_VIVO.md`. |
| L-11 | **O risk score da SÉRIE TEMPORAL é aproximado**, diferente do valor exato do `summary`. | Reconstruir o CVSS de cada finding aberto em cada período passado exigiria tabela de snapshot, que o ADR-025 evitou de propósito. | Serve para ver TENDÊNCIA, que é a função da linha. Está comentado no código, dito no ADR-025 e visível na interface. O `summary` — o número que a pessoa lê — é exato. |
| L-08 | **Uploads ficam em disco local**, não em storage externo com versionamento. | Decisão de infraestrutura do MVP (`UPLOADS_DIR` + volume Docker). | Volume nomeado sobrevive a `docker compose down`; caminho sempre contido sob `UPLOADS_ROOT`. |
| L-15 | **O donut de severidade não renderiza** — só a legenda aparece, no dashboard do CLIENT e no de aplicação. Recharts avisa `width(0) and height(0)` dentro de um contêiner `h-48 w-48` legítimo. | Pré-existente (provável efeito do upgrade para `recharts@^3.10.1`, major). Encontrado na validação da Fase 9, em componente que a entrega não tocou — §0.2 S6. | A informação não se perde: a legenda lista severidade e contagem em texto, e os KPIs numéricos acima estão corretos. O gráfico é reforço, não portador. |
| L-16 | **✅ Resolvida em 2026-10-01 — falha de rede silenciosa fora da Fase 9.** Registro histórico: o padrão `online` pausava consultas sem erro ou recuperação. | A correção global antes adiada foi entregue na task de navegação: `networkMode: always`, retries transitórios limitados e feedback de carregamento. | Consulta com onlineManager offline, erro definitivo e recuperação cobertos em `query-client.test.ts`; ADR-044. |
| L-17 | **Uma queda da API desloga o usuário.** O refresh falha, e o interceptor de `lib/api/client.ts` não distingue "refresh recusado" (401 legítimo) de "refresh não chegou ao servidor" (rede), chamando `clearAuth()` nos dois casos. | Pré-existente; mexer no interceptor de autenticação é risco desproporcional numa entrega de listagem. | A sessão volta com um login; nenhum dado se perde. |
| L-19 | **O Select customizado não funciona dentro do Dialog.** O painel do Select abre em portal fora do conteúdo do modal; o `Dialog` torna os siblings inertes e trata o clique nesse painel como clique externo. Em 2026-10-06, Chrome também confirmou `z-index: 40` atrás do modal em `60` no contexto de risco. | Corrigir a infraestrutura compartilhada de portal/foco/dismiss ampliaria o escopo da Issue #19. Encontrado durante CP-2 em 2026-09-30; aplicar a regra S6. | Para o seletor de empresa desta issue, usar `<select>` nativo dentro do modal, estilizado com `CLASSES_CONTROLE`; mantém teclado nativo e a interação dentro do foco do diálogo. Mesma solução aplicada em 2026-10-06 aos três seletores de contexto; o formulário foi corrigido sem alterar infraestrutura global. Evoluir o Select/coordenação de overlays fica como trabalho futuro. |

---

## Limitações conhecidas — Build / Docker

> Levantadas em **2026-09-14** ao destravar o `docker compose up --build`, e
> **restauradas em 2026-09-15** no CP-0 da iniciativa Exposure & Remediation.
>
> ⚠️ **Por que sumiram e voltaram:** esta seção entrou junto do fix `74cb60e` e
> foi removida pelo revert da landing (`31988ba`), que levou o fix junto por
> estar na mesma árvore. O build ficou quebrado em `dev` e `main` de 2026-09-14
> a 2026-09-15 sem nenhuma limitação registrada explicando por quê. Mesmo
> critério das demais: encontradas, avaliadas e conscientemente não corrigidas.

| # | Limitação | Por que não foi corrigida | Mitigação existente |
| --- | --- | --- | --- |
| L-12 | **Build da imagem não é reproduzível.** `package-lock.json` está no `.gitignore`, então nenhum lock chega ao contexto de build — cada `docker build` re-resolve as versões dentro das faixas de semver e pode trazer uma transitiva diferente da que o dev testou. | Passar a versionar o lock é decisão de projeto (afeta API, web e mobile) e exige validar `npm ci` nos três Dockerfiles. **Decisão do Rafael.** É também a causa-raiz de L-13. | Versões diretas pinadas por `^` em `package.json`; a stack é validada à mão antes da demo. `npm install -g npm@11` (L-13) neutraliza o sintoma mais grave |
| L-13 | **`npm install -g npm@11` é obrigatório nas imagens de API e Web.** O npm 10.9.8 que vem no `node:22-alpine` aborta com `Cannot read properties of null (reading 'edgesOut')` ao montar o grafo de peers sem lock (bug do Arborist). | O bug é do npm, não do projeto; resolver de verdade exigiria versionar o lock (L-12). **Reproduzido de novo em 2026-09-15** no CP-0, com npm 10.9.8, estágio `[web 4/8] RUN npm install`. | Linha presente e **documentada nos dois Dockerfiles**, com aviso de que já foi perdida uma vez. O comentário do `app/api/Dockerfile` referencia o do web e vice-versa |
| L-14 | **O `tsc --noEmit` do build da imagem type-checka os arquivos de teste.** `npm run build` roda `tsc --noEmit && vite build`, e o `tsconfig.json` inclui `src` inteiro — um erro de tipo em `*.test.tsx` derruba o build de produção. | É também a única checagem de tipos automatizada com gatilho: o CI só roda SonarQube, e `npm run check` é lint + contraste + testes, sem `tsc`. Removê-la do Dockerfile deixaria o `tsc` sem nenhum gatilho automático. | Aceito de propósito enquanto o CI não rodar `tsc`; o efeito é conservador (falha a mais, nunca a menos). Foi o que expôs a peer `@testing-library/dom` faltante |
| L-18 | **Peers usadas pelo código precisam estar declaradas à mão.** `@testing-library/react@16` não implementa `screen`/`waitFor`/`within` — só reexporta de `@testing-library/dom`, declarada como peer. Na máquina do dev o npm instala a peer sozinho, então a ausência da declaração fica invisível até o container. | Não é bug: é o comportamento correto de peer dependency. Auditar todas as peers do projeto é trabalho próprio. | `@testing-library/dom@^10.4.1` declarado explicitamente em `app/web/package.json` desde 2026-09-15 — o código usa aqueles símbolos, então a dependência é real e deve ser declarada, não herdada por acaso do resolvedor |

---

## Regras

- ✅ marcado pelo agente ao concluir (CLAUDE.md §0.1 R2)
- Consolidar ou dividir task = editar a linha, nunca duplicar
- Task descoberta no meio de uma fase → adicionar com `(descoberta)` na descrição
- JIRA sincronizado manualmente ao fim de cada fase, com as KANs listadas no relatório do agente
