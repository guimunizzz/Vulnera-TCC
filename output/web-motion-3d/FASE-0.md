<!-- Registro da Fase 0 (investigação e baseline) do refactor web-motion-3d; consumido pelo Rafael e pelas fases seguintes como referência "antes". -->

# Fase 0 — Investigação e baseline (2026-10-23)

Somente leitura. Nenhum arquivo de `app/` foi alterado. Base: branch `feat/export-findings-excel` @ `87df8ff` (5 commits à frente de `dev` @ `28c48ef`; os 5 tocam só a exportação Excel de findings).

## 1. Hipóteses do "Contexto"

| # | Hipótese | Veredito | Evidência |
|---|---|---|---|
| 1 | Três sistemas de animação | ✅ Confirmada | Motion em 31 arquivos (landing, `components/ui/*`, `motion/*`, páginas). GSAP só em `sections/how-it-works.tsx:9-15` e `sections/maturity.tsx:10-12`. CSS em 22 `@keyframes` (login, backdrop, módulos, landing, findings, remediação) + SMIL `<animateMotion>` em `pages/auth/auth-layout.tsx:58-64` |
| 1b | `useScroll` do Motion e ScrollTrigger fazem o mesmo papel | ✅ Confirmada | `landing/ui.tsx:70-71` (ScrollProgress) e `sections/final-cta.tsx:27-29` (scale/opacity) |
| 2 | three de dois jeitos (R3F+drei na landing; imperativo no layout) | ✅ Confirmada | `intro-3d.tsx:12-15`, `ambient-particles.tsx:11-13`; `dashboard/hero/use-dashboard-scene.ts:8` |
| 2b | Imperativo como padrão de qualidade | ✅ Confirmada, com ressalvas | 30 fps `:20,144`; DPR 1,5 `:21,185`; `low-power` `:183`; context lost `:184` + listener; pausa por aba `:243` e IO `:237`; dispose `:73-90`. Ressalvas: reduced-motion e largura < 768 são checados no gate `dashboard-atmosphere.tsx:15-16,30`, não no hook; dispose por lista registrada (não percorre a cena); ondas recalculadas na CPU por frame (1.296 vértices) |
| 3a | Intro 6 s não respeita reduced-motion | ✅ Confirmada **e medida** | `intro-3d.tsx:20,125`; `MotionConfig` em `landing-root.tsx:73` não alcança `useFrame`/`setTimeout`. Com `reducedMotion: 'reduce'` no Chrome: intro exibida e 94 draws em 2 s com câmera em movimento. Duração real ≈ 7,3 s (6 s + 0,9 s de fade) |
| 3b | AmbientParticles renderiza sempre | ✅ Confirmada **e medida** | `ambient-particles.tsx:57` (frameloop padrão `always`). Rodapé visível, hero fora da viewport: ~182 draws em 3 s (~60/s), nas 2 execuções, 11/11 trechos. Com `reduce`: 120 draws em 2 s. Também monta em 375 px (`hero.tsx:39-40`, 180 pontos) |
| 3c | Cores em hex fixo | ✅ Confirmada | `intro-3d.tsx:33-34,148,194`, `ambient-particles.tsx:39`; `landing.css:20-44` define toda a paleta `--vx-*` em hex |
| 3d | `matchMedia` de reduced-motion repetido | ✅ Confirmada | `how-it-works.tsx:56`, `maturity.tsx:64` (+ `nav.tsx:75`, `interactive-label.tsx:20`, `auth-layout.tsx:91`) |
| 4 | ADR-026 diverge do código | ✅ Confirmada | Sem `landing-palette.ts`, `useHeroScene`, `cyber-canvas`, `EffectComposer`/ASCII. A landing segue o tema do app (`landing.css:46` `:root[data-theme='light'] .vx-landing`) e usa R3F+drei, que a ADR-026 §3 descartava |
| 5 | `App.tsx` eager; só a landing é lazy | ✅ Confirmada | 26 páginas importadas estaticamente em `App.tsx:1-28`; `landing-page.tsx:36` faz `lazy()` de `landing-root`; `landing.css` entra no CSS principal (`:34`) |
| 6 | Previews não aplicadas; sidebar aplicada em 16/10 | ✅ Confirmada | `output/ui-redesign-preview/README.md`; `FRONTEND_WEB.md:31-40` |

### Achados extras

