# Evidências — Grafo 3D do scan DAST

Capturas do app servido pela stack Docker (`http://localhost:8086`), logado como
`bruno.pentester@vulnera.local` (seed), num scan **simulado** de `https://exemplo.com/`
(15 findings: 5 altos, 5 médios, 4 baixos, 1 informativo). Data: 2026-10-30.

| Arquivo | O que mostra |
| --- | --- |
| `00-antes-primeira-versao.jpg` | Primeira versão (esferas, cubo e octaedros lisos), para comparação |
| `01-visao-geral-tema-escuro.jpg` | Versão final: globo com meridianos e órbita, rack com LEDs, portas hexagonais, cristais por severidade, partículas de fluxo, piso com grade e sombra |
| `02-hover-tooltip-e-contorno.jpg` | Hover no rack: tooltip `exemplo.com`, contorno e escala; giro automático pausado |
| `03-selecao-destaque-de-caminho.jpg` | Clique em "Cross Site Scripting (Reflected)": caminho até a Internet aceso, resto translúcido, legenda anunciada |
| `04-tema-claro-com-sombras.jpg` | Tema claro após trocar o tema com a aba aberta (cena recriada com a proporção correta) |
| `05-estresse-300-nos-truncado.jpg` | Scan temporário com 285 findings em 28 endpoints: 300 nós e o aviso de truncamento (scan apagado depois) |
| `06-mobile-375px.jpg` | 375 px: sem overflow horizontal, legenda na base e botão no topo |

Os prints 02–05 foram feitos antes de a legenda ir para a base da cena; o resto do layout é o final.

## Medições no navegador

| Verificação | Resultado |
| --- | --- |
| FPS, 24 nós, 5 s com giro e partículas | 60,2 FPS · pior quadro 16,8 ms |
| FPS, 300 nós, 5 s | 60,2 FPS · pior quadro 16,8 ms |
| Abrir/fechar a aba 26 vezes | 0 avisos de WebGL, 1 canvas no DOM (antes da correção: "Too many active WebGL contexts") |
| Roda do mouse sobre a cena sem foco | página rola (253 → 53 px) |
| Teclado | Esc limpa; → Internet → Alvo; ← volta |
| Console | sem erros da cena |

Máquina de desenvolvimento, monitor 60 Hz: o FPS é o teto do monitor, não uma garantia em GPU fraca.
