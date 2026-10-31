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

## CyberGraph (2D/3D, painel, modal, arraste e nomes fixos) — 2026-10-30

A aba passou a se chamar **CyberGraph** e ganhou o modo 2D (padrão), a alternância 2D/3D, o painel do
nó, o modal de detalhes, o arraste livre de nós com **Restaurar layout** e, no 3D, os nomes fixos
abaixo de cada objeto (antes só no hover, print 02). Mesmo scan simulado, viewport 1440×900, salvo
quando indicado.

| Arquivo | O que mostra |
| --- | --- |
| `07-cybergraph-2d-escuro.jpg` | 2D: Internet → alvo → endpoints → grupos "Findings (N)" com contagem, arestas em degradê, grade de pontos, barra com Recentralizar · Restaurar layout · 2D/3D |
| `08-cybergraph-2d-caminho-e-painel.jpg` | Grupo de `/login` expandido e "SQL Injection" selecionado: caminho aceso com fluxo, resto esmaecido, painel com CWE, confiança e caminho numerado |
| `09-cybergraph-modal-finding.jpg` | Modal do finding (só leitura): URL, parâmetro, CWE/WASC, regra do ZAP, triagem, descrição, solução, referência e "Triar em Achados" |
| `10-cybergraph-3d-nomes-fixos.jpg` | 3D com o nome de cada objeto logo abaixo dele, sem hover; nomes de finding menores e truncados |
| `11-cybergraph-3d-selecao-mantida.jpg` | Seleção feita no 2D mantida ao trocar para o 3D: só os nomes do caminho ficam visíveis |
| `12-cybergraph-3d-tema-claro.jpg` | 3D no tema claro (cena recriada: 24 nomes, sem duplicar) |
| `13-cybergraph-2d-claro-grupo-expandido.jpg` | 2D no tema claro com o grupo de `/` expandido e o painel do grupo |
| `14-cybergraph-modal-grupo-claro.jpg` | Modal de um grupo: contagem por risco e lista de findings (clicar abre o finding) |
| `15-cybergraph-mobile-375px.jpg` | 375 px: barra quebra em duas linhas, zoom mínimo legível com arraste para ver o resto, sem overflow horizontal |
| `16-cybergraph-2d-nos-arrastados.jpg` | 2D com o alvo e `/api/status` arrastados; arestas seguem e "Restaurar layout" habilitado |
| `17-cybergraph-3d-nos-arrastados.jpg` | 3D com globo e rack arrastados; arestas, partículas e nomes seguem |

| Verificação (navegador) | Resultado |
| --- | --- |
| Arrastar nó no 2D (mouse real) | nó move, arestas seguem, não seleciona; "Restaurar layout" habilita e volta ao padrão |
| Arrastar nó no 3D (mouse real) | nó move num plano de frente para a câmera, sem orbitar; arestas e partículas seguem |
| Trocar 2D → 3D → 2D | posições arrastadas de cada modo e seleção mantidas; 1 canvas do grafo no DOM |
| "Restaurar layout" no 3D | nós voltam ao layout calculado; botão volta a desabilitar |
| "Triar em Achados" | abre a aba Achados, limpa filtros, expande a linha do finding e rola até ela |
| Modo 2D | `three.module` não é baixado (só ao escolher 3D) |
| FPS 3D com nomes, 5 s | pior quadro 4,4 ms (o painel do app mediu 240 FPS de RAF; não confirmei a taxa do monitor nesta medição) |
| Console | só 2× 401 do refresh de token ao carregar a página, sem erro do grafo |

## Espaçamento do 3D e redesenho de painel/modal — 2026-10-30

Pedido do Rafael: 3D "muito poluído" e detalhes "muito secos". O 3D trocou o anel de endpoints e as
esferas de findings por uma pilha de endpoints com grade de findings de frente para a câmera, e os nomes
passaram a disputar espaço na tela (o de menor prioridade some até a câmera girar ou o nó ganhar hover).
Painel e modal ganharam borda e faixa na cor do nó, cabeçalho com o ícone do grafo, fichas de metadado,
seções em cartões e entrada escalonada.

| Arquivo | O que mostra |
| --- | --- |
| `18-cybergraph-3d-espacado-sem-colisao.jpg` | 3D com endpoints empilhados e findings em grade; 19 de 24 nomes visíveis, nenhum encavalado (compare com o 10) |
| `19-cybergraph-painel-redesenhado.jpg` | Painel: borda e faixa na cor da severidade, ícone do nó, fichas CWE/confiança/data/parâmetro, caminho em linha do tempo com os ícones do grafo |
| `20-cybergraph-modal-redesenhado.jpg` | Modal do finding: borda e brilho na cor da severidade, seis fichas, seções com ícone, solução com borda verde |
| `21-cybergraph-modal-grupo-claro-redesenhado.jpg` | Modal do grupo no tema claro: blocos por risco com borda na cor da severidade e lista com borda por risco |
| `22-cybergraph-modal-mobile.jpg` | Modal em 375 px: fichas em duas colunas, rodapé empilhado |

| Verificação (navegador) | Resultado |
| --- | --- |
| Abrir o modal (amostrado por quadro) | escala 0,96 → 1 e opacidade 0 → 1 em ~200 ms; seções entram escalonadas até ~450 ms |
| Fechar o modal | some em ~160 ms (fade + escala) |
| Trocar de grupo para finding dentro do modal | conteúdo reanima pela troca de nó |
| `prefers-reduced-motion` | não emulado; as variantes vêm de `useMotion()`, que já remove deslocamento e escala |

## Sensores passivos (headers e SSL/TLS) e "só escolher o alvo" — 2026-10-31

| Arquivo | O que mostra |
| --- | --- |
| `23-nova-analise-so-o-alvo.jpg` | Nova análise: só o alvo e a autorização no mesmo passo; as três verificações descritas antes de iniciar; demonstração como link secundário |
| `24-scan-real-faixa-de-sensores.jpg` | Scan **real** em `http://host.docker.internal:8086/` (o próprio Vulnera): faixa com ZAP (9 achados, 33 s), headers (0 achados — a app já envia todos) e SSL/TLS ("Alvo sem HTTPS"); selo "sensor ssl" na lista |
| `25-cybergraph-finding-do-sensor-headers.jpg` | Scan simulado: "CSP ausente" no CyberGraph com subtítulo "· Headers" e "Sensor de origem: Headers de segurança" no painel |

| Verificação | Resultado |
| --- | --- |
| Scan real pela tela (alvo + autorização → Iniciar análise) | STARTING → SPIDER → PASSIVE → COMPLETED em 33 s; `simulated=false`; sensores `zap`, `headers`, `ssl` todos `OK` |
| Alvo inalcançável (`:59999`) | `FAILED` em 20 s, `simulated=false`, 0 achados; mensagem legível sem o código técnico |
| URL inválida / 3º pedido seguido | 400 `INVALID_TARGET_URL` / 429 `RATE_LIMITED` com `retryAfterSeconds` → "Tente novamente em N s" |
| Sensor SSL contra servidores reais | example.com OK · expired → expirado · self-signed → não confiável · wrong.host → nome divergente · TLS 1.0 → obsoleto · DNS inexistente → `UNAVAILABLE` legível |
| Sensor de headers real | `:8086` → OK sem achados · porta fechada → `UNAVAILABLE` ("a porta do alvo recusou a conexão") |
| Suítes | API 748/748 (`--runInBand`) · web 425/427 (2 falhas só no `findings-table.test.tsx` não versionado) |
