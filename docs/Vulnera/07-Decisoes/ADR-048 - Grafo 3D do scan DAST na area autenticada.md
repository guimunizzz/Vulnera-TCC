---
type: decisao
tags: [decision, frontend, three.js, webgl, dast, security-graph, acessibilidade]
status: vigente
codigo: ADR-048
data: 2026-10-30
---

<!-- Registra por que a área autenticada ganhou uma segunda cena WebGL (o grafo 3D do scan) e sob quais garantias; consumido pelos mantenedores e pela banca. -->

# ADR-048 — Grafo 3D do scan DAST na área autenticada

## Contexto

O [[ADR-041 - Atmosfera unica no layout autenticado]] limita a área autenticada a **um** canvas
Three.js, decorativo, para a atmosfera de fundo. A spec "Sensores e Security Graph" (2026-10-29)
pede um modo 3D do grafo Internet → ativo → endpoint → finding como **modo de apresentação** do
resultado do scan. O grafo não é decoração: ele é conteúdo, interativo e precisa de ponteiro,
teclado e foco — tudo o que o ADR-041 proíbe na atmosfera.

Ainda não existem a API de grafo, os sensores nem a ligação scan → aplicação (Fases 1–3 da spec).
O grafo é montado no cliente a partir dos findings que a tela do scan já carrega.

## Decisão

- **Exceção explícita ao ADR-041**: a aba "Grafo 3D" do detalhe do scan monta um segundo canvas
  WebGL, funcional, enquanto a aba está aberta. A atmosfera continua sendo a única cena decorativa.
- **Fora do bundle inicial**: a aba usa `React.lazy`; `three`, os addons de pós-processamento e a
  cena ficam em chunks próprios (`security-graph-3d-*.js` ~78 kB, `three.module-*.js` ~688 kB). O
  `index-*.js` não muda de tamanho.
- **Sem dependência nova**: tudo vem do pacote `three` já instalado (`OrbitControls`,
  `EffectComposer`, `UnrealBloomPass`, `OutlinePass`, `OutputPass`, `RoomEnvironment`,
  `RoundedBoxGeometry`). React Flow, dagre e html-to-image da spec ficam para a visão 2D.
- **Um canvas por cena, contexto liberado de fato**: o canvas é criado e removido pelo efeito React
  e o `dispose()` termina em `renderer.forceContextLoss()`. Sem isso, abrir a aba ~16 vezes estourava
  o limite de contextos do navegador (reproduzido: "Too many active WebGL contexts").
- **Acessibilidade**: sem WebGL a aba não aparece; a aba "Achados" segue como alternativa com o
  mesmo conteúdo. O canvas é focável (`role="application"`), setas percorrem os nós, Esc limpa, e a
  seleção é anunciada numa região `aria-live`. Com `prefers-reduced-motion` não há giro automático,
  animação ociosa nem partículas; a câmera só se move por ação da pessoa.
- **Rolagem da página preservada**: a roda do mouse só dá zoom com o canvas em foco.
- **Teto de 300 nós**, como na spec; o corte descarta INFO antes de HIGH e a tela avisa.

## Consequências

- Com a aba aberta há dois contextos WebGL (atmosfera + grafo) e dois RAFs. O RAF do grafo pausa com
  a aba do navegador oculta ou o canvas fora da viewport.
- Medido na máquina de desenvolvimento (Chrome do app desktop, monitor 60 Hz): 60,2 FPS e pior quadro
  de 16,8 ms com 24 nós e com 300 nós. **Não foi medido em GPU integrada fraca nem em celular real.**
- `prefers-reduced-motion` foi revisado em código, mas **não foi emulado no navegador** nesta entrega.
- O grafo usa só dados do ZAP. Quando `GET /dast/scans/:id/graph` existir, ele substitui
  `buildSecurityGraph` mantendo o tipo `SecurityGraph`; a cena não muda.
- Um tipo de nó novo (CVE, tecnologia, subdomínio, IP) entra como um `case` em
  `KitDeMalhas.criar` e uma camada em `CAMADA_X`.

## Relacionado

[[ADR-041 - Atmosfera unica no layout autenticado]]
[[ADR-026 - Landing publica cyber-samurai e paleta exclusiva]]
[[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]]
`docs/DAST.md` §11.5 · `docs/evidencias/security-graph/README.md` · `docs/NIGHT_SHIFT_REPORT.md`
