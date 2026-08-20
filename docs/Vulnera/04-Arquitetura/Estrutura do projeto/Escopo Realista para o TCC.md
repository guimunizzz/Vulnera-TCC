---
type: guia-operacional
tags: [architecture, code-generation, source-of-truth, tcc]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Escopo Realista para o TCC

## Objetivo

Orientar o Claude e a equipe sobre o que deve ser implementado prioritariamente, o que é opcional, e o que pode ser deixado como referência futura.

O Vulnera é um projeto de TCC com prazo real, equipe pequena e exigência de entrega funcional demonstrável para a banca.

---

## Premissa fundamental

A estrutura completa do monorepo representa a **visão arquitetural completa** do projeto.

Ela não é uma lista de tarefas obrigatórias — é um mapa de onde o projeto pode chegar.

A implementação real deve ser guiada por:

- viabilidade dentro do prazo do TCC
- funcionalidade demonstrável para a banca
- qualidade suficiente para avaliação acadêmica
- coerência com o MVP original (`[[vulnera]]`)

---

## O que nunca pode faltar (obrigatório para a banca)

### Back-end (API Express)

- [ ] Bootstrap do monorepo funcional
- [ ] Autenticação JWT com refresh token
- [ ] CRUD de usuários e empresas
- [ ] Planos e assinaturas (ao menos leitura e validação)
- [ ] CRUD de aplicações
- [ ] CRUD de projetos com máquina de estados
- [ ] CRUD de vulnerabilidades com CVSS e status
- [ ] Upload de evidências
- [ ] Avaliação de maturidade (domínios e controles)
- [ ] Geração de dados para relatório
- [ ] Notificações internas
- [ ] Auditoria básica (AuditLog)
- [ ] middlewares de autenticação, roles e ownership
- [ ] Validação de DTOs em todas as rotas

### Front-end Web (React + Vite)

- [ ] Autenticação e fluxo de login/logout
- [ ] Dashboard por role
- [ ] Gestão de aplicações e projetos
- [ ] Registro e visualização de findings
- [ ] Upload de evidências
- [ ] Avaliação de maturidade
- [ ] Geração de relatório PDF client-side
- [ ] Chat ou comentários em findings (ao menos básico)

### Mobile (Expo)

- [ ] Login e autenticação
- [ ] Dashboard resumido
- [ ] Lista e detalhe de projetos
- [ ] Lista e detalhe de findings
- [ ] Recebimento de notificações push

---

## O que é desejável mas não crítico para a banca

- Suporte a tickets (pode ser simplificado)
- IA Gemini (demonstrável em demo, mas não obrigatório em toda tela)
- WebSocket em tempo real (pode ser polling simples no MVP)
- SonarQube + ZAP rodando (basta evidência de execução, não precisa estar no CI)
- Prometheus + Grafana (referência futura; basta mostrar configuração)
- Nginx (pode ser substituído por proxy simples no MVP)

---

## O que é referência futura (não implementar no TCC)

- `docker-compose.prod.yml` completo
- Deploy real em produção
- CI com Quality Gate bloqueante
- Escalabilidade horizontal
- Multi-região
- Cobertura de testes acima de 80%
- Gestão avançada de billing e webhooks de pagamento
- Integração com scanner externo real

---

## Critérios de corte ao implementar

Ao decidir se uma feature entra na onda atual, usar estes critérios:

| Critério | Sim → implementar | Não → adiar |
|---|---|---|
| A banca vai ver ou testar? | Implementar funcional | Adiar ou mockar |
| Está no MVP original (`vulnera.md`)? | Implementar | Avaliar com equipe |
| Bloqueia outra feature prioritária? | Implementar | Adiar |
| Tem menos de 1 dia de implementação? | Implementar logo | Adiar se complexo |
| É só configuração ou infraestrutura? | Pode ser referência | Não bloquear feature |

---

## Ondas de implementação recomendadas

### Onda 1 — Fundação (obrigatória)

- bootstrap do monorepo
- configuração de banco, Prisma e migrations iniciais
- módulo de autenticação completo (login, refresh, logout, reset)
- módulo de usuários e empresas
- middlewares globais (JWT, roles, ownership)
- validação global de DTOs

### Onda 2 — Core do produto

- planos e assinaturas (criação e validação)
- aplicações
- projetos com máquina de estados
- vulnerabilidades com CVSS e status
- evidências com upload

### Onda 3 — Funcionalidades secundárias

- comentários e chat básico
- tickets de suporte
- avaliação de maturidade
- notificações internas
- relatório (dados da API + PDF no front)

### Onda 4 — Polimento e integração

- IA Gemini (sugestões de severidade e descrição)
- mobile cliente completo
- WebSocket (se polling não for suficiente)
- AuditLog detalhado

### Onda 5 — Hardening e evidências

- testes canário e de integração
- execução manual do ZAP
- análise Sonar
- revisão de segurança
- preparação de dados de demo

---

## Regras de priorização para o Claude

Ao receber uma solicitação de implementação, o Claude deve:

1. verificar em qual onda essa feature se encontra
2. verificar se a onda anterior está completa
3. se a feature for de onda avançada sem as anteriores concluídas, alertar e sugerir a sequência correta
4. nunca implementar funcionalidade de Onda 4 ou 5 se a Onda 1 não estiver completa

---

## O que pode ser mocado na demo

Para a banca, algumas partes podem ser demonstradas com dados de seed:

- planos e assinaturas (seed com plano ativo)
- histórico de maturidade (seed com avaliações)
- relatórios gerados (seed com dados reais)
- notificações push (demonstração com Expo Go)

---

## Relacionado

- [[Estrutura Geral do Monorepo]]
- [[Regras para o Claude ao Gerar Codigo]]
- [[Roadmap MVP]]
- [[Roadmap Fases]]
- [[Evidencias para Banca]]
- [[Visao Geral]]
- [[Fora do Escopo]]
- [[ADR-005 - Desenvolvimento local com Docker minimo]]
- [[ADR-007 - Sonar informativo e ZAP manual]]
