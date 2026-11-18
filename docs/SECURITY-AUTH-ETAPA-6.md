<!--
Relatório de acompanhamento da integração web da Etapa 6 da Issue #51.
Registra ownership, contratos, validações recebidas, limites e passos de revisão.
Consumidores: Rafael, owners da Etapa 6 e revisores da Issue #51.
-->
# Issue #51 — Etapa 6: integração web (concluída em 2026-11-18; aprovada com ressalvas)

**Estado:** aprovada com ressalvas em 2026-11-18. Fechamento do recorte web; não
significa E2E full-stack, lint global ou conclusão do cutover legado.

## Escopo

Conectar os fluxos de solicitação e verificação de acesso, ativação de convite e
revisão ADMIN à aplicação web: clientes HTTP tipados, páginas, rotas, CTAs,
sidebar e onboarding/login. O fluxo público de solicitação mantém proteção
Turnstile; ativação consome o token do convite sem abrir sessão automaticamente.
O cadastro legado `/auth/register` continua ativo nesta etapa. Seu cutover é
trabalho da Etapa 7.

## Base de integração e estado do Git

- Worktree: `output/issue51-integration-worktree`.
- Branch: `integration/issue51-dev-20261117`.
- HEAD observado: `44feabe9021ebf970b4388801687a15527b01230`, merge local da
  Issue #51 com `dev`; pais `27d7b59` e `aafbc2b`.
- O merge foi informado como concluído, índice sem conflitos e worktree original
  preservado. A Etapa 6 não gerou commit nem push neste registro.
- Comparação do baseline de 21 hashes do backend: zero diferenças reportadas.
  Isso não converte as validações da interface em validação full-stack.

## Ownership e arquivos

As letras identificam os seis owners desta execução. A coordenação limita a
execução paralela a três owners. Esforço informado: A/C/D/E XHIGH; B/F HIGH.
F mantém ownership exclusivo dos documentos listados.

| Owner | Responsabilidade e caminhos da Etapa 6 |
|---|---|
| A | Turnstile, token em fragmento, cliente HTTP anônimo, pedido/verificação: `app/web/.env.example`; `app/web/config/csp.ts`; `app/web/src/test/csp.test.ts`; `app/web/src/vite-env.d.ts`; `app/web/src/components/auth/turnstile-challenge.tsx` e teste; `app/web/src/hooks/use-fragment-token.ts` e teste; `app/web/src/lib/api/public-http.ts` e teste; `app/web/src/lib/api/public-access.api.ts` e teste; `app/web/src/types/public-access.types.ts`; `app/web/src/pages/auth/request-access-page.tsx`, `.test.tsx`, `.css`; `app/web/src/pages/auth/verify-email-page.tsx` e teste. |
| B | Fila ADMIN: `app/web/src/pages/admin/access-requests-page.tsx`, teste e CSS; `app/web/src/lib/api/admin-access-requests.api.ts` e teste; `app/web/src/types/admin-access-requests.types.ts`. |
| C | Ativação de convite: `app/web/src/pages/auth/activate-account-page.tsx`, teste e CSS; `app/web/src/lib/api/account-activation.api.ts` e teste; `app/web/src/types/account-activation.types.ts`. |
| D | Integração da aplicação e entrada: `app/web/src/App.tsx`, `App.test.tsx`; `src/pages/auth/auth-layout.tsx`, `auth-layout-motion.test.tsx`, `auth-submission.test.tsx`, `login-page.tsx`, `login-page.css`, `register-page.tsx`; `src/components/landing/nav.tsx`, `sections/hero.tsx`, `sections/pricing.tsx`, `sections/final-cta.tsx`, `sections/conteudo.test.tsx`; `src/pages/plans-page.tsx`, `landing-page.test.tsx`; `src/components/layout/sidebar.tsx`, `sidebar.test.tsx`; testes `src/test/controlled-access-routes.test.tsx` e `controlled-access-navigation.test.tsx`. Integração escrita/congelada; E ainda revisa os mocks. |
| E | E2E isolado: `app/web/playwright.controlled-access.config.ts`, `app/web/e2e/controlled-access.spec.ts` e evidências planejadas em `output/issue51-stage6/`. Owner corrigiu as fixtures após duas tentativas interrompidas; última execução focal de 11 casos iniciando, resultado aguardado. |
| F | Documentação: `PRD_VIVO.md`, `docs/BACKLOG.md`, `docs/ROADMAP_PROMPTS.md`, `docs/Vulnera/07-Decisoes/ADR-056 - Fundacao do acesso controlado.md`, `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md`, este relatório e correção pontual em `docs/SECURITY-AUTH-ETAPA-5.md`. |

