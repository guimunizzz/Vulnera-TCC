# Vulnera — Registro de Cross-review

## Convergências

- Security, backend e business confirmaram mass assignment em updates de Application/Project.
- Backend, business e data confirmaram as corridas de Subscription/Application/Project e ausência do gate ACTIVE de Project.
- Business, backend e flow confirmaram ausência de atomicidade entre mutação e AuditLog.
- Data/infra e tests confirmaram CI sem lockfile.
- Frontend e flow confirmaram busca/aging; flow ampliou a análise para incoerência global de filtros em METRICS-001.

## Adjudicações

- Company/companyRole: mantido P2 após separar violação intra-tenant de exfiltração cross-tenant não comprovada.
- INFRA-001: rebaixado a P2 porque o Compose principal fornece `PORT`.
- Enterprise 999: refutado como bug e movido para decisão de especificação.
- Maturity level: mantido P2 porque ADR-018 vigente é contradita por service, persistência, UI e PDF.
- Nenhum P0 sustentado.

## Restrições

Toda confirmação é estática. Concorrência, exploração, performance, UI, PDF, device e integrações externas exigem runtime autorizado separado.

