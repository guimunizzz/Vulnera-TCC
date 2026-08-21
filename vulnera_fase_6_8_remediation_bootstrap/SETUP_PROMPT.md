# SETUP ONLY — instalar a Skill de Remediação Fase 6.8

Execute apenas o setup do harness. NÃO inicie CP0 nem altere código do Vulnera.

## Objetivo

Instalar/mesclar os arquivos deste pacote no repositório atual.

## Regras

1. Confirme que está na raiz de um repositório Git.
2. Registre branch, commit e `git status --short`.
3. Não faça checkout/switch/reset/clean automaticamente.
4. Não altere código, testes, migrations, schema, dependências ou documentação do produto durante o setup.
5. Não sobrescreva silenciosamente custom agents/skills existentes; compare e preserve.
6. Não execute `git commit` nem abra PR.

## Instalação

Copie/mescle:

- `vulnera_fase_6_8_remediation_bootstrap/templates/codex/agents/*.toml` → `.codex/agents/*.toml`
- `vulnera_fase_6_8_remediation_bootstrap/templates/skill/vulnera-fase-6-8-remediation/**` → `.agents/skills/vulnera-fase-6-8-remediation/**`

Mescle em `.codex/config.toml`, sem duplicar `[agents]`:

```toml
[agents]
enabled = true
max_concurrent_threads_per_session = 6
default_subagent_model = "gpt-5.6-luna"
default_subagent_reasoning_effort = "high"
```

## Verificação

Confirme a existência dos agentes:

- `fase68_preflight_validator`
- `infra_ci_remediator`
- `security_remediator`
- `auth_remediator`
- `transaction_remediator`
- `business_rules_remediator`
- `metrics_remediator`
- `frontend_remediator`
- `test_engineer`
- `patch_reviewer`
- `closure_validator`
- `browser_runtime_validator`
- `documentation_remediator`

Confirme também:

- `.agents/skills/vulnera-fase-6-8-remediation/SKILL.md`
- referências da Skill presentes.

## Encerramento

Ao terminar, pare e reporte apenas:

- branch/commit atual;
- arquivos instalados/mesclados;
- conflitos preservados;
- agentes encontrados;
- Skill encontrada;
- `READY_FOR_FASE_6_8: YES|NO`;
- blockers.

NÃO invoque a Skill neste setup.