Sem arquivo compartilhado entre owners foi informado. A lista acima identifica
os arquivos atribuídos e presentes no worktree.

## Contratos e rotas

Os caminhos abaixo usam o prefixo `/api` da aplicação:

| Operação | Rota e payload | Resposta / autenticação |
|---|---|---|
| Solicitar acesso | `POST /api/access-requests`; `{ name, email, companyName, phone?, captchaToken }` | `202` com mensagem neutra; pública, Turnstile obrigatório. |
| Reenviar verificação | `POST /api/access-requests/resend-verification`; `{ email, captchaToken }` | `202` com mensagem neutra; pública, Turnstile obrigatório. |
| Confirmar e-mail | `POST /api/access-requests/verify-email`; `{ token }` | Mensagem genérica; pública. A interface só envia o token após ação explícita da pessoa. |
| Validar convite | `POST /api/account-activation/validate`; `{ token }` | `200 { valid: boolean }`, sem PII; pública, resposta `no-store`. |
| Ativar conta | `POST /api/account-activation/activate`; `{ token, password }` | `204` sem corpo; pública, resposta `no-store`; não cria sessão nem autentica automaticamente. |
| Listar solicitações | `GET /api/admin/access-requests`; query `status?`, `page?`, `pageSize?` | Itens e paginação; `apiClient` autenticado e rota web ADMIN. |
| Ver detalhe/histórico | `GET /api/admin/access-requests/:id` e `GET /api/admin/access-requests/:id/events` com paginação de eventos | DTOs sem token/hash de convite; autenticado como ADMIN. |
| Decidir/reemitir | `POST /api/admin/access-requests/:id/approve` `{}`; `/reject` `{ reason?: string\|null }`; `/resend-invitation` `{}` | Resposta da solicitação e resultado de entrega onde aplicável; autenticado como ADMIN. |

O backend é a autoridade para autorização e estado. A interface ADMIN usa o
cliente autenticado existente; esconder a página ou o item de navegação não
substitui a autorização da API. As chamadas anônimas usam `publicPost`, separado
do cliente autenticado, com `credentials: omit`, `cache: no-store`, sem bearer,
refresh interceptor ou cookie.

## Token, CAPTCHA e configuração

- Os links de verificação e ativação carregam `#token=...` no fragmento da URL.
  `useFragmentToken` lê uma vez, mantém o token em memória e limpa o fragmento
  com `history.replaceState`, preservando query, caminho e estado. O token não
  deve ser copiado para query string, log, telemetria ou armazenamento de sessão.
- Verificação de e-mail é iniciada por ação explícita. A página de ativação faz
  validação consultiva, pede senha e só então envia a ativação. Sucesso não cria
  sessão; a pessoa segue para login.
- Turnstile protege solicitação e reenvio. O frontend lê
  `VITE_TURNSTILE_SITE_KEY` e `VITE_TURNSTILE_ACTION`; o valor de ação deve
  coincidir com `TURNSTILE_EXPECTED_ACTION` na API (no exemplo,
  `access-request`). A API exige `TURNSTILE_SECRET_KEY` e valida host/action
  conforme a configuração. Chave ausente, script/challenge indisponível,
  expiração ou falha bloqueia o envio (fail-closed). O token do CAPTCHA é
  descartado/resetado após a tentativa.
- Os endpoints de verificação e ativação não pedem CAPTCHA; têm seus próprios
  limites de taxa no backend. CAPTCHA não substitui esses limites.
- A chave de site de teste Cloudflare presente no E2E é fixture de teste e não
  deve ser usada em build de produção.

## Validação recebida

Resultados reportados em 2026-11-17 e 18. Esta tabela conta os casos distintos sem
somar novamente a suíte ADMIN de componentes com a suíte da página ADMIN.

