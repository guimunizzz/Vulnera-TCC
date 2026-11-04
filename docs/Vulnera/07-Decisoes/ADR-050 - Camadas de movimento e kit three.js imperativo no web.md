---
type: decisao
tags: [decision, frontend, motion, three.js, gsap, webgl, acessibilidade, performance]
status: vigente
codigo: ADR-050
data: 2026-11-04
---

<!-- Registra a arquitetura de animação do web depois do refactor web-motion-3d: que biblioteca faz o quê, o kit three.js, a cena da landing, a atmosfera da plataforma e o que isso substitui no ADR-026 e no ADR-041; consumido pelos mantenedores e pela banca. -->

# ADR-050 — Camadas de movimento e kit three.js imperativo no web

> [!info] Origem
> Refactor `web-motion-3d` (branch `refactor/web-motion-3d`, 2026-10-23 a
> 2026-11-04), em seis fases com checkpoint. Baseline, medições e evidências em
> `output/web-motion-3d/` (relatório final: `FASE-6.md`). Roteiro da cena em
> `docs/LANDING_NARRATIVA.md`.

## Contexto

A investigação da Fase 0 (`output/web-motion-3d/FASE-0.md`) encontrou:

- **três sistemas de animação sem fronteira**: Motion em 31 arquivos, GSAP em
  duas seções da landing, `@keyframes` CSS em 22 lugares e SMIL no login, com
  `useScroll` do Motion e ScrollTrigger fazendo o mesmo papel;
- **three.js de dois jeitos**: R3F + drei na landing (intro 3D e partículas) e
  imperativo no dashboard. O `extend(THREE)` do R3F impedia o tree-shaking e
  inflava para 687 kB o chunk de three que o dashboard também baixava;
- a **intro 3D de ~7,4 s ignorava movimento reduzido** (medido: 94 desenhos em
  2 s com `reduce`), e as partículas desenhavam 60 vezes por segundo mesmo fora
  da tela, inclusive em 375 px;
- cores das cenas em **hex aproximado**, já divergentes dos tokens;
- `App.tsx` importava as 26 páginas de forma estática: chunk principal de
  1.771 kB (584 kB gzip);
- o ADR-026 descrevia uma landing (paleta `landing-palette.ts`, `useHeroScene`,
  `EffectComposer`, sempre escura) que o código não tinha.

## Decisão

### 1. Uma biblioteca por papel

| Camada | Responsável | Onde | Regra |
|---|---|---|---|
| Interface do produto (overlays, listas, KPIs, rota, troca de etapa) | **Motion** | `src/motion/` (`useMotion`, `components.tsx`, `tokens.ts`) | só tokens de duração e curva; nenhum componente inventa duração |
| Narrativa por rolagem da landing | **GSAP + ScrollTrigger** | `components/landing/motion/` (`gsap.ts`, `tokens.ts`, `useMovimentoLanding`) | registro único dos plugins; contexto `useGSAP` desfeito no unmount; sem `gsap.matchMedia()` (medido: na troca de condição levava a página ao topo) |
| Loops decorativos e `press` | **CSS** | folhas de cada módulo | `@media (prefers-reduced-motion)` e `:root[data-reduzir-movimento]` |
| Fundo decorativo | **three.js imperativo** | kit `src/three/` + uma cena por superfície | decoração apenas (§4) |

O CyberGraph 3D do scan DAST (ADR-048) continua com three imperativo próprio;
migrá-lo para o kit é o item SG-FUT-04 do backlog.

### 2. Kit `src/three/` em vez de R3F

R3F e drei saíram (Fase 4). O kit tem um arquivo por responsabilidade:

- `gate.ts` — `useCenaPermitida`: decide **antes** do `lazy()`. Sem WebGL2, com
  tela abaixo de 768 px, com movimento reduzido (sistema **ou** menu, ADR-049)
  ou com o **alto contraste** do menu, o chunk de three nem é baixado. É o
  único arquivo do kit que não importa `three`;
- `scene-host.ts` — renderer, DPR ≤ 1,5, pausa com a aba oculta ou o canvas
  fora da tela, perda de contexto;
- `loop.ts` — orçamento de fps com tolerância de 85% do intervalo (comparar com
  o intervalo exato alternava 33/50 ms e parecia lag);
- `dispose.ts` — descarte de geometrias, materiais, texturas e render targets;
- `palette.ts` — lê as cores do CSS em runtime e converte OKLCH com a mesma
  função do verificador de contraste. **Nenhum hex nas cenas.** Novos tokens:
  `--color-ambient-ink`, `--color-ambient-muted`, `--color-ambient-cyan` e
  `--color-ambient-magenta` (`tokens.css`, nos dois temas);
- `ascii.ts` — atlas de glifos desenhado em canvas 2D com JetBrains Mono;
- `grade-celulas.ts` — **duas passadas**: a lógica roda uma vez por célula num
  render target pequeno (RGBA8, `NearestFilter`) e a segunda passada só carimba
  o glifo por pixel. Numa passada só, a landing rolava a 31 fps;
- `gotas.ts` — a "gota d'água" no clique (só na landing).

### 3. Landing: uma cena ASCII narrativa

