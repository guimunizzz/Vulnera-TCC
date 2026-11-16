<!-- Relatório da entrega "Do ASCII para a pintura" (ADR-054), no formato S5 do AGENTS.md. Para o Rafael revisar a branch feat/landing-pintura. -->

# Relatório — landing "Do ASCII para a pintura"

```
=== RELATÓRIO ===
Feito:
  - Cena: atos 0–2 em ASCII mais denso (célula 12×18, fonte 13 px, peso 600);
    atos 3–5 em pintura (pinceladas em campo de fluxo, camada de tinta em
    ping-pong, halos, granulado); virada em onda da esquerda para a direita;
    degraus de qualidade automáticos; shaders pré-compilados no carregamento.
  - Kit: src/three/acumulacao.ts (novo); criarAtlasAscii com opções (compatível).
  - Conteúdo: Recursos reorganizado em 3 grupos / 9 cards reais; FAQ,
    Comparativo, Planos, Como funciona, Hero, Demo e CTA final revisados.
  - Pôster com a mesma célula da cena.
Arquivos: ver `git diff --stat origin/dev...feat/landing-pintura`.
Testes (rodados de verdade):
  - npm run lint: 0 erros · check:contrast: OK
  - vitest: 641/643 (77 arquivos). As 2 falhas estão em
    src/components/findings/findings-table.test.tsx, arquivo NÃO rastreado que
    já estava no working tree (fora do escopo, não versionado nesta branch).
  - Testes novos: pintura-logica (PIN-01..10), acumulacao (ACU-01..06),
    conteudo (CONT-01..07), CTR-04 (contraste da tinta), CENA-L07, POS-04.
  - e2e contra o container :8086: landing.spec.ts 7/7 (novo) e
    acessibilidade.spec.ts 4/4.
  - vite build: OK. `npm run build` (tsc --noEmit) FALHA por causa de
    e2e/exposure-remediation-lifecycle.spec.ts, também não rastreado e
    pré-existente.
Desempenho medido (RTX 3060 Ti, Chrome com janela, 1440×900, build de produção):
  - parado: 60 fps (ASCII e pintura), 0 quadros > 25 ms
  - rolando a virada: 57,5 fps (DPR 1) / 57,7 (DPR 2), maior intervalo 50 ms
  - rolando a página: 59,5 fps, maior intervalo 33 ms
  - long tasks > 50 ms: 0 em todos os trechos
  - GPU por quadro: ASCII ~1,1–1,5 ms; pintura ~2,5 ms (DPR 1) / 3,4–4,1 ms (DPR 2)
  - bundle: index 492,77 → 492,80 kB; cena lazy 15,61 → 30,36 kB
Docs atualizados: LANDING_NARRATIVA.md (§10 + histórico), FRONTEND_WEB.md,
  ADR-054, COMO_FUNCIONA_O_FUNDO.md, BACKLOG.md, PRD_VIVO.md, evidências em
  docs/evidencias/landing-pintura/ (90 capturas: 1440/768/375, dois temas,
  movimento reduzido e alto contraste).
Commits e push: ver `git log origin/dev..feat/landing-pintura`.
⚠️ Atenção do Rafael:
  - NÃO medido em Iris Xe: a máquina da sessão tem RTX 3060 Ti. O orçamento de
    55 fps em GPU integrada não está provado. Rodar
    `node output/landing-pintura/medir.cjs` na máquina-alvo.
  - Engasgo de conteúdo, sem relação com a cena (reproduz com a cena desligada):
    um intervalo de ~200 ms na primeira vez que a região depois de Recursos
    entra na tela (y≈3600–3900), e um de 67 ms na entrada de Recursos. Sem long
    task. Não investigado a fundo; pode ser pré-existente.
  - Decisões autônomas: posição das pinceladas calculada no vértice (sem
    textura de posição); ping-pong só na camada de tinta; onda da virada mais
    marcada que a do protótipo (1,1/0,35 contra 0,4/0,4); correção começa em
    3,75 (antes os grupos ASCII já sumiam em 3,15); `--vx-yellow` como luz
    quente; `--vx-indigo` novo; redemoinho do fluxo em volta dos grupos.
  - A DPR 2 da tinta é supersample: a tela continua em DPR ≤ 1,5.
  - Conteúdo removido por falta de lastro no código: "IA para Findings" e
    "Sugestões por IA" (ADR-017); "Em até 1 dia útil"; "Fluxo de revalidação"
    (status tem 4 estados); FAQ de troca de plano e de fidelidade (não há
    upgrade/downgrade nem cobrança); "nada é bloqueado no limite" (a API
    responde 422); "Suporte por e-mail/prioritário" e "SLA dedicado";
    "menos de 3 minutos"; "Executivo de 3 páginas, técnico de 20+"; push
    "por categoria" e "leitura de relatório" no mobile; "Aplicações
    ilimitadas" virou "Até 999" (valor do seed).
  - .eslintrc.json: pintura.ts entrou na lista de módulos de cena que podem
    importar three (mesmo caso de shaders.ts).
  - Docker Desktop foi iniciado e a stack reconstruída (`up -d --build`);
    nenhum volume foi apagado. O Vite dev da sessão (:5179) foi encerrado: os
    scripts medir.cjs e capturar.cjs aceitam a base como 1º argumento
    (http://localhost:8086).
  - Ciclo de autocrítica: 3 voltas em 1440 px; 768 px, 375 px, movimento
    reduzido e alto contraste revisados por amostragem nas capturas finais.
Próximo (registrado em docs/BACKLOG.md como LP-FUT-01..04):
  - Medir em Iris Xe e ajustar os degraus de qualidade se preciso.
  - Investigar o engasgo de conteúdo depois de "Recursos".
  - Demo com capturas reais do produto: não feito.
  - Ligar os planos da landing na API (TODO que já existia).
=================
```

