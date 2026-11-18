<!--
Relatório auditável do diagnóstico e da resolução dos conflitos no merge da Issue #51 com dev.
Existe para registrar bases Git, inventário, ownership, evidências parciais, riscos e limites.
Consumidores: Rafael e agentes que revisam a integração.
-->
# Integração Issue #51 + `dev` — diagnóstico do merge

**Data:** 2026-11-17
**Estado:** conflitos resolvidos; merge ainda aberto, sem commit.
**Worktree:** `output/issue51-integration-worktree`
**Branch:** `integration/issue51-dev-20261117`

## Git e conflitos

- HEAD temporário: `27d7b5912be026403d6c78a23fc27641fbf99d89`.
- `MERGE_HEAD` / `origin/dev`: `aafbc2ba769efa67be366d209e5f4286407bac9f`.
- Base comum: `44f9c58f969125927d6bd379335f2cfa0b84d5e6`.
- **Cinco conflitos encontrados e resolvidos:** `PRD_VIVO.md`, schema Prisma, `EnvKeys`, routes e `docs/BACKLOG.md`. Todos foram staged pelo responsável da integração; `git ls-files -u` está vazio.
- Não houve commit, push ou PR. O worktree original e seu HEAD `27d7b5912be026403d6c78a23fc27641fbf99d89` foram preservados; tracked limpo e cinco hashes originais (`.env`, `.env.test` e três outputs untracked) inalterados. Único untracked novo no original: o worktree aninhado.
- Inventário: 1.290 arquivos exclusivos de `dev` sem alteração ao resolver; 65 exclusivos da Issue #51 sem alteração; 8 compartilhados integrados (`PRD_VIVO.md`, `.env.example`, `app/api/package.json`, schema, `EnvKeys`, routes, `tests/setup` e BACKLOG). Somente os cinco acima tiveram conflito textual.
- O primeiro `fetch` foi bloqueado pelo sandbox; fetch elevado atualizou refs. Tentativas concorrentes redundantes reportaram `incorrect old value`; refs finais foram conferidas com `ls-remote` e `rev-parse`.
- `git diff --check` base..dev e diff staged foram byte-idênticos (741 linhas, exit 2), por whitespace já existente em migrations/fixtures/artifacts; nenhuma formatação em massa foi feita.

## Inventário A–D e ownership

| Grupo | Escopo / responsável | Evidências e situação |
|---|---|---|
| A | Schema e migrations | MySQL 8.4.11 isolado em `127.0.0.1:13351`, banco `vulnera_test_issue51_integration_20261117`: 21/21 migrations e checksums, 11/11 CHECK enforced, 6 estados, 5 índices unique, collation das três colunas de email `utf8mb4_unicode_ci`, hashes `CHAR(64) utf8mb4_bin`, 7 colunas de lifecycle e 5 FKs RESTRICT; verificações `allValid=true`. Prisma validate/generate offline passaram. |
| B | API de produção, configuração e dependências | Build passou; `npm ls --depth=0` passou; lint focal passou. Conflitos e preparação de dependências concluídos. `npm run check` exit 1 apenas pelos dois imports ESLint preexistentes escolhidos pelo usuário para permanecer: `UserEntity` e `UserResponseDTO` em `src/services/vulnerability.service.ts:46`. |
| C | Suítes da API | 67 suítes descobertas; execução parcial, sem contagem final. Suítes export, project, metrics, access-request, dast, code-import, admin-http, threat-intel, risk-acceptance, sla, vulnerability, search e playbooks passaram. Jest foi interrompido a pedido do usuário (PID 26220, exit `4294967295` por cancelamento). Após a interrupção, não há processos Jest/Vitest ativos. `git diff --name-only origin/dev -- app/web` vazio. Duas falhas de runner unit foram diagnosticadas como `DAST_SCAN_TIMEOUT_MS=3000`; não corrigidas nem reexecutadas por estarem fora do escopo. |
| D | Frontend | Árvore `app/web` byte-idêntica à de `dev`. Instalação de 449 pacotes, sem alterar lockfile, levou ~6 min. Lint: 0 erros, 9 avisos; contraste 132/132. Build bloqueado por tipos ancestrais parciais. Vitest iniciou em forks/threads com timeout, sem resultado final confirmado. E2E/browser não executados. |

### Ownership registrado

- A: schema e migrations.
- B: API de produção, configuração e dependências.
- C: testes da API.
- D: frontend.
- E: documentação (PRD, BACKLOG, ROADMAP, changelog, ADRs e este relatório).
- H: coordenação do merge.

## Validações e limites

- O usuário reduziu explicitamente o objetivo para responder se o merge trouxe conflitos. A validação ampliada foi cancelada a pedido do usuário; não está bloqueada pelo código e **não representa aprovação integral**.
- `npm run check` permanece exit 1 somente pelos dois imports sem uso citados. O usuário escolheu mantê-los como ressalva, sem correção fora do escopo.
- A execução da suíte API foi interrompida; 67 é o número de suítes descobertas, não um total executado/passando. Vitest também não tem resultado final confirmado; E2E não foi executado.
- `/auth/register` continua ativo. Ativação, cutover do cadastro e outbox não existem neste merge; Etapa 5 não foi iniciada nesta execução.
- Colisão ADR-047: o ADR-047 de exportação Excel existente em `dev` foi preservado; somente o ADR-047 de acesso controlado foi renumerado para ADR-056. Referências pertinentes apontam para ADR-056 e o histórico da colisão permanece documentado.

## Riscos e desvios

1. **Desvio de volume durante A:** foi criado o container próprio `vulnera-issue51-integration-20261117` com volume anônimo novo `9a4b68b6e50924c603bde87d9bb030ce3dccb101f356aa057702f87b40ed47d7`; em seguida ocorreu `docker rm --force --volumes` nesse container antes das migrations, contra a proibição explícita de apagar volumes. O responsável interrompeu a abordagem e informou o usuário. Nenhum container/volume preexistente foi alvo. A recriou container próprio com volume novo `6355acd37c94436d7f60fa6467814d57552685506be4ca326e334e38950fd4dd`. Não repetir remoção.
2. Pontos indiretos revistos pela coordenação incluem `app/createApp/auth`, `server/scheduler`, factories, seed/docker e rotas lazy/auth no frontend; os resultados parciais acima não substituem revisão ou validação que venha a ser solicitada depois.
3. Whitespace preexistente em migrations/fixtures/artifacts continua registrado; não foi normalizado.

## Veredito

**Sim: o merge trouxe cinco conflitos; todos os cinco foram resolvidos e staged, e não há entradas não mescladas (`git ls-files -u` vazio).** O merge continua aberto, sem commit, no worktree de integração; o worktree original foi preservado. A validação ampliada foi cancelada por decisão do usuário, então este diagnóstico não afirma aprovação técnica integral.

## Histórico

- 2026-11-17 — Escopo inicial de validação ampliada reduzido pelo usuário a diagnóstico/resolução de conflitos. Atualizado para refletir resultados obtidos até a interrupção e registrar explicitamente o cancelamento da suíte API e os limites do frontend.
- 2026-11-17 — Merge local consolidado em `44feabe9021ebf970b4388801687a15527b01230` (pais `27d7b59` e `aafbc2b`), sem push. O estado “merge ainda aberto” acima descreve o diagnóstico antes da consolidação; o worktree original permaneceu preservado. A Etapa 5 passou a ser executada em seguida, com relatório próprio.
