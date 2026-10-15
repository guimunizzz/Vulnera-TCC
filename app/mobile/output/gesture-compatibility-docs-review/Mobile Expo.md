---
type: documentacao-tecnica
tags: [architecture]
status: ativo
---

# Mobile Expo

## Papel
Cliente mobile enxuto para consulta e acompanhamento.

## Stack
- React Native
- Expo
- Expo Router
- Expo Notifications
- Axios
- TanStack Query

## Responsabilidades no MVP
- login exclusivo do CLIENT, sem cadastro
- lista de projetos da empresa, com busca/status e atualização
- detalhe de projeto com metadados, datas e lista paginada de vulnerabilidades
- detalhe read-only de vulnerabilidade, com CVSS, OWASP, descrição, impacto, recomendação e SLA/VRS quando fornecidos
- consulta de evidências autenticadas e comentários paginados
- conta com perfil atualizado, logout e status compartilhado do push
- registro de dispositivo e alertas de novas vulnerabilidades CRITICAL

## Limites

Relatórios/PDF e preferências de push por categoria eram citados como responsabilidades aqui, mas não integram o recorte da Fase 7. Permanecem fora do mobile atual, assim como criação/edição, upload, envio de comentários, chat, maturidade e funções de ADMIN/PENTESTER. A RN24 descreve uma evolução futura.

## Consulta e sessão — atualização de 2026-10-06

A identidade visual autenticada foi refeita com autorização explícita do usuário. Login e tokens anteriores foram preservados. As consultas usam os DTOs reais, paginação e facetas do servidor; falha não equivale a lista vazia. Cache por sessão é limpo em logout/troca de conta, o refresh preserva sessão em falha de rede e ignora respostas de conta anterior, e 429 respeita Retry-After. Android/iOS mantêm SecureStore; preview web guarda sessão apenas em memória. Ver [[ADR-045 - Consulta mobile paginada e isolamento de sessao]] e `app/mobile/output/mobile-refactor-report.md`.


## Movimento e navegação — atualização de 2026-10-09

O stack aninhado de Home/projeto/vulnerabilidade usa `Stack` de `expo-router/js-stack`. O interpolador combina o progresso da rota atual e da próxima para aplicar 28 px e fade em 320 ms na ida e no retorno; root e abas mantêm os navegadores existentes. Gesto horizontal de retorno usa o mesmo progresso; saiu a configuração de gesto de tela inteira do stack nativo. O módulo de gestos já vem na árvore instalada do Expo Router; nenhum manifesto ou lockfile mudou.

`MotionReveal` aceita distância opcional: as telas autenticadas usam 8 px com atraso máximo de 180 ms e duração de 280 ms. O padrão anterior continua para consumidores existentes. `WorkspaceSkeleton` compartilha um relógio de brilho por grupo, pausado por foco, estado do app e movimento reduzido. `WorkspaceDisclosure` mede o conteúdo real para animar altura/opacidade em 260 ms, com controles de pelo menos 48 px e conteúdo recolhido oculto à acessibilidade. Skeletons só representam espera; não adicionam dados de demonstração ou consultas.

A barra vigente é o indicador deslizante da opção 1 (320 ms), e Home/Configurações usam fade com deslize de 28 px. A assinatura compacta está nos cabeçalhos Home e Minha conta; detalhes preservam retorno e título. Ver [[ADR-046 - Transicoes curtas no stack de projetos mobile]]. Exports web/Android e QA no navegador aprovados; avaliação nativa permanece pendente.


## Correção de compatibilidade Expo Go — 2026-10-09

A entrega inicial do stack JS usava uma dependência transitiva de gestos sem verificar a ABI do Expo Go. A resolução 3.3.0 chamava um método ausente no módulo nativo 2.x, causando o crash iOS reportado pelo usuário. O pacote `react-native-gesture-handler` agora é dependência direta em `~2.32.0`, alinhada ao `expo/bundledNativeModules.json` instalado e à [documentação SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/). Manifesto e lockfile foram atualizados pelo instalador, substituindo a afirmação anterior de que bastava a dependência transitiva. Navegadores e transições continuam iguais. Export iOS e QA estático/web passaram; confirmação no aparelho pendente. Os avisos de `expo-notifications` no Expo Go são separados desta falha e não foram ocultados.

O preview web também passou a declarar `react-native-web` (`^0.21.2`), instalado pelo Expo após o export detectar módulo ausente na reinstalação. Antes era um peer opcional presente em `node_modules`, sem dependência direta. Essa correção permite repetir o QA existente e usar o script web de forma reproduzível; não introduz uma nova plataforma distribuída.
