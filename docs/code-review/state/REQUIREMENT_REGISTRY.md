# Vulnera — Requirement Registry

## Integridade do registro

- Checklist: 3.911 linhas, 1.619 checkboxes, todos desmarcados.
- Seeds: 1.619 linhas e 1.619 IDs únicos; todas as linhas apontam para checkbox válido.
- SHA-256 normalizado em LF: `c4c81ed6fa31e7232d5707c94d9054957c9f8c33925ae57e5900f700a857bc0d`.
- Seções 0–36 possuem requisitos; 37–38 são referência estrutural sem seeds.
- Marcadores preservados: 13 ambiguidades, 48 conflitos e 45 itens fora do MVP.

## Classificação de auditabilidade

| Categoria | Total |
|---|---:|
| `CROSS_LAYER` | 699 |
| `RUNTIME_REQUIRED` | 292 |
| `CODE_STATIC` | 276 |
| `PROCESS_DOCUMENTATION` | 82 |
| `MANUAL_VISUAL` | 64 |
| `DERIVED_ACCEPTANCE` | 100 |
| `OUT_OF_MVP` | 45 |
| `SPEC_CONFLICT` | 48 |
| `SPEC_AMBIGUITY` | 13 |
| **Total** | **1.619** |

## Distribuição primária por domínio

| Domínio | Total |
|---|---:|
| business | 338 |
| frontend | 284 |
| security | 229 |
| process | 208 |
| tests | 127 |
| backend | 110 |
| data | 107 |
| infra | 102 |
| e2e | 76 |
| architecture | 38 |
| **Total** | **1.619** |

## Roteamento da Fase 1

- Orquestrador/indexador: S00, S01, S30, S32, S33 e S35.
- Arquitetura: S03.
- Data/infra: S04, S05, S26, S27 e S29.
- Segurança: S02, S06, S11, S23 e edges S31-R001..R014/R035..R043.
- Regras de negócio: S07..S10, S12..S13, S21..S22 e edges S31-R015..R034.
- Frontend/UX: S14..S20, S21..S22 e S31-R044..R054.
- Backend: cross-review de S06..S14, S20, S22 e S24.
- Testes: S24..S26 e runtime/processo de S28.
- Fluxos: S34; critérios de pronto S35 são derivados.
- Processo/manual: S28, S32 e S36.

## Canonicalização

Requisitos primários canônicos estão em S02–S29. Itens de edge case, aceite e pronto não devem criar findings duplicados:

- S31-R001..R007 → S06/S24 (auth/sessão).
- S31-R008..R014 → S02/S08..S11/S23 (tenancy/ownership).
- S31-R015..R021 → S07 (Plan/Subscription).
- S31-R022..R026 → S09/S14 (Project/Reports).
- S31-R027..R034 → S10/S13 (Vulnerability/CVSS/auditoria).
- S31-R035..R043 → S11/S23 (upload/Evidence).
- S31-R044..R054 → S13/S16..S18/S24 (métricas/UI/falhas).
- S34-R001..R076 → findings canônicos dos fluxos correspondentes.
- S35-R001..R024 → gates derivados de segurança, produto, UX, CI e processo.

## Marcadores explícitos

- `SPEC_AMBIGUITY`: S00-R008; S02-R034; S05-R034; S05-R103; S07-R028; S15-R018; S18-R041; S21-R033; S22-R001; S23-R031; S24-R013; S26-R009; S33-R035.
- `SPEC_CONFLICT`: S00-R007; S03-R037..R038; S05-R039; S05-R099..R100; S06-R038; S07-R057; S07-R060; S09-R012; S09-R016; S10-R073; S11-R044; S20-R019; S33-R001..R034.
- `OUT_OF_MVP`: S04-R034..R037; S05-R022; S06-R039..R041; S07-R061; S10-R070..R072; S14-R061..R063; S15-R016..R017; S19-R039; S26-R029..R031; S30-R001..R024.

## Regras de adjudicação

- Presença de código não equivale a implementação.
- `RUNTIME_REQUIRED`/`MANUAL_VISUAL` sem evidência preexistente terminam `NOT_VALIDATED`.
- `PROCESS_DOCUMENTATION`, `OUT_OF_MVP`, ambiguidades e conflitos mantêm rastreabilidade, mas não viram pendência funcional do MVP por omissão.
- Itens derivados usam `CANONICAL_REQUIREMENT_ID`/`RESOLVED_BY`.
- Severidade só será atribuída após evidência de impacto; marcadores de especificação usam `NONE` salvo risco técnico independente.

