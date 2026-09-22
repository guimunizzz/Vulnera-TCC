# Dashboard atmosférico — entrega de 2026-09-22

Relatório do redesign de `/dashboard`, consumido pela manutenção do frontend e pela revisão da entrega. Branch: `feat/improve-front-dash`.

## 1. Resumo

Hero compartilhado entre ADMIN, CLIENT e PENTESTER; hierarquia, profundidade e estados de carregamento ADMIN refinados. A solicitação posterior de movimento nos cards ampliou a decoração: ondas lentas no fundo da página e pequenas órbitas nos KPIs. Nada animado representa métricas inventadas. Não houve mudanças de API, schema, permissões ou dependências.

## 2. Arquivos

- `app/web/src/pages/dashboard-page.tsx`: composição da atmosfera e do hero, mantendo os três ramos por papel.
- `app/web/src/components/dashboard/admin-dashboard.tsx`: KPIs, skeleton, alerta, ranking semântico e CTA com dados existentes.
- `app/web/src/components/dashboard/kpi-card.tsx`: contrato preservado, ícone/tom opcionais e espaço decorativo.
- `app/web/src/components/dashboard/hero/`: novos hero, fallback, atmosfera, canvas lazy, hook de cena, paleta e CSS isolado.
- `app/web/src/pages/dashboard-page.test.tsx` e `app/web/src/components/dashboard/admin-dashboard.test.tsx`: contratos por papel, fallback, decoração e valores reais.
- `docs/DESIGN_SYSTEM.md`, `PRD_VIVO.md`, `docs/BACKLOG.md` e este relatório: documentação da entrega.

## 3. Three.js

`DashboardAtmosphere → Suspense → DashboardAmbientCanvas → useDashboardScene`. Apenas o hook lazy importa Three. Um contexto e um RAF atendem fundo e cards por viewport/scissor; não existe renderer por KPI.

Fundo: 18 curvas com 72 amostras cada (1.296 vértices), deformação senoidal em buffer persistente. Cards: três anéis de 80 pontos e arestas de um pequeno icosaedro, geometria reutilizada em cada recorte. Sem texturas, loaders, bloom ou pós-processamento.

Render limitado a 30 Hz, DPR máximo 1,5 e preferência GPU de baixo consumo. ResizeObserver mede página/cards; MutationObserver acompanha cards carregados após queries. Pointer usa coordenadas imperativas e interpolação suave, sem setState ou leitura de layout a cada movimento. Tema atualiza materiais sem reconstruir contexto.

RAF pausa com documento oculto ou área fora da viewport. Cleanup cancela RAF, desconecta observers, remove listeners, descarta geometria/materiais/renderer e libera contexto. Context loss encerra cena e mantém fallback. Referências não nulas estáveis resolvem os TS18047 informados no build.

## 4. Motion

Motion existente controla entrada do hero, stagger dos KPIs, ícones, contador e ranking. Tokens centrais de duração/easing reutilizados. `useMotion` impede montagem do canvas quando movimento reduzido está ativo; as animações DOM respeitam a mesma preferência. As órbitas contínuas são decoração Three solicitada posteriormente, não animação de layout dos cards.

## 5. Performance

Comparação disponível entre o build da primeira versão desta tarefa e o refinamento final (não é uma medição do HEAD anterior ao redesign):

| Chunk | Primeira versão, kB (gzip) | Final, kB (gzip) |
| --- | --- | --- |
| principal | 1.714,71 (568,03) | 1.715,03 (568,09) |
| Three lazy compartilhado | 495,63 (125,97) | 498,31 (126,97) |
| dashboard canvas lazy | 4,27 (2,09) | 4,96 (2,44) |

Three continua separado do principal; nenhum import eager foi introduzido. O aviso Vite de chunk principal grande permanece. Não foi feito profiling formal de GPU/FPS em aparelhos físicos. Em larguras menores que 768 px não há canvas; fallback CSS estático reduz custo.

## 6. Acessibilidade

Canvas `aria-hidden`, sem foco e com `pointer-events: none`; dados e ações continuam HTML. Ranking usa lista e headings semânticos; número não depende de cor. O verificador de tokens aprovou 66/66 pares (não equivale a uma medição automatizada de todas as composições transparentes). Contraste e legibilidade também conferidos visualmente nos temas claro/escuro.

## 7. Testes executados

- `npm run lint` em `app/web`: **0 erros**, 9 avisos preexistentes fora dos arquivos alterados.
- `npm run check:contrast`: **66/66 pares**, zero falhas e zero primitivos fora do gamut.
- `npm test -- --maxWorkers=1` no container com source e `vitest.config.ts` locais montados somente leitura: **221/221 testes**, **15/15 arquivos**. Inclui contratos dos três papéis, reduced-motion, mobile, ausência de WebGL, montagem/desmontagem, KPIs e ranking reais.
- `docker compose build web`: **aprovado**, incluindo `tsc --noEmit && vite build`.
- `docker compose up -d --no-deps web`: web atualizado, API/banco não recriados nesta atualização final.

A tentativa de testes completos no host encontrou dependências locais ausentes; instalação sem salvar falhou no npm (`edgesOut`). Nenhum lockfile foi editado. A suíte completa foi validada no ambiente Docker com dependências instaladas pela imagem. Existem avisos React act/router no runner, sem falhas.

## 8. Validação visual e funcional

Conta ADMIN fornecida pelo usuário, em `http://localhost:8086/dashboard`. Login funcionou com banco existente; **não foi necessário executar seed**. Dados observados: 2 empresas ativas, 0 pendentes, 4 críticos; ranking TechNova 12 e Jeremias 6. Credenciais não são armazenadas neste relatório.

Larguras 1440, 1024, 768 e 375 px sem overflow horizontal; hero de 178 px no desktop. Claro, escuro e sistema conferidos. Sidebar/topbar mantidas; KPIs reorganizam colunas; ranking e CTA permanecem legíveis. Em 375 px, zero canvas e fallback intencional.

Três ciclos Dashboard → Findings → Dashboard: zero canvas em Findings, exatamente um ao retornar. Console capturado nessa sessão sem warnings/errors. CTA abriu a página de assinaturas pendentes corretamente. Capturas foram inspecionadas na sessão, não versionadas. Corrigidos fundo opaco que ocultava as órbitas e cálculo de posições afetado pelo stagger.

## 9. Revisão e limitações

Revisados limpeza, observers, listeners, RAF, closures, lazy imports, mudança de tema e ausência de estado React por frame. Não foi feito teste automatizado de perda real de contexto nem medição de memória GPU; a navegação manual comprova ausência de canvas duplicado, não um perfil de memória. Reduced-motion e ausência de WebGL validados nos testes React, não por emulação de sistema no navegador. CLIENT/PENTESTER preservados por testes de roteamento e componentes compartilhados; inspeção autenticada manual concentrou-se no ADMIN escolhido.

Paleta WebGL usa aproximações sRGB centralizadas dos tokens, conforme padrão da landing; alterações futuras dos tokens exigem sincronizá-la. O bundle inicial grande preexistente e avisos de lint fora do escopo não foram refatorados. Nenhuma nova fase de domínio ou ADR foi criada por uma composição visual local.

## 10. Resumo do diff

Mudança restrita à apresentação do dashboard, dois arquivos de testes e documentação. Sem arquivos de API, banco, migrations, manifests ou lockfiles alterados. O arquivo preexistente não rastreado `repomix-output.md` foi preservado e excluído do commit. Commit local ao final, conforme autorização mais recente; nenhum push solicitado.
