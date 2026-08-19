# Vulnera — Auditoria do Estado Atual

## 1. Resumo executivo

Esta auditoria examinou o baseline funcional `dev@49cac59122bc9d4e05e491339e1f4eb80aad838d` por inspeção estática multiagente. A branch `code-review` foi usada somente para os artefatos desta revisão. Nenhum código, teste, migration, configuração ou documento canônico do produto foi alterado.

O produto possui implementação substancial e conectada: autenticação com refresh, roles, Company/Plan/Subscription, Applications, Projects/membership, CVSS/OWASP/findings, upload endurecido, comentários, relatórios client-side, dashboards, analytics, mobile CLIENT, Expo Push e maturidade. Ainda assim, o baseline não deve ser considerado pronto: existem nove findings P1 confirmados, inclusive bypass de campos protegidos em updates, defaults JWT previsíveis no Compose, corridas de integridade, ausência do gate comercial de Project, inconsistência potencial da auditoria, analytics incoerente e pipeline não reproduzível.

### Cobertura da Checklist Mestre

- Requisitos rastreados: **1.619/1.619**.
- Seções com itens: **37** (S00–S36); S37/S38 são referência sem checkbox.
- Findings técnicos acionáveis após revisão adversarial: **32**.
- P0: **0**; P1: **9**; P2: **22**; P3: **1**.
- Decisões/validações sem severidade técnica: **4**.

Não é apresentado um único “percentual implementado” para os 1.619 itens, pois isso misturaria requisitos de código, execução, inspeção visual, processo, conflitos, itens derivados e trabalho fora do MVP. A distribuição exata de auditabilidade é:

| Auditabilidade | Total |
|---|---:|
| CODE_STATIC | 276 |
| CROSS_LAYER | 699 |
| RUNTIME_REQUIRED | 292 |
| MANUAL_VISUAL | 64 |
| PROCESS_DOCUMENTATION | 82 |
| DERIVED_ACCEPTANCE | 100 |
| OUT_OF_MVP | 45 |
| SPEC_CONFLICT | 48 |
| SPEC_AMBIGUITY | 13 |
| **Total** | **1.619** |

Os 292 itens runtime e 64 manuais permanecem `NOT_VALIDATED` quando não havia evidência preexistente suficiente. Os 45 itens fora do MVP não foram transformados em pendências do MVP.

## 2. Estado geral do projeto

Áreas mais maduras estaticamente:

- parser/cálculo CVSS v3.1, OWASP, override e máquina MVP de Vulnerability;
- isolamento de leitura por Company/ProjectMember na maioria das APIs sensíveis;
- upload com detecção por conteúdo, containment, attachment e `nosniff`;
- rotas e consumidores de reports, dashboards, analytics, mobile e maturidade;
- testes de integração da API abrangentes em quantidade e domínios.

Áreas que impedem declarar o MVP pronto:

- autorização/integridade de updates de Application/Project;
- segredos padrão e cadeia de confiança JWT no Compose;
- invariantes concorrentes de refresh e Subscription;
- gates de plano/assinatura em Project;
- consistência entre mutação e AuditLog;
- coerência dos filtros do analytics;
- reprodutibilidade do CI;
- ausência de validação real de runtime, browser, device, PDF, Sonar e demo.

## 3. Arquitetura encontrada

Monorepo npm workspaces com:

- API Express 5/TypeScript/Prisma/MySQL em `app/api`;
- web React 18/Vite/React Router/TanStack Query/Zustand/Axios/Tailwind/Recharts/pdf-lib em `app/web`;
- mobile Expo/React Native/Expo Router/TanStack Query/Zustand/SecureStore em `app/mobile`.

O backend usa predominantemente `routes → controllers → services → repositories → Prisma`, montado por factories. Auth middleware injeta o ator; `requireRole` trata papel e ownership fino é aplicado nos services. A persistência contém os domínios de identidade, tenant/comercial, análises, findings, auditoria, reports, notifications e maturidade. Detalhes e evidências estão em `state/ARCHITECTURE_MAP.md`.

## 4. Cobertura consolidada da Checklist Mestre

