---
type: moc
tags: [core, domain]
status: ativo
---

# MOC - Dominio

## Entidades
[[Company]]
[[User]]
[[Plan]]
[[Subscription]]
[[Application]]
[[Project]]
[[ProjectMember]]
[[Vulnerability]]
[[Evidence]]
[[VulnerabilityComment]]
[[MaturityAssessment]]
[[MaturityDomain]]
[[MaturityControl]]
[[MaturityScore]]
[[Report]]
[[Notification]]
[[AuditLog]]
[[PasswordResetToken]]
[[RefreshToken]]

## Conceitos
[[CVSS]]
[[OWASP Top 10]]
[[Maturidade]]
[[Remediation Service]]
[[Multi-tenancy por escopo]]
[[Ownership]]
[[Auditoria]]
[[Client-side PDF]]

## Permissões
[[Roles]]
[[CompanyRole]]
[[Matriz de Permissoes]]
[[Regras de Ownership]]

## Máquinas de estado
[[Maquina - Project]]
[[Maquina - Vulnerability]]
[[Maquina - Subscription]]

## Regras de negócio críticas
[[RN03 - Limite de aplicacoes por plano]]
[[RN05 - Project 1 para 1 com Application]]
[[RN07 - Projeto exige assinatura ativa]]
[[RN10 - Severidade via CVSS com override justificado]]
[[RN12 - Transicoes seguem maquina de estados]]
[[RN13 - Fluxo com remediation service]]
[[RN14 - Fluxo sem remediation service]]
[[RN16 - Cliente so ve dados da propria Company]]
[[RN17 - Pentester so ve Projects atribuidos]]
[[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]]

## Modelagem de dados
[[MER Conceitual]]
[[Entidades e Relacionamentos]]
[[Campos Criticos]]
[[Convenios de Nome]]
[[Enum - Roles]]
[[Enum - CompanyRole]]
[[Enum - ProjectStatus]]
[[Enum - VulnerabilityStatus]]
[[Enum - SubscriptionStatus]]
[[Enum - AnalysisType e Level]]

## Fora do escopo (histórico)
[[ChatMessage]] · [[SupportTicket]] · [[Maquina - SupportTicket]] · [[Enum - TicketStatus]]
