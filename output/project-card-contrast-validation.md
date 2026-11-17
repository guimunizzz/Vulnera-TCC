<!-- Relatório da revisão visual dos cards; documenta evidências para revisão humana. -->
# Contraste dos cards do projeto — 2026-10-06

Branch: `codex/fix-project-card-contrast`, criada de `origin/main` em `a73a926`.

Os dois contêineres da aba Visão geral não tinham background (alpha 0). Foram substituídos pelo `Card` existente, com `bg-surface`, `border-subtle`, `shadow-raised` e títulos acessíveis. Os tokens `text-fg` e `text-fg-muted`, conteúdo, controles, handlers e queries permanecem iguais. Nenhum estilo global, API, dado, permissão ou fluxo foi alterado.

## Evidências visuais

Chrome headless, página React real (capturas finais do build de produção servido por `vite preview`), respostas HTTP de fixtures locais interceptadas pelo script `project-card-contrast-visual.cjs`. API/banco reais não utilizados. A prévia de desenvolvimento bloqueou fontes externas ao worktree pelo allowlist do Vite; as capturas finais foram refeitas no build com fontes empacotadas. Inspeção visual das capturas confirmou que a decoração permanece fora dos cards e não atravessa suas superfícies.

- [Antes, escuro desktop](project-card-contrast/before-dark-desktop.png)
- [Depois, escuro desktop](project-card-contrast/after-dark-desktop.png)
- [Depois, escuro mobile 375 px](project-card-contrast/after-dark-mobile.png)
- [Estado vazio](project-card-contrast/after-dark-empty.png)
- [Tema claro](project-card-contrast/after-light-desktop.png)
- [Medições do navegador](project-card-contrast/after-metrics.json)

Ambos os cards têm alpha 255/255 (100% opaco). Contraste no tema escuro: valores **16,60:1**, labels secundários **6,90:1**. Sem overflow horizontal em 375 px; nenhum erro JavaScript. As verificações bloqueiam requests diferentes de GET, sem executar adicionar/remover pentester ou transição de status.

## Ambiente

O host tinha pacotes ausentes. `npm ci` não se aplica porque o repositório ignora lockfiles. `npm install` falhou com `edgesOut` no npm 10, problema já descrito no Dockerfile. Docker Desktop não iniciou por erro de socket `sailor-ingest.sock`. Nenhum desses problemas foi corrigido no produto. Para validar, foram usadas dependências locais já disponíveis e arquivos oficiais dos pacotes ausentes, em pastas ignoradas, sem alterar manifestos/lockfile versionado.

`npm run check -- -- --maxWorkers=1 --silent`: **aprovado**, 337/337 testes em 30 suítes (242,51 s). Lint: **0 erros, 9 avisos anteriores**. Tokens: **66/66 pares AA** nos dois temas. Build TypeScript + Vite: **aprovado**, com aviso anterior de chunks grandes. As mensagens de `scrollTo` não implementado no jsdom não causaram falhas.