- **R3F infla o chunk de three usado pelo Dashboard.** O chunk `three.module` tem 687,5 kB (177,2 kB gzip), contra 498,3 kB em 22/09 (`DASHBOARD_VISUAL.md` §5), quando o R3F estava revertido (`31988ba`, 14/09). O chunk mantém classes que nem a cena do dashboard nem `Points` usam (`AnimationMixer`, `SkinnedMesh`, `PMREMGenerator`, `LatheGeometry`), sinal de que o `extend(THREE)` do R3F impede o tree-shaking. O canvas do dashboard baixa esse mesmo chunk. É uma hipótese forte; a prova virá na Fase 4, quando o R3F sair.
- `maturity.tsx` não registra o ScrollTrigger: funciona porque `how-it-works.tsx:15` é importado antes.
- `FinalCTA`/`ScrollProgress`: `useTransform`/`useSpring` ligados a `style` não são desligados por `MotionConfig reducedMotion="user"` (avaliado por leitura de código, não medido).
- `TransicaoDeRota` usa durações literais `0.05/0.15` (`motion/components.tsx:206`), fora de `DURACAO`.
- `AGENTS.md:556` ainda diz `develop`; o repositório usa `dev` (já registrado no Contexto Mestre).
- ADRs com número duplicado: 028, 044, 045, 046. Próximo livre: **ADR-048**.

## 2. Inventário de animação

| Arquivo | Biblioteca | O que anima | Reduced-motion | Cleanup |
|---|---|---|---|---|
| `landing/intro-3d.tsx` | three (R3F+drei) + Motion | Partículas, câmera em Z, scramble do nome, fade | ❌ Não | R3F desmonta o Canvas; timers limpos |
| `landing/ambient-particles.tsx` | three (R3F+drei) | Rotação e oscilação de 400/180 pontos | ❌ Não | Desmonte do Canvas; sem pausa por viewport |
| `landing/landing-root.tsx` | Motion | Troca intro → landing (0,8 s) | Parcial (`MotionConfig`) | ✅ |
| `landing/ui.tsx` `Reveal` | Motion | Fade + slide no `whileInView` | ✅ via `MotionConfig` | ✅ |
| `landing/ui.tsx` `ScrollProgress` | Motion (`useScroll`) | Barra de progresso | ⚠️ Não desliga (style) | ✅ |
| `landing/sections/final-cta.tsx` | Motion (`useScroll`) | Scale/opacity do título | ⚠️ Não desliga (style) | ✅ |
| `landing/sections/how-it-works.tsx` | GSAP + ScrollTrigger | Stagger dos passos; linha com scrub | ✅ (sai cedo) | ✅ contexto `useGSAP` |
| `landing/sections/maturity.tsx` | GSAP + ScrollTrigger | Radar, pontos, barras, score | ✅ (durações 0) | ✅ contexto `useGSAP` |
| `landing/sections/hero.tsx`, `pricing.tsx`, `faq.tsx`, `features.tsx` | Motion | Stagger de entrada, hover/tap, acordeão, modal | ✅ via `MotionConfig` | ✅ |
| `landing/sections/demo.tsx` + `demo.css` | Motion + CSS | Barras, tendência, troca de vista | ✅ (`useReducedMotion` + CSS) | ✅ |
| `landing/nav.tsx` | Motion | Altura da barra, dropdown | ✅ via `MotionConfig`; scroll instantâneo | ✅ |
| `landing/custom-cursor.tsx` | Motion | Mira com spring e rastro (setState por mousemove) | ❌ Não verifica | ✅ listeners |
| `landing/landing.css` | CSS | Glitch, breathe, blink, cell-pulse, bounce | ✅ rede global `base.css:236` | n/a |
| `ui/interactive-label.*` | JS (RAF) + CSS | Decode/glitch de rótulos | ✅ | ✅ cancela RAF |
| `pages/auth/auth-layout.tsx` + `login-page.css` | SMIL + CSS + Motion | Circuito, deriva, sinais, troca login/registro | ✅ pausa SMIL e CSS | ✅ |
| `layout/operations-backdrop.css` | CSS | Deriva do fundo autenticado | ✅ (`no-preference`) | n/a |
| `layout/module-surfaces.css` | CSS | Radar do DAST, sinal do scan ativo | ✅ | n/a |
| `dashboard/hero/use-dashboard-scene.ts` | three (imperativo) | Ondas no fundo, órbitas nos KPIs | ✅ via gate | ✅ completo |
| `motion/components.tsx` | Motion | Rota, stagger, contador, overlays, desenho de gráfico | ✅ (`useMotion`) | ✅ |
| `ui/{dialog,drawer,popover,dropdown-menu,select,tooltip,toast,accordion}.tsx` | Motion | Overlays e acordeão | ✅ (`useMotion`) | ✅ |
| `dashboard/*`, `findings-table.tsx`, `findings-page.*`, `remediation-page.*`, `new-analysis`, `onboarding`, `sla-settings` | Motion + CSS | Entradas, KPIs, troca de etapa, confirmação | ✅ | ✅ |

## 3. Baseline numérico (`app/web/`, host, Node 22.22.1)

| Verificação | Resultado |
|---|---|
| `npm run lint` | 0 erros, 9 avisos preexistentes (`react-refresh/only-export-components`) |
| `npm run check:contrast` | 66/66 pares, 0 falhas, 77 primitivos, 0 fora do gamut |
| `npm test -- --maxWorkers=1` | **398/398** testes, 37/37 arquivos, 269 s |
| `npm run build` | ✅, aviso de chunk > 500 kB |