Os **1.619 IDs originais** estão preservados sem replicação neste relatório executivo. A matriz item a item está em `state/REQUIREMENT_REGISTRY.md`, e os seeds originais estão em `state/REQUIREMENT_SEEDS.jsonl`. As exceções, evidências e severidades canônicas estão em `findings/CONSOLIDATED_FINDINGS.md`. Os fluxos derivados S34/S35 estão correlacionados nos documentos de validação correspondentes, especialmente `reviews/FLOW_VALIDATION.md` e `reviews/CROSS_REVIEW.md`.

| Seção | Cobertura e estado consolidado |
|---|---|
| S00–S01 | processo/contexto rastreado; resultados resolvidos pelos domínios canônicos |
| S02 | 53/53; SECURITY-001/003 e ambiguidade do convite |
| S03 | 38/38; arquitetura predominante presente; conflitos preservados |
| S04 | 37/37; estrutura presente; INFRA-001 P2; runtime e 4 OUT_OF_MVP |
| S05 | 107/107; schema/migrations inspecionados; BUSINESS-002/DATA-001 e marcadores |
| S06 | 50/50; auth base presente; SECURITY-002/004, AUTH-001/002; runtime não validado |
| S07 | 61/61; fluxo presente com BUSINESS-001/002/005 e SECURITY-003; marcadores preservados |
| S08 | 28/28; CRUD/tenant presentes; SECURITY-001 e BUSINESS-007 |
| S09 | 54/54; membership/máquina v4 presentes; SECURITY-001, BUSINESS-003/008 e conflitos |
| S10 | 85/85; CVSS/override/máquina presentes; BACKEND-002 e BUSINESS-004 |
| S11 | 44/44; hardening principal presente; EVIDENCE-001/002 e conflito whitelist |
| S12 | 12/12; thread/paginação/autoria presentes; BUSINESS-009 |
| S13 | 17/17; eventos chamados; garantia atômica parcial por BUSINESS-004 |
| S14 | 63/63; API/PDF client-side localizados; PDF real não validado; 3 OUT_OF_MVP |
| S15 | 18/18; dashboards localizados; tratamento de erro parcial |
| S16 | 70/70; endpoints/painel presentes; METRICS-001 e FRONTEND-001/002/006 |
| S17 | 86/86; design system presente; FRONTEND-004/005; visual/leitor não validados |
| S18 | 53/53; rotas/infra web presentes; FRONTEND-003; visual não validado |
| S19 | 46/46; mobile CLIENT/read-only/SecureStore presentes; device não validado |
| S20 | 25/25; push code/mocks presentes; entrega real não validada; conflito de preferências |
| S21 | 45/45; maturidade full-stack presente; MATURITY-001/002 e ambiguidade |
| S22 | 9/9 condicionais à ambiguidade de escopo; não viram ausência do MVP |
| S23 | 51/51; SECURITY-001/002/004; ZAP/CVE/licenças não revalidados |
| S24 | 13/13; logging/tratamento parcial; TESTS-002 e ambiguidade Pino |
| S25 | 127/127 inventariados; integração API ampla; TESTS-001/002; execução não realizada |
| S26 | 32/32; INFRA-002; Sonar/ZAP não reexecutados; 3 OUT_OF_MVP |
| S27 | 22/22; seeds presentes; execução/idempotência não validadas |
| S28 | 47/47 processo/documentação; demo e evidências runtime não validadas |
| S29 | 11/11; health/scripts/Compose presentes; runtime não validado |
| S30 | 24/24 OUT_OF_MVP; nenhum virou pendência MVP |
| S31 | 54/54 resolvidos por requisito/finding canônico ou NOT_VALIDATED |
| S32 | 12/12 limitações rastreadas como documentação/risco residual |
| S33 | 36/36 conflitos/ambiguidade preservados |
| S34 | 76/76 resolvidos em FLOW_VALIDATION |
| S35 | 24/24 gates derivados; MVP final `NOT_READY` |
| S36 | 55/55 processo/manual; evidência preexistente ou NOT_VALIDATED |

## 5. Regras de negócio

Findings principais:

