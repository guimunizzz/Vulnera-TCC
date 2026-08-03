---
type: conceito
tags: [domain, seguranca]
status: ativo
---

# OWASP Top 10

## Definição
O OWASP Top 10 é uma lista dos 10 riscos de segurança mais críticos em aplicações web, publicada e mantida pelo OWASP (Open Web Application Security Project). É atualizada periodicamente com base em dados reais de incidentes.

O Vulnera referencia a edição **OWASP Top 10 2021**.

## As 10 categorias (2021)

| Código | Categoria |
|---|---|
| A01 | Broken Access Control |
| A02 | Cryptographic Failures |
| A03 | Injection |
| A04 | Insecure Design |
| A05 | Security Misconfiguration |
| A06 | Vulnerable and Outdated Components |
| A07 | Identification and Authentication Failures |
| A08 | Software and Data Integrity Failures |
| A09 | Security Logging and Monitoring Failures |
| A10 | Server-Side Request Forgery (SSRF) |

## Uso no Vulnera

- todo finding (`Vulnerability`) deve ter uma `owasp_category` como classificação obrigatória (`A01`..`A10`)
- a categoria OWASP é um dos campos sugeridos pela IA Gemini ao pré-preencher um finding
- relatórios técnicos agrupam findings por categoria OWASP para facilitar priorização

Ver: [[RN11 - Toda Vulnerability deve ter categoria OWASP]]

## Relação com CVSS

O CVSS quantifica a **severidade técnica** da vulnerabilidade.
O OWASP Top 10 classifica a **categoria** do risco.

São complementares — um finding pode ser OWASP A03 (Injection) com CVSS 9.8 (Critical).

## Links relacionados
[[Vulnerability]]
[[RN11 - Toda Vulnerability deve ter categoria OWASP]]
[[CVSS]]
[[Findings]]
[[Integracao Gemini]]
