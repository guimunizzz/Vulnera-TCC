<!-- Descrição do PR da correção visual dos cards; consumida na publicação para dev. -->
Na aba **Visão geral** do detalhe de um projeto, os contêineres de **Metadados** e **Pentesters atribuídos** tinham borda, mas nenhum background. As linhas e ondas decorativas atravessavam os cards e competiam com o conteúdo.

Os dois blocos agora usam o componente `Card` existente, com `bg-surface` opaco, `border-subtle`, `shadow-raised` e títulos acessíveis. A decoração continua visível ao redor dos cards, e a hierarquia entre labels secundários (`text-fg-muted`) e valores (`text-fg`) foi preservada.

## Escopo

- Superfície dos dois cards na aba Visão geral.
- Tokens e componente existentes do design system, sem cores hardcoded ou CSS exclusivo.
- Registros de conclusão e validação no `PRD_VIVO.md` e `docs/BACKLOG.md`.
- Sem alteração de API, regras de negócio, permissões, dados, entidades ou fluxos de criação/edição.

O PR foi preparado sobre `dev` e contém somente a correção dos cards e seus registros documentais. A atualização anterior do README não faz parte desta comparação.

## Validação

- `npm run check -- -- --maxWorkers=1 --silent`: **337/337 testes em 30 suítes**.
- Lint: **0 erros**, com **9 avisos preexistentes**.
- Auditoria de tokens: **66/66 pares** atendem WCAG AA nos temas escuro e claro.
- Build TypeScript + Vite: **aprovado**, com aviso preexistente de tamanho dos chunks.
- Chrome no build de produção: tema escuro em desktop (1440 px) e mobile (375 px), estado vazio de pentesters e tema claro inspecionados.
- Superfície **100% opaca** nos dois cards; contraste no tema escuro de **16,60:1** nos valores e **6,90:1** nos labels secundários.
- Decoração preservada, sem overflow horizontal mobile e sem erros JavaScript.

A validação visual usou respostas HTTP de fixtures locais; não exercitou banco/API reais nem ações de adicionar/remover pentesters. O código Web após a reaplicação sobre `dev` tem exatamente a mesma árvore Git validada antes da publicação.

## Critérios de aceitação

- [x] Linhas/ondas não interferem na leitura interna dos cards.
- [x] Metadados e Pentesters atribuídos têm superfície opaca padronizada.
- [x] Textos secundários e valores principais permanecem distinguíveis.
- [x] Aparência consistente com o design system e background decorativo preservado.
- [x] Alteração exclusivamente visual, validada no tema escuro.
