<!-- Relatório da correção do contexto; documenta reprodução, regressão e tenancy para revisão humana. -->
# Edição do contexto de risco por CLIENT — 2026-10-06

Branch: `codex/fix-client-risk-context`, criada de `origin/dev` em `0638c47` (PR #55 já integrada).

## Causa e correção

Não havia `disabled` ou `readOnly` no formulário. No Chrome, o painel do `Select` customizado estava fora do `Dialog`, em `z-index: 40`, abaixo do modal em `z-index: 60`; ele não recebia o clique. Os inputs dos donos aceitaram preenchimento no cenário reproduzido. A incompatibilidade entre Select com portal e Dialog já está registrada em L-19 no backlog.

Os três seletores foram substituídos por `<select>` nativo com `CLASSES_CONTROLE`, seguindo a solução já usada na seleção de empresa. Os inputs, switch, payload, cache, handlers e API foram preservados. Não há mudança de schema, migration, dependências ou permissões. A infraestrutura global de overlays continua fora do escopo.

## Critérios

| Critério | Evidência |
| --- | --- |
| Criticidade, ambiente e sensibilidade editáveis | Chrome: clique no controle, seleção por teclado e payload correto; APP-CTX-01 |
| Donos de negócio e técnico editáveis | Inputs preenchidos; APP-CTX-01 confirma ambos |
| Exposta à internet continua funcionando | Switch e payload booleano; estado preservado na reabertura |
| Salvar e reabrir com os seis valores | APP-CTX-01 + Chrome com fixtures HTTP; CTX-04 faz PUT e GET na API/banco reais de teste |
| Isolamento entre empresas | TEN-29 tenta enviar todos os campos de outra Company; recebe 403 e banco permanece inalterado |
| Ownership existente | CTX-05/06/07 preservam redução somente por ADMIN, MEMBER sem alteração de risco e PENTESTER sem edição |
| Regressão | APP-CTX-01 falha no código anterior e passa na correção; APP-CTX-02 bloqueia redução e APP-CTX-03 mantém dados após FORBIDDEN |

Regra D2 preservada: CLIENT OWNER pode aumentar os fatores de risco; reduções exigem ADMIN. CLIENT MEMBER mantém suas restrições existentes. A correção habilita a interação dos campos sem ampliar alçadas.

## Validação executada

- Web focal: **24/24** em `applications-page.test.tsx`.
- API focal: **12/12**, executada em contêiner separado com fonte/testes da branch montados somente para leitura e destino confirmado como **vulnera_test**. Banco de demonstração não alterado.
- Chrome no build de produção (`vite preview`): clique nos três seletores, seleção por teclado, seis campos, um PUT, reabertura, bloqueio de redução, desktop escuro e 375 px sem overflow; fixtures HTTP isoladas, sem editar registros de demonstração. Fontes empacotadas no build; CSP configurada para a mesma origem API do build.
- [Reprodução do select atrás do modal](client-risk-context/before-select.png), [diagnóstico](client-risk-context/before.json).
- [Formulário reaberto](client-risk-context/after-reopened-dark.png), [mobile](client-risk-context/after-mobile.png), [payload e resultado](client-risk-context/after.json).

Web final: `npm run check -- -- --maxWorkers=1 --silent` **aprovado, 340/340 em 30 suítes (204,92 s)**; lint 0 erros/9 avisos anteriores, tokens 66/66 AA nos dois temas. Build TypeScript/Vite aprovado, com aviso anterior de chunks grandes. `npm run check` da API para nos dois imports não usados preexistentes em `vulnerability.service.ts:45` (`UserEntity` e `UserResponseDTO`); os 12 testes acima foram executados separadamente. Nenhum código de produção da API foi alterado. Suíte API completa não repetida nesta correção frontend.

Tentativas ambientais intermediárias: Jest no host não localizou testes no worktree com dependências compartilhadas; o contêiner inicial precisou do `jest.config.ts` montado e da serialização de env sem aspas literais. A execução final com configuração correta passou 12/12. Uma asserção Web foi ajustada ao aviso existente, que usa `role=status`, em vez de presumir `role=alert`.
