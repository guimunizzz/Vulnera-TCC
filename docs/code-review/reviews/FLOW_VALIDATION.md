# Vulnera — Validação Cruzada de Fluxos

## Escopo

Validação estática dos 76 itens S34 e 24 gates S35 no baseline `dev@49cac59122bc9d4e05e491339e1f4eb80aad838d`. Runtime, banco, containers, browser, device e integrações externas não foram executados.

## Resultado por fluxo

| Fluxo | Estado | Findings/limitações determinantes |
|---|---|---|
| S34.1 Público → assinatura | PARTIAL/DIVERGENT | BUSINESS-001/002/005; Company/Subscription não atômicos; pendência não persistente na UI |
| S34.2 Application → Project | DIVERGENT | SECURITY-001, BUSINESS-003/007/008 |
| S34.3 Finding | PARTIAL | BUSINESS-004/009, EVIDENCE-001, FRONTEND-003; upload runtime não validado |
| S34.4 Push | PARTIAL/NOT_VALIDATED | código de registro/envio presente; device/entrega não validados; navegação por push ausente |
| S34.5 Reports | PARTIAL/NOT_VALIDATED | authz/elegibilidade estáticas; PDF real não validado; metadata/AuditLog não atômicos |
| S34.6 Métricas | DIVERGENT | FRONTEND-001/002/006 e METRICS-001 |
| S34.7 Maturidade | DIVERGENT | MATURITY-001/002 e FRONTEND-003 |
| S34.8 Demo final | NOT_VALIDATED com bloqueios | INFRA-001/002; Sonar pendente; Compose/demo não executados |

## Adjudicação dos P1 da Fase 1

Todos foram confirmados: SECURITY-001/002, AUTH-001, BUSINESS-001/002/003/004 e INFRA-001/002. Nenhum foi refutado ou rebaixado pela validação de fluxo. O cross-review acrescentou METRICS-001 (P1) e FRONTEND-006 (P2).

## Resolução de S34

- R001–R003: fluxo público/registro presente estaticamente.
- R004–R012: `RESOLVED_BY` S07 + BUSINESS-001/002/004/005; parcial/divergente.
- R013–R020: `RESOLVED_BY` S08/S09 + SECURITY-001/BUSINESS-003/007/008; divergente, membership estático presente.
- R021–R034: `RESOLVED_BY` S10–S13 + BUSINESS-004/009/EVIDENCE-001; parcial; IO real não validado.
- R035–R039: `RESOLVED_BY` S19/S20/VALIDATION-001; device/entrega não validados e navegação por push ausente.
- R040–R048: `RESOLVED_BY` S14/BUSINESS-004/VALIDATION-001; authz presente, PDF real não validado.
- R049–R058: `RESOLVED_BY` S16/FRONTEND-001/002/006/METRICS-001; divergente.
- R059–R065: `RESOLVED_BY` S21/MATURITY-001/002/FRONTEND-003; divergente e visual/PDF não validado.
- R066–R076: `RESOLVED_BY` S27–S29/INFRA-001/002/VALIDATION-001/SPEC-001; não validado com bloqueios estáticos.

## Resolução de S35

- R001–R007: parcial por SECURITY-001/002/003/004, AUTH-001/002, BUSINESS-009 e execução TEN ausente.
- R008–R010: implementações estáticas localizadas; paridade, upload e PDFs em runtime não validados.
- R011: divergente por FRONTEND-001/002/006 e METRICS-001.
- R012: divergente por MATURITY-001/002/FRONTEND-003.
- R013–R017: estruturas mobile/design/a11y localizadas; device/visual/leitor de tela não validados.
- R018–R020: pipeline não reproduzível (INFRA-002), Sonar pendente, ZAP somente como evidência preexistente.
- R021–R023: documentação/demo parcialmente sincronizadas e runtime não validado.
- R024: `NOT_READY` pelos P1 consolidados.

## Cross-review adicional

- Confirmados: SECURITY-003, BUSINESS-005/007/008, EVIDENCE-001, BUSINESS-009, MATURITY-001/002, FRONTEND-001/002/003, TESTS-002 e VALIDATION-001.
- Não refutados, mas não revalidados nessa passagem dirigida: AUTH-002, SECURITY-004, BACKEND-001/002, BUSINESS-006, EVIDENCE-002, DATA-001, FRONTEND-004/005, TESTS-001 e VALIDATION-002.

