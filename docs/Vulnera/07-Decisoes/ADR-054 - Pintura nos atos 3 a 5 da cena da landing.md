---
type: decisao
tags: [decision, landing, webgl, three, pintura, ascii, movimento, acessibilidade, desempenho]
status: vigente
codigo: ADR-054
data: 2026-11-15
supersedes-parcialmente: ADR-050
---

<!-- Registra por que a cena narrativa da landing trocou de material a partir do ato 3 (de caracteres ASCII para pinceladas), quais alternativas foram descartadas e o que isso custa; consumido pelos mantenedores do `app/web` e pela banca. -->

# ADR-054 — Pintura nos atos 3 a 5 da cena da landing

> [!info] Origem
> Pedido do Rafael em 2026-11-15, depois de aprovar num protótipo a direção
> **"Do ASCII para a pintura"**, estilo **expressivo em alta definição**.
> Branch `feat/landing-pintura`. Roteiro e medições em
> `docs/LANDING_NARRATIVA.md` §10; explicação para iniciantes em
> `docs/COMO_FUNCIONA_O_FUNDO.md`; capturas em
> `docs/evidencias/landing-pintura/`.

> [!warning] Supersede PARCIALMENTE o [[ADR-050 - Camadas de movimento e kit three.js imperativo no web]]
> O ADR-050 continua valendo em tudo o que diz sobre camadas de animação, kit
> `src/three/`, gate antes do `lazy()` e atmosfera da plataforma. O que muda é
> o §3 ("Landing: uma cena ASCII narrativa"): a cena **continua** narrativa e
> **continua** ASCII nos atos 0–2, mas os atos 3–5 passam a ser pintura. E a
> camada de tinta pode usar DPR até 2, acima do teto de 1,5 do kit — só ela.

> [!warning] Em revisão desde 2026-11-16
> Depois de ver a pintura na página, o Rafael disse não ter certeza se gostou
> e pediu para explorar mais o three.js. A landing passou a ter três materiais
> para os atos 3–5 — **terreno** (padrão), **grafo** e **pintura** — escolhidos
> por `?cena=` na URL, para comparar. Este ADR continua descrevendo a pintura
> e a troca de material no ato 3, que valem; o que está em aberto é **qual**
> material fica. A decisão final vira um ADR novo. Ver
> `docs/LANDING_NARRATIVA.md` §11.

## Contexto

A cena narrativa da landing conta seis atos enquanto a página rola: funciona →
tem falhas → encontrar → organizar → corrigir → estável. Até aqui os seis eram
feitos do mesmo material, caracteres de terminal (ADR-050).

Funcionava, mas a segunda metade da história era a mais fraca visualmente:
"organizar", "corrigir" e "estável" eram os mesmos glifos mudando de lugar e de
cor. A parte que mostra o **resultado** do produto parecia igual à parte que
mostra o **problema**.

A ideia aprovada é usar a troca de material como parte da narrativa: enquanto o
sistema é só "dados brutos", ele é feito de caracteres; quando o Vulnera
organiza e ajuda a corrigir, ele vira algo com forma, cor e movimento contínuo.

## Decisão

### 1. O roteiro continua; o material muda no ato 3

| Atos | Material | O que mostra |
|---|---|---|
| 0 · Funciona, 1 · Tem falhas, 2 · Encontrar | **ASCII** (como antes, mais denso: célula 12 × 18 px, fonte a 13 px) | campo calmo, `!` pulsando, varredura que revela a severidade |
| 3 · Organizar | **a virada** | cada célula se desfaz em pincelada, em onda da esquerda para a direita; as falhas migram para quatro grupos nas laterais e giram em volta deles |
| 4 · Corrigir | **pintura** | do mais grave para o menos grave, a pincelada fica verde, sobe e se dissolve |
| 5 · Estável | **pintura** | o fluxo desacelera, a luz esquenta, o grupo de baixa continua, discreto |

Canvas fixo atrás das seções, progresso 0→5 pelo scroll, ScrollTrigger único e
`data-ato` nas seções: nada disso mudou.

### 2. Estilo "expressivo": muitas pinceladas curtas, com rastro curto

Cerca de 6.500 pinceladas numa tela de 1440 × 900 (escala com a área), cada uma
uma fita afinada nas pontas que segue a linha do campo de fluxo. Elas pintam
numa camada de tinta que desbota 8,5% por quadro: o rastro é curto, a imagem é
nítida. Cinco matizes da marca × três tons, escolhidos por manchas grandes que
derivam devagar ("cor partida"). Todas as cores são lidas dos tokens em runtime.

