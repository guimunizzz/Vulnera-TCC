<!-- Relatório de fechamento do refactor web-motion-3d (Fase 6): estado honesto por fase, antes × depois medido, validação final e o que ficou pendente; consumido pelo Rafael e pela revisão do PR. -->

# Fase 6 — Fechamento do refactor web-motion-3d (2026-11-04)

Branch `refactor/web-motion-3d`, com `dev` @ `c019dcc` mesclado em `e3f96ed`.
Decisão registrada no **ADR-050**; roteiro da cena em `docs/LANDING_NARRATIVA.md`.

## 1. Estado por fase

| Fase | Entrega | Commits | Estado |
|---|---|---|---|
| 0 | Investigação e baseline | — (`FASE-0.md`) | ✅ Somente leitura, com medições reproduzíveis |
| 1 | Código dividido por rota (`paginaLazy`, `LimiteDeRota`) | `5b22243` | ✅ Validado: 3 papéis, falha de chunk, fallbacks (`fase1/`) |
| 2 | Kit `src/three/` e paleta por token | `0e6f379`, `a2d0eb3` | ✅ Validado: testes KIT, capturas (`fase2/`) |
| 3 | GSAP central na landing | `08b7b99` | ✅ Validado: troca de movimento reduzido ao vivo sem pular a rolagem (`fase3/`) |
| 4 | Landing narrativa ASCII, sem R3F/drei/intro/partículas/cursor | `7ec9e0f`, `990b57e`, `8ea7b51` | ✅ Validado: matriz 1440/768/375 × temas × reduce × sem WebGL (`landing-ascii/`) |
| 4+ | Fundo mais visível e gota · fluidez a 60 fps · atmosfera "com vida" | `d659cf5`, `0ecf882`, `7e93f20` | ✅ Validado: contraste AA medido, fps medidos (`fluidez/`, `atmosfera-viva/`) |
| 5 | Dashboard, Aplicações e Projetos conforme `output/ui-redesign-preview/` | `60dd364` | ✅ Validado nos 3 papéis, 1440/768/375 (`fase5/`) |
| — | Merge de `feat/security-graph` | `de67255` | ✅ Paleta do grafo corrigida; SG-FUT-04 registrado |
| — | Merge de `dev` (menu de acessibilidade, sensores) | `e3f96ed` | ✅ 10 conflitos resolvidos, integração validada (`merge-dev/`) |
| 6 | Documentação e fechamento | este commit | ✅ |

## 2. Antes × depois

Mesma máquina (i7-1165G7, Iris Xe, Chrome com janela) e mesmos roteiros da Fase 0.

| Medida | Antes (Fase 0) | Depois |
|---|---|---|
| Chunk principal `index` | 1.771,6 kB (584,3 gzip) | **481,0 kB (156,9 gzip)** |
| Chunk `three` | 687,5 kB (177,2 gzip), com R3F | **492,0 kB (125,3 gzip)**, compartilhado por landing, atmosfera e CyberGraph |
| Chunk lazy da landing | 325,3 kB (112,5 gzip) | **179,7 kB (65,2 gzip)** |
| CSS principal | 114,5 kB | 87,9 kB |
| Bibliotecas de animação | Motion + GSAP + CSS + SMIL + R3F/drei, sem fronteira | Motion (produto) · GSAP (landing) · CSS (loops) · three imperativo (kit) |
| Intro da landing | 7,4 s, ignorava movimento reduzido, long task de até 451 ms | removida; 0 long tasks na rolagem |
| Desenho da landing com o hero fora da tela | 181–183 desenhos em 3 s, em qualquer largura | cena só ≥ 768 px; pausa fora da tela e com aba oculta |
| Rolagem da landing | 43,2 / 38,6 fps (mín. 22) | 57,2 / 57,7 com render sob demanda (Fase 4); **48–52** com o fundo contínuo a 60 fps pedido depois (sem canvas: ~45) |
| Landing parada, com gota, e plataforma | — | **56–60 fps**, 0% de quadros > 25 ms |
| Cores das cenas | hex aproximado | tokens lidos em runtime (`--color-ambient-*`, `--vx-*`, severidade) |
| Movimento reduzido nas cenas | gate só no dashboard | gate único (sistema **ou** menu) + alto contraste |
| Testes (Vitest) | 398 em 37 arquivos | **526 em 57 arquivos** (inclui os de `dev`) |
| Contraste | 66 pares AA | **132 pares**, AA nos dois temas e AAA no alto contraste |
| Lint | 0 erros, 9 avisos | 0 erros, os mesmos 9 avisos |

