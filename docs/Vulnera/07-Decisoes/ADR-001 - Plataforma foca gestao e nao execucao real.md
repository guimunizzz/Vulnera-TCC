---
type: decisao
tags: [decision]
status: vigente
codigo: ADR-001
---

# ADR-001 - Plataforma foca gestao e nao execucao real

> [!warning] Tensão registrada em 2026-09-10 — status **não** alterado
> O módulo [[DAST]] (Fases 9 / 9.1 / 9.2, set/2026) **executa** varredura dinâmica de verdade: sobe um container do OWASP ZAP e roda spider + active scan contra uma URL informada pelo pentester. Isso é execução real, ainda que contida (um alvo por scan, ferramenta única, container descartável por execução, exclusivo de PENTESTER/ADMIN, com bloqueio de SSRF contra loopback e faixas privadas).
> Nenhum dos ADRs do módulo ([[ADR-028 - Execucao do ZAP via Docker spawn]], [[ADR-029 - DAST como silo]], [[ADR-030 - Execucao assincrona sem fila]], [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]], [[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]]) revisou esta decisão explicitamente. O status continua `vigente` porque rebaixá-lo é decisão do Rafael, não do agente que documentou a divergência (CLAUDE.md §0.2 S3) — mas ela está aqui para não passar em branco na banca (R5).

## Contexto
O projeto trata de segurança ofensiva e gestão de findings, mas precisa manter foco acadêmico, ético e operacional.

## Decisão
O Vulnera será uma plataforma de gestão, acompanhamento e entrega de análises, não uma plataforma de execução real de ataques.

## Consequências
- reduz risco ético e técnico
- mantém aderência ao escopo do TCC
- preserva clareza para a banca

## Relacionado
[[Visao Geral]]
[[Fora do Escopo]]
[[DAST]]
[[ADR-028 - Execucao do ZAP via Docker spawn]]