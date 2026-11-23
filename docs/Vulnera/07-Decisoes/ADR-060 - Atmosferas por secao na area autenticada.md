---
type: decisao
tags: [decision, frontend, motion, webgl, acessibilidade]
status: vigente
codigo: ADR-060
data: 2026-11-23
---

# ADR-060 - Atmosferas por seção na área autenticada

> [!info] Atualiza o ADR-041
> Continua valendo: o `AppLayout` é o único dono da decoração, ela é
> `aria-hidden`, sem eventos de ponteiro, lazy, e o conteúdo é HTML. Muda que a
> decoração deixa de ser uma só (ASCII) e passa a depender da seção.
>
> Número: 057–059 já estão em uso na branch `refactor/assistant-ui`.

## Contexto

A área autenticada tinha um único fundo, a atmosfera ASCII (ADR-050). O
Rafael quis explorar mais o 3D, mas o 3D do produto (o mapa do Exposure
Graph) parecia "cubo cinza de tutorial": materiais padrão do three, luz
ambiente, nada vivo. Já o fundo da landing (terreno com shaders próprios,
ADR-055) funcionava.

Num laboratório (`/lab-3d`, só em desenvolvimento) quatro linhas foram
comparadas: relevo, nebulosa, constelação e cidade. O Rafael escolheu
**relevo** e **nebulosa**, com a ideia de **radar e pings** da landing, e
pediu que o ASCII continuasse onde fizesse sentido, sem "um tipo em cada
tela" sem critério. Também pediu: mais calma dentro da plataforma, o mouse
sem atraso, cuidado com peso, o dado real perceptível, crossfade de 0,8 s,
um modo apresentação do Dashboard e um pôster para quando a cena não roda.

## Decisão

1. **Cada linguagem tem um papel, e o papel decide a tela**
   (`features/atmosfera-3d/rotas.ts`):

   | Linguagem | Papel | Telas |
   |---|---|---|
   | Nebulosa | o todo | Dashboard |
   | Relevo + radar | vigilância da superfície de risco | Aplicações, Projetos, Threat Intel, Remediação |
   | ASCII | trabalho técnico cru | Findings, DAST, SAST/SCA, Playbooks, Agendamentos, Nova análise |
   | Nenhuma | formulário/configuração; tela que já tem 3D | SLA, Aprovações, Filas, Maturidade, Exposure Graph |

   Uma rota que não está na tabela fica com o ASCII.

2. **Camadas com crossfade.** `AtmosferaDaPlataforma` mantém uma camada por
   atmosfera. A nova só aparece depois do primeiro quadro desenhado, e a
   anterior apaga em 0,8 s e sai do DOM. Há no máximo duas vivas, e dentro de
   uma mesma linguagem a cena não remonta.

3. **Shaders próprios, não materiais padrão.** Relevo (curvas de nível por
   `fwidth`, pele sombreada pela inclinação, anéis de alcance) e nebulosa
   (partículas em rotação diferencial, deriva de ruído simplex) calculam tudo
   no vertex/fragment shader. O radar (`radar.ts`) gira um feixe; ao cruzar
   um alvo solta um ping em coordenadas do mundo; com risco alto há mais
   pings e mais alertas magenta. O clique só dispara ping no modo imersivo,
   porque na plataforma clicar é trabalho.

4. **Dois modos.** *Plataforma*: sem bloom, DPR ≤ 1,25, metade das
   partículas e da malha, movimento mais lento. *Imersivo* (modo
   apresentação, o `<main>` em tela cheia pela Fullscreen API): bloom,
   DPR ≤ 1,5, clique que pinga.

5. **O teto de AA é da camada, não da cena.** A cena desenha em
   intensidade cheia e a camada (CSS) recebe a opacidade-teto: 0,30/0,24 na
   plataforma (os mesmos números do ASCII) e 0,32/0,40 na apresentação, que é
   o máximo de AA no pior caso (branco da soma aditiva no escuro, tinta no
   claro). O teste é `atmosfera-3d-contrast.test.ts`.

6. **Risco vindo do dado real, sem requisição nova.** A tela publica o seu risco
   (0 a 1) num store mínimo, calculado a partir do que ela já carregou:
   - Dashboard: severidade dos findings, puxada pelos críticos abertos.
   - Remediação: severidade pesada pelo estágio do quadro.
   - Threat Intel: CVEs abertas, puxadas pelos KEV.

   A cena persegue o valor em cerca de 1,4 s. Só quem publicou pode limpar,
   porque a página que sai ainda está montada durante a transição.

7. **Pôster em canvas 2D, sem three e sem imagem.** Aparece com movimento
   reduzido, tela estreita, sem WebGL2, "Pausar animações" ou falha da
   cena. É a mesma lógica da cena num quadro parado: campo de altura e
   câmera iguais para as curvas de nível do relevo, mesma distribuição de
   estrelas, mesmas ondas do ASCII. As cores vêm dos tokens na hora do
   desenho. Com alto contraste não há decoração nenhuma.

## Alternativas descartadas

- **Uma atmosfera só** (antes): não aproveita o 3D novo e trata o trabalho
  técnico e a visão macro do mesmo jeito.
- **Sortear uma atmosfera por tela**: o Rafael pediu critério.
- **Pôster como imagem no repositório**: ficaria desatualizado com tokens e
  tema, e não mostraria o risco real.
- **Bloom na plataforma**: é o passo mais caro e chama atenção para o fundo.

## Consequências

- Até dois contextos WebGL durante a troca (0,8 s); fora dela, um.
- O three fica em chunks lazy (`cena-3d-canvas`, `palette`). O pôster tem
  chunk próprio de cerca de 9 kB, sem three.
- O tema claro é mais discreto que o escuro (blending normal, teto de 0,24).
- O mapa 3D do Exposure Graph continua como era. A tela fica sem atmosfera
  para não disputar com ele, e refazê-lo na linguagem nova é trabalho
  futuro.

## Relacionado

[[ADR-041 - Atmosfera unica no layout autenticado]] ·
[[ADR-050 - Camadas de movimento e kit three.js imperativo no web]] ·
[[ADR-055 - Terreno topografico nos atos 3 a 5 da cena da landing]] ·
`docs/FRONTEND_WEB.md` §Atmosferas por seção · `docs/DECISIONS.md` D20
