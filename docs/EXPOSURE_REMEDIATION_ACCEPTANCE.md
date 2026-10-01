# Exposure & Remediation Management — aceite e evidências

> Documento de aceite da iniciativa CP-1 a CP-7. Ele transforma o mapa técnico
> em histórias verificáveis e deixa explícito o que é evidência existente, o que
> tem cobertura parcial e o que ainda exige uma prova de navegador.
>
> Fonte de implementação: código em `app/api/src/`, `app/web/src/`,
> `app/web/e2e/` e `app/api/prisma/schema.prisma`. O documento técnico resumido
> está em [`EXPOSURE_REMEDIATION.md`](./EXPOSURE_REMEDIATION.md).

## 1. Escopo, atores e legenda

### Escopo

O aceite cobre o ciclo operacional de um finding: contextualizar a aplicação,
dar prazo, priorizar, formalizar exceção, orientar a correção, guardar recortes
de trabalho e acompanhar a remediação. CP-8 (Exposure Graph / Cadeias de
Exposição) está **fora de escopo**: não há código, rota, tabela ou tela de
grafo nesta versão.

### Atores

| Ator | Uso relevante nesta iniciativa |
|---|---|
| ADMIN | governa empresas, políticas, VRS, aceite e remediação |
| CLIENT OWNER | aumenta contexto de risco e governa a própria política/aceite conforme alçada |
| CLIENT MEMBER | consulta o que a própria empresa permite; não altera contexto nem decide aceite |
| PENTESTER membro | cria/edita findings, solicita aceite, usa playbooks e opera o quadro do projeto |
| PENTESTER não-membro | não recebe dados nem operações do projeto |

Legenda da matriz: ✅ evidência automatizada executada para a versão atual;
🕘 evidência histórica executada em versão anterior do spec (não certifica a
versão modificada); 🔶 cobertura parcial ou dependente de prova de navegador;
📋 critério para o qual falta teste dedicado; ⛔ fora do escopo. A ausência de
Playwright no workspace web impede declarar verdes os specs E2E modificados
nesta sessão; eles foram apenas revisados estaticamente.

## 2. Casos de uso

| ID | Caso de uso | Papel | Pré-condições | Passos | Resultado esperado |
|---|---|---|---|---|---|
| UC-01 | Contextualizar aplicação | ADMIN ou CLIENT OWNER | usuário autenticado; aplicação ativa e finding associado | abrir a aplicação; editar ambiente, criticidade, exposição ou sensibilidade; salvar | valores persistidos no vocabulário real; findings recalculados e contexto disponível no DTO |
| UC-02 | Governar SLA | ADMIN ou CLIENT OWNER | empresa acessível; política vigente ou defaults | abrir configurações de SLA; consultar ou versionar política; ADMIN pode reaplicar | política versionada sem reescrever prazo histórico; estado e prazo derivados no finding |
| UC-03 | Priorizar exposição | ADMIN ou PENTESTER membro | finding visível com CVSS e aplicação contextualizada | abrir findings; ordenar/filtrar por VRS; abrir detalhe | score 0–100, faixa e fatores explicáveis aparecem e a ordem respeita o VRS |
| UC-04 | Solicitar/decidir aceite | PENTESTER membro solicita; ADMIN ou CLIENT OWNER decide | finding visível; solicitante e decisor são pessoas diferentes; prazo válido | solicitar aceite; outro ator aprovar/rejeitar; consultar o finding | decisão auditada; finding continua aberto; aceite pausa SLA e sua revogação/expiração retoma o relógio |
| UC-05 | Corrigir com playbook | ADMIN ou PENTESTER | catálogo System disponível ou playbook custom do tenant | abrir catálogo/detalhe do finding; consultar “Como corrigir”; clonar se necessário | System permanece somente leitura; custom é editável; conteúdo é sanitizado e atribuído corretamente |
| UC-06 | Reabrir uma pergunta | ADMIN, CLIENT ou PENTESTER (PRIVATE) | usuário autenticado; recorte de findings conhecido | aplicar filtros; salvar a busca; abrir ou fixar o atalho | query canônica é reexecutada sob o escopo de quem abriu, sem snapshot de resultados |
| UC-07 | Conduzir remediação | ADMIN ou PENTESTER membro | finding visível em `OPEN`, `IN_PROGRESS` ou `FIXED` | abrir `/remediation`; usar o menu de transição; atribuir responsável quando aplicável | somente transições válidas são oferecidas; mudança persiste, move a coluna e gera auditoria |
| UC-08 | Visualizar Exposure Graph | — | — | — | ⛔ CP-8 não implementado nesta versão |