| Área | PASS | Suítes | Evidência e limite |
|---|---:|---:|---|
| A — solicitação/verificação/Turnstile | 32/32 | 7 | Primeira rodada 30/32; repetição somente nas 3 suítes afetadas: 14/14 em 25 s. A repetição é sobreposição, não novos casos. |
| Clientes HTTP de ADMIN + ativação | 6/6 | 2 | Resultado conjunto; não contar outro 6 para o mesmo par de clientes. |
| UI de ativação | 9/9 | 1 | Suite focal da página. |
| UI ADMIN (página/componentes) | 6/6 | 1 | Uma contagem agregada; não duplicar os 6 casos de componentes ADMIN. |
| **Total antes da integração central** | **53/53** | **11** | 32 + 6 + 9 + 6. Resultado focal, não full E2E. |
| D — integração central/navegação/layout | 48/48 | 8 | `App`, rotas, navegação, motion do layout de acesso, submissão, sidebar, landing e conteúdo; 59,29 s. Suites reportadas: App, controlled-access-routes, controlled-access-navigation, auth-layout-motion, auth-submission, sidebar, landing-page e sections/conteudo. |
| **Total distinto recebido** | **101/101** | **19** | 53 anteriores + 48 centrais; sem suíte global/API. Owners/orquestrador reportaram; F não reexecutou. |
| E — Playwright focal mockado | **8/11; 3 sem PASS final** | 1 rodada | 1,7 min. Rerun dos 3 interrompida após duas falhas de seletor; última alteração não reexecutada por prioridade de entrega. Não é full-stack. |
| Lint A | PASS | 16 arquivos | Escopo focal de arquivos do owner A. |
| Lint B/C | PASS | 10 arquivos | Escopo focal de arquivos dos owners B/C. B também reportou lint de produção em 2 arquivos PASS após ajuste de landmark. |
| Lint D/E | PASS informado | D16 e E2 arquivos | Lint focal adicional, sem declaração de lint global. |
| Contraste | PASS | 132 pares, 0 falhas | `npm run check:contrast`; 77 primitivos considerados. |
| Backend baseline | PASS informado | 21 hashes | Comparação contra baseline: zero mudanças reportadas. |
| Build web padrão | **FALHOU no ambiente** | — | `npm run build` termina em TS2688 por tipos implícitos/incompletos herdados de workspaces ancestrais (incluem bcrypt/Jest/cors), não por erro de fonte web. Não foram alteradas config/dependências para mascarar. |
| Build focal alternativo | **PASS** | — | `npx tsc --noEmit --typeRoots ./node_modules/@types` passou após o owner E corrigir dois erros de fixture. `vite build` passou: 2.892 módulos em 1m32s. O PASS focal não apaga o TS2688 do comando padrão no ambiente atual. |

E2E Playwright usa Chrome instalado contra Vite isolado em `127.0.0.1:4179`, sem API real. A primeira tentativa foi interrompida por fixture que interceptava imports do Vite; a segunda por fixture que não era `autouse`. A rodada de 11 casos teve 8 PASS e 3 FAIL em 1,7 min: dois seletores de senha ambíguos e um finding axe no widget Turnstile sem role. O widget recebeu `role=group` e passou reteste isolado 5/5. Rerun dos três casos foi interrompida após duas falhas de seletor; owner E preparava seletores por regex ancorada, sem nova execução após esse ajuste a pedido do usuário para priorizar a entrega. Não declarar os três como PASS.

O finding axe `label-content-name-mismatch` no brand link compartilhado do
AuthLayout é preexistente, registrado sem correção por instrução do usuário. E
limitou axe aos novos painéis sem desativar regras e registrou o finding da
página completa como ressalva. O pedido de acesso foi inspecionado visualmente
em 320 px e 1440 px; isso não representa inspeção integral nem API real.

## Browser real e Playwright mockado

A extensão Chrome voltou a falhar ao estabelecer conexão trusted RPC, inclusive
após instalação pelo usuário. Isso é indisponibilidade do canal de inspeção, não
aprovação nem falha funcional da aplicação.

O setup Playwright focal usa Chrome desktop em `127.0.0.1:4179`, `pt-BR`, fuso
`America/Sao_Paulo` e `reducedMotion: reduce`. Intercepta `/api/**`, fornece uma
implementação local de Turnstile e bloqueia tráfego externo. Não inicia backend,
banco ou SMTP. Seus resultados podem comprovar fluxos visuais/navegação contra
respostas simuladas e devem ser rotulados como **E2E de UI mockado**, não
full-stack, API real, entrega de e-mail ou validação do CAPTCHA real.

## Roteiro manual local

Este é um roteiro para revisão humana; não representa execução realizada nesta
sessão.

