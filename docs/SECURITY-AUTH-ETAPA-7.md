<!--
O que faz: acompanha o cutover do cadastro público e a retomada do onboarding.
Por que existe: separar contrato, evidência parcial e pendências antes do aceite.
Quem consome: Rafael e os responsáveis pela revisão da Issue #51.
-->

# Issue #51 — Etapa 7: cutover e retomada do onboarding

**Estado: validada localmente com ressalvas.** Rastreabilidade remota: [PR #83](https://github.com/guimunizzz/Vulnera-TCC/pull/83).
Este relatório não afirma merge remoto nem fechamento da Issue #51.

Checkpoint documental: 2026-11-25. Código da Etapa 7 implementado em
`53d142e`. Merge local concluído em `822fa21` (pais `828ec6a` + `effd32a`); branch
publicada. Rastreabilidade remota: [PR #83](https://github.com/guimunizzz/Vulnera-TCC/pull/83).
`95f3252` foi o baseline observado antes, com três commits
SAST/SCA que permanecem documentados no BACKLOG. A matriz abaixo registra
evidências pré-integração, inclusive execuções não verdes e seus limites. Os
canários foram aprovados pelos owners; os resultados pós-`dev` estão registrados
abaixo, com as ressalvas correspondentes.

## Objetivo

Substituir o cadastro público direto pelo fluxo de solicitação de acesso e
permitir que uma conta ativada retome o onboarding. O cutover preserva login,
refresh, logout, ativação transacional, autorização e catálogo de planos.

## Contrato funcional informado

- `POST /api/auth/register` foi removido e responde 404; `/register` direciona
  para `/request-access`.
- Company e papel OWNER são associados por compare-and-swap (CAS) em uma única
  transação. Uma solicitação `PENDING` do mesmo plano é reaproveitada; pedido
  para outro plano resulta em 409. Pedido e evento de auditoria são gravados
  juntos.
- `GET /api/subscriptions/onboarding-status` é exclusivo de `CLIENT OWNER` e
  limita a consulta à empresa do próprio usuário. `/current` continua
  retornando apenas assinatura `ACTIVE`.
- Login permite retomar sem Company ou assinatura; a interface exibe o estado
  `PENDING` durante essa retomada.
- CNPJ permanece opcional. A aprovação da assinatura é independente da
  aprovação do acesso.
- A validação de CAPTCHA exige hostname e action reais, inclusive em produção;
  o secret é mantido apenas no runtime da API. SMTP externo fica reservado ao
  deploy.

## Resultados de validação antes da integração

Estes resultados foram confirmados pelos owners antes da integração. A execução
completa e o reteste das falhas têm interseção; **as contagens não devem ser
somadas**.

| Área | Resultado | Limite ou pendência |
| --- | --- | --- |
| API — TSC/lint | TSC PASS; lint termina nos dois imports antigos de `vulnerability.service.ts` | Os imports são preexistentes e ficaram fora do recorte |
| API — execução completa | 72 suítes: 65 passaram e 7 falharam; 1064 testes passaram e 46 falharam (1110 no total); 967 s | Não é gate verde |
| API — reteste das sete suítes | 6/7 suítes e 231/233 testes passaram | As duas falhas do `zap-runner` reproduziram exatamente os mesmos dois casos e saídas no harness isolado de `e5e353c`; controle confirmou ser residual preexistente. Sem alteração DAST |
| API — Auth+Company | 21/21 | Validação focal do recorte |
| API — Docker isolado | PASS final | Não equivale à suíte completa |
| Web — TSC/build/lint/contraste | TSC + Vite PASS; lint 0 erros/9 avisos; contraste 132/132 PASS | Build Docker final PASS |
| Web — runtime de produção servido | Docker final PASS; Rollup 4.68.5; CSS scoped servido | Verificação de artefato em stack isolada |
| Web — Playwright real de projeto | 1/1 PASS após corrigir seletor de senha | CLIENT provisionado exclusivamente; sem regressão de role observada |
| Web — Vitest focal `/register` | 2/2 PASS | Não substitui a suíte Web completa |
| Web — suíte completa pré-integração, baixa concorrência | 87 arquivos: 85 passaram, 2 falharam; 708/710 testes passaram | Finding de nome acessível foi reproduzido depois na base pura `effd32a`; ver resultados pós-`dev` |
| Web — Playwright mockado | Rodada original 9/11; CA-01 e CA-09 passaram depois em execução separada (2/2) | CA-01 = CTA do cabeçalho; CA-09 = nome acessível do seletor com a opção atual. Como a execução foi separada, não converter 9/11 em 11/11 |
| Web — spec focal de onboarding | 11/11 PASS após sincronizar o clique; ADMIN focal 6/6 PASS | Canários aprovados; não substitui a suíte integral 708/710 |
| Web — escala visual | `min-h-touch` de 44 px passou a escala | Padding 12–16 px aplicado a quatro inputs sem prefixo; login preservado |
| Web — smoke Chrome em produção isolada | CTA e `/register` direcionam para `/request-access`; nenhum POST observado | Padding computado: 12 px nos quatro campos a 390 px e 16 px a 1440 px; login preservou altura 42 px e prefixo. Smoke de UI, não inspeção de tráfego HTTP |
| API e Web em Docker isolado | PASS final | Não substitui suítes automatizadas completas |
| Smoke HTTP separado | register 404; rotas admin/empresa anônimas 401; CAPTCHA ausente 400 | Não substitui as suítes ou a prova do widget real |
| Widget Turnstile real e fluxo até onboarding | Evidência manual confirmada em stack isolada na porta 8186 | Revisão final da etapa ainda pendente |

O reteste e a comparação com o controle confirmam 71/72 suítes distintas da API
passando, com o único resultado residual nos dois casos de timeout preexistentes
do `zap-runner`. Esta descrição das suítes distintas não altera nem soma os
totais de testes das duas execuções, apresentados separadamente acima.

O merge local com `origin/dev` foi concluído em `822fa21` (pais `828ec6a` e
`effd32a`); a branch foi publicada. Rastreabilidade remota: [PR #83](https://github.com/guimunizzz/Vulnera-TCC/pull/83).
`95f3252` é o baseline observado
antes da atualização, com três commits SAST/SCA; esse histórico foi preservado
no BACKLOG. A matriz acima é pré-integração. Resultados Web/API/Compose pós-`dev`
estão registrados abaixo, com as ressalvas do lint global, teste Web herdado e
avisos do npm. Não se declara PR, merge remoto ou encerramento da Issue #51.

## Validação pós-`dev` — Web, Compose e lint focal

- Build Docker do Web com tag exclusiva: PASS; nenhum container foi criado.
- TSC, lint Web focal e contraste: PASS, 132/132.
- Vitest: 17 arquivos/125 testes; rodada inicial 122/125. Dois timeouts em
  arquivos de rotas/navegação passaram isoladamente (16 testes nesses
  arquivos), para 124/125 testes distintos observados.
- A falha de nome acessível Code Import/Security Graph foi reproduzida na base
  pura `effd32a` (7/8 no mesmo harness). Os arquivos CodeImport/grafo foram
  conferidos byte a byte iguais à `dev`; a falha não foi atribuída ao diff da
  Issue #51.
- `docker compose ... config --quiet` dos perfis DEV e real: PASS. A secret
  está somente na API e nenhum literal de secret aparece no diff.
- Lint API focal da Issue #51: PASS. Lint global ainda falha em dois argumentos
  não usados em `memory-job-queue.ts`, arquivo byte a byte igual a `origin/dev`;
  os imports antigos de VulnerabilityService foram removidos pela base nova.
- API pós-`dev`: Docker build, TSC, Prisma generate, lint focal e migration
  deploy 23/23 em schema novo restrito no container MySQL existente passaram;
  `prisma validate` passou e `migrate status` confirmou 23 atualizadas.
- Jest inicial: 21 suítes, 20/21 e 338/339 testes (131,6 s). A única falha é
  `admin-access-request-http`: DI real ausente e fixture fixa de 23/10/2026 já
  expirada em 25/11. O owner alinhou o relógio só no teste; reteste final de
  1/1 suíte e 9/9 testes passou, com exit explícito Jest 0 e Docker 0. O gate
  Jest focal foi aprovado com as demais ressalvas registradas.
- Contando as asserções distintas após o reteste, observam-se 21/21 suítes e
  339/339 testes PASS; primeira rodada permaneceu em 20/21 e 338/339.
- `npm install` reportou 12 advisories (8 moderate/4 high), sem `audit fix`.
  Dependências Prisma/BullMQ do host estão desatualizadas; os testes isolados
  usam infraestrutura descartável existente.

### Evidência manual recebida

O usuário submeteu o formulário pela interface na stack isolada. A captura
mostrou o widget real em estado de sucesso e a mensagem de solicitação recebida.
Leitura agregada do MySQL confirmou a sequência
`PENDING_EMAIL_VERIFICATION` → `PENDING_REVIEW` → `APPROVED` → `ACTIVATED`,
com eventos de verificação, aprovação e uso do convite. O pedido terminou com
e-mail verificado e convite consumido. MailHog recebeu uma mensagem de
verificação e uma de convite. Os requests de verificação e aprovação tiveram
HTTP 200; ativação, login e retomada do onboarding foram concluídos pela
interface, com leitura independente do estado persistido.

O resultado agregado confirmou uma sessão, um User `CLIENT`/`OWNER`, uma Company
sem CNPJ e uma Subscription `PENDING_APPROVAL` para o plano escolhido. Assim,
este fluxo demonstra que a ativação e a retomada de onboarding podem ocorrer sem
exigir CNPJ e sem confundir aprovação de acesso com status comercial. Não foram
copiados endereço, credenciais, tokens, links ou conteúdo de mensagens.

O owner aplicou padding horizontal de 12–16 px a quatro inputs sem prefixo e
preservou o campo de login; diff/cascata e smoke Chrome foram revisados. Em 390
px o padding computado é 12 px; em 1440 px é 16 px. O login conservou altura de
42 px e prefixo. A escala aceitou `min-h-touch` de 44 px, e TSC/Vite e build
Docker passaram. O CTA de cabeçalho e o nome acessível do seletor (com opção
atual) passaram individualmente em CA-01/CA-09; isso não altera a rodada mockada
9/11 nem equivale a 11/11.

## Riscos e follow-ups fora do aceite desta etapa

Há três itens preexistentes registrados para acompanhamento posterior:

- concorrência de refresh e divergência entre `expiresAt` e TTL;
- concorrência entre decisões comerciais `approve` e `reject`;
- variação temporal nas respostas e no login.

São follow-ups independentes do cutover. Este registro não inclui payloads,
roteiros de exploração ou alegação de que esses itens foram corrigidos.

## Ressalvas e rastreabilidade

- A rodada Web completa pré-integração permanece 708/710. A validação pós-`dev`
  teve 124/125 testes distintos; a falha de acessibilidade foi reproduzida na
  base pura e atribuída a arquivos iguais à `dev`. A evidência não transforma a
  suíte em verde.
- Canários aprovados antes da integração. Merge local concluído em `822fa21`
  (pais `828ec6a` + `effd32a`); branch publicada. Rastreabilidade remota:
  [PR #83](https://github.com/guimunizzz/Vulnera-TCC/pull/83). Web, API e Compose
  passaram com as ressalvas acima. `95f3252` permanece como baseline histórico
  com três commits SAST/SCA. Este relatório não afirma merge remoto nem
  fechamento da Issue #51.
- Os totais da execução API completa e do reteste são reportados em separado;
  não somar contagens de testes sobrepostas.

## Histórico

- 2026-11-25 — Código implementado em `53d142e`; integração local de
  `origin/dev` (`effd32a`) aberta, sem merge commit/push. Registrado que a
  evidência de teste e a prova manual acima são pré-integração. O estado da
  execução API, reteste, Web, smoke e jornada manual foi mantido sem somar
  contagens sobrepostas. Aguardam validações pós-`dev`/remotas e revisão.
- 2026-11-25 — Atualização Web pós-`dev`: build Docker Web, TSC, lint focal,
  contraste 132/132 e Compose config DEV/real passaram. Vitest em 17 arquivos,
  122/125 na primeira rodada e 124/125 distintos após dois timeouts aprovados
  isoladamente. A falha de nome acessível reproduziu em `effd32a` puro; arquivos
  CodeImport/grafo são byte a byte iguais à `dev`. Lint API focal passou; global
  falha nos dois args unused herdados.
- 2026-11-25 — Atualização API pós-`dev`: Docker build, TSC, Prisma generate,
  lint focal e migration deploy 23/23 em schema novo restrito passaram. Jest
  inicial 20/21 suítes, 338/339 em 131,6 s; única falha em fixture vencida de
  `admin-access-request-http`, sem DI real. Reteste final 1/1 suíte, 9/9 testes,
  exit explícito Jest 0/Docker 0; asserções distintas 21/21 suítes, 339/339.
  `prisma validate` passou e `migrate status` confirmou 23 atualizadas.
  `npm install` reportou 12 advisories (8 moderate/4 high), sem `audit fix`.
- 2026-11-25 — Atualização posterior: merge local `822fa21` publicado na branch;
  rastreabilidade remota em [PR #83](https://github.com/guimunizzz/Vulnera-TCC/pull/83).
  Validação local com ressalvas registrada. Este registro não afirma merge remoto
  ou fechamento da Issue #51.
- 2026-11-19 — Incluídos resultados pré-integração da API, Web/Docker, canários,
  E2E focal, prova manual de ponta a ponta e smoke visual. Canários aprovados;
  spec focal de onboarding 11/11 e ADMIN 6/6 passaram. A rodada Web integral
  708/710 permanece não verde, com finding Code Import preexistente para
  conferir pós-`dev`. Pendem integração e validações pós-`dev`/remotas. Sem PR,
  merge ou encerramento da issue.