## 3. Histórias e critérios de aceite

### CP-1 — Contexto de risco da Application

**User story:** Como CLIENT OWNER, quero registrar o contexto de risco da minha aplicação, para que os findings reflitam a exposição real do alvo.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP1-01 | `environment` aceita `DEV`, `HOMOL`, `PROD`; `criticality` aceita `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`; `internetFacing` é booleano; `dataSensitivity` aceita `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`. Defaults da migration são respeitados. | ✅ `application-risk-context.test.ts`: CTX-01, CTX-02 |
| CP1-02 | ADMIN pode subir/descer risco; CLIENT OWNER pode subir; redução por CLIENT e edição por MEMBER/PENTESTER são recusadas sem alterar o registro. `companyId` não vem do body. | ✅ CTX-03 a CTX-07, TEN-29 |
| CP1-03 | Uma alteração de contexto recalcula os findings da aplicação, registra `RISK_CONTEXT_CHANGED` com antes/depois/contagem e embute `applicationContext` no DTO de finding, inclusive para PENTESTER. | ✅ CTX-08, CTX-09; ✅ VRS-04, VRS-09 |
| CP1-04 | A tela de aplicação exibe os campos, avisa uma redução e invalida a listagem de findings após salvar. | 🔶 componente `application-risk-form.tsx` existe; 📋 falta E2E dedicado de edição e reflexo visual |

### CP-2 — SLA Engine

**User story:** Como ADMIN, quero versionar e reaplicar políticas de SLA, para que cada finding tenha um prazo operacional rastreável.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP2-01 | `GET/PUT /api/companies/:id/sla-policy` lê/versiona a política; `GET .../history` lista versões; `POST .../apply` é separado e ADMIN-only. Dias são inteiros de 1 a 365. | ✅ `sla.test.ts`: SLA-02, SLA-04, SLA-11, SLA-13 |
| CP2-02 | Criação e edição de vetor persistem `slaStartedAt`, `slaDueAt`, `slaDueSoonAt`, `slaPausedMs` e política usada. O estado é derivado como `NO_SLA`, `ON_TRACK`, `DUE_SOON`, `BREACHED`, `ACCEPTED`, `RESOLVED_IN_SLA` ou `RESOLVED_LATE`. | ✅ SLA-01, SLA-05, SLA-06, SLA-10 |
| CP2-03 | Alterar a política não reescreve prazos históricos; reaplicar só toca findings ativos; backfill é idempotente; `FIXED → IN_PROGRESS` abre ciclo e `IN_PROGRESS → OPEN` não reseta o relógio. | ✅ SLA-03, SLA-04, SLA-08, SLA-12 |
| CP2-04 | `slaState` funciona nos dois construtores de filtro e a tela de SLA mostra política, histórico e ação conforme papel. | ✅ SLA-07, SLA-11; 🔶 filtros têm cobertura de API, 📋 falta E2E da tela e do badge atualizado |

### CP-3 — Vulnera Risk Score

**User story:** Como PENTESTER, quero ordenar findings pelo risco contextual, para atacar primeiro o que é mais importante no ambiente real.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP3-01 | `VRS = round(cvss × 6) + criticidade + ambiente + exposição + sensibilidade`, limitado a 0–100, com `vrsFactors`, fórmula e timestamp persistidos. | ✅ `vrs.util.test.ts` VRS-U-01..12; ✅ `vrs.test.ts` VRS-01..04, VRS-07 |
| CP3-02 | Faixas reais são `MONITORAR` 0–39, `PLANEJADO` 40–64, `URGENTE` 65–84 e `IMEDIATO` 85–100. Override de rótulo sem mudança de vetor não altera o VRS. | ✅ VRS-U-01..12; ✅ VRS-03, VRS-09 |
| CP3-03 | `vrsMin`, `vrsMax` e `sortBy=vrsScore` filtram/ordenam e os dois construtores devolvem o mesmo conjunto; contexto recalcula todos os findings da aplicação. | ✅ VRS-04, VRS-05, VRS-06, VRS-09, TEN-31 |
| CP3-04 | A tabela/detalhe web exibe CVSS e VRS separadamente, com faixa e fatores compreensíveis. | 🔶 `findings-table.tsx`, `vrs-badge.tsx`; 📋 falta E2E que compare contexto, detalhe e ordenação na tela |

