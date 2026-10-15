<!-- Relatório da revisão de movimento; registra mudanças e limites da validação para Rafael. -->

=== RELATÓRIO ===

Feito: removidos fades sobrepostos da tela e dos blocos, restaurada a navegação nativa de projetos e vulnerabilidades e estabilizada a altura inicial das seções abertas. Reveals autenticados usam até 4 px/220 ms e opacidade 96–100%; abas mantêm 28 px/320 ms com opacidade 96–100%. Toques são mais discretos. Listas animam somente os primeiros itens e skeletons animam uma única opacidade por grupo. A correção anterior do Gesture Handler permanece.

Arquivos:

- `app/(tabs)/_layout.tsx`
- `app/(tabs)/home/_layout.tsx`
- `app/(tabs)/home/index.tsx`
- `app/(tabs)/home/project/[id].tsx`
- `app/(tabs)/home/finding/[id].tsx`
- `src/components/workspace-ui.tsx`
- `src/components/workspace-motion.tsx`
- `src/components/workspace-disclosure.tsx`
- `src/components/workspace-skeleton.tsx`
- `package.json` e `package-lock.json`: correção de dependências da etapa anterior, gerada pelo instalador; sem nova dependência nesta revisão visual.

Testes: typecheck, lint e exports finais web/iOS/Android aprovados. Verificações no navegador: detalhes **10/10** e barra/abas **7/7**, com fixtures isoladas. Cobrem layout inicial, expansão, comentários/paginação, evidência com erro/vazio/retentativa, retorno, teclado, trocas rápidas e movimento reduzido. Bundles finais nativos em `stable-motion-native`. Resultados: `stable-motion-results.json` e `short-slide-navigation-results.json`.

Docs atualizados: seis cópias preparadas e revisadas em `stable-motion-docs-review`; aplicação na raiz pendente. Incluem PRD, BACKLOG, Mobile Expo, Mobile Cliente, substituição do ADR-046 e ADR-047. Mantêm o histórico da correção de gestos.

⚠️ Atenção do Rafael: o deslize dos detalhes passa a ocupar a largura da tela conforme o navegador nativo, substituindo os 28 px do stack JS; entre Home e Configurações continuam 28 px. Android administra a duração de sua transição. Não houve medição de FPS ou validação física do gesto, blur ou fluidez: navegador e export não demonstram esses aspectos. Login conserva seu movimento anterior; a revisão não altera consultas ou grava dados da API. Alterações anteriores fora desse escopo foram preservadas. Nenhum commit foi criado.

Próximo: parar Metro, fechar Expo Go, reiniciar com `npx expo start --clear` e conferir as transições no aparelho.

=================
