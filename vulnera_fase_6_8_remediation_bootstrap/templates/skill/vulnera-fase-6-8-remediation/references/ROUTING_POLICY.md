# Routing dos agentes

## Model tiers

- **Luna/high**: coleta mecânica, inventário ou tarefas muito estruturadas.
- **Terra/high**: implementação técnica localizada, CI, frontend, testes e documentação técnica.
- **Sol/xhigh**: segurança, autenticação, concorrência/transações, regras complexas, SQL cross-domain, patch review e closure.

A thread principal/orquestrador deve preferir **Sol/high**.

## Mapa por checkpoint

| Checkpoint | Agente principal | Apoio obrigatório |
|---|---|---|
| Gate -1 / CP0 | `fase68_preflight_validator` | domain readers conforme os 5 findings |
| CP1 | `infra_ci_remediator` | `test_engineer`, `patch_reviewer`, `closure_validator` |
| CP2 | `security_remediator` | `test_engineer`, `patch_reviewer`, `closure_validator` |
| CP3 | `security_remediator` + `auth_remediator` | test/review/closure |
| CP4 | `transaction_remediator` | `test_engineer`, `patch_reviewer`, `closure_validator` |
| CP5 | `business_rules_remediator` | test/review/closure |
| CP6 | `metrics_remediator` | test/review/closure |
| CP7 | `frontend_remediator` | test/review/closure |
| CP8 | `test_engineer` | `patch_reviewer`, `closure_validator` |
| CP9 | `browser_runtime_validator` | agentes responsáveis por regressões; closure |
| CP10 | `documentation_remediator` | `closure_validator` final |

## CP0 em paralelo

Amostra sugerida em paralelo, somente leitura/investigação:

- SECURITY-001 → `security_remediator` em modo confirm-only;
- AUTH-001 → `auth_remediator` em modo confirm-only;
- BUSINESS-003 → `business_rules_remediator` em modo confirm-only;
- INFRA-002 → `infra_ci_remediator` em modo confirm-only;
- METRICS-001 → `metrics_remediator` em modo confirm-only.

Nenhum deles escreve no CP0.

## CP4 — subgrupos sequenciais

Para reduzir conflito de arquivos e raciocínio:

1. `AUTH-001` (refresh token);
2. `BUSINESS-002 + BUSINESS-005` (subscription/onboarding);
3. `BUSINESS-007 + BUSINESS-008` (limits/project uniqueness/transition);
4. `BUSINESS-004` (mutação + AuditLog);
5. `MATURITY-002` (batch de scores).

Cada subgrupo completa RED→PATCH→GREEN antes do próximo quando houver sobreposição provável.

## Regra de escalonamento

Se reviewer e remediator divergirem em finding crítico, envie somente aquele finding + arquivos relevantes ao `closure_validator`/Sol xhigh. Não reanalise o projeto inteiro.
