# Refinamento de suavidade do mobile — 2026-10-06/07

A apresentação autenticada foi refinada na branch `mobile/api`, após o usuário considerar a revisão anterior pesada e estática. A implementação está concluída; a última repetição visual e a avaliação física continuam pendentes conforme os limites abaixo.

- Home compacta, com projetos visíveis mais cedo e resumo baseado em dados reais.
- Títulos de 28 px, seções de 18 px, corpo de 15 px e metadados de 12–13 px; margens de 20 px, intervalos de 8/12/16/20 px. Texto continua aceitando escala do sistema.
- Controles com áreas de toque mínimas de 48 dp. Toque comprime até 1,8%, em 100 ms, com retorno amortecido sem ultrapassar a escala inicial.
- Entradas com opacidade e deslocamento de 10 px em 280 ms; atrasos limitados a 180 ms. Seleção de chips e abas muda em 220 ms.
- Navegação nativa com transição de 280 ms e gesto de retorno; abas principais usam fade. Expansão da confirmação de logout tem transição de layout curta.
- Atmosfera de gradientes SVG com ciclo lento e deslocamento limitado; rolagem atualiza um valor Reanimated, sem renderização React por frame. Movimento para ao perder foco ou entrar em segundo plano.
- Preferência por movimento reduzido observada ao vivo e compartilhada por contexto. Sem animação do blur por frame nem novas dependências.
- Android 12+ usa um BlurTargetView de fundo por tela, compartilhado com cartões e barra. Android antigo mantém transparência. Login, tokens compartilhados antigos e integração funcional da API permanecem preservados.
- O último ajuste compactou o bloco CVSS e colocou as três abas do finding na largura disponível, evitando ocultar Comentários em 320 px.

Referências para as decisões de dimensão e movimento: [áreas de toque Android](https://support.google.com/accessibility/android/answer/7101858), [movimento Apple](https://developer.apple.com/design/human-interface-guidelines/motion), [blur Android no Expo](https://docs.expo.dev/versions/latest/sdk/blur-view/). A escala tipográfica e as durações são escolhas desta implementação; não se declara certificação completa de acessibilidade.

## Verificação

| Verificação | Resultado e limite |
| --- | --- |
| Typecheck e lint finais | Aprovados após o último ajuste compacto |
| Export web final | Aprovado; serve apenas como preview de QA |
| Export Android | Aprovado na revisão anterior ao ajuste compacto; a execução final não teve conclusão confirmada após interrupção |
| Fluxos com API real | 14/14 na revisão anterior ao ajuste compacto: navegação, filtro, paginação, recuperação de evidência, conta e logout |
| Movimento e proporção no Chrome | 9/9 na mesma revisão: fundo, compressão/retorno, pausa ao trocar de aba, controles, rolagem, movimento reduzido ao vivo, 320/390/430 px e execução sem exceções |
| Repetição da última revisão | Parou na abertura do Chrome com timeout, antes de carregar o app; não foi contabilizada como aprovada |
| Aparelho físico | Pendente: sensação da navegação, blur, gestos e desempenho nativo; não se afirma 60 fps |

Evidências: [UI](./ui-smoke-results.json), [movimento e medidas](./motion-smoke-results.json), [Home](./mobile-soft-home-390.png), [projeto em 320 px](./mobile-soft-project-320.png), [finding em 320 px](./mobile-soft-finding-320.png) e [conta](./mobile-account-390.png). As capturas são da revisão anterior ao último ajuste compacto das abas/CVSS; essa diferença está registrada, não ocultada.

## Arquivos principais e documentação

Novos componentes `workspace-motion.tsx`, `workspace-blur.tsx` e `cvss-ring.tsx`; refinados `workspace-ui.tsx`, `workspace.ts`, cartões, badges, TabIcon e as quatro telas/layouts autenticados. O contexto de blur não muda contratos ou autorização. A apresentação estática anterior foi substituída; seus registros funcionais continuam em [relatório anterior](./mobile-refactor-report.md) e ADR-045.

PRD, BACKLOG, histórico do ROADMAP, Changelog e Mobile Expo têm adições preparadas em [diff revisável](./docs-review-soft/review.diff). Não há commit, push ou PR nesta rodada. Alterações anteriores do usuário, exclusão de `.env.example` e arquivos do web foram preservados.
