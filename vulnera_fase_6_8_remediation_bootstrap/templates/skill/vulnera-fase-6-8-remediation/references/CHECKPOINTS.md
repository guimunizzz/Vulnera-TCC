# Checkpoints normalizados — Fase 6.8

## Gate -1 — saneamento e contexto

**Owner:** Orchestrator + `fase68_preflight_validator`.

Entrada: docs obrigatórios + consolidado saneado + branch correta.

Gate de saída: `READY_FOR_CP0: YES`.

---

## CP0 — Estabelecer a verdade

**Owner:** `fase68_preflight_validator`.

1. Validar Docker/Compose, API check e web build.
2. Medir testes/cobertura.
3. Confirmar em paralelo, sem escrever: SECURITY-001, AUTH-001, BUSINESS-003, INFRA-002, METRICS-001.
4. Cada confirmação deve citar arquivo/símbolo/linha.
5. Se houver divergência material, STOP.

**Gate:** baseline classificado e cinco findings `CONFIRMED` ou `REFUTED` com evidência.

---

## CP1 — INFRA-002 / pipeline

**Owner:** `infra_ci_remediator`.

- gerar lockfile(s) por `npm install`, nunca editar à mão;
- remover regra indevida de ignore;
- não executar `git commit`;
- reproduzir `npm ci → lint → build → migrate → test → coverage`;
- provar que gate falha quando intencionalmente quebrado e volta a passar após reversão.

**Protocolo:** RED/negative-gate → patch → GREEN pipeline → review → closure.

**Gate:** instalação determinística + pipeline completo reproduzível.

---

## CP2 — SECURITY-001 / mass assignment

**Owner:** `security_remediator`.

- `test_engineer` cria testes RED para campos protegidos;
- allowlist explícita em controllers PATCH/update;
- defesa em profundidade no repository, sem spread arbitrário;
- Project com `{status:"COMPLETED"}` não muda status nem gera AuditLog via update genérico.

Confirme campos protegidos contra schema real antes de implementar.

**Gate:** testes de todas as entidades alvo + patch review + closure.

---

## CP3 — Segredos, autorização, auth

**Owners:** `security_remediator`, `auth_remediator`.

Ordem recomendada para evitar sobreposição:

1. SECURITY-002 — remover fallback JWT; falhar fechado; Compose/env docs seguros;
2. SECURITY-003 — reconsultar ator no banco em operações ADMIN sensíveis conforme finding;
3. AUTH-002 — normalizar e-mail leitura/escrita + 409 `USER_ALREADY_EXISTS`;
4. SECURITY-004 — rate limit em login/register/refresh, resposta 429 `RATE_LIMITED`.

Cada item tem RED/GREEN próprio e revisão independente.

**Gate:** todos os quatro IDs com closure explícita ou STOP/BLOCKED justificado.

---

## CP4 — Atomicidade

**Owner:** `transaction_remediator`.

Findings: AUTH-001, BUSINESS-002, BUSINESS-004, BUSINESS-005, BUSINESS-007, BUSINESS-008, MATURITY-002.

Aplicar transação a operações compostas e locking/consume-condicional onde transação isolada não garante invariante.

Subgrupos sequenciais conforme ROUTING_POLICY.

`test_engineer` cria concorrência real com `Promise.all` e repetições.

**Schema:** se qualquer solução exigir alterar `schema.prisma`, STOP antes de editar.

**Gate:** invariantes provadas sob concorrência + AuditLog atômico + review + closure por ID.

---

## CP5 — Regras de negócio

**Owner:** `business_rules_remediator`.

- BUSINESS-001: `Plan.isActive` na solicitação e aprovação; `PLAN_NOT_AVAILABLE` 422.
- BUSINESS-003: Subscription ACTIVE + `maxProjects` + lock/transação do CP4; erros 422 definidos.

A ressalva de especificação de `maxProjects` deve permanecer configurável/documentada; se o comportamento real exigir decisão humana incompatível, STOP.

**Gate:** RED/GREEN para ambos + review/closure.

---

## CP6 — METRICS-001

**Owner:** `metrics_remediator`.

- um conjunto coerente de filtros para todos os cálculos;
- SQL cru parametrizado com Prisma, sem concatenação;
- KPI, severidade, aging, MTTR, reabertura, séries/comparison respeitam filtros equivalentes;
- teste de coerência de populações;
- browser será confirmado novamente no CP9.

**Gate:** testes verdes + review + closure técnico; validação browser pode manter `PARTIALLY_VALIDATED` até CP9 se exigida pelo consolidado.

---

## CP7 — Frontend visível

**Owner:** `frontend_remediator`.

- FRONTEND-001: busca funcional ou removida;
- FRONTEND-002: aging bucket → predicado correto;
- FRONTEND-003: error separado de loading/empty + recuperação;
- seguir design system da Fase 6.5;
- zero Radix.

**Gate:** testes/frontend build verdes + review; closure browser final no CP9 quando aplicável.

---

## CP8 — TESTS-001

**Owner:** `test_engineer`.

- `coverageThreshold` no Jest, pelo menos para services conforme requisito;
- pipeline falha abaixo do threshold;
- não reduzir threshold para acomodar cobertura insuficiente;
- regressão completa verde.

**Gate:** cobertura imposta de verdade e pipeline comprova o gate.

---

## CP9 — Validação em navegador

**Owner:** `browser_runtime_validator`.

Executar os 9 cenários de `VALIDATION_PROTOCOL.md`.

Para qualquer falha:

1. reabrir finding/checkpoint responsável;
2. remediator corrige;
3. test engineer prova;
4. reviewer revisa;
5. repetir cenário do browser.

**Gate:** 9/9 executados com resultado explícito; bloqueios ambientais devidamente declarados.

---

## CP10 — Documentação e rastreabilidade

**Owner:** `documentation_remediator`.

1. criar/atualizar `docs/FINDINGS_REMEDIATION.md` com **todos** os findings do consolidado;
2. cada linha contém ID, severidade, status, correção, teste/prova e commit (`N/A — no commit in phase` enquanto a fase proíbe commit);
3. criar ADR-030, ADR-031, ADR-032 conforme prompt e convenção do projeto;
4. atualizar `CLAUDE.md` anti-patterns/checklist de CRUD;
5. registrar limitações conhecidas fora de escopo com motivo;
6. atualizar docs vivos indicados pela fase;
7. não reescrever findings históricos como se nunca tivessem existido.

`closure_validator` faz reconciliação final de IDs/status/provas.

**Gate final:** rastreabilidade total + worktree revisado + nenhum commit/PR criado.
