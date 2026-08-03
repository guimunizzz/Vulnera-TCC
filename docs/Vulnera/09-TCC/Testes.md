---
type: tcc
tags: [academico, testes]
status: ativo
---

> [!info] Revisado em 2026-07-26
> Testes E2E automatizados (Playwright) saíram do escopo. A estratégia vigente é **testes de integração** (Jest + Supertest contra o app real e banco de teste) mais smoke manual documentado em `docs/DEMO.md`.
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
| **Playwright** | Testes E2E (Fase 8) — cobertura de fluxos no browser |

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

## Testes de segurança dinâmica (OWASP ZAP)

Além dos testes automatizados, o ZAP realiza varredura dinâmica antes de marcos:

- **Quando**: fim das Fases 3, 5 e 7; pré-banca
- **Tipo**: Baseline Scan (passivo) com opção de API Scan via OpenAPI spec
- **Evidência**: relatório HTML exportado para `zap-reports/`

Ver: [[OWASP ZAP]]

---

## Valor para a banca

- testes canário demonstram **engenharia defensiva consciente** — não é CRUD sem critério
- isolamento multi-tenant testado demonstra **segurança como requisito de negócio**
- relatório ZAP é evidência visual de teste de segurança aplicado ao próprio produto

---

## Links relacionados
[[Metodologia]]
[[GitHub Actions CI]]
[[SonarQube]]
[[OWASP ZAP]]
[[Evidencias para Banca]]
[[Seguranca da Aplicacao]]