| Chunk | Raw | Gzip |
|---|---|---|
| `index` (principal, todas as páginas) | 1.771,57 kB | 584,29 kB |
| `three.module` (lazy, compartilhado landing/dashboard) | 687,49 kB | 177,19 kB |
| `landing-root` (lazy, inclui R3F/drei/GSAP/seções) | 325,27 kB | 112,45 kB |
| `dashboard-ambient-canvas` (lazy) | 5,03 kB | 2,48 kB |
| CSS principal / CSS landing | 114,47 / 10,19 kB | 23,53 / 2,37 kB |

## 4. Baseline visual

`baseline/` — 66 capturas da landing (11 seções × 1440/768/375 × dark/light) e 24 da área autenticada (ADMIN: Dashboard/Aplicações/Projetos × 3 larguras × 2 temas; CLIENT owner TechNova: as 3 telas em 1440 × 2 temas). Container web reconstruído do HEAD acima. As 24 capturas autenticadas terminaram sem `aria-busy` e sem estado de erro; 4 respostas 429 foram recuperadas pelas retentativas (ADR-044). Contagem de canvas: landing 1 em todas as larguras (inclusive 375); app 1 em ≥ 768, 0 em 375.

## 5. Baseline de performance da landing

Máquina: i7-1165G7 (8 threads), Iris Xe (o Chrome usou a Intel: `ANGLE … Iris Xe … D3D11`), 15,7 GB, Windows 11, Chrome 156, DPR 1, viewport 1440×900, tema dark. Chrome **com janela** via Playwright (`baseline-perf.cjs`), roda do mouse com 100 px a cada 60 ms. FPS medido por contador de `requestAnimationFrame` dentro da página (inclui o custo da instrumentação); long tasks medidas por `PerformanceObserver`.

| Medida | Execução 1 | Execução 2 |
|---|---|---|
| FPS médio rolando | 43,2 | 38,6 |
| FPS mínimo por trecho (~800 px) | 22,3 (topo, hero visível) | 27,5 |
| Long tasks durante a rolagem | 0 | 0 |
| Draws do hero em 3 s parado no rodapé | 183 | 181 |
| Trechos fora da viewport com draw | 11/11 | 11/11 |

Intro (sessão nova, a quente, 2 execuções): botão "Pular" em ~0,9–1,0 s; duração 7,3–7,4 s; FPS 48–56; long tasks de 171–189 ms na troca intro → landing (451 ms na primeira execução, a frio).

Traces do DevTools: `baseline/landing-scroll-trace-{1,2}.json` (~25 MB cada; abrir em DevTools → Performance → Load profile).

## 6. Propostas `output/ui-redesign-preview/`

- **Dashboard:** troca o hero grande ("Menos riscos. Mais segurança.") por um cabeçalho compacto com uma linha de contexto ("3 críticos aguardando tratamento") e o CTA "Explorar findings"; KPIs com legenda secundária; ranking e card "Aprovações" lado a lado (substitui o alerta + "Fila de aprovações"); novo bloco "Continue seu trabalho" (atalhos para Aplicações/Projetos/Findings) e faixa "N findings críticos em aberto → Revisar"; breadcrumb no topo. A proposta não tem as órbitas nem o fundo de ondas.
- **Aplicações:** cabeçalho compacto com contagem em chip e "Nova aplicação" à direita; busca + filtro "Todos os ambientes" no topo da tabela; nome e URL na mesma célula com ícone; nova coluna Ambiente; contexto de risco em chips menores; ações reduzidas a "Nova análise" + menu "⋯" (Painel/Contexto/Remover saem da linha); rodapé "Mostrando N de N".
- **Projetos:** os 4 KPIs de status viram cards com "Ver projetos →"; busca + filtro "Todos os status"; coluna "Etapa atual" com chip e barra de etapas; datas por extenso ("01 out. 2026"); seta de navegação por linha; rodapé "Mostrando N de N".
- As capturas "antes" das prévias usam a sidebar antiga; a atual já é a nova.

## 7. Divergências docs × código

1. ADR-026 (paleta `landing-palette.ts`, `useHeroScene`, landing sempre dark, three vanilla sem R3F) × código (paleta em `landing.css`, tema do app, R3F+drei).
2. `DESIGN_SYSTEM.md` §2.8 ("nenhum componente inventa duração") × landing inteira (durações/eases literais em todos os arquivos) e `TransicaoDeRota` (0,05/0,15).
3. `DASHBOARD_VISUAL.md` §5 (three lazy 498 kB) × build atual (687 kB).
4. `FRONTEND_WEB.md:13-15` diz que three "só desenha a atmosfera decorativa compartilhada", mas a landing também usa three (R3F).
5. Comentário de `hero.tsx:6-7` diz que `AmbientParticles` está "num chunk à parte"; ela está dentro de `landing-root` (o chunk lazy da landing inteira).
6. `AGENTS.md:556` usa `develop`; o repositório usa `dev`.