## Adendo — 2026-11-16: "melhore a tinta"

```
=== RELATÓRIO ===
Feito: tinta com mais corpo — massas largas por baixo (16% das pinceladas),
  cerdas e pincel seco, mistura molhada na camada de acumulação e relevo
  iluminado na composição. Evidências refeitas.
Arquivos: scene/config.ts, scene/pintura.ts, scene/shaders.ts,
  three/acumulacao.ts (opção `difusao`, padrão 0), docs.
Testes: lint 0 erros · contraste OK · vitest 641/643 (as mesmas 2 falhas do
  arquivo não rastreado) · e2e landing.spec.ts 7/7 no container.
Desempenho medido (RTX 3060 Ti, build de produção): parado 60 fps; rolando a
  virada 57,7 (DPR 1) / 56,4 (DPR 2); página 59,4 / 59,7; 0 long tasks.
Docs atualizados: LANDING_NARRATIVA.md §10.6, COMO_FUNCIONA_O_FUNDO.md.
⚠️ Atenção do Rafael: "melhore a tinta" foi interpretado como dar corpo e
  textura (decisão minha; se era outra coisa — cor, densidade, velocidade —
  os números estão todos em PINTURA). A tinta nova lê 6 texturas a mais por
  pixel: reforça a necessidade de medir em Iris Xe. Chunks não remedidos.
Próximo: igual (LP-FUT-01..04).
=================
```

## Adendo — 2026-11-16: terreno e grafo (three.js em 3D)

