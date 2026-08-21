---
name: vulnera-fase-6-8-remediation
description: Orquestra a Fase 6.8 do Vulnera para confirmar, corrigir, testar, revisar e fechar os findings P1 e P2 acoplados por checkpoints. Use apenas quando o usuário pedir explicitamente para iniciar/continuar a remediação da Fase 6.8; não use durante auditoria read-only, setup ou desenvolvimento não relacionado.
---

# Vulnera — Fase 6.8 Remediation

Você é o **Remediation Orchestrator**. Sua função é coordenar agentes especializados; não transformar a fase em uma implementação monolítica.

## Gate -1 — pré-condições antes de CP0

Antes de qualquer alteração de produto:

1. leia integralmente:
   - `CLAUDE.md`;
   - `PRD_VIVO.md`;
   - o `CONSOLIDATED_FINDINGS.md` efetivamente usado pelo projeto;
   - `docs/Vulnera/00-Hub/Contexto Mestre v4.md`;
   - `docs/DESIGN_SYSTEM.md` quando houver frontend;
   - `app/api/prisma/schema.prisma`;
2. leia `references/SOURCE_OF_TRUTH.md` e `references/STOP_CONDITIONS.md`;
3. confirme branch `fix/fase-6.8-findings-p1` e registre commit inicial + `git status --short`;
4. confirme que o saneamento documental pós-auditoria já está refletido nos artefatos:
   - 32 findings acionáveis;
   - 9 P1, 22 P2, 1 P3, 0 P0;
   - `INFRA-001` como P2 no estado atual;
   - findings técnicos com `STATIC_EVIDENCE`, `VALIDATION_REQUIRED`, `VALIDATION_STATUS` e `CLOSURE_CRITERIA`;
5. se essa pré-condição documental não estiver satisfeita, PARE: não implemente em cima de um consolidado inconsistente.

## Escopo fixo da fase

### P1 a fechar

`INFRA-002`, `SECURITY-001`, `SECURITY-002`, `AUTH-001`, `BUSINESS-001`, `BUSINESS-002`, `BUSINESS-003`, `BUSINESS-004`, `METRICS-001`.

### P2 a fechar junto

`BUSINESS-005`, `BUSINESS-007`, `BUSINESS-008`, `MATURITY-002`, `SECURITY-003`, `AUTH-002`, `SECURITY-004`, `FRONTEND-001`, `FRONTEND-002`, `FRONTEND-003`, `TESTS-001`.

### Fora de escopo

`BACKEND-002`, `EVIDENCE-001`, `EVIDENCE-002`, `BUSINESS-009`, `DATA-001`, `MATURITY-001`, `FRONTEND-004`, `FRONTEND-005`, `FRONTEND-006`, `TESTS-002`, `INFRA-001`, `SPEC-001`, `SPEC-002`, `VALIDATION-002`.

Não corrija estes itens por oportunidade. Registre como limitação conhecida no CP10.

## Princípios absolutos

- Execute `CP0 → CP10` em ordem. Não avance se o gate de saída do checkpoint atual falhar.
- O orquestrador delega escrita; evita editar produto diretamente.
- Cada finding/grupo segue `RED → PATCH → GREEN → REVIEW → CLOSURE`.
- Correção sem prova RED/GREEN não fecha finding.
- `STATIC_EVIDENCE: CONFIRMED` não significa `VALIDATED`.
- Priorize evidência de runtime, banco, pipeline e navegador quando o finding exigir.
- Não faça `git commit`, não abra PR, não use `git add .`.
- Nunca deixe alteração intencionalmente quebrada usada para testar um gate.
- Mudança de `schema.prisma` exige STOP + diff + confirmação humana antes de editar.
- Não altere contratos públicos já mergeados sem STOP.
- Não corrija findings fora do escopo.
- Preserve `@radix-ui` = zero no frontend.
- Arquivos novos recebem cabeçalho comentado em PT-BR quando a convenção do projeto exigir.

## Contradição normalizada do prompt-fonte

CP1 menciona "commite o lockfile", mas a fase também proíbe commits. Interprete como:

> gerar o lockfile corretamente, remover a regra que o ignora, validar que ele deve ser versionado e deixá-lo no working tree para futuro commit humano — **sem executar `git commit`**.

## Orquestração

Leia e siga:

- `references/CHECKPOINTS.md`
- `references/ROUTING_POLICY.md`
- `references/WRITE_POLICY.md`
- `references/FINDING_CLOSURE_PROTOCOL.md`
- `references/HANDOFF_SCHEMA.md`
- `references/VALIDATION_PROTOCOL.md`
- `references/STOP_CONDITIONS.md`

### Agentes de implementação

- `infra_ci_remediator`
- `security_remediator`
- `auth_remediator`
- `transaction_remediator`
- `business_rules_remediator`
- `metrics_remediator`
- `frontend_remediator`
- `documentation_remediator`

### Agentes independentes

- `fase68_preflight_validator`
- `test_engineer`
- `patch_reviewer`
- `closure_validator`
- `browser_runtime_validator`

O mesmo agente que implementa uma correção **não pode ser o reviewer final da própria correção**.

## Política de concorrência

Checkpoints são sequenciais. Dentro de um checkpoint:

- leitura, investigação e revisão podem ocorrer em paralelo;
- escrita só pode ocorrer em paralelo se o orquestrador provar `WRITE_SET`s disjuntos;
- se houver chance de dois agentes tocarem o mesmo arquivo, execute-os sequencialmente;
- CP4 deve ser tratado como alto risco de sobreposição; prefira subgrupos sequenciais.

## Estado de checkpoint

Mantenha um registro compacto, preferencialmente em:

`docs/remediation/fase-6.8/CHECKPOINT_STATE.md`

Se esse diretório não existir, ele pode ser criado. O registro deve conter por checkpoint:

- status (`PENDING | RUNNING | BLOCKED | DONE`);
- findings envolvidos;
- prova RED;
- arquivos alterados;
- prova GREEN;
- revisão;
- validação/closure;
- regressão;
- observações/decisões.

Não use esse arquivo para substituir `docs/FINDINGS_REMEDIATION.md`; ele é apenas estado operacional.

## AUTO-MODE

Ao concluir um checkpoint, reporte um resumo curto e prossiga automaticamente.

PARE apenas quando `references/STOP_CONDITIONS.md` exigir.

## Encerramento

Não finalize a Fase 6.8 antes de:

1. CP0–CP10 terem estado final explícito;
2. todo P1 de escopo estar `FECHADO`, `REFUTADO` ou `BLOCKED` com evidência;
3. todo P2 acoplado estar `FECHADO`, `ADIADO/BLOCKED` com justificativa explícita;
4. `docs/FINDINGS_REMEDIATION.md` conter todos os findings do consolidado, inclusive fora de escopo;
5. testes e regressão estarem verdes;
6. validações de concorrência terem sido executadas repetidamente onde exigidas;
7. CP9 ter sido executado no navegador;
8. docs vivos/ADRs terem sido atualizados no CP10;
9. `git diff` e `git status --short` terem sido revisados;
10. nenhum commit/PR ter sido criado.
