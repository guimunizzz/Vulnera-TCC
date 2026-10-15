# Modelo 7 — luz atravessando o vidro, 2026-10-08

=== RELATÓRIO ===

Feito: opção 2 aplicada. Brilho radial roxo atravessa o vidro até a aba selecionada e desaparece; ícone pulsa até 1,12× e retorna a 1×. Fade e sequência completos duram 400 ms. A seleção segue a rota, inclusive entrada pelo avatar. Trocas rápidas cancelam a sequência anterior e retomam da posição atual. Não há brilho inicial ou ao tocar a aba já selecionada; movimento reduzido mantém mudança imediata, sem brilho, escala ou fade.

Arquivos: `src/components/icon-glass-tab-bar.tsx` e `app/(tabs)/_layout.tsx`. Geometria da barra, conteúdo das telas, login, API, dependências e lockfiles preservados. Demais mudanças no Git pertencem a etapas anteriores.

Testes: tipos e lint aprovados; exports web e Android aprovados. Roteiro `light-navigation-smoke.mjs`: **7/7** com geometria e alvos em 320/390 px, brilho e pulsação nos dois sentidos, fade, teclado, trocas rápidas, avatar, pilha do projeto, movimento reduzido, logout e ausência de exceções. Amostras por frame: `light-navigation-results.json`. Capturas somente da Home: `light-navigation-home-320.png` e `light-navigation-home-390.png`.

Docs: PRD e BACKLOG atualizados após revisão e autorização de escrita na raiz. Cópias e diff em `light-navigation-docs-review`; histórico da opção 1 preservado e marcado como substituído.

Atenção: navegador usa fixtures isoladas apenas no roteiro de QA; API real não foi validada nesta tarefa. Export Android verifica empacotamento, não suavidade, blur ou feedback tátil no aparelho físico. Sem alteração de infraestrutura.

Próximo: experimentar a opção 2 no Expo e comparar a sensação com a opção 1. Sem commit/push.

=================
