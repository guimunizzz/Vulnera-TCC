# Vulnera — Code Review Workspace

Esta pasta é o único local autorizado para escrita durante a auditoria/revisão do código.

## Regras

- `MASTER_CHECKLIST.md` é uma entrada imutável da auditoria. Não marcar checkboxes e não reescrever requisitos.
- Agentes especialistas trabalham em modo somente leitura e retornam findings ao orquestrador.
- O orquestrador pode criar/atualizar arquivos apenas dentro de `docs/code-review/`.
- Nenhuma correção, refactor, migration, alteração de teste ou mudança de configuração do produto deve ser feita.
- Não gerar patches/diffs de implementação durante a revisão.
- Quando não houver evidência suficiente, registrar `NOT_VALIDATED`.
- Sugestões de correção devem aparecer apenas no relatório final e em `RECOMMENDATIONS.md`.

## Estrutura esperada

- `SETUP_REPORT.md` — diagnóstico do harness e commit/branch auditados.
- `MASTER_CHECKLIST.md` — Checklist Mestre original, preservada.
- `state/` — mapa de arquitetura, registry e manifesto.
- `findings/` — findings consolidados e, se útil, recortes por domínio.
- `reviews/` — validação ponta a ponta, cross-review e revisão adversarial.
- `runtime/` — somente evidências de runtime previamente existentes ou explicitamente autorizadas.
- `VULNERA_IMPLEMENTATION_AUDIT.md` — relatório principal.
- `RECOMMENDATIONS.md` — sugestões finais priorizadas, sem modificar código.
