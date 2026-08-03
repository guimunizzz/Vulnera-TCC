---
type: tcc
tags: [academico, metodologia]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Metodologia

## Natureza do trabalho

O Vulnera é um **Trabalho de Conclusão de Curso (TCC) técnico com produto funcional**. A metodologia combina:

- **Pesquisa aplicada**: estudo de padrões de mercado (CVSS, OWASP, DevSecOps) aplicados a um problema real
- **Desenvolvimento de software**: construção de uma plataforma full-stack com arquitetura em camadas
- **Demonstração prática**: uso da plataforma com casos reais durante o desenvolvimento

---

## Metodologia de desenvolvimento

### Framework de gestão

**Scrum adaptado** com ciclos de 2 semanas:

| Cerimônia | Frequência | Formato |
|---|---|---|
| Planning | A cada sprint (2 semanas) | Síncrono — definição das tarefas do sprint |
| Daily | Diário | Assíncrono — grupo no WhatsApp/mensagem curta |
| Review | Fim do sprint | Síncrono — demo do que foi produzido |
| Retrospectiva | Fim do sprint | Síncrono curto — o que melhorar |

Ferramenta de gestão: **GitHub Projects** (Kanban visual integrado ao repositório).

### Fluxo de desenvolvimento

```
feature/branch → PR para develop → CI (lint + test + build) → code review Rafael → merge
develop → PR para main → CI completo + SonarQube → merge (apenas features estáveis)
```

Convenções:
- `main` — branch protegida, sempre estável
- `develop` — branch de integração
- `feature/<nome>` — tarefas novas
- `fix/<nome>` — correções
- Commits seguem **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`)

### Code review

- toda PR revisada por Rafael antes do merge
- checklist mínimo: lint passa, testes passam, SonarQube não piora

---

## Metodologia de pesquisa

### Como as decisões técnicas foram tomadas

Cada decisão estrutural foi submetida a:
1. levantamento de alternativas
2. análise de trade-offs (custo de implementação, manutenção, adequação ao TCC)
3. documentação formal como ADR (Architecture Decision Record)

7 ADRs formalizados — ver `07-Decisoes/`.

### Como os padrões foram selecionados

- **CVSS v3.1**: padrão internacional adotado pelo NVD/NIST para classificação de vulnerabilidades
- **OWASP Top 10**: referência mais citada para vulnerabilidades em aplicações web
- **Express**: framework com arquitetura prescrita em camadas — favorece código organizado e testável
- **Prisma**: ORM com type-safety nativo — reduz vulnerabilidades de SQL injection por design
- **Docker rootless**: prática recomendada pelo NIST SP 800-190 para segurança de containers

---

## Metodologia de testes

### Filosofia

> Testar o que, se quebrar, causa estrago real. Não perseguir cobertura por vaidade.

Dois níveis obrigatórios:
1. **Testes canário** — alarmes para as regras mais críticas (auth, multi-tenancy, regras de negócio)
2. **Testes de integração** — validação dos fluxos principais end-to-end

Meta de cobertura: **60% de linhas** (informativa no SonarQube, não bloqueante).

Ver: [[Testes]] para detalhamento completo.

---

## Metodologia de segurança

### DevSecOps integrado ao desenvolvimento

A segurança não é uma fase — é contínua:

| Etapa | Prática |
|---|---|
| Design | Threat modeling documentado no vault; ADRs para decisões de segurança |
| Código | Padrões documentados: autenticação, validação, injection, XSS, upload, logs, segredos |
| Build | SonarQube SAST em cada PR (informativo) |
| Deploy-like | Dockerfiles rootless; CI valida que o build não quebra |
| Runtime | OWASP ZAP DAST manual antes de marcos |
| Operação | Prometheus + Grafana; logs estruturados com Pino; AuditLog de ações sensíveis |

Ver: [[Politica de Desenvolvimento Seguro]], [[SonarQube]], [[OWASP ZAP]]

---

## Metodologia de documentação

O vault do Obsidian funciona como **memória externa estruturada do projeto**:

- notas canônicas por domínio, produto, arquitetura e infra
- 7 ADRs com contexto, alternativas e trade-offs
- regras de negócio explícitas com casos de teste
- máquinas de estado formalizadas
- guia operacional para o Claude (IA de apoio documental)

Benefício: qualquer integrante pode consultar o vault e entender uma decisão sem depender de memória verbal.

---

## Critérios de avaliação interna

O projeto será considerado bem-sucedido se:

| Critério | Como verificar |
|---|---|
| Fluxo completo funcional | Demo: onboarding → projeto → finding → relatório |
| Segurança da própria plataforma | ZAP sem críticos; SonarQube sem vulnerabilidades abertas |
| Testes passando | CI verde em `main`; canários passando |
| Documentação completa | Vault preenchido; monografia concluída |
| Demo com dados realistas | Seed com 2 empresas + 10 findings representativos |

---

## Links relacionados
[[Estrutura da Monografia]]
[[Testes]]
[[Distribuicao da Equipe]]
[[GitHub Actions CI]]
[[Politica de Desenvolvimento Seguro]]
[[ADR-007 - Sonar informativo e ZAP manual]]