```
=== RELATÓRIO ===
Feito: dois materiais 3D para os atos 3–5, ao lado da pintura, escolhidos por
  ?cena= na URL. Terreno (padrão): a grade vira mapa topográfico, glifos de
  falha pousam em quatro montes que afundam ao corrigir. Grafo: células viram
  nós, falhas se ligam a quatro aglomerados que giram.
Arquivos: scene/cena-3d.ts, scene/terreno.ts, scene/grafo.ts,
  scene/materiais.ts, scene/config.ts, scene/pintura-logica.ts,
  scene/use-landing-scene.ts, .eslintrc.json, testes e docs.
Testes: lint 0 erros · contraste OK · vitest 654/656 (as mesmas 2 falhas do
  arquivo não rastreado) · e2e landing.spec.ts 10/10 no container :8086.
Desempenho medido (RTX 3060 Ti, build de produção, DPR 1 / DPR 2):
  terreno: parado 59,8 / 60,1 · virada 57,9 / 58,0 · página 59,6 / 59,6
  grafo:   parado 59,8 / 59,9 · virada 58,2 / 57,9 · página 59,5 / 59,6
  0 long tasks; maior intervalo na virada 50 ms.
Docs atualizados: LANDING_NARRATIVA.md §11, ADR-054 (aviso de revisão),
  FRONTEND_WEB.md, COMO_FUNCIONA_O_FUNDO.md, BACKLOG.md; evidências em
  docs/evidencias/landing-pintura/terreno e /grafo.
⚠️ Atenção do Rafael:
  - "terreno e grafo, aplique na landing" foi lido como: os dois na página
    real, lado a lado com a pintura, com o terreno como padrão. Se a ideia era
    um só, ou os dois na mesma cena, é ajuste pequeno.
  - A câmera inclina com o scroll, o que contraria a regra "sem câmera em
    movimento" da §2 do roteiro. Está presa ao scroll e não roda com
    "reduzir animações"; a regra precisa ser revista se o 3D ficar.
  - O pôster (celular, movimento reduzido) continua ASCII nos três.
  - PRD_VIVO.md não foi atualizado: a entrega está em avaliação, não concluída.
  - Não medido em Iris Xe. Chunks não remedidos.
Próximo: LP-FUT-05 (escolher o material) e LP-FUT-06 (pôster), além de 01–04.
=================
```

## Adendo — 2026-11-16: terreno como material final (ADR-055)

> [!NOTE]
> Este adendo e o seguinte (epílogo e grafo) são o estado final. Os blocos
> acima ficam como histórico da branch (pintura, tinta com mais corpo,
> comparação de três materiais).

```
=== RELATÓRIO ===
Feito:
  - Terreno caprichado: montes com erosão (cristas em três escalas, pico
    secundário, selas ligando os dois de cada lado), sombra projetada, luz de
    contorno, neblina com cor, correção em varredura (a faixa verde desce a
    encosta e só então o monte afunda) e clique que vira onda sísmica no relevo.
  - Terreno como material final: grafo, pintura, o ?cena= e a camada de
    acumulação do kit foram removidos. ADR-055 registra a decisão e revê a
    regra "sem câmera em movimento".
Arquivos:
  novos     scene/terreno.ts, terreno-shaders.ts, terreno-logica.ts,
            terreno.test.ts, e2e/landing.spec.ts, ADR-055
  alterados scene/config.ts, shaders.ts, use-landing-scene.ts,
            scene-contrast.test.ts, three/gotas.ts, three/ascii.ts,
            .eslintrc.json, seções da landing, docs
  removidos scene/pintura*.ts, grafo.ts, materiais*.ts, cena-3d.ts,
            three/acumulacao.ts (+ teste)
Testes (rodados de verdade):
  - lint 0 erros · contraste OK · vitest 639/641 (as 2 falhas seguem em
    findings-table.test.tsx, arquivo não rastreado fora da branch)
  - e2e no container :8086: landing.spec.ts 7/7 + acessibilidade.spec.ts 4/4
  - vite build OK; `npm run build` continua falhando no tsc por causa de
    e2e/exposure-remediation-lifecycle.spec.ts (não rastreado, pré-existente)
Desempenho medido (RTX 3060 Ti, 1440×900, build de produção, DPR 1 / DPR 2):
  parado no terreno 60,3 / 60,1 fps · rolando a virada 57,6 / 58,6 ·
  rolando a página 59,4 / 59,5 · 0 long tasks ·
  maior intervalo na virada 33 / 50 ms
  bundle: index 492,77 → 492,80 kB; cena lazy 15,61 → 36,77 kB
Docs atualizados: ADR-055 (novo), ADR-054 (substituído), LANDING_NARRATIVA.md
  (§2, §3, §4, §5.1 e §12), FRONTEND_WEB.md, COMO_FUNCIONA_O_FUNDO.md
  (reescrito para o terreno), BACKLOG.md, PRD_VIVO.md; evidências em
  docs/evidencias/landing-terreno/ (62 arquivos, 6,3 MB).
⚠️ Atenção do Rafael:
  - NÃO medido em Iris Xe. O vértice do terreno é pesado (11 avaliações da
    função de altura por vértice, por causa da normal e da sombra). Há degraus
    de qualidade automáticos, mas só a medição na máquina-alvo confirma.
  - A câmera inclina com o scroll: a regra "sem câmera em movimento" foi
    revista no roteiro e no ADR-055. Não roda com "reduzir animações".
  - O pôster (celular, movimento reduzido) continua ASCII: LP-FUT-06.
  - Sombra e luz são por vértice (um a cada 24 px): suaves, sem detalhe fino.
  - A pasta output/landing-pintura e a branch feat/landing-pintura mantêm o
    nome antigo; não renomeei para não mexer no que já foi enviado.
  - Itens do pacote sugerido que NÃO entraram (não estavam na recomendação):
    horizonte, órbita da câmera, sonar do ato 2, rastro do salto, rótulos
    nos montes.
Próximo: LP-FUT-01 (Iris Xe), 02 (engasgo de conteúdo), 03 (Demo real),
  04 (planos pela API), 06 (pôster do terreno).
=================
```

