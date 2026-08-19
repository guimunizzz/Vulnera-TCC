# START CODE REVIEW — Vulnera

Inicie a revisão formal do estado atual do Vulnera usando explicitamente:

`$vulnera-implementation-audit`

## Antes de qualquer análise

1. Leia `docs/code-review/SETUP_REPORT.md`.
2. Execute novamente:
   `python vulnera_codex_code_review_bootstrap/scripts/validate_review_setup.py --repo .`
3. Confirme `READY_FOR_REVIEW: YES`.
4. Confirme branch `dev` e registre o commit auditado.
5. Leia a política de não-mutação da Skill.
6. Confirme que toda escrita da revisão ficará em `docs/code-review/**`.

Se qualquer gate falhar, pare e liste somente os bloqueios.

## Regra absoluta

Esta execução é **somente revisão e mapeamento**.

- Não corrigir código.
- Não refatorar.
- Não alterar testes.
- Não alterar migrations/schema.
- Não alterar configuração.
- Não instalar dependências.
- Não executar comandos mutáveis.
- Não produzir patch/diff de implementação.

Quando uma conclusão exigir runtime mutável, use `NOT_VALIDATED` e descreva o que deveria ser validado.

## Entregas finais

- `docs/code-review/VULNERA_IMPLEMENTATION_AUDIT.md`
- `docs/code-review/RECOMMENDATIONS.md`

O segundo arquivo deve conter sugestões finais e backlog priorizado, sem aplicar qualquer correção.