### CP-4 — Risk Acceptance

**User story:** Como CLIENT OWNER, quero decidir pedidos formais de aceite de risco, para que exceções permaneçam abertas, pausadas e auditáveis.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP4-01 | O fluxo é `REQUESTED → APPROVED/REJECTED → EXPIRED/REVOKED`; pedido exige justificativa, validade não passada e teto de 365 dias; segundo pedido ativo retorna conflito. | ✅ `risk-acceptance.test.ts`: RISK-ACC-01..04, RISK-ACC-13 |
| CP4-02 | Quem solicita não decide, inclusive ADMIN; PENTESTER pode solicitar mas nunca decidir; CLIENT MEMBER não solicita/decide; company e projeto são respeitados. | ✅ RISK-ACC-05..08, TEN-32 |
| CP4-03 | Finding permanece aberto; aceite ativo deriva `ACCEPTED`, pausa SLA, não muda VRS; revogar soma a pausa e desloca `dueAt`/`dueSoonAt`; expiração preguiçosa é atômica e audita uma vez. | ✅ RISK-ACC-09..12 |
| CP4-04 | Painel do finding permite solicitar, aprovar, rejeitar e revogar apenas conforme alçada, refletindo o estado retornado pela API. | 🔶 `risk-acceptance-panel.tsx` implementado; 📋 falta E2E multiator/visual do fluxo |

### CP-5 — Playbooks de remediação

**User story:** Como PENTESTER, quero consultar e adaptar playbooks OWASP, para aplicar uma correção segura e repetível ao finding.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP5-01 | Catálogo OWASP System tem dez categorias, atribuição CC BY-SA visível, é somente leitura e o sync é CLI idempotente; snapshot permite seed offline. | ✅ `remediation-playbook.test.ts`: PB-01, PB-03, PB-10, PB-SEED-01; 🔶 E2E-EXP-01..03 da versão atual revisados estaticamente, reexecução pendente por Playwright ausente; 🕘 versão anterior executada em 2026-09-16 |
| CP5-02 | ADMIN/PENTESTER podem criar/editar/remover custom do tenant; clone preserva procedência; CLIENT lê; outro tenant não lê. Campos de origem do body são ignorados. | ✅ PB-02, PB-04..07, PB-13, TEN-33 |
| CP5-03 | Markdown é sanitizado na escrita e novamente na renderização; HTML bruto não executa; referências exigem `https`; CSP do preview não usa `unsafe-inline` em `script-src`. | ✅ PB-08, PB-09; `markdown.test.ts` MD-01..10/MD-08b; `csp.test.ts` CSP-01..05; ✅ E2E-EXP-09 |
| CP5-04 | No detalhe do finding, “Como corrigir” escolhe custom do tenant antes do System e mostra conteúdo real. | ✅ PB-12; 🔶 E2E-EXP-04 da versão atual revisado estaticamente, reexecução pendente por Playwright ausente; 🕘 versão anterior executada em 2026-09-16 |

### CP-6 — Saved Queries / Watchlists

**User story:** Como PENTESTER, quero salvar uma pergunta de findings, para reabrir o mesmo recorte sem guardar uma resposta obsoleta.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP6-01 | Query é canonizada apenas com parâmetros conhecidos, ordem estável e sem `page/pageSize`; o descarte é informado; pergunta vazia ou grande é recusada. | ✅ `saved-query.util.test.ts`: SQ-U-01..08; ✅ `saved-query.test.ts`: SQ-02, SQ-03 |
| CP6-02 | PRIVATE é do dono; COMPANY é legível pelo tenant; PENTESTER só pode PRIVATE; invisível retorna 404; limite é 50 buscas/8 fixadas. | ✅ SQ-04..07, TEN-34 |
| CP6-03 | Abrir uma busca navega para `/findings?<queryString>` e reexecuta sob o escopo de quem abriu; salvar a mesma pergunta novamente é recusado. | ✅ SQ-01, SQ-08..10; 🔶 E2E-EXP-05/06 da versão atual revisados estaticamente, reexecução pendente por Playwright ausente; 🕘 versão anterior executada em 2026-09-16 |
| CP6-04 | A barra web preserva os filtros atuais, permite fixar/remover e não perde foco/estado por remount. | 🔶 `saved-queries-bar.tsx` e E2E-EXP-05/06; 📋 falta teste web dos parâmetros CP-2/3/4/7 na requisição da tabela |

