# Evidências — atmosferas 3D por seção (ADR-060, D20, D21)

Branch `feat/atmosfera-3d`, 2026-11-23. As capturas foram feitas na stack
Docker (`http://localhost:8086`), logado como ADMIN (01–06) e como o CLIENT
demo da TechNova (07–11). Os navegadores automatizados rodaram sem GPU
(SwiftShader). As cenas são as mesmas, só o fps não vale como medida.

| # | Arquivo | O que mostra |
|---|---|---|
| 01 | `01-dashboard-nebulosa-plataforma.jpg` | Dashboard com a nebulosa no modo plataforma (teto 0,30), atrás dos cartões |
| 02 | `02-remediacao-relevo-plataforma.jpg` | Remediação com o relevo e o radar; o risco vem do quadro |
| 03 | `03-troca-de-secao-crossfade.jpg` | Dashboard → Findings no meio da troca: nebulosa saindo, ASCII entrando (0,8 s) |
| 04 | `04-modo-apresentacao-imersivo.jpg` | Botão "Apresentar": o conteúdo em tela cheia, a cena imersiva (teto 0,32) |
| 05 | `05-poster-nebulosa-movimento-reduzido.jpg` | Movimento reduzido: o pôster 2D da nebulosa no lugar da cena |
| 06 | `06-poster-relevo-movimento-reduzido.jpg` | Movimento reduzido: o pôster 2D do relevo (curvas, anéis, pings parados) |
| 07 | `07-sla-poster-ascii-parado.jpg` | Formulário (SLA): o ASCII parado, fundo presente sem movimento (D21.1) |
| 08 | `08-exposure-graph-2d-acabamento-radar.jpg` | Grafo 2D com acabamento: halos, pacotes, rótulos com contorno, palco com radar |
| 09 | `09-exposure-graph-selecao-ping.jpg` | Seleção de aplicação: caminho aceso, ping no nó e na atmosfera |
| 10 | `10-exposure-graph-tema-claro.jpg` | Tema claro: o grafo e o relevo (teto 0,32, traço mais grosso) |
| 11 | `11-dashboard-tema-claro.jpg` | Tema claro no Dashboard |

## Comportamento verificado (Playwright, stack real)

- Atmosfera por rota:
  - `/dashboard` → nebulosa;
  - `/applications`, `/projects`, `/remediation`, `/threat-intel` e `/exposure-graph` → relevo;
  - `/findings` → ASCII animado;
  - `/settings/sla` → ASCII parado.
- Troca de seção: durante a troca há duas camadas (a anterior com
  `data-visivel=false`); depois do fade, sobra uma só.
- Exposure Graph:
  - 14 pacotes de luz e 10 halos de críticos no grafo da TechNova;
  - a seleção acende 2 anéis de ping e esconde os pacotes;
  - na aba **Mapa 3D** a atmosfera apaga e volta ao retornar para **Grafo**.
- Movimento reduzido: os pôsteres da nebulosa, do relevo e do ASCII aparecem.
- Modo apresentação: `document.fullscreenElement` é o `#conteudo`.
- Console sem erros. Os 429 que aparecem vêm do rate limit da API com a
  navegação rápida do robô.

## FPS na GPU real (Chrome com janela, 2026-11-23)

Medição: `requestAnimationFrame` da página durante 8 s em cada cenário, com
o mouse em movimento contínuo. A janela tinha 1440×900, com o DPR real da
tela. O monitor é de 240 Hz. A cena desenha a 60 fps por orçamento
(`three/loop.ts`), então "240 fps" quer dizer que a página nunca perdeu um
quadro do monitor.

GPU: NVIDIA GeForce RTX 3060 Ti (ANGLE / Direct3D 11).

| Cenário | fps médio | p95 do quadro | pior quadro |
|---|---|---|---|
| lab · Relevo · plataforma | 240 | 4,3 ms | 4,5 ms |
| lab · Nebulosa · plataforma | 240 | 4,3 ms | 4,4 ms |
| lab · Relevo · imersivo | 240 | 4,3 ms | 4,8 ms |
| lab · Nebulosa · imersivo | 240 | 4,3 ms | 8,3 ms |
| plataforma · /dashboard | 240 | 4,3 ms | 12,2 ms |
| plataforma · /remediation | 240 | 4,3 ms | 12,5 ms |
| plataforma · /findings | 240 | 4,3 ms | 4,4 ms |
| plataforma · /exposure-graph | 239 | 4,3 ms | 8,4 ms |
| apresentação · /dashboard | 240 | 4,3 ms | 4,5 ms |

O pior quadro (cerca de 12 ms) aparece logo depois da navegação, quando a
cena compila os shaders. Fora isso nenhum quadro passou de 4,8 ms nos modos
plataforma. **Falta medir numa GPU integrada** (ATM-FUT-01).
