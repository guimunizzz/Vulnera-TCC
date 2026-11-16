---
type: decisao
tags: [decision, landing, webgl, three, terreno, 3d, camera, movimento, acessibilidade, desempenho]
status: vigente
codigo: ADR-055
data: 2026-11-16
supersedes: ADR-054
supersedes-parcialmente: ADR-050
---

<!-- Registra a escolha final do material dos atos 3–5 da cena narrativa da landing (um terreno topográfico em 3D), as alternativas que rodaram na página e foram descartadas (pintura e grafo), e a revisão da regra "sem câmera em movimento"; consumido pelos mantenedores do `app/web` e pela banca. -->

# ADR-055 — Terreno topográfico nos atos 3 a 5 da cena da landing

> [!info] Origem
> Decisão do Rafael em 2026-11-16, depois de comparar três materiais rodando
> na própria landing (pintura, grafo e terreno, escolhidos por `?cena=`):
> "gostei do terreno", "o terreno vai ser o final", "gosto de caprichar no 3D".
> Branch `feat/landing-pintura`. Roteiro e medições em
> `docs/LANDING_NARRATIVA.md` §12; explicação para iniciantes em
> `docs/COMO_FUNCIONA_O_FUNDO.md`; capturas em
> `docs/evidencias/landing-terreno/`.

> [!warning] Supersede o [[ADR-054 - Pintura nos atos 3 a 5 da cena da landing]]
> O ADR-054 decidiu duas coisas. **Continua valendo:** a cena troca de material
> no ato 3, e a virada é uma onda da esquerda para a direita em que cada célula
> ASCII dá lugar ao material novo. **Deixa de valer:** o material ser pintura.
> O código da pintura e a camada de acumulação do kit foram removidos.

> [!warning] Supersede PARCIALMENTE o [[ADR-050 - Camadas de movimento e kit three.js imperativo no web]]
> Do ADR-050 muda só o §3 (a cena da landing deixa de ser toda ASCII) e o teto
> de DPR, que a camada do terreno pode passar (até 2). Camadas de animação,
> kit `src/three/`, gate antes do `lazy()` e atmosfera da plataforma seguem
> como estão.

## Contexto

A cena narrativa da landing conta seis atos enquanto a página rola: funciona →
tem falhas → encontrar → organizar → corrigir → estável. O ADR-054 trocou o
material da segunda metade por pintura (pinceladas num campo de fluxo).

Vista na página, a pintura não convenceu: era toda plana, e o three.js estava
sendo usado só como um jeito de desenhar retângulos. O pedido passou a ser
explorar profundidade, câmera e geometria. Dois materiais 3D foram
implementados ao lado da pintura, com a mesma interface, para comparar no
navegador:

- **terreno** — a grade de caracteres ganha relevo e vira um mapa topográfico;
- **grafo** — as células viram nós no espaço, ligados por arestas.

## Decisão

### 1. Os atos 3–5 são um terreno topográfico

| Ato | O que se vê |
|---|---|
| 0–2 | ASCII, como antes. |
| 3 · Organizar | **A virada:** a grade inclina e ondula. Cada glifo de falha se ergue numa haste e salta para o monte da sua severidade. Quatro montes crescem nas laterais, com curvas de nível; crítica é o mais alto. |
| 4 · Corrigir | Do mais alto para o mais baixo: uma faixa verde desce a encosta e **só então** o monte afunda. Os glifos viram `✓`, sobem e somem. Baixa nunca; média, a metade. |
| 5 · Estável | Planície calma, luz quente; fica o morro de baixa e meio morro de média (risco residual aceito). |

A metáfora se explica sozinha — quanto mais grave, mais alto; corrigir é
achatar — e relevo com luz lê de longe, num projetor.

### 2. O plano 3D começa sendo a própria tela

O mundo é medido em px CSS, com a origem no centro da tela. A câmera fica a
uma distância em que o plano z = 0 preenche a tela exatamente: sem inclinação,
cada célula ASCII cai em cima do seu glifo. Os glifos de falha usam o **mesmo
hash por célula** e o **mesmo atlas** da cena ASCII. O `@` que estava na página
é o `@` que sobe para o monte. É isso que faz a virada ler como transformação,
e não como troca de cena.

### 3. A câmera se move — presa ao scroll

O roteiro dizia "sem câmera em movimento". Essa regra é **revista**: a câmera
inclina 46° em volta do eixo horizontal da tela conforme a virada avança.

O que continua valendo da intenção original:

- o movimento é do scroll — parou de rolar, a câmera para; nada se move sozinho;
- nada vem na direção de quem lê (a câmera gira, não avança);
- com "reduzir animações" (sistema ou menu) a cena nem monta: fica o pôster.

### 4. Relevo é função; nada é guardado

A altura do terreno é uma função avaliada no vértice: ondulação calma, quatro
montes de crista erodida, as selas que os ligam em cordilheira e a onda do
clique. Normal, sombra projetada (marcha curta em direção à luz) e luz de
contorno saem dela. Posição, cor e glifo de cada falha saem do número da
instância. Não há textura de altura, de posição, nem alvo em ponto flutuante.