### CP-7 — Quadro de remediação e responsável

**User story:** Como PENTESTER, quero mover e atribuir findings pelo quadro, para acompanhar quem corrige cada etapa.

| Story | Critérios de aceite verificáveis | Evidência |
|---|---|---|
| CP7-01 | `/remediation` tem exatamente `OPEN`, `IN_PROGRESS`, `FIXED`; `CLOSED` fica fora; cada menu oferece apenas transições válidas e o fluxo é operável por teclado. | ✅ código de `remediation-page.tsx`; ✅ `overlays.test.tsx` A11Y-10..12; 🔶 E2E-EXP-08 da versão atual revisado estaticamente, reexecução pendente por Playwright ausente; 🕘 versão anterior executada em 2026-09-16 |
| CP7-02 | `assignedTo` aceita atribuir/reatribuir/desatribuir apenas a usuário que enxerga o finding; ADMIN cruza tenant, PENTESTER exige membro, CLIENT escreve nunca. | ✅ `remediation-assignee.test.ts`: ASSIGN-01..06, ASSIGN-09 |
| CP7-03 | Filtros `assignedTo` e `assignedTo=none` têm paridade Prisma/SQL, índices existem, e toda troca audita `ASSIGNEE_CHANGED` com de/para. | ✅ ASSIGN-06..08, VULN-LIST-09 |
| CP7-04 | Uma escolha real do menu persiste a transição, move o cartão de coluna e o finding aparece na listagem filtrada; a prova restaura o estado original. | 🔶 E2E-EXP-07 (teste reversível adicionado nesta rodada); 📋 execução bloqueada pela dependência Playwright ausente |

## 4. Seis cruzamentos funcionais

Estes são os seis pontos onde uma entrega alimenta outra e, por isso, não basta
provar cada endpoint isoladamente.

| ID | Cruzamento | Critério de aceite | Evidência atual |
|---|---|---|---|
| X-01 | CP-1 → CP-3 | mudar contexto da Application recalcula VRS dos findings e o finding devolve contexto + score coerentes | ✅ CTX-08/09, VRS-04/09 |
| X-02 | CP-2 ↔ CP-4 | aceite ativo pausa SLA como `ACCEPTED`; revogar/expirar desloca prazo e acumula pausa sem alterar VRS | ✅ RISK-ACC-11/12, SLA-07 |
| X-03 | CP-3 → CP-7 | quadro solicita `sortBy=vrsScore`, preserva prioridade contextual e permite transição do cartão | 🔶 VRS-05 + código do quadro; 🔶 E2E-EXP-07 revisado para provar transição/status (não executado), 📋 falta assert de ordem por VRS no navegador |
| X-04 | CP-5 → detalhe do finding | categoria do finding resolve playbook custom antes do System e renderiza “Como corrigir” seguro | ✅ PB-12; 🔶 E2E-EXP-04 atual não reexecutado; 🕘 versão anterior executada em 2026-09-16 |
| X-05 | CP-2/3/4/7 → CP-6 | uma busca salva pode guardar SLA, faixa VRS, aceite e responsável como pergunta canônica e reexecutá-los | 🔶 vocabulário na API/util; 📋 hook web `use-findings-filters.ts` ainda precisa provar que repassa esses parâmetros à tabela |
| X-06 | CP-6 → CP-7 | watchlist navega para o recorte e o quadro reflete uma mudança de status/responsável persistida | 🔶 E2E-EXP-05/06 e API ASSIGN; 🔶 E2E-EXP-07 revisado para provar status + filtro (não executado), 📋 falta fluxo único watchlist→quadro |

## 5. Superfície de API de aceite

