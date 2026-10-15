# Relatório — crash de gestos no Expo Go

Data: 2026-10-09. Branch: `mobile/api`. Sem commit/push nesta correção.

=== RELATÓRIO ===

Feito: corrigida a resolução de Gesture Handler para a ABI nativa do Expo SDK 57. O usuário reportou `TypeError: undefined is not a function` em `RNGestureHandlerModule.installUIRuntimeBindings` e no stack de Home após a adoção de `expo-router/js-stack`. O pacote instalado era 3.3.0 e o lockfile mantinha 3.2.1; a matriz nativa do Expo e a documentação SDK 57 indicam `~2.32.0`. A nova dependência direta resolve 2.32.0 tanto no stack quanto no drawer. A versão 2.32 não contém a chamada que gerava o erro. O stack JS e todas as animações continuam iguais.

Instalação: `npx expo install react-native-gesture-handler`, concluída com código 0. O npm reconciliou a árvore instalada com o lockfile. O primeiro export web revelou `react-native-web` ausente, anteriormente instalado como peer opcional sem estar declarado. Para preservar o preview e repetir a regressão, `npx expo install react-native-web` adicionou `^0.21.2`, também com código 0. Lockfile gerado pelo npm, sem edição manual; demais versões existentes do lockfile não foram atualizadas nesta correção.

Arquivos de aplicação: `package.json` e `package-lock.json`. Roteiro de compatibilidade, relatórios e export iOS em `output/`. Demais mudanças de aplicação listadas no Git vêm das tarefas visuais anteriores.

Testes: 20/20 verificações, sendo 3 de matriz/resolução/lockfile, 10 de detalhes e 7 de barra/abas. Typecheck, lint, export iOS e export web aprovados. `expo install --check` offline informou dependências atualizadas; esse resultado usa validação local, sem checagem remota. `git diff --check` aprovado nos dois arquivos. Roteiros de UI usam fixtures isoladas; não validam API real. A exportação iOS comprova montagem do bundle, não execução nativa ou ABI no aparelho.

Docs: cinco cópias revisadas em `gesture-compatibility-docs-review/`: PRD, BACKLOG, Mobile Expo, Mobile Cliente e complemento do ADR-046. Aplicação na raiz pendente de escrita autorizada.

⚠️ Atenção do Rafael: os testes web anteriores não detectaram a incompatibilidade nativa, e a entrega anterior não comprovava funcionamento em Expo Go. A confirmação física segue pendente. Os avisos de limitações de `expo-notifications` são separados do crash; o registro de push não foi alterado nem seus avisos ocultados. O npm informou 41 vulnerabilidades no audit; nenhuma atualização ampla/audit fix foi executada fora do escopo. A exclusão preexistente de `.env.example` foi preservada.

Próximo: parar o Metro (Ctrl+C), fechar Expo Go completamente e executar `npx expo start --clear` em `app/mobile`. Reabrir pelo QR e conferir abertura/retorno de projeto/vulnerabilidade no iOS; informar qualquer erro restante.

=================

Fontes: [Gesture Handler no Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/) e [limitações de notificações](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
