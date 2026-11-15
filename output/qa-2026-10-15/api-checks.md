<!-- Registra os checks automatizados e HTTP da API para apoiar Rafael na preparação da apresentação; consumido pelo relatório de QA desta sessão. -->
# QA da API — 2026-10-15

## Isolamento confirmado

- Lidos `PRD_VIVO.md`, `AGENTS.md`, `app/api/prisma/schema.prisma`, configuração Jest e `tests/setup.ts` antes da execução.
- `.env.test`: `localhost:3307/vulnera_test`, `NODE_ENV=test`, bcrypt cost 4, uploads e relatórios em diretórios de teste, `DAST_FORCE_SIMULATE=true`.
- `DATABASE_URL` foi explicitamente carregado do `.env.test` no processo dos testes, com guarda que exige host `localhost`, porta `3307` e pathname exato `/vulnera_test` antes de iniciar Jest. Nenhuma credencial é incluída neste relatório.
- `vulnera_test` já existia, com 26 tabelas e 14 migrations aplicadas, assim como a demo. Nenhuma migration, reset, seed, instalação ou alteração de schema foi executada.
- Conexões observadas no MySQL durante a suíte apontavam para `vulnera_test`. A limpeza automática dos casos de integração afeta somente esse banco de teste.
- DAST de integração é simulado; unitários de runner usam mocks de Docker/HTTP. Nenhum scan real ou externo foi solicitado por estes checks.

## Resultado

| Check | Resultado |
| --- | --- |
| `npm run build` em `app/api` | Aprovado, exit 0 |
| `npm run lint` em `app/api` | Reprovado, 2 erros preexistentes de import não usado |
| Jest completo serial com cobertura | **643/643 testes aprovados, 43/43 suítes, zero pendentes** |
| Smoke HTTP somente leitura da stack real | 10/10 aprovados |

O `npm run check` global não pode ser declarado verde: o script para no lint antes de rodar testes. O build e a suíte foram executados separadamente para obter evidência independente.

Resultado final recuperado de `api-jest-results.json`: `success=true`, sem testes ou suítes reprovados. Cobertura total: **91,79% linhas, 87,95% statements, 94,65% funções e 74,36% branches**. Nos 27 arquivos de services, a cobertura ponderada de linhas foi **94,34% (2085/2210)**. Dois arquivos continuam abaixo de 80% de linhas individualmente: `owasp-sync.service.ts` (62,5%) e `rate-limit.service.ts` (78%). A média não equivale a cumprir o limiar em todos os arquivos.

## Falha reproduzida

**API-LINT-01 — gate global da API continua vermelho.** Em `app/api/src/services/vulnerability.service.ts:45`, os imports `UserEntity` e `UserResponseDTO` violam `@typescript-eslint/no-unused-vars`. Reproduzir com `npm run lint` em `app/api`. O problema já constava no PRD de sessões anteriores. Não bloqueou o build nem foi alterado neste QA.

## Smoke HTTP da stack real

| Request | Esperado | Observado |
| --- | --- | --- |
| `GET /api/health` | 200 | 200, status `ok` |
| `GET /api/plans` | 200 público | 200 |
| `GET /api/companies` sem token | 401 | 401 |
| `GET /api/applications` sem token | 401 | 401 |
| `GET /api/projects` sem token | 401 | 401 |
| `GET /api/vulnerabilities` sem token | 401 | 401 |
| `GET /api/reports` sem token | 401 | 401 |
| `GET /api/dast/scans` sem token | 401 | 401 |
| `GET /api/not-a-route-qa` | 404 | 404 |
| `OPTIONS /api/plans`, Origin `http://localhost:8086` | 204 + CORS para origem web | 204, origem correta |

Essas chamadas não criam nem alteram registros de negócio. Os fluxos autenticados da stack real são responsabilidade do relatório paralelo desta sessão.

## Escopo da suíte existente

43 arquivos: 31 de integração e 12 de unidade. Integração cobre auth, usuários, planos, empresas, assinaturas, aplicações/contexto de risco, projetos/membros, findings/pesquisa/hardening/push, comentários, evidências, métricas, relatórios, maturidade, notificações, limites de tráfego, SLA, VRS, aceite de risco, responsável de remediação, playbooks, buscas salvas, tenancy e DAST/triagem/promoção.

## Limites

- Não foram executados testes de carga k6 nem scans reais.
- Testes de integração validam API e banco isolado; a inspeção de aparência e navegação fica nos relatórios de navegador/web.
- Nenhuma alteração de código, dependência, lockfile ou documentação viva feita por este agente.