| Método | Rota real | CP |
|---|---|---|
| GET/PUT | `/api/companies/:id/sla-policy` | CP-2 |
| GET | `/api/companies/:id/sla-policy/history` | CP-2 |
| POST | `/api/companies/:id/sla-policy/apply` | CP-2 |
| GET/POST | `/api/vulnerabilities/:id/risk-acceptances` | CP-4 |
| POST | `/api/risk-acceptances/:id/approve\|reject\|revoke` | CP-4 |
| GET | `/api/playbooks`, `/api/playbooks/:id` | CP-5 |
| GET | `/api/playbooks/for-category/:owaspCategory` | CP-5 |
| POST/PUT/DELETE | `/api/playbooks`, `/api/playbooks/:id`, `/api/playbooks/:id/clone` | CP-5 |
| GET/POST/PUT/DELETE | `/api/saved-queries` | CP-6 |
| POST | `/api/vulnerabilities/:id/assign` | CP-7 |
| POST | `/api/vulnerabilities/:id/transition` | CP-7 |

Filtros acrescentados em `GET /api/vulnerabilities`: `slaState`, `vrsMin`,
`vrsMax`, `riskAcceptance` e `assignedTo` (incluindo `none`).

## 6. Lacunas e plano de prova

### Prova adicionada nesta rodada

`app/web/e2e/exposure-remediation.spec.ts` deixou o E2E-EXP-07 sem `skip` e
passou a: selecionar um cartão existente, escolher uma transição válida,
aguardar o `POST /api/vulnerabilities/:id/transition`, verificar a coluna de
destino, abrir `/findings?status=...` e verificar o título; no `finally`, restaura
o status original via API e confere o finding. E2E-EXP-08 também falha de forma
explícita se o quadro não tiver cartão, em vez de mascarar a ausência.

### Provas ainda recomendadas

1. Criar fixture isolada (ou uma estratégia de dados descartáveis permitida
   pelo projeto) para um E2E CP1→CP3: alterar contexto, conferir VRS no detalhe e
   conferir a ordenação/lista. A stack atual só oferece credenciais de ADMIN e
   PENTESTER; não há helper de CLIENT OWNER e aceite aprovado não tem DELETE.
2. Adicionar E2E CP2: editar política como ADMIN, aplicar, abrir finding e
   conferir badge/estado e filtro; não usar `skip` quando não houver dados.
3. Adicionar E2E CP4 com dois atores, cobrindo pedido, decisão por outro ator,
   pausa/retomada do SLA e bloqueio de autoaprovação.
4. Adicionar teste web de contrato do hook de filtros: `slaState`, `vrsMin`,
   `vrsMax`, `riskAcceptance` e `assignedTo` precisam sair da URL e chegar à
   requisição da tabela. A API/util já conhece os campos, mas
   `use-findings-filters.ts` lista atualmente apenas os filtros básicos.
5. Adicionar E2E CP6→CP7 que abre uma watchlist, entra no quadro filtrado e
   confirma o status/responsável; o fluxo deve limpar qualquer busca criada.
6. Estabilizar o VRS-05 intermitente registrado em
   `docs/evidencias/exposure-remediation/test-summary.md` antes de tratá-lo como
   evidência determinística.

## 7. Execução desta rodada

Não foram iniciados serviços, executados seeds/resets, aplicadas migrations,
instaladas dependências ou alterados lockfiles. `docker compose ps` foi apenas
consulta e mostrou `vulnera-api`/`vulnera-db` healthy, `vulnera-web` Up em
`http://localhost:8086` e `vulnera-mail` Up.

As dependências do workspace web não estão prontas para executar Playwright
localmente: `app/web/node_modules` existe, mas não contém
`@playwright/test` nem o binário `playwright`; o `package-lock.json` também não
registra esse pacote. Portanto E2E-EXP-07/08 foram revisados estaticamente nesta
rodada e não foram declarados verdes sem execução real. O histórico de
2026-09-16 continua sendo a evidência histórica dos 9 E2E anteriores. Ela não
é transferida automaticamente para os specs modificados nesta sessão: a
versão anterior de E2E-EXP-07 apenas abria o menu, e E2E-EXP-01..06/08 também
precisam ser reexecutados após as alterações atuais antes de receberem ✅.