### 3. Posição calculada, não guardada

O caminho sugerido era guardar a posição das partículas numa textura e
avançá-la com ping-pong. Ficou diferente, de propósito:

- **a posição de cada pincelada é uma função do tempo**, calculada no vértice
  (integra o campo de fluxo a partir do ponto de nascimento). Não há textura de
  posição nem alvo em ponto flutuante — que dependeria de uma extensão do
  WebGL2 que nem toda GPU oferece;
- **o ping-pong ficou onde ele é necessário**: na camada de tinta
  (`src/three/acumulacao.ts`). Um alvo só, de 8 bits, nunca desbota até zero e
  deixa uma mancha fantasma; lendo o quadro anterior como textura o shader
  subtrai um piso e o rastro some de verdade.

Resultado: uma draw call para todas as pinceladas, uma para esmaecer, uma para
compor. Nenhuma geometria por caractere, nenhum estado a perder num
redimensionamento.

### 4. As falhas nascem na célula do glifo

As pinceladas de falha usam o **mesmo hash por célula** do shader ASCII. A
célula que mostrava `@` em vermelho é exatamente onde nasce a pincelada
vermelha. É isso que faz a virada ser lida como transformação, e não como uma
troca de cena.

### 5. Degradação: o pôster ASCII continua sendo o plano B

Movimento reduzido (sistema ou menu), tela abaixo de 768 px, sem WebGL2, falha
do chunk ou contexto perdido: pôster ASCII, que já conta os seis atos. Alto
contraste: fundo liso. A pintura **não** tem versão estática — o pôster dos
atos 3–5 segue em ASCII (grupos e `✓`).

### 6. Qualidade em degraus

A camada de tinta começa em DPR ≤ 2 (decisão do Rafael na rodada de perguntas).
Se a máquina não segura a cadência por 90 quadros seguidos, a pintura desce um
degrau: DPR 1,5 com 75% das pinceladas, depois DPR 1 com 50%. Reduz-se
resolução e partícula antes de cortar a ideia.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **Manter ASCII nos seis atos** | É o estado anterior. Barato e já validado, mas a metade "boa" da história não se distinguia da metade "ruim". |
| **Estilo "elegante"** (poucas pinceladas longas e finas) | Rejeitado pelo Rafael no protótipo: bonito de perto, mas vazio; de longe, num projetor, não lê como pintura. |
| **"Tinta feita de ASCII"** (pinceladas desenhadas com caracteres) | Rejeitado pelo Rafael no protótipo: perde o contraste entre os dois materiais, que é justamente a narrativa. |
| **Partículas com estado (GPGPU, textura de posição)** | Mais flexível, mas exige alvo em ponto flutuante e código de reinício/redimensionamento. O movimento que a cena precisa cabe numa função do tempo. |
| **Upgrade do three / WebGPU / TSL** | Fora do escopo: sem dependência nova e sem mexer no lockfile. |

## Consequências

**Ganhos**

- A virada do ato 3 é o momento mais forte da página e carrega a mensagem do
  produto (bagunça → ordem).
- O kit ganhou um módulo reutilizável (`acumulacao.ts`) sem mudar quem já o
  usava: a atmosfera da plataforma não foi tocada.
- A lógica da pintura é testável sem WebGL (`pintura-logica.ts`).

**Custos e limites**

- A pintura custa mais GPU que o ASCII (números em
  `docs/LANDING_NARRATIVA.md` §10).
- ⚠️ A medição desta entrega foi feita numa **RTX 3060 Ti**. O alvo do
  orçamento é uma GPU integrada classe Iris Xe, que não estava disponível na
  sessão: falta repetir `output/landing-pintura/medir.cjs` nela. Os degraus de
  qualidade (§6) existem para esse caso.
- O pôster e a cena deixaram de ser espelho um do outro nos atos 3–5.
- `scene-contrast.test.ts` passou a cobrir a tinta (cores × tons × teto de
  alfa × halo) atrás da superfície do texto.

## Relacionado

- [[ADR-050 - Camadas de movimento e kit three.js imperativo no web]]
- [[ADR-049 - Menu de acessibilidade com preferencias no navegador]]
- ADR-041 (corte de 768 px) · ADR-026 (landing fora do design system)
- `docs/LANDING_NARRATIVA.md` · `docs/COMO_FUNCIONA_O_FUNDO.md` · `docs/FRONTEND_WEB.md`
