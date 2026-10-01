---
type: tcc
tags: [academico, testes]
status: ativo
---

> [!info] Revisado em 2026-09-10
> A estratégia principal continua sendo **testes de integração** (Jest + Supertest contra o app real e banco de teste) mais smoke manual documentado em `docs/DEMO.md`.
> **Correção:** o callout anterior (2026-07-26) dizia que E2E com Playwright estava fora do escopo. Desde 2026-09-09 **existe uma suíte E2E versionada** em `app/web/e2e/`, criada para o módulo [[DAST]] — Chrome real contra a stack Docker real, deliberadamente **fora** do `npm run check` (que precisa continuar rodando sem Docker). Ver a seção "Testes E2E (Playwright)" abaixo.

> [!info] Revisado em 2026-07-26 (histórico)
> Estratégia da época: integração + smoke manual.
> Toda PR de CRUD inclui: happy path, erros de validação do controller e ao menos uma regra de negócio do service. Canários `TEN-xx` de tenancy em toda fase que toque recurso de cliente. Cobertura ≥80% nos services.

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Testes

## Filosofia

> Testar o que, se quebrar, causa estrago real. Não perseguir cobertura por vaidade.

O Vulnera adota uma estratégia pragmática de testes orientada ao TCC: focar nos cenários que, se falharem, comprometem a credibilidade do produto — autenticação, isolamento de dados entre empresas e regras de negócio críticas.

Meta de cobertura: **60% de linhas** (monitorada via SonarQube, não bloqueante).

---

## Tipos de teste

### 1. Testes canário (obrigatórios — bloqueiam PR)

Conjunto reduzido de testes que protegem os pontos mais sensíveis do sistema. Marcados com `@canary` no nome. Executados em **toda PR** e sua falha bloqueia o merge em `main`.

**Regra**: modificar ou remover um canário exige justificativa explícita no comentário da PR.

#### Canários de autenticação

| ID | Cenário | Critério de sucesso |
|---|---|---|
| AUTH-01 | Login com credenciais válidas | 200 + accessToken + refreshToken |
| AUTH-02 | Login com senha errada | 401, sem logar senha |
| AUTH-03 | Login com e-mail inexistente | 401 (mesma resposta — previne enumeração) |
| AUTH-04 | Token expirado | 401 com mensagem clara |
| AUTH-05 | Token com secret inválido | 401 |
| AUTH-06 | Refresh com token válido | Novo access token |
| AUTH-07 | Refresh após logout | 401 (token invalidado) |
| AUTH-08 | Rota protegida sem Authorization | 401 |
| AUTH-09 | Senha no banco é hash bcrypt | Verifica formato `$2[aby]$` diretamente no DB |

#### Canários multi-tenant (os mais críticos)

| ID | Cenário | Critério de sucesso |
|---|---|---|
| TEN-01 | Cliente A acessa projeto da Company B | 404 (não revela existência) |
| TEN-02 | Cliente A lista projetos | Nenhum projeto da Company B na resposta |
| TEN-03 | Cliente A edita Application da Company B | 404 |
| TEN-04 | Cliente A faz upload em finding da Company B | 404 |
| TEN-05 | Pentester não atribuído acessa findings do Project X | 403 |
| TEN-06 | Cliente lista todas as empresas (rota admin-only) | 403 |
| TEN-07 | Cliente Member convida novo usuário | 403 (só Owner) |
| TEN-08 | Dashboard do cliente só soma dados da própria Company | Query assertion |

#### Canários de regras de negócio

| ID | Cenário | Critério de sucesso |
|---|---|---|
| BIZ-01 | Cadastrar app excedendo limite do plano Basic | 422 |
| BIZ-02 | Criar projeto sem subscription ativa | 422 |
| BIZ-03 | CVSS 9.5 → severidade CRITICAL | Assertion no objeto |
| BIZ-04 | CVSS 5.0 → severidade MEDIUM | Assertion |
| BIZ-05 | Override de severidade sem justificativa | 422 |
| BIZ-06 | Sem remediação: analista tenta marcar FIXED | 403 |
| BIZ-07 | Com remediação: analista marca FIXED | 200 |
| BIZ-08 | Transição inválida (ex: OPEN → CLOSED direto) | 422 |
| BIZ-09 | Upload de arquivo `.exe` | 422 (MIME rejeitado) |
| BIZ-10 | Relatório com projeto em status REQUESTED | 422 |

---

#### Canários do módulo DAST (desde 2026-09-05)

| ID | Cenário | Critério de sucesso |
|---|---|---|
| SEC-01..05 | SSRF, path traversal e ausência de shell no runner | Alvo privado/loopback recusado; leitura fora do diretório de relatórios recusada |
| RBAC-01..10 | `CLIENT` em qualquer rota `/api/dast/*` | 403 em todas — incluindo triagem, promoção e comparação |
| PIPE-01..05 | Parsing e normalização dos alertas do ZAP | Fingerprint estável entre execuções; HTML removido dos textos |
| LIFE-01..04 | Ciclo de vida do scan | Timeout marca `FAILED`; cancelamento não persiste findings depois |
| DAST-WD-01..07 | Watchdog | Teto de 2 simultâneos respeitado; fila FIFO; abort por falta de pulso |
| DAST-PROG-01 / SIM-01 / STAT-01 | Progresso, selo de simulado e rota `/status` | Percentual persistido; `simulated` exposto no DTO; rota literal antes de `/:id` |
| DAST-TRI-* | Triagem | Status inválido recusado; nota limitada; `AuditLog` gravado |
| DAST-PRO-* | Promoção | Vetor CVSS obrigatório; não-membro recebe 403; **`DAST-PRO-07`**: apagar o scan não apaga a `Vulnerability`; **`DAST-PRO-03b`**: duas promoções simultâneas devolvem 409, não 500 |
| DAST-CMP-* | Comparação | Alvos diferentes → 422; diff por fingerprint em três grupos |

