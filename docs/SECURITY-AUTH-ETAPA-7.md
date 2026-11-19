<!--
O que faz: acompanha o cutover do cadastro público e a retomada do onboarding.
Por que existe: separar contrato, evidência parcial e pendências antes do aceite.
Quem consome: Rafael e os responsáveis pela revisão da Issue #51.
-->

# Issue #51 — Etapa 7: cutover e retomada do onboarding

**Estado: em andamento. Este documento é um rascunho de acompanhamento; não
representa aprovação da Etapa 7, merge ou encerramento da Issue #51.**

Data do registro: 2026-11-19. Referência de trabalho: branch
`refactor/security-auth-gated-access`, com base `e5e353c`. A matriz registra os
resultados pré-integração, inclusive execuções não verdes e seus limites. Os
canários foram aprovados pelos owners; integração e validações pós-`dev`/remotas
seguem pendentes.

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
| API — execução completa | 72 suítes: 65 passaram e 7 falharam; 1064 testes passaram e 46 falharam; 967 s | Não é gate verde |
| API — reteste das sete suítes | 6/7 suítes e 231/233 testes passaram | As duas falhas do `zap-runner` reproduziram exatamente os mesmos dois casos e saídas no harness isolado de `e5e353c`; controle confirmou ser residual preexistente. Sem alteração DAST |
| API — Auth+Company | 21/21 | Validação focal do recorte |
| API — Docker isolado | PASS final | Não equivale à suíte completa |
| Web — TSC/build/lint/contraste | TSC + Vite PASS; lint 0 erros/9 avisos; contraste 132/132 PASS | Build Docker final PASS |
| Web — runtime de produção servido | Docker final PASS; Rollup 4.68.5; CSS scoped servido | Verificação de artefato em stack isolada |
| Web — Playwright real de projeto | 1/1 PASS após corrigir seletor de senha | CLIENT provisionado exclusivamente; sem regressão de role observada |
| Web — Vitest focal `/register` | 2/2 PASS | Não substitui a suíte Web completa |
| Web — suíte completa, baixa concorrência | 87 arquivos: 85 passaram, 2 falharam; 708/710 testes passaram | Finding de nome acessível em Code Import é preexistente e será conferido pós-`dev`; não declarar a contagem integral verde |
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

O branch `origin/dev` estava em `95f3252`, com três commits SAST/SCA. O único
arquivo do recorte que se sobrepõe é `docs/BACKLOG.md`; a integração/merge ainda
não ocorreu. As validações foram feitas antes dela e não constituem revisão da
base integrada. Canários aprovados pelos owners. Restam gates de integração e
validação pós-`dev`/remota; nenhum PR ou merge é registrado aqui.

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

## Pendências para a revisão final

- A rodada Web completa permanece 708/710 e não é declarada verde. Spec focal de
  onboarding passou 11/11 depois de sincronizar o clique; manter separada da
  contagem integral. Verificar pós-`dev` o finding Code Import preexistente.
- Canários aprovados. Integrar com `origin/dev` e executar as validações
  pós-`dev` e remotas. `origin/dev` observado em `95f3252`; sem PR/merge
  registrado neste documento.
- Preservar em separado o total API da execução completa e o reteste das sete
  suítes, sem somar contagens de testes.
- Atualizar este relatório, PRD, BACKLOG, ROADMAP e ADR-056 com as provas finais.
- Aguardar revisão e sinal do responsável antes de marcar a Etapa 7 aprovada,
  registrar merge ou encerrar a Issue #51.

## Histórico

- 2026-11-19 — Incluídos resultados pré-integração da API, Web/Docker, canários,
  E2E focal, prova manual de ponta a ponta e smoke visual. Canários aprovados;
  spec focal de onboarding 11/11 e ADMIN 6/6 passaram. A rodada Web integral
  708/710 permanece não verde, com finding Code Import preexistente para
  conferir pós-`dev`. Pendem integração e validações pós-`dev`/remotas. Sem PR,
  merge ou encerramento da issue.
