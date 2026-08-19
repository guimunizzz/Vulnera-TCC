# SETUP ONLY — preparar o Code Review multiagente do Vulnera

Execute **somente** a preparação. NÃO inicie a revisão do código, NÃO percorra a Checklist Mestre item a item e NÃO gere findings funcionais.

## Objetivo

Instalar/mesclar o harness contido em `vulnera_codex_code_review_bootstrap/templates/`, criar `docs/code-review/` e deixar a revisão pronta para ser iniciada em uma sessão separada.

## Regras obrigatórias

1. Confirme que está na raiz de um repositório Git.
2. Registre branch atual, commit atual e `git status --short`.
3. A branch esperada é `dev`.
4. Não faça checkout/switch/reset/clean automaticamente.
5. Não altere código-fonte, testes, migrations, configuração de produto ou documentação canônica.
6. Na etapa SETUP, as únicas escritas fora de `docs/code-review/**` permitidas são a instalação controlada do harness:
   - `.codex/agents/*.toml`
   - `.agents/skills/vulnera-implementation-audit/**`
   - merge mínimo de `[agents]` em `.codex/config.toml`
7. Não sobrescreva silenciosamente arquivos existentes. Compare, preserve e registre conflitos.
8. Não instale dependências, não rode migrations/seeds/build/testes e não faça chamadas externas.

## Estrutura a instalar

Copie/mescle:

- `templates/codex/agents/*.toml` → `.codex/agents/*.toml`
- `templates/skill/vulnera-implementation-audit/**` → `.agents/skills/vulnera-implementation-audit/**`
- `templates/docs/code-review/README.md` → `docs/code-review/README.md`
- `templates/docs/code-review/MASTER_CHECKLIST.md` → `docs/code-review/MASTER_CHECKLIST.md`

A Checklist Mestre fornecida neste pacote é a fonte de entrada da revisão. Depois de instalada, não marque checkboxes nem reescreva requisitos.

Crie:

- `docs/code-review/state/`
- `docs/code-review/findings/`
- `docs/code-review/reviews/`
- `docs/code-review/runtime/`

## `.codex/config.toml`

Preserve todo conteúdo existente e garanta somente estes valores sob `[agents]`:

```toml
[agents]
enabled = true
max_concurrent_threads_per_session = 6
default_subagent_model = "gpt-5.6-luna"
default_subagent_reasoning_effort = "high"
```

Não duplique a tabela TOML.

## Pré-indexação determinística da Checklist

Execute:

```bash
python vulnera_codex_code_review_bootstrap/scripts/build_requirement_seeds.py --repo .
```

Se necessário, use `python3`.

Esse passo NÃO audita o código. Ele apenas transforma os checkboxes da Checklist em sementes rastreáveis e gera:

- `docs/code-review/state/REQUIREMENT_SEEDS.jsonl`
- `docs/code-review/state/CHECKLIST_MANIFEST.md`

## Validação

Execute:

```bash
python vulnera_codex_code_review_bootstrap/scripts/validate_review_setup.py --repo . --write-report
```

Se necessário, use `python3`.

## Saída obrigatória

Crie/complete `docs/code-review/SETUP_REPORT.md` contendo:

- branch e commit;
- working tree;
- arquivos do harness instalados/preservados;
- conflitos;
- agentes encontrados;
- Skill encontrada;
- hash e estatísticas da Checklist;
- resultado da pré-indexação;
- resultado do validador;
- `READY_FOR_REVIEW: YES|NO`.

## Encerramento

Quando terminar o SETUP, pare.

Não invoque `$vulnera-implementation-audit`.
Não inicie agentes de auditoria.
Não revise o código.
