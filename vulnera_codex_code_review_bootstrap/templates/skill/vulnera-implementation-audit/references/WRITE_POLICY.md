# Política de Escrita e Não-Mutação

## Regra absoluta da revisão

A revisão é **somente leitura sobre o produto**.

Nenhum agente pode corrigir, refatorar, formatar, implementar ou alterar arquivos do Vulnera.

## Único local autorizado para escrita

Durante a revisão, o agente principal/orquestrador pode escrever **somente** em:

`docs/code-review/**`

Agentes especialistas permanecem configurados com `sandbox_mode = "read-only"` e devem retornar resultados ao orquestrador, que persiste os artefatos quando necessário.

## Escritas proibidas

Não escrever em qualquer outro caminho do repositório, inclusive:

- `app/**`, `src/**`, `packages/**`, `prisma/**`, `database/**`, `infra/**`;
- arquivos de configuração do produto;
- migrations, seeds, fixtures e snapshots;
- testes;
- documentação canônica fora de `docs/code-review/**`;
- `.env`, `.env.*`, secrets;
- lockfiles;
- workflows;
- `AGENTS.md`;
- `.codex/**` e `.agents/**` durante a fase de auditoria (essas pastas só podem ser preparadas no SETUP).

## Operações proibidas durante a auditoria

- `git commit`, `git add`, `git reset`, `git checkout`, `git switch`, `git clean`, rebase/merge;
- install/update de dependências;
- formatters ou linters com `--fix`;
- migrations, seed ou comandos que alterem banco;
- atualização de snapshots;
- geração de código;
- comandos que criem artefatos no source tree;
- chamadas a serviços externos com efeito colateral.

## Runtime

A auditoria é estática por padrão.

Se uma conclusão exigir execução que possa alterar filesystem, banco, serviço externo ou estado do projeto, **não execute**. Registre `NOT_VALIDATED` e descreva o teste necessário.

Comandos estritamente de leitura são permitidos, por exemplo: `git status`, `git log`, `git diff`, `git ls-files`, `rg`, `grep`, `find`, leitura de arquivos e inspeção de configuração.

## Sugestões

Sugestões e ações recomendadas são permitidas apenas como texto em:

- `docs/code-review/VULNERA_IMPLEMENTATION_AUDIT.md`
- `docs/code-review/RECOMMENDATIONS.md`

Não produzir patch aplicável automaticamente.