## 3. Validação final (2026-11-04)

| Verificação | Resultado |
|---|---|
| `npm run check` (lint, contraste, testes) | ✅ 0 erros · 132/132 · 526/526 |
| `npm run build` (`tsc --noEmit` + Vite) | ✅ |
| Container `:8086` (`docker compose up -d --build`; a API trouxe as migrations de sensores do `dev`) | ✅ bundle servido contém o menu (`vulnera:a11y`) |
| `e2e/acessibilidade.spec.ts` (axe A/AA, inclusive com alto contraste e 200%) | ✅ 4/4 |
| `e2e/cybergraph.spec.ts` | ✅ 9/9; o CG-08 só passa isolado (429 do rate limit com a suíte inteira, WEB-FUT-06) |
| `merge-dev.cjs`: menu × cenas, texto a 200% | ✅ 15/15, 0 erros de console |

Os e2e rodaram com o Chrome do sistema (`channel: "chrome"`, config temporária
removida depois), porque o Chromium do Playwright não está baixado nesta
máquina.

## 4. Integração com o menu de acessibilidade

- Fonte única: `design/accessibility.ts` (do `dev`). O hook próprio do refactor
  (`motion/use-prefere-movimento-reduzido.ts`) saiu; o teste de troca do
  sistema com a página aberta ficou como MOV-04.
- "Reduzir animações" do menu desmonta a cena (a landing troca para o pôster),
  e o GSAP da landing refaz as animações na versão de fade.
- O alto contraste também desmonta as cenas e esconde o pôster: o teto de
  opacidade dos glifos é AA, e o alto contraste promete 7:1 (KIT-17).
- A 200%, Dashboard, Aplicações e Projetos não têm rolagem horizontal. O ajuste
  de container query do `dev` para o hero antigo ficou sem alvo, porque o hero
  foi removido na Fase 5.

## 5. Não validado

- Celular e GPU fraca reais (WEB-FUT-04); leitor de tela real (WEB-FUT-07);
  memória de GPU por perfil.
- Se o modo StrictMode do Vite dev ainda duplica a atmosfera: a causa provável
  foi removida com o atlas assíncrono, mas não houve medição específica.
- A estética DedSec é só referência de linguagem visual: nenhum logo, asset ou
  fonte do jogo foi copiado.

## 6. Pendências registradas (BACKLOG)

WEB-FUT-01 (`pdf-lib` estático no chunk de Findings), 02 (classes Tailwind fora
da escala), 03 (rolagem da landing até 60 fps), 04 (dispositivo real e corte de
768 px), 05 ("—" no nome da aplicação para o PENTESTER), 06 (CG-08 × rate
limit), 07 (leitor de tela real) e SG-FUT-04 (paleta do CyberGraph 3D no kit).

## 7. Propostas para `CLAUDE.md` / `GOTCHA.md` (não aplicadas)

Pela regra D5, nada foi editado. Proposta de entradas no `GOTCHA.md`:

1. **Movimento reduzido tem uma fonte só.** Use `movimentoReduzido()` /
   `useMovimentoReduzido()` de `design/accessibility.ts`; `matchMedia` direto ou
   `useReducedMotion` do `motion` ignoram o menu de acessibilidade (e o do
   `motion` não reage à troca com a página aberta).
2. **Cena three.js nova entra pelo kit.** `useCenaPermitida` antes do `lazy()`,
   cor por `three/palette.ts` (nunca hex) e teste de contraste do texto sobre
   ela. Se a opacidade subir, refaça ATM-01/CTR.
3. **Classe Tailwind fora da escala não gera CSS e não dá erro.** A escala de
   espaçamento é 0–6, 8, 10, 12, 16, 20, 24, `px` e `touch`; `w-32` ou
   `gap-1.5` somem em silêncio.
4. **e2e da suíte inteira esbarra no rate limit.** Uma falha isolada com 429 no
   log da API não é regressão; rode o caso sozinho antes de investigar.
