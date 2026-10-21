# Deslize curto entre abas — 2026-10-09

=== RELATÓRIO ===

Feito: Configurações entra pela direita e Home pela esquerda com fade e deslocamento de 28 px em 320 ms. A interpolação do navegador mantém o estado das rotas, o acionamento pelo avatar e a preferência de movimento reduzido. Barra fixa e indicador deslizante seguem a implementação restaurada anteriormente.

Arquivos desta etapa: `app/(tabs)/_layout.tsx`. Alterações pendentes em `src/components/icon-glass-tab-bar.tsx` são da restauração anterior, mantidas. Sem mudanças em API, conteúdo, login, dependências ou lockfiles.

Testes: typecheck/lint e export web aprovados. Roteiro existente com `--slide`: 7/7; registra movimento para os dois lados limitado a 28 px, retorno a zero, fade e escala dos ícones, além das interações de teclado, toque rápido, avatar, pilha de projeto, acessibilidade de movimento e logout. Sem exceções. Resultados por frame em `short-slide-navigation-results.json`. Capturas somente da Home.

Docs: PRD/BACKLOG preparados em `short-slide-docs-review`, com sincronização documental das etapas anteriores; escrita da raiz depende de aprovação do sandbox.

Atenção: verificação visual usa fixtures apenas no navegador. Não comprova API real, suavidade, blur, feedback tátil ou leitor de tela no aparelho físico.

Próximo: experimentar a transição no Expo. Sem commit/push.

=================
