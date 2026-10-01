<!--
  O que faz: explica a arquitetura e a implementação visual do frontend web.
  Por que existe: permite manter a mesma linguagem entre módulos e revisar o
  comportamento da interface sem depender do histórico de uma sessão.
  Quem consome: Rafael, equipe do TCC e próximos agentes de frontend.
-->

# Frontend web do Vulnera

**Estado em 2026-09-23.** O frontend está em `app/web/` e é uma SPA React +
TypeScript construída com Vite. Tailwind usa os tokens próprios em
`src/styles/tokens.css`; os componentes de interface ficam em
`src/components/ui/`. Motion anima transições de interface. Three.js só desenha
a atmosfera decorativa compartilhada e é carregado sob demanda. Os gráficos
analíticos usam os componentes de `src/components/metrics/`.

Este documento descreve o código implementado. As especificações de tokens e
das telas anteriores continuam em [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) e
[DASHBOARD_VISUAL.md](DASHBOARD_VISUAL.md). A decisão do fundo único está em
[ADR-041](Vulnera/07-Decisoes/ADR-041%20-%20Atmosfera%20unica%20no%20layout%20autenticado.md).

## Entrada, rotas e dados

`src/main.tsx` monta, nessa ordem, `ThemeProvider`, TanStack Query,
`BrowserRouter` e `ToastProvider`. `src/App.tsx` registra as rotas. As telas
autenticadas passam por `ProtectedRoute`; quase todas usam `AppLayout`, que
fornece navegação, cabeçalho, alternância de tema, área principal e transição
entre rotas. `/onboarding` usa um fluxo protegido de tela inteira.
`/dast/scans/:id/report` também é uma tela cheia separada do layout.

As páginas chamam módulos em `src/lib/api/`. O `apiClient` Axios anexa o access
token, centraliza o refresh e põe requisições simultâneas em uma fila enquanto
o token é renovado. TanStack Query guarda os dados do servidor por chave de
query; Zustand mantém a sessão. Filtros que precisam sobreviver ao botão
Voltar ou ser compartilháveis ficam na URL, como no painel de aplicação e na
busca de findings. Os números exibidos vêm dessas queries; decoração não cria
dados de negócio. O backend continua sendo a autoridade de permissões, regras
e escopo de empresa.

## Fundo único da área autenticada

`AppLayout` monta `operations-backdrop.css` e `DashboardAtmosphere` uma vez,
como camadas sem interação sob `operations-content`. A base CSS desenha uma
grade técnica sutil, luzes radiais e um sinal circular lento. O mesmo fundo
funciona nos temas dark e light porque usa os tokens OKLCH existentes. Em
mobile, o sinal circular sai e a grade perde opacidade. A folha também para o
loop quando o sistema pede movimento reduzido.

`DashboardAtmosphere` conserva a cena Three.js que já era usada no Dashboard e
em Findings. O novo `AmbientHostContext` informa a essas páginas que o layout
já montou a cena: assim, a navegação autenticada possui no máximo um canvas.
O canvas tem `aria-hidden`, não recebe ponteiro e só carrega em viewport com
pelo menos 768 px, sem `prefers-reduced-motion`. A cena limita o DPR a 1,5,
desenha em até 30 fps, pausa com a aba oculta e descarta renderer, geometria,
material, RAF e observers no cleanup. O buffer acompanha o tamanho visível do
canvas, limitado a `min(100dvh, 60rem)`; páginas longas continuam com o fundo
CSS abaixo dessa área. A cena não bloqueia conteúdo quando WebGL ou o download
falha.

O botão **Pausar animações** de Findings envia o evento local
`vulnera:ambient-pause` ao `AppLayout`. Ao sair da página, o efeito limpa a
pausa. O evento só controla decoração, sem tocar queries, filtros ou dados.

## Identidade dos módulos

