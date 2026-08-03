---
type: tcc
tags: [academico, monografia]
status: em-construcao
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Estrutura da Monografia

## Informações gerais

- **Curso**: Técnico em Desenvolvimento de Sistemas
- **Título provisório**: Vulnera: plataforma SaaS para gestão e entrega de análises de segurança em aplicações
- **Equipe**: Rafael, Guilherme, Iann
- **Período**: 7 meses (2026-01 a 2026-07)
- **Formato**: monografia técnica com demonstração prática

---

## Estrutura proposta

### Capa e elementos pré-textuais
- capa padrão da instituição
- folha de aprovação
- resumo (português) — 150 a 250 palavras
- abstract (inglês)
- lista de figuras
- lista de siglas e abreviaturas
- sumário

---

### Capítulo 1 — Introdução

**Objetivo**: contextualizar o problema, justificar o projeto e apresentar os objetivos.

Seções:
- 1.1 Contextualização
- 1.2 Problema
- 1.3 Justificativa
- 1.4 Objetivos (geral e específicos)
- 1.5 Estrutura do trabalho

**Ponto-chave**: mostrar que consultorias de segurança enfrentam desorganização operacional e que a solução é uma plataforma de gestão — não um produto ofensivo.

Ver: [[Problema e Oportunidade]], [[Objetivos]], [[ADR-001 - Plataforma foca gestao e nao execucao real]]

---

### Capítulo 2 — Fundamentação Teórica

**Objetivo**: embasar tecnicamente o projeto com conceitos e padrões adotados.

Seções:
- 2.1 Segurança da informação e análise de vulnerabilidades
- 2.2 CVSS — Common Vulnerability Scoring System
- 2.3 OWASP Top 10
- 2.4 Arquitetura de software em camadas
- 2.5 Desenvolvimento seguro (DevSecOps)
- 2.6 Plataformas SaaS — modelo de negócio simulado
- 2.7 Inteligência Artificial aplicada à segurança (LLMs)

**Ponto-chave**: cada seção deve justificar por que o conceito é relevante para o Vulnera especificamente.

Ver: [[Referencias e Bases Teoricas]]

---

### Capítulo 3 — Levantamento de Requisitos

**Objetivo**: especificar o que o sistema deve fazer, para quem e com quais restrições.

Seções:
- 3.1 Perfis de usuário (Admin, Pentester, Cliente)
- 3.2 Requisitos funcionais — tabela RF01–RF_N
- 3.3 Requisitos não funcionais — tabela RNF01–RNF_N
- 3.4 Regras de negócio críticas — RN01–RN24
- 3.5 Restrições de escopo (o que está fora)

**Ponto-chave**: mostrar que há rigor na especificação — não é "achei que precisava".

Ver: [[MOC - Dominio]], [[Fora do Escopo]], [[Regras de Ownership]]

---

### Capítulo 4 — Modelagem e Design

**Objetivo**: descrever as decisões de design e a modelagem do domínio.

Seções:
- 4.1 Arquitetura do sistema (diagrama de alto nível)
- 4.2 Modelo de domínio — entidades e relacionamentos
- 4.3 Máquinas de estado (Project, Vulnerability, Subscription, Ticket)
- 4.4 Decisões arquiteturais (ADRs principais)
- 4.5 Modelo de dados — MER
- 4.6 Contratos da API REST

**Ponto-chave**: vincular cada decisão de design a uma justificativa documentada (ADRs).

Ver: [[Visao Geral]], [[MER Conceitual]], [[Entidades e Relacionamentos]], [[07-Decisoes/]]

---

### Capítulo 5 — Implementação

**Objetivo**: descrever como o sistema foi construído.

Seções:
- 5.1 Stack técnica e justificativa
- 5.2 Back-end Express — estrutura em camadas
- 5.3 Front-end React + Vite — arquitetura web
- 5.4 App mobile Expo — escopo e limitações
- 5.5 Infraestrutura Docker e CI/CD
- 5.6 Integração com Gemini
- 5.7 Segurança da aplicação — controles implementados
- 5.8 Observabilidade — Prometheus e Grafana

**Ponto-chave**: não listar código extenso — mostrar escolhas, padrões e como as camadas se integram.

Ver: [[MOC - Arquitetura]], [[Politica de Desenvolvimento Seguro]]

---

### Capítulo 6 — Testes e Validação

**Objetivo**: demonstrar que o sistema funciona conforme especificado e é seguro.

Seções:
- 6.1 Estratégia de testes — filosofia pragmática
- 6.2 Testes canário — autenticação, multi-tenancy, regras de negócio
- 6.3 Testes de integração — fluxos principais
- 6.4 Análise estática com SonarQube
- 6.5 Análise dinâmica com OWASP ZAP
- 6.6 Resultados e achados

**Ponto-chave**: a estratégia de testes canário é diferencialmente acadêmico — mostrar que testar o que importa é mais valioso que perseguir cobertura.

Ver: [[Testes]], [[SonarQube]], [[OWASP ZAP]]

---

### Capítulo 7 — Resultados e Discussão

**Objetivo**: avaliar criticamente o que foi entregue.

Seções:
- 7.1 Funcionalidades implementadas vs. planejadas
- 7.2 Diferenciais técnicos do projeto
- 7.3 Limitações e trade-offs documentados
- 7.4 Casos didáticos — aplicações de colegas analisadas
- 7.5 Trabalhos futuros

**Ponto-chave**: honestidade sobre o que ficou de fora e por quê (decisões documentadas, não falhas não reconhecidas).

Ver: [[Casos Didaticos]], [[Historico de Ideias]], [[ADR-001 - Plataforma foca gestao e nao execucao real]]

---

### Capítulo 8 — Conclusão

**Objetivo**: sintetizar o aprendizado e o valor do projeto.

Seções:
- 8.1 Objetivos alcançados
- 8.2 Contribuições técnicas e acadêmicas
- 8.3 Reflexão sobre o processo de desenvolvimento
- 8.4 Considerações finais

---

### Elementos pós-textuais
- Referências bibliográficas
- Apêndices (se necessário): glossário, diagramas adicionais, contratos da API

---

## Distribuição de escrita por integrante

| Capítulo | Responsável principal | Revisão |
|---|---|---|
| 1 — Introdução | Iann | Rafael |
| 2 — Fundamentação teórica | Iann + Rafael | Rafael |
| 3 — Requisitos | Rafael | Guilherme |
| 4 — Modelagem | Rafael | Guilherme |
| 5 — Implementação | Rafael + Guilherme | Rafael |
| 6 — Testes | Guilherme + Rafael | Rafael |
| 7 — Resultados | Todos | Rafael |
| 8 — Conclusão | Todos | Rafael |

---

## Checklist de escrita

- [ ] Resumo e abstract redigidos
- [ ] Capítulo 1 concluído
- [ ] Capítulo 2 concluído
- [ ] Capítulo 3 concluído
- [ ] Capítulo 4 concluído
- [ ] Capítulo 5 concluído
- [ ] Capítulo 6 concluído — aguarda resultados dos testes ZAP
- [ ] Capítulo 7 concluído — aguarda casos didáticos
- [ ] Capítulo 8 concluído
- [ ] Referências formatadas (ABNT ou padrão da instituição)
- [ ] Revisão ortográfica final
- [ ] Formatação conforme normas da instituição

---

## Links relacionados
[[Evidencias para Banca]]
[[Metodologia]]
[[Distribuicao da Equipe]]
[[Referencias e Bases Teoricas]]
[[Casos Didaticos]]
[[Testes]]
[[MOC - Vulnera]]
