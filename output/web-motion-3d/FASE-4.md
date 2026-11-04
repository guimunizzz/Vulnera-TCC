# Fase 4 — landing narrativa (refactor web-motion-3d)

> Estado em 2026-10-30, branch `refactor/web-motion-3d`. Roteiro e técnica em
> `docs/LANDING_NARRATIVA.md`.

## O que entrou

| Item | Estado |
|---|---|
| Intro 3D, partículas do hero e cursor customizado removidos | ✅ |
| `@react-three/fiber` e `@react-three/drei` removidos (via npm, autorizado) | ✅ |
| Cena narrativa ASCII em 6 atos (1 quad, 1 shader, render sob demanda) | ✅ |
| Pôster ASCII por ato (movimento reduzido, < 768 px, sem WebGL, contexto perdido) | ✅ |
| Landing segue o tema claro/escuro do app (substitui o dark forçado da ADR-026) | ✅ |
| Durações, easings, deslocamentos e escalas da landing em tokens (`motion/tokens.ts`) | ✅ |
| Superfície AA atrás do texto + teste de contraste com as cores reais | ✅ |
| Atmosfera ASCII discreta na área autenticada (substitui ondas/órbitas) | ✅ |
| Merge da `feat/security-graph` (CyberGraph 2D/3D) sem quebra | ✅ |

## Validação

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ |
| ESLint | ✅ 0 erros (9 avisos anteriores ao refactor) |
| Contraste do design system | ✅ 66/66 pares AA |
| Vitest (`--maxWorkers=1`) | ✅ 481/481 |
| Build | ✅ `index-*.js` 469,9 kB (gzip 154); um chunk `three` de 492 kB compartilhado por atmosfera, landing e CyberGraph |
| Matriz no container (1440/768/375 × dark/light × reduce, + sem WebGL) | ✅ modos corretos, 0 erros (sem WebGL: 3 `console.error` do próprio three ao falhar o contexto; o pôster assume) — `landing-ascii/fase4-landing-matrix.json` |
| Saída para `/login` | ✅ 1 canvas → 0 |
| Plataforma: cores dos tokens nos 2 temas, mesmo canvas na troca, pausa, 3 ciclos Dashboard ↔ Findings | ✅ 1 canvas, 4 redesenhos/s, 0 erros — `fase4-plataforma/fase4-plataforma.json` |
| Plataforma com movimento reduzido | ✅ 0 canvas, fundo CSS, chunk de three não baixado |
| CyberGraph 2D/3D depois do merge | ✅ 0 erros; 3D = 2 canvas (atmosfera + grafo); de volta ao Dashboard, 1 — `merge-security-graph/` |
| Desempenho (Chrome com janela, Iris Xe, mesmo protocolo do baseline) | ✅ ver abaixo — `landing-ascii/landing-perf-fase4.json` |
| GIF da rolagem | ✅ `landing-ascii/rolagem-1440-dark.gif` (91 quadros) |

### Antes × depois (landing, 1440 × 900, dark)

| Medida | Baseline (Fase 0) | Fase 4 |
|---|---|---|
| FPS médio rolando (2 execuções) | 43,2 / 38,6 | **57,2 / 57,7** |
| FPS mínimo por trecho | 22,3 / 27,5 | **49,1 / 49,6** |
| Long tasks na rolagem | 0 | 0 |
| Intro antes do conteúdo | 7,4 s, long tasks até 451 ms | **nenhuma** |
| Desenhos em 3 s parado no rodapé | 181–183 (hero fora da tela) | **23–24** (tiques da cena) |
| Canvas | 1 | 1 |

Traces do DevTools (> 50 MB cada) ficaram fora do repositório.

## Desvios e decisões autônomas

- **Pontos → ASCII.** A primeira implementação (pontos WebGL + pôster SVG)
  foi trocada a pedido do Rafael. As capturas da versão de pontos ficaram em
  `landing/` só como histórico.
- **Atmosfera sem dígitos.** Por ser global no layout, aparecia ao lado de
  breadcrumb, abas e KPIs (DAST/CyberGraph). Dígitos saíram; teste CENA-06.
- **Superfícies quase opacas** (hero do dashboard, KPIs, hero e cards de
  severidade de Findings): a atmosfera só aparece nos vãos e margens. O brilho
  do canto do hero de Findings, antes emprestado do fundo da página, passou a
  ser desenhado nele mesmo.
- **Hash do pôster** corrigido (sorteios correlacionados) — NAR-11.
- **Merge do security graph:** a paleta do grafo importava
  `dashboard-scene-palette.ts` (removido na Fase 2); os valores foram copiados
  sem mudança e a migração para tokens ficou no BACKLOG (SG-FUT-04). A cena do
  grafo entrou na exceção de lint do `three` (ela já é lazy em 3 níveis).

## Pendências registradas

- 768 px fica no limite da área livre (atos 3–5 ≈ 15%); reavaliar com
  aparelho real.
- Com WebGL desligado à força, o three registra 3 `console.error` antes do
  pôster assumir; o gate não sonda contexto de propósito (ADR-026 §4).
- Dashboard em `npm run dev` (StrictMode): antes, a remontagem reaproveitava
  o canvas após `forceContextLoss`. Com o atlas assíncrono, a montagem
  cancelada não chega a criar contexto (como no CENA-L05 da landing), então o
  problema provavelmente sumiu — **não validado em dev** (o login no Vite dev
  falha por CORS nesta máquina). Não afeta o build.
