<!-- Preserva os achados intermediários da QA do assistente para revisão da entrega; não substitui o resultado final. -->

# Iterações da verificação de navegador

- Primeira execução: Escape não fechava o painel após o envio. A desativação do botão retirava o foco, e o handler estava restrito ao ramo do assistente. Reproduzido em ADMIN e CLIENT, enviado ao implementador e corrigido com listener condicionado no documento e textarea readOnly durante a espera.
- Segunda execução: 9/12 cenários passaram; painel em 320×568 teve `x=-2px` nos temas claro e escuro porque a largura em `100vw` incluía a barra de rolagem. Correção solicitada para usar a largura percentual do contêiner fixo. Resultado intermediário preservado em `browser-results-before-mobile-fix.json`.
- Duas limitações do próprio roteiro foram corrigidas: o driver esperava estabilidade de um botão que deve estar em movimento (hover forçado passa a dispensar somente essa espera), e o init script de fixtures tentava acessar localStorage no iframe sandbox do ZAP (agora executa apenas no documento pai).
- Capturas desktop claro/escuro foram abertas com `view_image`: painel, mascote e textos legíveis, sem corte do painel em desktop. A revisão de 320px aguarda a repetição após a correção de largura.

Todos os cenários usam respostas sintéticas interceptadas exclusivamente no navegador, sem chamada Gemini real ou escrita em banco. O rótulo Gemini no cenário específico valida apenas a apresentação da origem fornecida pelo contrato simulado.

## Resultado final

Execução final em `http://127.0.0.1:5175`: **12/12 cenários aprovados, zero erros de página**. O resultado está em `browser-results.json` e `browser-report.md`. Capturas desktop dark/light e narrow 320px dark/light foram abertas com `view_image`; painel e textos permanecem legíveis e dentro da viewport. O histórico tem rolagem interna (2.922px de conteúdo em área de 223px na prova de estresse) e o assistente desaparece na mídia de impressão.

A verificação de largura global identificou uma limitação anterior da página: em 320px, o cabeçalho Conta atinge `right=335,28px` e o documento tem `scrollWidth=335px` **antes e depois** de abrir o chat. A aprovação do assistente exige que ele caiba na viewport e não aumente esse overflow existente; não representa correção do cabeçalho. Essa ressalva está registrada no JSON final, sem alterar código fora do escopo.

Movimento foi observado com a preferência normal, incluindo pausa por hover/foco/manual e contenção após resize. Os cenários reduzidos usam `prefers-reduced-motion`. A matriz cobriu ADMIN/dark, CLIENT/light, PENTESTER/system, mobile claro/escuro, portal sob modal existente, instância única na navegação protegida, ausência pública, onboarding/relatório ZAP, origem de resposta, texto seguro e descarte de resposta de sessão encerrada. Nenhum teste comprova qualidade de Gemini ao vivo.

## Repetição no build servido e integração local real

Após o rebuild e a recriação API/web pelo orquestrador, a matriz foi repetida em `http://localhost:8086`: **12/12 aprovados, zero erros de página e zero violações CSP**. O header CSP com `script-src` foi exigido; o asset servido foi `/assets/index-BM7VkbDc.js`. Artefatos ficam em `production/`, preservando os resultados Vite anteriores. O cenário de sessão usa Sair e novo login pela interface, sem depender de imports de código-fonte indisponíveis no build.

Foi executado também `real-ui-smoke.cjs`, sem interceptações: uma tentativa de login CLIENT com credenciais fictícias já versionadas em `docs/DEMO.md`, duas perguntas reais ao backend local e clique no atalho Solicitar análise. Ambas retornaram HTTP 200 e `source: local`, capturando `dashboard` e depois `new-analysis`. Nenhum formulário de negócio foi submetido; a sessão foi encerrada por Sair. Evidência em `production/real-ui-results.json` e `production/real-client-local.png`. A captura real e a captura de 320px do build servido foram abertas com `view_image` e conferidas.

Esse smoke comprova frontend e backend locais integrados em modo local. Continua sem comprovar Gemini ao vivo; não houve envio de perguntas extras além das duas autorizadas para essa prova.
