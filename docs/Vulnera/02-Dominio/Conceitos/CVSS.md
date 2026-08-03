---
type: conceito
tags: [domain, seguranca]
status: ativo
---

# CVSS

## Definição
CVSS (Common Vulnerability Scoring System) é o padrão internacional para quantificar a severidade de vulnerabilidades de segurança. Mantido pelo FIRST (Forum of Incident Response and Security Teams), é adotado pelo NVD/NIST como referência global.

O Vulnera usa **CVSS v3.1**.

## Como funciona

O score CVSS v3.1 é calculado a partir de um **vetor base** com 8 métricas:

| Métrica | Sigla | Valores possíveis |
|---|---|---|
| Attack Vector | AV | Network (N), Adjacent (A), Local (L), Physical (P) |
| Attack Complexity | AC | Low (L), High (H) |
| Privileges Required | PR | None (N), Low (L), High (H) |
| User Interaction | UI | None (N), Required (R) |
| Scope | S | Unchanged (U), Changed (C) |
| Confidentiality | C | None (N), Low (L), High (H) |
| Integrity | I | None (N), Low (L), High (H) |
| Availability | A | None (N), Low (L), High (H) |

Exemplo de vetor: `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`

## Mapeamento de score para severidade

| Score | Severidade |
|---|---|
| 0.0 | None |
| 0.1 – 3.9 | Low |
| 4.0 – 6.9 | Medium |
| 7.0 – 8.9 | High |
| 9.0 – 10.0 | Critical |

## Uso no Vulnera

- todo finding (`Vulnerability`) tem um `cvss_vector` e um `cvss_score` calculado
- `severity_calculated` é derivado automaticamente do score
- `severity_final` pode ser diferente se o analista aplicar override justificado
- o campo `severity_override_reason` é obrigatório quando `severity_final ≠ severity_calculated`

Ver: [[RN10 - Severidade via CVSS com override justificado]]

## Links relacionados
[[Vulnerability]]
[[RN10 - Severidade via CVSS com override justificado]]
[[Enum - VulnerabilityStatus]]
[[OWASP Top 10]]
[[Findings]]
