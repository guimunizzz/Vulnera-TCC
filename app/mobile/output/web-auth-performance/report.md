# Otimização do acesso web — 2026-10-15

Branch: `refactor/web`. Pedido: tornar login e cadastro mais fluidos mantendo os recursos existentes.

## Mudanças

- `auth-layout.tsx` e `login-page.css`: coordenadas do mouse somente nas duas camadas decorativas, sem propagação pelo formulário/SVG estático; até um `requestAnimationFrame` pendente, usando a posição mais recente e compensando a rolagem.
- Circuito SVG memorizado. Animações CSS e SVG/SMIL pausam quando o fundo termina o fade de saída (550ms), ou a aba fica oculta. Retomada mantém o tempo da animação. Toque mantém o fundo visível animado; movimento reduzido cancela atualizações dispensáveis. Listeners, frame e timer são removidos ao sair.
- `interactive-label.tsx`: `memo` evita reconciliar textos iguais a cada tecla; classificação das letras calculada uma vez, caracteres já revelados pulados e restauração altera somente o texto necessário. Decode/glitch e seus tempos preservados.
- `login-page.tsx` e `register-page.tsx`: trava síncrona impede requests duplicados antes do próximo render, inclusive por Enter. `finally` libera nova tentativa. Senhas diferentes continuam bloqueando cadastro antes de qualquer request.
- Layout compacto, logo interna, campos, mostrar senha, validação, mensagens de erro, foco, nomes acessíveis, store, destinos e transições preservados.

## Comparação local

Chrome headless, viewport 1440×900, servidor Vite local. Três rodadas por versão; mediana de métricas do Chrome DevTools Protocol. Cada rodada: 2s em repouso com fundo invisível e 150 movimentos de ponteiro. Medidas feitas antes dos jobs de teste/build para reduzir disputa de CPU.

| Medida | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Recalcular estilos durante 150 movimentos | 1419.916 ms | 145.388 ms | 89.8% |
| Tarefas da thread principal durante 150 movimentos | 2164.189 ms | 541.046 ms | 75.0% |
| Tarefas da thread principal em 2 s com fundo invisível | 142.835 ms | 3.344 ms | 97.7% |

O tempo de recálculo caiu; a medição não demonstra redução na quantidade de recálculos. Resultados são deste ambiente, sem garantia de FPS ou percentual equivalente em outros computadores. Digitação teve uma amostra exploratória por versão, insuficiente para um percentual confiável. Não foi medido paint/GPU ou consumo de bateria.

Com movimento reduzido, os 60 movimentos do roteiro passaram de 120 mutações de estilo no `main` para zero mutações nas três camadas observadas. Com movimento normal, o formulário e o SVG estático deixaram de herdar as coordenadas variáveis. Dados brutos: `baseline.json` e `optimized.json`.

## Validação

- `npm run check --workspace=app/web -- -- --pool=threads --maxWorkers=1 --silent`: 348/348 testes em 32 arquivos; ESLint 0 erros e 9 avisos anteriores; contraste 66/66.
- Testes focais: 20/20 em quatro arquivos. Novos testes cobrem envio repetido, sucesso e destino, retry após erro, valores preservados, confirmação de senha, coalescência de ponteiro, pausa/retomada, mudança de preferências, visibilidade e limpeza ao desmontar.
- `npm run build --workspace=app/web`: aprovado, com aviso anterior sobre tamanho de bundle.
- Navegador: 18/18, sem exceções JavaScript. `smoke-results.json` detalha os cenários, incluindo 320×568, orientação horizontal, teclado/foco, erros, decode/glitch, transições, toque, rolagem e movimento reduzido.
- Revisão visual independente aprovada em `login-1440x900.png`, `register-320x568.png` e `touch-register-390x844.png`: elementos inteiros, sem sobreposição.

Autenticação foi simulada nos testes, sem criar contas reais. Visibilidade oculta foi simulada por evento; toque foi emulado no navegador. Não houve validação em aparelho físico nem benchmark de produção. Nenhuma mudança de API/schema/dependências/lockfiles nesta tarefa.

## Acompanhamento

Revisão identificou comportamento preexistente: uma resposta de autenticação que termina depois de sair do formulário ainda pode atualizar a sessão e navegar. Registrado no BACKLOG como trabalho futuro, sem ampliar o escopo desta otimização.
