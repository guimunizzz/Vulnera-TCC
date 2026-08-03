---
type: tcc
tags: [academico, referencias]
status: em-construcao
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencias e Bases Teoricas

## Nota sobre este arquivo

As referências bibliográficas específicas (autores, anos, editoras) serão finalizadas durante a escrita da monografia, conforme normas da instituição. Este arquivo organiza as **bases teóricas necessárias por tema** e os **materiais de referência oficiais** que fundamentam o projeto.

---

## 1. Segurança da informação e análise de vulnerabilidades

### Conceitos fundamentais necessários
- definição de vulnerabilidade, ameaça, risco e ativo
- ciclo de vida de uma vulnerabilidade (descoberta → divulgação → remediação)
- tipos de testes de segurança: SAST, DAST, IAST, pentest manual
- diferença entre pentest e bug bounty

### Materiais de referência oficiais
- **NIST SP 800-115**: Technical Guide to Information Security Testing and Assessment — define metodologia de testes de segurança
- **OWASP Testing Guide**: guia metodológico de testes de aplicações web
- **CVE/NVD**: National Vulnerability Database (nvd.nist.gov) — base de vulnerabilidades conhecidas

---

## 2. CVSS — Common Vulnerability Scoring System

### Conceitos necessários
- o que é CVSS e por que é padrão de mercado
- CVSS v3.1: vetor base, temporal e ambiental
- métricas do vetor base: AV, AC, PR, UI, S, C, I, A
- mapeamento de score para severidade: None (0), Low (0.1–3.9), Medium (4.0–6.9), High (7.0–8.9), Critical (9.0–10.0)
- override manual justificado — quando o contexto muda a severidade calculada

### Materiais de referência oficiais
- **CVSS v3.1 Specification Document** — FIRST.org (forum.first.org/cvss)
- **NVD CVSS Calculator** — calculador oficial do NIST

---

## 3. OWASP Top 10

### Conceitos necessários
- o que é o OWASP e por que a Top 10 é referência
- categorias A01–A10 da edição 2021
- como o Vulnera usa as categorias como classificação obrigatória de cada finding
- relação entre CVSS e OWASP — complementaridade

### Materiais de referência oficiais
- **OWASP Top 10 2021** — owasp.org/Top10
- **OWASP Application Security Verification Standard (ASVS)** — referência para controles de segurança

---

## 4. Arquitetura de software

### Conceitos necessários
- arquitetura em camadas (Controller → Service → Repository)
- princípios SOLID aplicados ao back-end
- injeção de dependência (Express DI container)
- separação entre regra de negócio e persistência
- padrão Repository — isolamento do ORM
- DTO (Data Transfer Object) — contrato de entrada/saída

### Materiais de referência
- Documentação oficial do **Express** (docs.nestjs.com)
- **Clean Architecture** — Robert C. Martin (livro; usar para embasar separação de camadas)
- **Domain-Driven Design** — Eric Evans (conceito de entidade, agregado, repositório)

---

## 5. DevSecOps

### Conceitos necessários
- o que é DevSecOps e como difere de DevOps
- "shift left security" — trazer segurança para o início do desenvolvimento
- análise estática (SAST) vs dinâmica (DAST)
- containerização segura — Docker rootless, usuário não-root
- CI/CD e quality gates

### Materiais de referência
- **NIST SP 800-190**: Application Container Security Guide — referência para Docker seguro
- **OWASP DevSecOps Guideline** — owasp.org/www-project-devsecops-guideline
- Documentação do **SonarQube** (docs.sonarqube.org)
- Documentação do **OWASP ZAP** (zaproxy.org)

---

## 6. Plataformas SaaS e modelo de assinatura

### Conceitos necessários
- definição de SaaS (Software as a Service)
- multi-tenancy — isolamento de dados entre clientes
- modelo de planos e limites de uso
- onboarding e ciclo de vida do cliente

### Materiais de referência
- **The SaaS Playbook** — Rob Walling (referência prática de produto SaaS)
- artigos acadêmicos sobre multi-tenancy em aplicações web

---

## 7. Inteligência artificial aplicada à segurança

### Conceitos necessários
- LLMs (Large Language Models) e suas capacidades
- uso assistivo vs autônomo de IA
- riscos de IA em contextos de segurança (prompt injection, dados sensíveis, alucinações)
- rate limiting como controle de custo e governança

### Materiais de referência
- **Google AI for Developers** — documentação do Gemini API
- **OWASP Top 10 for LLM Applications** — owasp.org/www-project-top-10-for-large-language-model-applications
- artigos sobre IA em cibersegurança (assistência a analistas)

---

## 8. Desenvolvimento web moderno

### Materiais de referência por tecnologia

| Tecnologia | Referência |
|---|---|
| Express | docs.nestjs.com |
| React + Vite (App Router) | nextjs.org/docs |
| React Native / Expo | expo.dev/docs |
| Prisma ORM | prisma.io/docs |
| TypeScript | typescriptlang.org/docs |
| MySQL | postgresql.org/docs |
| Socket.IO | socket.io/docs |
| Jest | jestjs.io/docs |
| Playwright | playwright.dev/docs |

---

## 9. Referências sobre testes de software

### Conceitos necessários
- tipos de testes: unitário, integração, E2E
- test coverage — métricas e limitações
- testes canário como alarmes de regressão
- testes de segurança automatizados vs manuais

### Materiais de referência
- **The Art of Software Testing** — Glenford Myers (clássico de testes)
- **Growing Object-Oriented Software, Guided by Tests** — Freeman & Pryce
- Documentação do **Jest** e **Supertest**

---

## Checklist de fundamentação

- [ ] Capítulo 2 da monografia usa pelo menos uma referência por seção
- [ ] CVSS e OWASP têm referências oficiais (não apenas Wikipedia)
- [ ] DevSecOps tem referência do NIST ou OWASP
- [ ] Gemini/IA tem referência recente (2023+)
- [ ] Referências formatadas conforme norma da instituição (ABNT ou outro padrão definido)
- [ ] Revisão final de todas as URLs — verificar que estão acessíveis

---

## Links relacionados
[[Estrutura da Monografia]]
[[Metodologia]]
[[Seguranca da Aplicacao]]
[[SonarQube]]
[[OWASP ZAP]]
[[Integracao Gemini]]