- BUSINESS-001: Plan inativo pode ser solicitado/aprovado.
- BUSINESS-002: duas Subscriptions podem tornar-se ACTIVE em corrida.
- BUSINESS-003: Project não exige Subscription ACTIVE; `maxProjects` depende de ratificação, mas nem é consultado.
- BUSINESS-004: mutação e AuditLog não formam unidade atômica.
- BUSINESS-005: onboarding Company→OWNER→Subscription pode ficar parcial.
- BUSINESS-007/008: limites e transições dependem de check-then-act.
- BUSINESS-009: autor removido pode conservar capacidade de apagar Comment.
- MATURITY-001/002: nível categórico contradiz ADR-018 e batch não é atômico.

A semântica de “Enterprise ilimitado” foi removida do backlog técnico pela revisão adversarial: S05-R034 é ambíguo e precisa primeiro de decisão de especificação.

## 6. Backend

A separação de camadas é consistente em grande parte do código, e creates sensíveis normalmente reconstroem DTOs. O problema crítico está nos updates de Application/Project, nos quais cast TypeScript não remove campos extras em runtime e o objeto chega ao Prisma. Outros gaps incluem validação de User update, filtros/paginação de Vulnerabilities, rate limiting e consistência transacional.

## 7. Frontend

Web e mobile consomem as principais APIs e têm gates visuais por role, fila de refresh web e SecureStore mobile. Lacunas confirmadas:

- busca textual do analytics não chega à API;
- clique em aging aplica período de criação com semântica diferente;
- falhas de API podem parecer loading/vazio;
- linha de Project clicável não é operável por teclado;
- alguns gráficos usam cores fixas fora dos tokens;
- série estimada não é rotulada como aproximação.

## 8. Banco de dados

Schema/migrations cobrem os models, índices e cascatas principais. Riscos:

- ausência de garantia persistente/atômica para uma Subscription ACTIVE;
- ausência de serialização para um Project ativo por Application;
- `Vulnerability.createdBy` e vínculos de MaturityAssessment sem FKs;
- regras de capacidade e AuditLog dependem de múltiplas operações independentes.

Aplicação real das migrations não foi presumida.

## 9. Autenticação e autorização

Implementado estaticamente: bcrypt, access/refresh separados, hash do refresh, rotação sequencial, logout, Bearer middleware e role gates. Pendências:

- AUTH-001: rotação concorrente gera mais de um sucessor;
- AUTH-002: e-mail não é normalizado e colisão pode virar 500;
- SECURITY-001/003: campos protegidos e companyRole não têm enforcement completo;
- SECURITY-004: login sem rate limiting.

## 10. Segurança

P1 confirmados:

- mass assignment em update de Application/Project;
- defaults JWT conhecidos no Compose, exploráveis quando não substituídos e serviço alcançável.

Pontos positivos: upload por conteúdo, path containment, attachment/nosniff, SQL raw parametrizado, React sem sinks `dangerouslySetInnerHTML` localizados, e ownership consistente na maioria de Evidence/Reports/Maturity/Metrics. Não foram encontrados bypasses independentes nesses domínios.

ZAP/CVE/licenças e exposição real do Compose permanecem `NOT_VALIDATED`.

## 11. Integrações

Expo Push é a integração externa funcional localizada. Registro/envio e falha não bloqueante existem estaticamente; entrega real/device não foram testados. Não foram localizadas implementações funcionais de Gemini, SMTP, WebSocket, pagamento, filas ou cron, coerente com o corte de escopo. Mailhog está reservado no Compose.

## 12. Jobs e processamento assíncrono

Não foram localizados workers, filas ou scheduler; esses itens são explicitamente fora do MVP. Push ocorre inline com tratamento de falha. Nenhuma pendência de worker foi criada.

## 13. UX e design

Há design system próprio, temas, componentes, skeletons/empty/error em várias áreas e testes axe/overlay. Não foi feita validação visual em 375/768/1440, leitor de tela ou device. Os findings FRONTEND-003/004/005 descrevem problemas estáticos concretos; o restante visual permanece `NOT_VALIDATED`.

## 14. Tratamento de erros

Controllers mapeiam vários códigos estáveis, mas não existe middleware global de erros. Alguns conflitos Prisma previsíveis chegam a 500. Web/mobile frequentemente não distinguem falha de vazio/loading. Push é desenhado para não propagar falha, mas o caminho cross-layer de exceção não tem teste de integração.

## 15. Testes

Inventário estático:

- API: 22 arquivos; 212 chamadas `it(...)`, com parametrização que amplia casos.
- Web: 4 arquivos e 30 `it(...)`.
- Mobile: nenhum teste localizado.

