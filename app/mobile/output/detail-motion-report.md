# Relatório — movimento suave nos detalhes mobile

Data: 2026-10-09. Branch: `mobile/api`. Nenhum commit, push ou PR nesta tarefa.

=== RELATÓRIO ===

Feito: cinco melhorias implementadas. Projeto e vulnerabilidade abrem com deslize de 28 px e fade em 320 ms; a tela anterior retorna pela esquerda. Home, conta e detalhes apresentam blocos com subida de 8 px e atrasos até 180 ms. Skeletons com brilho discreto indicam a primeira carga da API; o conteúdo entra por fade. Informações e comentários expandem/recolhem altura e opacidade em 260 ms. Comentários começam abertos; vetor CVSS recolhido. Movimento reduzido aplica estados diretamente; o brilho pausa quando a tela perde foco ou o app fica inativo.

Arquivos de aplicação desta tarefa:

- `app/(tabs)/home/_layout.tsx`
- `app/(tabs)/home/index.tsx`
- `app/(tabs)/home/project/[id].tsx`
- `app/(tabs)/home/finding/[id].tsx`
- `app/(tabs)/settings.tsx`
- `src/components/workspace-motion.tsx`
- `src/components/workspace-disclosure.tsx` (novo)
- `src/components/workspace-skeleton.tsx` (novo)

Testes: typecheck e lint aprovados; exports web e Android aprovados. Interação: 10/10 em `detail-motion-results.json`; regressão da barra/abas: 7/7 em `short-slide-navigation-results.json`. Conferidos skeleton → dados, deslocamento/fade na abertura, alturas intermediárias ao recolher, expansão da descrição/comentário longo, erro de evidência separado de vazio, nova tentativa, segunda página de comentários, largura de 320 px, movimento reduzido, retorno e abas. Regressão inclui teclado, trocas rápidas, avatar, preservação da pilha e logout. Sem exceções de navegador ou escrita nos recursos. `git diff --check` aprovado nos arquivos alterados; avisos de conversão LF/CRLF são do Git no Windows.

Docs atualizados: PRD, BACKLOG, Mobile Expo, Mobile Cliente e ADR-046. As cinco cópias revisadas em `detail-motion-docs-review/` foram aplicadas na raiz após autorização de escrita. Histórico anterior preservado; etapas anteriores de assinatura em Configurações, restauração do indicador e deslize entre abas sincronizadas. Esta tarefa não fecha uma nova fase do roadmap.

⚠️ Atenção do Rafael: o stack de projetos passou ao stack JS já incluído no Expo Router para controlar o deslocamento exato; demais navegadores continuam como antes. Gesto horizontal agora usa a borda, substituindo a configuração nativa de tela inteira. Não houve mudança de dependências, contratos de API ou dados. A revisão usa fixtures somente no navegador: não valida conectividade real, suavidade, memória, gesto ou leitor de tela no aparelho. A edição preexistente de `.env.example` não foi tratada nesta tarefa. Roteiros e capturas em `output/` não precisam entrar no commit de aplicação.

Próximo: recarregar o app no Expo e experimentar abertura/retorno, expansão e abas no aparelho.

=================

Complemento posterior — 2026-10-09: o usuário reportou crash nativo iOS em Gesture Handler após a adoção do stack JS. A resolução transitiva 3.x não correspondia à ABI 2.x do Expo Go; a correção fixa a dependência direta do SDK e o lockfile. Ver `gesture-compatibility-report.md`. Os resultados web acima não demonstravam compatibilidade nativa; as animações continuam iguais após a correção.