Saíram a intro 3D, as partículas e o cursor customizado. Um canvas fixo atrás
das seções conta a história da página em seis atos (`LANDING_NARRATIVA.md`),
com estética de terminal e acentos neon. Quando a cena não roda, um pôster
`<pre>` estático com o ato atual ocupa o lugar. As cores vêm de `--vx-*`
(`landing.css`) e dos tokens de severidade do produto, lidos em runtime.

### 4. Plataforma: a atmosfera ASCII no lugar das ondas e órbitas

O ADR-041 continua valendo: um canvas, montado uma vez pelo `AppLayout`. Muda o
conteúdo. As 18 ondas e as órbitas dos KPIs deram lugar a uma atmosfera ASCII
com as curvas antigas desenhadas em glifos, aurora violeta → ciano → magenta,
brilho na chuva, hover discreto e uma varredura na troca de página e a cada 36 s
(`components/dashboard/hero/atmosfera-config.ts`). A atmosfera **não usa
dígitos**, porque no produto número é dado. O teto de opacidade (0,30 no tema
escuro, 0,24 no claro) é o limite em que o texto primário e o secundário seguem
AA com um glifo cruzando a letra, conta feita pelo teste ATM-01.

### 5. Decoração nunca é dado nem controle

Todo canvas é `aria-hidden`, não recebe foco e usa `pointer-events: none`.
O hover (só mouse e caneta) e o clique da gota são ouvidos na `window`, e a
gota ignora cliques em alvos interativos. Nada na
cena representa métrica de negócio. Com movimento reduzido, a página mantém a
opacidade, perde deslocamento e escala, e a duração encolhe.

### 6. Código dividido por rota

`App.tsx` carrega cada página por `paginaLazy` (`lib/lazy-page.ts`) sob um
`LimiteDeRota` (`components/layout/route-boundary.tsx`), que mostra skeleton
enquanto baixa e trata só a falha de download do chunk (rede caída, deploy
novo); erro de render continua subindo. Ficam no chunk principal só `AppLayout`,
`ProtectedRoute` e a landing, que faz o próprio `lazy()`.

## O que este ADR substitui

O histórico dos ADRs anteriores fica preservado. Cada um ganhou uma nota no
topo apontando para cá.

| ADR | Trecho | Estado |
|---|---|---|
| ADR-026 §1 | landing sempre escura | **Substituído.** A landing segue o tema do app (decisão do Rafael na Fase 0) |
| ADR-026 §2 | módulo `landing-palette.ts` com hex | **Substituído.** Nunca existiu. As cores ficam em `--vx-*` e nos tokens, lidas pelo `three/palette.ts` |
| ADR-026 §3 | three vanilla sem R3F, com `EffectComposer` | **Confirmado em parte.** three vanilla sim (R3F removido); sem pós-processamento: o ASCII é um shader próprio de duas passadas |
| ADR-026 §4 | `useHeroScene` / `CyberCanvas` e fallback em gradiente | **Substituído** pelo gate do kit e pelo pôster ASCII; o contrato de degradação (WebGL2, movimento reduzido, jsdom) foi mantido |
| ADR-041 | "até 30 fps", ondas e órbitas | **Atualizado.** Um canvas e o mesmo gate; agora a 60 fps em duas passadas, com o conteúdo do §4 |
| `DASHBOARD_VISUAL.md` | hero, órbitas, `dashboard-scene-palette.ts` | **Histórico.** O cabeçalho compacto da Fase 5 tomou o lugar do hero, e a paleta saiu |

## Consequências

- Chunk principal de 1.771 kB para 481 kB (584 kB para 157 kB em gzip); chunk
  de three de 687 kB para 492 kB; o chunk lazy da landing de 325 kB para 180 kB.
- Rolagem da landing no mesmo protocolo e na mesma máquina (Iris Xe):
  baseline com 43,2 / 38,6 fps de média e mínimo de 22. Na Fase 4, com render
  sob demanda, 57,2 / 57,7. Com o fundo contínuo a 60 fps, pedido pelo Rafael
  por fluidez, a rolagem fica em 48–52 fps. Sem canvas, a mesma página mede
  ~45 fps: o fundo custa ~3 fps e o resto é o conteúdo da página. Parada, com
  gota e na plataforma: 56–60 fps, sem quadros acima de 25 ms.
- Testes de 398 para 526 (inclui os do `dev` incorporados no merge). Contraste
  de 66 para 132 pares, agora com a régua AAA do alto contraste (ADR-049).
- Toda cena nova precisa entrar pelo gate do kit e ler a cor do CSS. O teste
  de contraste da superfície precisa ser refeito quando o teto de opacidade
  mudar.
- **Não validado:** aparelho móvel real, leitor de tela real e memória de GPU
  por perfil. 768 px é o limite inferior da cena e está no limite: os atos 3 a
  5 ficam pouco visíveis.

## Relacionado

[[ADR-026 - Landing publica cyber-samurai e paleta exclusiva]] ·
[[ADR-041 - Atmosfera unica no layout autenticado]] ·
[[ADR-048 - Grafo 3D do scan DAST na area autenticada]] ·
[[ADR-049 - Menu de acessibilidade com preferencias no navegador]] ·
`docs/FRONTEND_WEB.md` · `docs/DESIGN_SYSTEM.md` · `docs/LANDING_NARRATIVA.md`
