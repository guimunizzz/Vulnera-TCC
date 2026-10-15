# Modelo 7 — animação 1, 2026-10-08

Barra central glass de 176×56, dois ícones outline e divisória. A seleção desliza 79 px em 320 ms; ícones crescem 10% e mudam de cor por camadas de opacidade; o navegador mantém fade de 320 ms. Estado vem da aba efetiva, não do último toque. Movimento reduzido remove transição/escala, mantendo o estado selecionado legível. Labels de acessibilidade preservados mesmo sem texto visual; alvos 79×54.

## Arquivos desta etapa

- `src/components/icon-glass-tab-bar.tsx`: apresentação, indicador e eventos do React Navigation.
- `app/(tabs)/_layout.tsx`: conecta a barra e configura fade; guard/push existentes preservados.
- `src/theme/tokens.ts`: largura 176 e altura 56 do respiro compartilhado da barra.

Demais arquivos modificados no Git pertencem às tarefas anteriores. Nenhuma mudança na API, login, autenticação, telas, dependências ou lockfiles nesta etapa. O conteúdo das telas permanece; apenas o respiro inferior acompanha a nova altura da barra.

## Verificação

Tipos e lint aprovados. Exports web e Android aprovados. Roteiro `icon-navigation-smoke.mjs`: 7/7 com geometria em 320/390, movimento intermediário da linha e fade da tela, teclado, trocas rápidas, entrada pelo avatar, retorno ao projeto, movimento reduzido, logout e ausência de exceções. Resultados/amostras em `icon-navigation-results.json`; capturas `icon-navigation-home-320.png` e `icon-navigation-home-390.png`.

A primeira tentativa de animar a cor diretamente no Ionicons gerou erro `setNativeProps` no navegador. A implementação final usa Views animadas em camadas e passou sem exceções. Não houve mudança de pacote para resolver isso.

API sem containers ativos. Fixtures limitadas ao script do navegador, sem mock/dado fictício no app distribuído ou persistência real. Blur, desempenho, feedback tátil e leitor de tela em Android/iOS físicos ainda precisam de avaliação no aparelho. Capturas limitadas à Home, conforme pedido.

## Próximo

Opção 1 fica aplicada para experimentar no Expo. Mostrar opção 2 na sequência, após avaliação da primeira pelo usuário; não foi aplicada nesta etapa. Sem commit/push.
