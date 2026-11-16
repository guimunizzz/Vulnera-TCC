<!-- Relatório da entrega "Do ASCII para a pintura" (ADR-054), no formato S5 do AGENTS.md. Para o Rafael revisar a branch feat/landing-pintura. -->

# Relatório — landing "Do ASCII para a pintura"

> [!WARNING]
> A sessão foi encerrada pelo limite de uso antes do fim. O que falta está em
> "Próximo". Nada abaixo é afirmado sem ter rodado.

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
  ADR-054, COMO_FUNCIONA_O_FUNDO.md, evidências em docs/evidencias/landing-pintura/.
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
    nenhum volume foi apagado. O Vite dev da sessão ficou em :5179.
Próximo:
  - docs/BACKLOG.md e PRD_VIVO.md: entradas ✅ NÃO foram escritas.
  - Ciclo de autocrítica: 3 voltas feitas em 1440; 768/375, movimento reduzido
    e alto contraste foram capturados mas só parte foi revisada a olho.
  - Demo com capturas reais do produto: não feito.
  - Medir em Iris Xe e investigar o engasgo de conteúdo acima.
=================
```
