# Paleta grafite — 2026-10-08

Base e superfícies autenticadas em grafite, reflexos/bordas neutros e textos brancos/cinza. O violeta fica nas ações, foco, seleção e marca; brilho violeta máximo do fundo reduzido de 0,24 para 0,065. Barra inferior, avatares, ícones de apoio e metadados deixam de tingir toda a tela.

Em revisão usa azul; Pendente usa amarelo; Concluído mantém verde. As cores de severidade existentes foram preservadas. O anel CVSS acompanha `severityCalculated`, confirmada no schema, enquanto o badge usa `severityFinal`: override manual não altera a interpretação técnica da nota. Nota ausente mantém somente o trilho neutro.

Liquid glass, tamanhos, navegação, animações e movimento reduzido preservados. Nenhuma mudança na API, banco, autenticação, login, dependências, lockfiles ou `.env` nesta task. Sem commit/push.

## Arquivos de aplicação

- `src/theme/workspace.ts`
- `src/components/workspace-motion.tsx`
- `src/components/workspace-ui.tsx`
- `src/components/badge.tsx`
- `src/components/cvss-ring.tsx`
- `src/components/project-card.tsx`
- `src/components/finding-row.tsx`
- `src/components/evidence-carousel.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/home/index.tsx`
- `app/(tabs)/home/project/[id].tsx`
- `app/(tabs)/home/finding/[id].tsx`
- `app/(tabs)/settings.tsx`

## Validação

Typecheck, lint e exports web/Android aprovados. Preview visual 6/6 com Home em 320/390 px, projeto, cinco níveis de CVSS/nota ausente, detalhe em 320 px, evidências, comentários, perfil e compressão/retorno do botão. Nenhuma exceção JavaScript. Capturas `palette-*.png` e resultado `palette-preview-results.json` nesta pasta; scripts/capturas são auxiliares, não usados pelo app.

Docker/API estavam desligados. O script isolado `palette-preview.mjs` intercepta as chamadas no navegador com fixtures e não persiste dados ou tokens reais. Esta validação comprova apresentação e interação no preview, sem comprovar API real, blur nativo, desempenho ou leitura de tela em aparelho físico. Dois percursos iniciais do script foram corrigidos para considerar a pilha de navegação conservada ao trocar de aba; não foi necessária correção no aplicativo.

PRD/backlog são preparados separadamente e só aplicados com permissão de escrita fora de `app/mobile`, preservando as alterações anteriores.