1. Subir os serviços locais: `docker compose up -d db mailhog`. Usar o setup do
   [README](../README.md#desenvolvimento-no-host-com-hot-reload) e configurar
   `app/api/.env` com banco de desenvolvimento identificado, segredos locais,
   `CORS_ORIGIN=http://localhost:3000` e `PUBLIC_WEB_URL=http://localhost:3000`.
2. Para validação real do Turnstile, configurar no `app/web/.env` a site key
   apropriada ao ambiente, `VITE_TURNSTILE_ACTION=access-request`; na API,
   preencher `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME` e
   `TURNSTILE_EXPECTED_ACTION=access-request`. Sem configuração válida o fluxo
   deve permanecer bloqueado. Não usar credenciais de produção localmente.
3. Em um terminal, iniciar API após geração/aplicação do schema e seed do
   ambiente local, conforme README: `cd app/api`, `npx prisma generate`,
   `npx prisma migrate deploy`, `npm run db:seed`, `npm run dev`. Em outro:
   `cd app/web`, `npm run dev` (Vite na porta 3000 segundo README). Definir
   `VITE_API_URL=http://localhost:3001/api` completo no `.env` web. Em DEV é
   permitido usar a site key oficial de teste
   `1x00000000000000000000AA`; configure seu par de teste no backend para um
   smoke com API real. Não usar a chave de teste em build de produção; builds
   de produção exigem a chave real. Nunca registrar/compartilhar segredo.
4. Como visitante, abrir `/request-access`, enviar o desafio e solicitar acesso;
   conferir a resposta neutra e a mensagem local no MailHog. Reabrir
   `/verify-email#token=...`, conferir que o fragmento é removido da barra e
   confirmar por ação explícita. Exercitar reenvio sem revelar se um endereço
   existe e verificar novo desafio/cooldown após a tentativa.
5. Entrar com uma conta ADMIN local documentada em `docs/DEMO.md`, abrir
   `/admin/access-requests`, filtrar, paginar, consultar detalhe/histórico,
   rejeitar uma solicitação de teste e aprovar outra. Conferir mensagem/estado de
   entrega, reenvio de convite e que nenhuma tela ou DTO revela token/hash.
6. Abrir o convite de teste em `/activate-account#token=...`, conferir validação,
   senha/confirmar senha e estados inválido/limite; após ativar, confirmar que a
   aplicação não abriu sessão e efetuar login explicitamente.

### Revisão visual e checklist de acessibilidade

- **Conferido parcialmente:** pedido de acesso inspecionado em 320 px e 1440 px;
  E2E continua mockado, sem API/SMTP/Cloudflare reais.
- Pendente: completar os fluxos com teclado somente: ordem de Tab, foco visível, Enter/
  Space, retorno de foco após diálogos, rótulos, erros e anúncios de estado.
- Revisar a fila ADMIN em larguras 320, 375/390 e 768 px: sem corte ou rolagem
  horizontal indevida; ações e paginação alcançáveis por toque/teclado.
- Revisar temas claro/escuro e contraste do texto, foco, status e botões.
- Ativar movimento reduzido e conferir que transições não bloqueiam envio,
  feedback, navegação ou leitura dos estados.
- Confirmar que nenhum token aparece na query string, no histórico após captura,
  em referrer, logs ou storage; conferir respostas sem cache e sem sessão
  automática depois de ativar.
- Confirmar experiência quando CAPTCHA/script não carrega: ação bloqueada,
  mensagem compreensível e retry acessível.

## Ressalvas de etapas anteriores e próximas

- A Etapa 5 foi concluída em 2026-11-17, aprovada com ressalvas: domínio 23/23,
  focais 36/36 e full API 70/70 suítes, 1152/1152 (executada antes dos dois
  casos adicionais). Não repetir nem contabilizar como 1154.
- O lint global da API ainda tem dois imports preexistentes em
  `vulnerability.service.ts:46` (`UserEntity`, `UserResponseDTO`), com zero
  warnings. Outbox não existe; o fluxo SMTP é síncrono.
- `/auth/register` permanece ativo. Cutover protegido do cadastro legado,
  remoção do caminho público antigo e trabalho operacional relacionado estão
  reservados para a Etapa 7; não fazem parte desta entrega web.

Etapa 6 fechada em 2026-11-18 como **aprovada com ressalvas**: 101 testes focais
PASS, lint/contraste/build alternativo PASS; três E2E sem PASS final, finding
preexistente do brand link, falta de Cloudflare/SMTP/API reais e TS2688 do build
padrão permanecem ressalvas documentadas.

## Consolidação e entrega

O usuário autorizou consolidar as alterações das Etapas 5/6 e fazer push. Este
relatório registra o checkpoint Git inicial antes dessa consolidação:
branch `integration/issue51-dev-20261117`, HEAD `44feabe9021ebf970b4388801687a15527b01230`,
índice vazio e nenhum conflito; worktree original preservado. As alterações de
código ficaram staged durante a preparação; no checkpoint informado, 69
arquivos aguardavam commit e push. O alvo autorizado é
`refactor/security-auth-gated-access`. O merge usa a base `aafbc2b`; o avanço
posterior de `origin/dev` para `95f32520ec3bfd61ecd83c67e99328fb4d292e68` não foi
incorporado. O commit de código `9a0f2f119bd5120712d3890d2e0005fa1649090f`
(69 arquivos) foi publicado em `origin/refactor/security-auth-gated-access`.
A documentação será consolidada em commit separado.