---

### 2. Testes de integração — fluxos principais

Testes end-to-end sem mock do banco (MySQL de teste via serviço no CI). Um por fluxo principal.

| Fluxo | Cobertura |
|---|---|
| **F1 — Onboarding** | Register Company → Subscription PENDING → Admin aprova → Login do Owner |
| **F2 — Criar análise** | Cliente loga → cria Application → cria Project → Admin atribui Pentester → Pentester vê projeto |
| **F3 — Ciclo de finding** | Pentester cria Vuln → Evidence → Cliente comenta → Pentester transiciona → relatório pode ser gerado |
| **F4 — Permissões cruzadas** | 3 usuários distintos verificam toda a matriz de permissões |

---

### 3. Testes unitários (colocalizados)

Testes de funções puras ou lógica isolada, colocados ao lado do arquivo fonte:

```
cvss.service.ts
cvss.service.spec.ts     ← unitário colocalizado
```

Foco: cálculo CVSS, derivação de severidade, validações de enum, lógica de máquina de estados.

---

## Estrutura de arquivos

```
apps/api/
├── src/
│   └── modules/
│       └── vulnerabilities/
│           ├── cvss.service.ts
│           └── cvss.service.spec.ts
└── test/
    ├── canary/
    │   ├── auth.canary.spec.ts
    │   ├── multi-tenant.canary.spec.ts
    │   └── business-rules.canary.spec.ts
    ├── integration/
    │   ├── onboarding.flow.spec.ts
    │   ├── create-analysis.flow.spec.ts
    │   ├── finding-lifecycle.flow.spec.ts
    │   └── permissions-matrix.flow.spec.ts
    └── helpers/
        ├── test-db.ts        # reset do banco entre testes
        ├── fixtures.ts       # dados comuns reutilizáveis
        └── http-client.ts    # supertest wrapper com auth
```

---

## Ferramentas

| Ferramenta | Uso |
|---|---|
| **Jest** | Unitários e integração |
| **Supertest** | Chamadas HTTP contra a aplicação Express |
| **@prisma/client** | Assertions diretas no banco quando necessário |
| **Playwright** | Testes E2E (desde a Fase 9.2, 2026-09-09) — Chrome real contra a stack Docker real, em `app/web/e2e/` |

---

## O que não é testado (decisão consciente)

- componentes de UI individuais (Button, Card, etc.) — custo alto, valor baixo
- getters/setters triviais
- mocks de serviços externos (Gemini, Expo Push) — apenas a camada de abstração
- cobertura de 100% — meta é 60%, monitorada no SonarQube

---

## Integração com CI

```
PR para main
  ├── jest (canários + integração) → bloqueia se falhar
  ├── docker build → bloqueia se falhar
  └── sonarqube scan → informativo (não bloqueia)
```

Ver: [[GitHub Actions CI]], [[SonarQube]]

---

## Testes E2E (Playwright) — desde 2026-09-09

```bash
docker compose up -d                              # na raiz
docker compose exec api npm run db:seed           # se o banco estiver vazio
npm run test:e2e --workspace=app/web
```

Decisões que valem para a banca:

- **Sem `webServer` na config, de propósito** — o alvo é a stack de verdade (mesmo banco, mesmo Docker da demonstração), não um servidor de teste. Por isso a suíte fica **fora** do `npm run check`.
- **O caso `E2E-01` prova que a barra de progresso mede em vez de estimar**: exige que o percentual suba **e** que as fases nomeadas do ZAP apareçam. Uma barra baseada em tempo decorrido passaria na primeira asserção e falharia na segunda.
- **Pegou um bug que Jest e Supertest não pegariam**: link para `/vulnerabilities/:id`, rota inexistente (a do produto é `/findings/:id`) — cada metade funcionava isolada.
- ⚠️ **Rode a suíte sozinha.** Cada caso dispara scans reais; junto com o `npm test` do backend, numa máquina de 16GB, o SO derruba o worker com uma mensagem que **parece** falha de teste e não é.

---

## Testes de segurança dinâmica (OWASP ZAP)

Além dos testes automatizados, o ZAP realiza varredura dinâmica **contra a própria aplicação** antes de marcos (papel 1 do ZAP no projeto — o papel 2, como motor do módulo [[DAST]], é funcionalidade de produto e está coberto pelos canários acima):

- **Quando**: fim das Fases 3, 5 e 7; pré-banca
- **Tipo**: Baseline Scan (passivo) com opção de API Scan via OpenAPI spec
- **Evidência**: relatório HTML exportado para `zap-reports/`

Ver: [[OWASP ZAP]]

---

## Valor para a banca

- testes canário demonstram **engenharia defensiva consciente** — não é CRUD sem critério
- isolamento multi-tenant testado demonstra **segurança como requisito de negócio**
- relatório ZAP é evidência visual de teste de segurança aplicado ao próprio produto
- a suíte E2E contra a stack real mostra teste de **integração de verdade**, incluindo um caso desenhado para distinguir medição de estimativa

---

## Links relacionados
[[Metodologia]]
[[GitHub Actions CI]]
[[SonarQube]]
[[OWASP ZAP]]
[[Evidencias para Banca]]
[[Seguranca da Aplicacao]]
