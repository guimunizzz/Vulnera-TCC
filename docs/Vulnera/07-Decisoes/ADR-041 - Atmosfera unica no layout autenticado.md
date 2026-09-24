---
type: decisao
tags: [decision, frontend, motion, webgl, acessibilidade]
status: vigente
codigo: ADR-041
data: 2026-09-23
---

# ADR-041 - Atmosfera única no layout autenticado

## Contexto

Dashboard e Findings já usavam a mesma cena Three.js em montagens locais.
As demais telas autenticadas não compartilhavam o fundo e uma expansão da
cena por página multiplicaria contextos WebGL, RAF e observadores.

## Decisão

O `AppLayout` monta uma única atmosfera para suas rotas: grade, luz e sinais
CSS como base e o canvas Three.js existente como camada opcional. O contexto
`AmbientHostContext` impede que Dashboard e Findings montem outro canvas
quando renderizadas dentro do layout; fora dele, elas continuam renderizáveis
isoladamente em testes. Onboarding, que fica fora do layout por causa do fluxo
de cadastro, reutiliza a camada CSS.

O canvas é decorativo, lazy, não recebe eventos de ponteiro, limita DPR e
altura do buffer, pausa quando a página fica oculta e não monta em viewport
estreita ou com movimento reduzido. A pausa de Findings alcança a atmosfera
do layout sem alterar queries ou dados. Conteúdo, métricas e ações continuam
em HTML.

## Consequências

- Uma navegação autenticada tem no máximo um canvas e um RAF da atmosfera.
- Páginas longas mantêm o fundo CSS até o fim; o buffer WebGL se limita à
  primeira área visível, evitando alocar uma textura da altura do documento.
- Falha de download ou de contexto WebGL preserva o fundo CSS e as telas.
- A identidade de cada módulo vem do conteúdo e de superfícies semânticas,
  sem criar paletas ou cenas separadas.

## Relacionado

[[ADR-023 - Biblioteca de componentes propria em vez de Radix]]
[[ADR-024 - Sistema de temas com tokens OKLCH]]
`docs/DASHBOARD_VISUAL.md`
