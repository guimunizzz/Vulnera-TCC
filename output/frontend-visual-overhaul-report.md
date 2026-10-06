<!--
  O que faz: registra a revisão visual e a validação da área autenticada.
  Por que existe: dá ao Rafael um resultado auditável antes de qualquer commit.
  Quem consome: Rafael e revisores do frontend.
-->

# Relatório — revisão visual do frontend autenticado

## Páginas alteradas

- Fundo compartilhado aplicado às rotas de `/dashboard`, `/applications`,
  `/projects`, `/findings`, `/remediation`, `/dast`, `/playbooks`,
  `/settings/sla` e seus detalhes sob `AppLayout`.
- Hierarquia e superfícies atualizadas diretamente nos detalhes de aplicação,
  projeto, finding e scan; criação/edição de finding; catálogo/detalhe de
  playbooks; avaliação de maturidade; e assinaturas pendentes.
- `/new-analysis` e `/onboarding` receberam transição de etapas; Onboarding
  reutiliza o fundo CSS no fluxo de tela inteira.

## Background compartilhado

`AppLayout` monta uma base CSS de grid técnico, luz radial e sinal lento com
tokens existentes. Uma única cena Three.js lazy desenha ondas/órbitas quando
há espaço, WebGL e movimento normal. `AmbientHostContext` evita o segundo
canvas que Dashboard/Findings montariam localmente. O buffer WebGL fica limitado
à primeira área visível, com DPR 1,5 e limite de 30 fps; CSS segue por páginas
longas. A pausa de Findings controla essa instância global.

## Principais animações

- Sinal lento do fundo, órbitas e resposta discreta ao ponteiro na cena já
  existente; todos decorativos.
- Entrada e saída de etapas em Nova análise e Onboarding com `AnimatePresence`
  e variantes de `useMotion()`.
- Radar/pulso CSS do DAST ativo, hover/foco dos cards de playbook e transições
  de superfícies usando os tokens do design system.
- Transições já existentes de rotas, listas, status, Remediação e SLA foram
  preservadas e passaram a compartilhar o mesmo fundo.
- Com `prefers-reduced-motion`, canvas e loops não montam e os deslocamentos
  dos wizards são removidos.

## Componentes compartilhados criados

- `AmbientHostContext`: sinaliza a cena única para Dashboard e Findings.
- `operations-backdrop.css`: camada global e fallback responsivo.
- `module-surfaces.css`: heros e superfícies semânticas dos módulos.

## Testes executados

- `npm run lint`: 0 erros, 9 avisos preexistentes.
- `npm run check:contrast`: 66/66 pares aprovados nos temas dark/light.
- `npm test -- --maxWorkers=1 --exclude src/components/findings/findings-table.test.tsx`:
  237/237 testes versionados aprovados, inclusive o novo caso CSP/CRLF.
- `npm test -- --maxWorkers=1`: 237/239; duas falhas em
  `src/components/findings/findings-table.test.tsx`, arquivo não rastreado que
  já existia antes desta branch.
- `docker compose build web`: TypeScript e Vite aprovados. O build em host é
  bloqueado por um E2E não rastreado preexistente incluído pelo `tsconfig`;
  o build Docker usa apenas os arquivos distribuídos para o web.
- `git diff --check`: sem erros de whitespace.

## Browser validation

- Stack Docker com DB, API, web e MailHog; entrada `http://localhost:8086`.
- Smoke de 10 rotas principais em 1440, 768 e 375 px: 30 verificações de
  caminho, título, largura do documento, fundo único e no máximo um canvas.
- Com dados da demo, foram navegados Dashboard, Aplicações e seu painel,
  Projetos e detalhe, Findings e detalhe/edição, novo finding, Remediação,
  SLA, DAST, Playbooks e detalhe, Maturidade, Assinaturas, Nova análise e
  Onboarding. Projetos e Dashboard foram inspecionados também após carregar.
- Temas dark/light conferidos; escolha light persistiu após reload. Em
  `prefers-reduced-motion`, o canvas ficou ausente. Nenhum erro de CSP, de
  React ou exceção de página no smoke final.
- Capturas de Dashboard, Projetos e breakpoints de apoio em
  `output/visual-qa/`.
- Para percorrer muitos módulos sem esgotar o limiter de produção da demo, a
  API foi temporariamente recriada com rate limit desligado durante o smoke
  detalhado; a configuração normal foi restaurada ao final.

## Bugs encontrados

- **Corrigido:** em checkout Windows, o hash CSP usava CRLF do arquivo, mas o
  navegador executa o script de tema com LF. A política bloqueava o tema no
  primeiro paint. `config/csp.ts` normaliza as quebras e o teste cobre o caso.
- **Fora do escopo:** requests já existentes da demo retornam 404 em
  `/api/subscriptions/current` para ADMIN e em
  `/api/companies/me/metrics/comparison` no painel de aplicação. Não foram
  alterados contratos de API ou regras de negócio.
- A navegação inicial com reload rápido atingiu o rate limiter e produziu 429;
  o smoke detalhado foi repetido com a configuração temporária descrita acima.

## Limitações

- A base demo não tem scan DAST; o detalhe `/dast/scans/:id` foi compilado e
  revisado no código, mas não pôde ser inspecionado com um scan real no browser.
- A tabela de assinaturas estava vazia na demo; a rolagem horizontal mobile
  foi implementada, sem linha de dados para inspeção visual.
- O smoke verificou a contagem de canvas e o cleanup no código; não mediu
  numericamente RAF ou memória de GPU após navegações longas.
- O aviso de bundle Vite acima de 500 kB permanece anterior a esta tarefa.

## Arquivos alterados

- Layout/cena: `app-layout.tsx`, `dashboard-atmosphere.tsx`,
  `use-dashboard-scene.ts`, `ambient-host-context.ts`,
  `operations-backdrop.css`, `module-surfaces.css`.
- Páginas: `application-dashboard-page.tsx`, `project-detail-page.tsx`,
  `findings-page.tsx`, `finding-detail-page.tsx`, `finding-editor-page.tsx`,
  `dast-page.tsx`, `dast-scan-detail-page.tsx`, `playbooks-page.tsx`,
  `playbook-detail-page.tsx`, `maturity-assessment-page.tsx`,
  `pending-subscriptions-page.tsx`, `new-analysis-page.tsx`,
  `onboarding-page.tsx`.
- Tema/teste: `app/web/config/csp.ts`, `app/web/src/test/csp.test.ts`.
- Documentação: `docs/FRONTEND_WEB.md`, ADR-041, `PRD_VIVO.md`,
  `docs/BACKLOG.md`, este relatório e capturas em `output/visual-qa/`.
- Os três arquivos não rastreados preexistentes de testes/E2E em `app/api`
  e `app/web` foram preservados sem edição.

## Commit sugerido

`feat(web): unificar atmosfera visual da área autenticada e documentar frontend`

Relatório da entrega na branch `feat/visual-overhaul-authenticated`; push não executado.