Existem testes de integração amplos para API, tenancy, upload, reports, metrics, push e maturity. Não foram executados. Faltam gates de coverage, PDFs no browser, device/mobile, concorrência de refresh/Subscription, falha Expo atravessando criação, `diffJson` inválido e vários edge cases de sessão. O pipeline não consegue ser considerado evidência porque depende de lockfile ausente.

## 16. Infraestrutura e configuração

Compose contém MySQL, API, web, Mailhog, healthchecks e volumes. O setup local por `.env.example` usa nome de porta divergente. O CI é backend-centric e usa `npm ci` sem lockfile. Sonar está documentado como pendente; artefatos ZAP preexistem, mas não foram reexecutados.

## 17. Código incompleto, mocks e placeholders

- Mock de Expo no CI é deliberado e não foi confundido com entrega real.
- Não há DELETE de Evidence.
- Busca do analytics é controle sem efeito no backend.
- Navegação por resposta de push não foi localizada.
- Não há rate limiter.
- Observabilidade/e-mail/chat/IA permanecem fora do MVP, não stubs pendentes.

## 18. Funcionalidades órfãs

Frontend sem backend/semântica:

- busca de analytics;
- clique de aging com semântica incompatível.

Backend sem consumidor obrigatório confirmado: nenhum caso crítico independente foi sustentado. APIs de Notification in-app permanecem condicionadas à ambiguidade S22.

## 19. Código morto ou legado

Não foi classificado código como morto sem referência suficiente. Campos legados de maturidade são usados ativamente e, por isso, configuram divergência, não dead code. `PasswordResetToken`, Mailhog e capacidades fora do MVP são reservas explícitas.

## 20. Divergências entre especificação e implementação

Principais:

- updates aceitam campos derivados/protegidos;
- Plan inativo pode ser contratado;
- Project não aplica gate ACTIVE;
- analytics mistura populações filtradas;
- maturity mantém nível categórico removido pela ADR vigente;
- Evidence aceita `proof` vazio;
- CI configurado não possui pré-requisito versionado;
- filtros/UX do analytics comunicam comportamento diferente do executado.

Conflitos S33 permanecem registrados sem escolha arbitrária.

## 21. Implementações extras

Não foi confirmada funcionalidade extra relevante fora da Checklist Mestre. O nível categórico de maturidade não é tratado como extra benéfica: ele contradiz a ADR-018 vigente. Reservas explícitas no schema/Compose não foram promovidas a implementação funcional.

## 22. Dívida técnica

- transações/concorrência não tratadas em invariantes e trilha de auditoria;
- validação manual inconsistente e casts usados como se fossem sanitização runtime;
- CI sem instalação determinística;
- cobertura frontend/mobile pequena diante da superfície funcional;
- tratamentos de erro inconsistentes;
- lacunas de integridade referencial;
- documentação/runtime sem fechamento reproduzível.

## 23. Pontos de atenção

- A ausência de P0 não significa prontidão: nove P1 foram confirmados adversarialmente.
- SECURITY-002 tem confiança MEDIUM porque a cadeia estática existe, mas o uso efetivo dos defaults e exposição do Compose não foram validados.
- Findings de concorrência são estruturalmente possíveis; frequência/impacto em runtime não foram medidos.
- O ZIP adicional previsto no protocolo não está acessível e a comparação repo↔ZIP é `NOT_VALIDATED`.
- Nenhum resultado de teste, build, migration, PDF, push, browser ou device foi inventado.

## 24. Pendências priorizadas

O backlog detalhado, sem patches, está em `RECOMMENDATIONS.md`. O MVP permanece `NOT_READY` até adjudicar/corrigir os nove P1 e executar os gates runtime relevantes.

## Revisão final obrigatória

- 1.619/1.619 IDs têm rastreabilidade por registry, seção, finding ou resolução derivada.
- Findings relevantes possuem evidência de caminho/símbolo.
- Fluxos críticos S34 foram correlacionados ponta a ponta.
- Frontend, backend, persistência, autorização e testes foram cruzados.
- 100% dos P1 e divergências passaram por revisão adversarial.
- Nenhum item fora do MVP foi transformado em pendência MVP.
- Nenhum arquivo funcional do produto foi alterado.