## Adendo — 2026-11-16: epílogo, grafo sobre o terreno e vida contínua

```
=== RELATÓRIO ===
Feito:
  - O fundo não para mais depois de "Planos": o progresso segue de 5 a 6 até
    o fim da rolagem (epílogo). Nesse trecho uma rede de nós verdes nasce
    sobre a planície, a câmera orbita 5° e baixa 7°, e o horizonte amanhece.
  - Grafo como camada do terreno: um nó flutua sobre cada cume, ligado aos
    glifos daquele monte (a aresta se solta na correção); os montes de cada
    lado se ligam; a rede do epílogo cobre a planície.
  - Vida contínua: pulsos nas arestas, sonar saindo dos montes a cada 6 s,
    varredura de luz a cada 9 s, glifos e nós balançando.
Arquivos: scene/terreno-shaders.ts, terreno.ts, terreno-logica.ts, config.ts,
  use-landing-scene.ts (marco do fim da página), terreno.test.ts, docs.
Testes: lint 0 erros · contraste OK · vitest 643/645 (as mesmas 2 falhas do
  arquivo não rastreado) · e2e landing.spec.ts 7/7 no container :8086.
Desempenho medido (RTX 3060 Ti, build de produção, DPR 1 / DPR 2):
  parado no epílogo 59,9 / 59,9 fps · parado no ato 3 60,2 / 60,3 ·
  rolando a virada 58,1 / 56,8 · rolando a página 59,4 / 59,7 · 0 long tasks
  chunk lazy da cena 45,91 kB (gzip 16,71); bundle inicial 492,80 kB
Docs atualizados: LANDING_NARRATIVA.md §3 e §12.7, ADR-055 §6,
  COMO_FUNCIONA_O_FUNDO.md (Parte 6), FRONTEND_WEB.md, BACKLOG.md,
  PRD_VIVO.md; evidências refeitas em 1440 e 768 px, com os quadros
  "epilogo" e "fim" (70 arquivos, 7,3 MB).
⚠️ Atenção do Rafael:
  - Agora há animação que roda sozinha (pulsos, sonar, varredura, balanço).
    A câmera e a narrativa continuam presas ao scroll. Registrei a distinção
    no ADR-055 §6; se preferir tudo preso ao scroll, é só desligar os quatro.
  - O intervalo de 150 ms que apareceu na virada em DPR 2 é o engasgo de
    conteúdo já registrado (LP-FUT-02), não a cena.
  - Mais duas draw calls e mais conta no vértice: reforça a necessidade de
    medir em Iris Xe (LP-FUT-01).
  - Revisão a olho: 1440 px nos dois temas (atos 3, 4, epílogo e fim).
    768 px foi capturado sem erro, não revisado.
Próximo: LP-FUT-01, 02, 03, 04 e 06.
=================
```
