# Política de escrita

A Fase 6.8 é uma fase de implementação, portanto escrita é permitida, porém estritamente roteada.

## Orquestrador

O orquestrador coordena e revisa. Evite editar produto diretamente; delegue a um agente de domínio para manter autoria e revisão independentes.

## Agentes de domínio

Podem editar apenas o escopo recebido no handoff. Antes de escrever, devem declarar:

- `READ_SET`: arquivos/símbolos investigados;
- `WRITE_SET`: arquivos que pretendem alterar;
- `FINDINGS`: IDs cobertos.

Se o `WRITE_SET` expandir materialmente, devolva ao orquestrador antes de continuar.

## Test Engineer

É o dono preferencial dos arquivos de teste. Deve criar a prova RED antes do patch quando viável e reexecutar após o patch.

## Reviewers/Validators

`patch_reviewer`, `closure_validator` e `browser_runtime_validator` são independentes e não devem corrigir código durante a revisão. Eles retornam falhas ao orquestrador.

## Proibições

- `git commit`;
- abrir PR;
- `git reset --hard`, `git clean`, rebase/merge destrutivo;
- corrigir findings fora do escopo por oportunidade;
- editar `schema.prisma` sem STOP + aprovação;
- esconder falhas apagando testes ou reduzindo assertions;
- reduzir coverage threshold para fazer pipeline passar;
- introduzir `@radix-ui` no frontend;
- deixar secrets reais em arquivo versionável.

## Alterações temporárias para provar gates

É permitido introduzir falha temporária controlada para provar que um gate falha, desde que:

1. o estado anterior seja conhecido;
2. a mudança seja mínima;
3. o gate realmente falhe;
4. a mudança seja revertida imediatamente;
5. `git diff` confirme que nenhum artefato temporário ficou no patch final.
