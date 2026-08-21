# Vulnera — Bootstrap da Skill de Remediação Fase 6.8

Este pacote transforma o prompt `PROMPT_FASE_6.8_FINDINGS.md` em uma execução multiagente orientada por checkpoints.

## Objetivo

Executar a remediação dos 9 P1 e dos P2 explicitamente acoplados à mesma causa raiz, preservando:

- checkpoints CP0 → CP10 em ordem;
- confirmação runtime antes de corrigir;
- teste RED antes do patch e GREEN depois;
- separação entre implementação, teste, revisão do patch e validação de fechamento;
- critérios explícitos de parada;
- ausência de `git commit`/PR;
- rastreabilidade por Finding ID;
- validação final em navegador, regressão e documentação.

## Estrutura

- `SETUP_PROMPT.md`: instala/mescla a Skill e os custom agents.
- `START_REMEDIATION_PROMPT.md`: prompt curto para iniciar a Fase 6.8 no Codex.
- `templates/skill/vulnera-fase-6-8-remediation/`: Skill principal.
- `templates/codex/agents/`: agentes especializados.
- `templates/codex/config.fragment.toml`: fragmento mínimo de configuração multiagente.

## Decisão de normalização importante

O prompt-fonte contém uma contradição: CP1 diz para "commitar o lockfile", enquanto as restrições globais dizem `NÃO commite, NÃO abra PR`.

A Skill resolve isso assim:

> gerar/versionar o lockfile no working tree, validar que deve ser incluído no futuro commit, mas **não executar `git commit`** nesta fase.

A regra global prevalece.

## Fluxo operacional

```text
MAIN ORCHESTRATOR (Sol/high)
        │
        ├─ Gate -1: sanidade documental + branch
        │
        ├─ CP0: verdade do baseline
        │
        ├─ CP1..CP8: remediação por domínio
        │      └─ para cada finding/grupo:
        │           Test Engineer (RED)
        │           → Remediator (patch)
        │           → Test Engineer (GREEN)
        │           → Patch Reviewer
        │           → Closure Validator
        │
        ├─ CP9: Browser/Runtime Validator
        │      └─ falha volta ao agente responsável
        │
        └─ CP10: Documentation Remediator
               → Closure Validator final
```

## Regra de concorrência

Até 6 threads podem existir, porém agentes com escrita não devem rodar em paralelo quando os seus `WRITE_SET`s puderem se sobrepor. Paralelismo é preferido para leitura/revisão e para tarefas de escrita em áreas comprovadamente disjuntas.
