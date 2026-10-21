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


## Movimento e vidro — refinamento de 2026-10-06

A apresentação visual anterior foi substituída pelo refinamento documentado em `app/mobile/output/mobile-softness-report.md`. A área autenticada compartilha preferências de movimento reduzido por contexto, observando alterações em tempo de execução. Reanimated move opacidade/transformação com deslocamentos pequenos; o blur não é animado por frame. A atmosfera para quando a tela perde foco ou o app entra em segundo plano; rolagem atualiza apenas um valor compartilhado, sem setState por frame. Um BlurTargetView por tela contém somente o fundo, é reutilizado pelos cartões e pela barra e evita capturar os próprios vidros. A tela ativa registra sua referência, e o cleanup de uma tela anterior não remove a referência nova. Android 12+ usa `dimezisBlurViewSdk31Plus`; versões anteriores usam a transparência de fallback. No Android a barra desfoca a atmosfera, não o texto dos cartões que passa atrás dela; o tint garante legibilidade. iOS/web mantêm o blur correspondente à plataforma. Login, API, DTOs, cache e autorização continuam iguais à entrega funcional anterior. Sem novas dependências. Validação física nativa continua pendente.