`module-surfaces.css` fornece três marcas optativas: `data-ops-hero` para o
cabeçalho, `data-ops-surface` para superfícies de dados e `data-ops-lift` para
cards interativos. Variantes de hero usam **os mesmos tokens**, alterando
composição, luz e borda conforme o contexto. Aplicação destaca superfície de
ataque; Projeto mostra pipeline; Finding sinaliza ameaça; DAST acrescenta um
radar CSS discreto; Playbooks lembra uma base de conhecimento; Maturidade e
Governança mantêm a hierarquia própria. O scan ativo recebe um pequeno pulso
CSS ao lado de seu progresso real. Não há paleta nem cena 3D por módulo.

Dashboard, inventário de Aplicações, lista de Projetos, Findings, Remediação e
SLA já tinham componentes e movimentos próprios; o layout agora lhes dá a
mesma atmosfera. Os detalhes de aplicação, projeto, finding, edição, scan,
playbook e maturidade ganharam cabeçalhos e superfícies coerentes. O wizard de
Nova análise usa essa hierarquia dentro do layout. Onboarding reutiliza o
fundo CSS fora dele para preservar seu fluxo de tela inteira. Páginas públicas,
styleguide e relatório DAST não foram redesenhados.

## Movimento e acessibilidade

`src/motion/tokens.ts` espelha as durações e curvas de `tokens.css`;
`src/motion/use-motion.ts` entrega variantes já adaptadas à preferência do
sistema. `src/motion/components.tsx` concentra entrada escalonada, transição
de rota, contadores e overlays. Nova análise e Onboarding usam
`AnimatePresence` com a variante `troca` ao mudar de etapa; o formulário segue
funcional durante a saída e entrada do conteúdo. Os demais módulos reutilizam
os componentes Motion existentes para listas, filtros, cards e feedback das
mutations. Não há durações arbitrárias por página.

Quando `prefers-reduced-motion` está ativo, a cena WebGL não monta, os loops
CSS param e as variantes de Motion removem deslocamento e escala. Valores e
conteúdo permanecem legíveis. A decoração usa `aria-hidden` e
`pointer-events: none`; a navegação mantém link de pulo, landmarks, foco e
controles semânticos. Em tabelas estreitas, o conteúdo rola horizontalmente
quando necessário em vez de cortar colunas; listas que já possuíam cards
mobile continuam usando o mesmo DOM.

## Tema e política de scripts

O script mínimo em `index.html` define `data-theme` antes do primeiro paint.
Depois, `ThemeProvider` assume as trocas e acompanha a preferência do sistema
quando o modo escolhido é `system`. Em `vite preview`, a CSP permite esse
script por hash. `config/csp.ts` normaliza CRLF/CR para LF antes de calcular o
hash, como faz o parser HTML do navegador; isso também permite o primeiro
paint correto em checkout Windows. `src/test/csp.test.ts` cobre a regra.

## Como manter e verificar

Ao criar uma tela autenticada, registre a rota sob `AppLayout` em `App.tsx`,
use componentes de `src/components/ui/`, tokens semânticos, dados da API e as
variantes de `useMotion()`. A página não deve montar outra atmosfera. Escolha
`data-ops-hero` apenas quando um cabeçalho destacado ajudar o fluxo, sem
repetir um conjunto fixo de KPIs. Teste também estados de loading, vazio, erro,
tema claro/escuro, 375/768/1440 px e movimento reduzido.

Na raiz do repositório, `docker compose up -d --build` inicia DB, API, web e
MailHog; a entrada web é `http://localhost:8086`. As credenciais da base de
demonstração estão em [DEMO.md](DEMO.md). Em `app/web/`, rode
`npm run lint`, `npm run check:contrast`, `npm test -- --maxWorkers=1` e
`npm run build`. O resultado específico desta entrega, inclusive limites
observados no navegador, está em
[`output/frontend-visual-overhaul-report.md`](../output/frontend-visual-overhaul-report.md).