Cinco draw calls (malha, arestas, hastes, nós, glifos) num alvo fora da tela,
sem buffer de profundidade e sem MSAA: a malha é desenhada do fundo para a frente e as
linhas têm a borda suavizada na conta. A passada de tela compõe esse alvo com
o ASCII e os halos, com o mesmo teto de alfa que o teste de contraste cobre.

### 5. O clique vira onda no relevo

Nos atos ASCII o clique continua sendo a gota que ondula a grade. A partir da
virada, o ponto clicado é projetado no plano e vira uma onda sísmica que
levanta a malha de verdade; os glifos balançam em cima dela.

### 6. A história vai até o fim da página, e o grafo vive em cima do terreno

Acréscimo do mesmo dia, depois de o Rafael notar que o fundo parava em
"Planos" (o último `data-ato`) e pedir mais animação, "usando o grafo também".

- **Epílogo.** O progresso narrativo segue de 5 a 6, e o 6 é alcançado no fim
  da rolagem. Nesse trecho uma rede de nós nasce sobre a planície, a câmera
  orbita e baixa em direção ao horizonte, e o horizonte amanhece. Não é um
  sétimo ato: `data-ato` e pôster continuam com seis.
- **Grafo como camada.** Descartado como material, o grafo ficou como o que
  liga as coisas: um nó flutua sobre cada cume, ligado aos glifos daquele
  monte (a aresta se solta quando a falha é corrigida), e a rede do epílogo
  cobre a planície. Mesma técnica do resto: instâncias, nada guardado.
- **Vida contínua.** Pulsos correm pelas arestas, anéis de sonar saem dos
  montes e uma faixa de luz varre o relevo, mesmo com a página parada. O que
  continua preso ao scroll é a **câmera** (§3) e a **narrativa**; os detalhes
  podem se mexer sozinhos, como o ASCII dos atos 0–2 sempre fez.

### 7. Degradação e qualidade

Movimento reduzido, tela abaixo de 768 px, sem WebGL2, falha do chunk ou
contexto perdido: pôster ASCII (que conta os seis atos em ASCII). Alto
contraste: fundo liso. Se a máquina não segura a cadência por 90 quadros
seguidos, o terreno desce um degrau: DPR 1,5 com malha de 30 px, depois DPR 1
com malha de 40 px.

## Alternativas consideradas

Todas rodaram na landing real antes da decisão. Uma amostra das capturas está
em `docs/evidencias/landing-terreno/alternativas/`.

| Alternativa | Por que não |
|---|---|
| **Pintura** (ADR-054) | Bonita, mas plana: não usa o que o three.js tem de melhor. Mesmo com massas, cerdas e relevo iluminado, o Rafael não se convenceu ("não sei se gostei das tintas"). Também era a mais cara: camada de acumulação com mistura molhada e relevo por pixel. |
| **Grafo** (como material) | Conversa com o Exposure Graph do produto, mas lê pior de longe (pontos e linhas finas) e a metáfora pede explicação. Preterido pelo Rafael em favor do terreno — e reaproveitado como camada sobre ele (§6). |
| **Manter os três por `?cena=`** | Serviu para comparar. Como produto final seria código morto e três conjuntos de shader para manter. |
| **Manter ASCII nos seis atos** | Estado anterior ao ADR-054: a metade "boa" da história não se distinguia da metade "ruim". |

## Consequências

**Ganhos**

- A virada continua sendo o momento mais forte da página, agora com
  profundidade de verdade.
- Código menor que com a pintura: saíram `pintura.ts`, `grafo.ts`, a base
  genérica de material e `src/three/acumulacao.ts`. O kit voltou ao que era,
  mais dois parâmetros opcionais (`criarAtlasAscii` e `aoCair` das gotas).
- A lógica do terreno é testável sem WebGL (`terreno-logica.ts`).

**Custos e limites**

- ⚠️ Medido numa **RTX 3060 Ti**. O alvo do orçamento é uma GPU integrada
  classe Iris Xe, que não estava disponível: falta repetir
  `output/landing-pintura/medir.cjs` nela. O vértice do terreno é pesado (11
  avaliações da função de altura por vértice, por causa da normal e da
  sombra); os degraus de qualidade existem para esse caso.
- O pôster de fallback continua ASCII: celular e movimento reduzido não veem
  o terreno.
- A regra "sem câmera em movimento" deixou de ser absoluta (§3).

## Relacionado

- [[ADR-054 - Pintura nos atos 3 a 5 da cena da landing]] (substituído)
- [[ADR-050 - Camadas de movimento e kit three.js imperativo no web]]
- [[ADR-049 - Menu de acessibilidade com preferencias no navegador]]
- ADR-041 (corte de 768 px) · ADR-026 (landing fora do design system)
- `docs/LANDING_NARRATIVA.md` · `docs/COMO_FUNCIONA_O_FUNDO.md` · `docs/FRONTEND_WEB.md`
