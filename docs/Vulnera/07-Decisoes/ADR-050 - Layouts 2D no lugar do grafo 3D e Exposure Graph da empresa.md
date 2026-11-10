---
type: decisao
tags: [decision, frontend, backend, dast, security-graph, exposure-graph, three.js, acessibilidade]
status: vigente
codigo: ADR-050
data: 2026-11-09
---

<!-- Registra a saída do modo 3D do CyberGraph, os layouts 2D que o substituem e o Exposure Graph da empresa (2D + mapa 3D). Substitui em parte o ADR-048. -->

# ADR-050 — Layouts 2D no lugar do grafo 3D e Exposure Graph da empresa

## Contexto

O [[ADR-048 - Grafo 3D do scan DAST na area autenticada]] colocou um modo 3D no CyberGraph do
scan. Na prática ele repetia o 2D com menos legibilidade (nomes que colidem, câmera para
administrar, teclado mais pobre) e foi avaliado pelo Rafael como pouco profissional. Ao mesmo
tempo, o 2D tinha um único arranjo (colunas Internet → alvo → endpoint → findings), bom para
seguir um caminho e ruim para ver agrupamentos.

Do lado da empresa, o **Exposure Graph / Cadeias de Exposição** (CP-8, DECISIONS D8/D9) estava
registrado como "não implementado": nenhuma tela mostrava as aplicações da empresa juntas.

## Decisão

1. **Sai o modo 3D do CyberGraph do scan.** Removidos `security-graph-3d.tsx` e `scene/`
   (cena, malhas, paleta, controle de qualidade) e a alternância 2D/3D. A aba vira só 2D.
2. **Layouts 2D no lugar dele**, todos sobre a mesma visão já agrupada (grupos, filtro, busca,
   seleção, arrasto e teclado valem para todos): **Hierárquico** (o de antes), **Radial** (alvo
   no centro, um anel por nível), **Estrela** (cada ramo vira um hub com os filhos em leque),
   **Orgânico** (forças, no estilo do Lens da Wiz) e **Clusters** (ilhas por severidade). O
   cálculo é puro e determinístico em `graph-layouts.ts` (sem `Math.random`, o mesmo grafo dá o
   mesmo desenho) e **sem dependência nova**: o orgânico é um force-directed próprio, de ~60
   linhas, que parte do radial. A escolha fica no `localStorage`.
3. **"Caminho mais crítico"** no CyberGraph: seleciona o finding de maior risco e acende o caminho
   de exposição até a Internet (o destaque que já existia). O nome segue o D8: "caminho de
   exposição", nunca "attack path".
4. **Exposure Graph da empresa** em `/exposure-graph` (ADMIN e CLIENT), alimentado por
   `GET /companies/me/exposure-graph`. Projeção do MySQL, sem graph database (D8): aplicações
   ativas da empresa do usuário autenticado, abertas por severidade, categorias OWASP abertas e as
   cinco mais graves de cada aplicação. Mesma regra de escopo do comparativo
   (`/companies/me/metrics/comparison`): a empresa vem do token, nunca da URL; sem empresa → 404
   `COMPANY_NOT_FOUND`. Factory Method + Controller → Service → Repository.
5. **O grafo da empresa reusa o desenho do CyberGraph** (`cyber-graph-2d.tsx`) e os mesmos
   layouts. A categoria OWASP é **um nó compartilhado** ligado a todas as aplicações em que está
   aberta — o raio de impacto da mesma classe de falha.
6. **O 3D volta como outra coisa: o mapa da superfície de ataque** (aba "Mapa 3D" da mesma
   página). Um bairro por ambiente, um prédio por aplicação; **altura = abertas (log), base =
   criticidade, cor = pior severidade, antena = exposta à Internet**. Cada eixo visual é um campo
   real; nada decorativo que possa ser lido como dado. Selecionar um prédio é a mesma seleção do
   grafo e do painel. "Apresentar" percorre as aplicações da mais grave para a menos grave.

## Garantias (as do ADR-048 que continuam valendo para o mapa)

- **Fora do bundle inicial**: a página carrega o mapa com `React.lazy`; `three`,
  `@react-three/fiber` e `@react-three/drei` (já instalados, usados no landing) só baixam na aba
  "Mapa 3D". Continua sendo a exceção funcional ao [[ADR-041 - Atmosfera unica no layout autenticado]]:
  um segundo canvas só enquanto a aba está aberta.
- **Acessibilidade**: o canvas tem `role="img"` com resumo; a **lista de prédios** abaixo dele
  (botões) dá o mesmo acesso por teclado e leitor de tela, e o painel mostra o detalhe. Movimento
  reduzido desliga o pulso da antena, o voo da câmera e o botão "Apresentar". Sem WebGL, a aba
  explica e o grafo 2D segue disponível.
- **Cores dos dois temas e do alto contraste**: os materiais leem os tokens OKLCH do DOM
  (convertidos por um canvas 2D) e recalculam ao trocar tema ou contraste.

## Consequências

- O grafo do scan perde a "vitrine" 3D; o lugar de impacto visual passa a ser a empresa, onde a
  forma da cidade carrega informação (altura, cor, antena) em vez de repetir o 2D.
- `ADR-048` fica **substituído em parte**: as garantias de WebGL dele valem para o mapa; a cena
  do grafo do scan deixa de existir.
- O Exposure Graph mostra **vulnerabilidades gerenciadas** (`Vulnerability`). Achados DAST ainda
  não promovidos não entram: o silo DAST não tem vínculo com `Application` antes da promoção (D9).
- Severidade `NONE` (CVSS 0) fica fora das contagens do grafo, que só conhecem
  CRITICAL/HIGH/MEDIUM/LOW.
- O orgânico é O(n²) por passo (260 passos); com o teto de 300 nós do CyberGraph roda em dezenas
  de milissegundos e é memorizado (arrastar não recalcula).
