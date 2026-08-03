---
type: contexto
tags: [core]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Diferenciais e Posicionamento

## O que torna o Vulnera um TCC forte

1. **Não é CRUD** — máquina de estados, integrações externas, real-time, IA e mobile
2. **TypeScript end-to-end** — tipagem forte em API, web e mobile demonstra maturidade técnica
3. **Três aplicações integradas** — web admin, web cliente e mobile com comunicação real
4. **DevSecOps aplicado ao próprio produto** — meta-prova-de-conceito: a plataforma que fala sobre segurança é desenvolvida com práticas de segurança
5. **Integração real com IA** — Gemini como assistência técnica ao pentester, tema atual e valorizado
6. **Baseado em padrões de mercado** — CVSS v3.1 e OWASP Top 10, não critérios inventados
7. **Problema claro e verificável** — solução testável com aplicações de colegas do curso como alvos
8. **Observabilidade** — Prometheus + Grafana, raro em TCCs e comum em produtos de produção
9. **Trilha de auditoria** — raro em TCC, requisito comum em produtos de segurança reais
10. **Arquitetura com camadas claras** — controller → service → repository → banco, com testes por camada

## Pitch para banca (frase de elevador)

> O **Vulnera** é uma plataforma SaaS que simula a operação de uma consultoria de segurança da informação, composta por back-end Express, front-end React + Vite e app mobile React Native, toda em TypeScript. Permite que empresas contratem análises de segurança, acompanhem findings em tempo real com máquina de estados baseada em CVSS e OWASP, e recebam relatórios gerados com apoio de IA. A própria infraestrutura demonstra práticas DevSecOps: containers rootless, CI/CD com SonarQube e OWASP ZAP, e observabilidade via Prometheus/Grafana.

## Posicionamento no mercado acadêmico
- não compete com ferramentas reais como Burp Suite ou Acunetix — é plataforma de gestão, não de ataque
- ocupa a lacuna de sistemas que organizam e comunicam resultados de análise
- simula o tipo de sistema usado em consultorias reais de segurança (ex: portais de cliente)

## Relacionado
[[Visao Geral]]
[[Proposta de Valor]]
[[Fora do Escopo]]
[[ADR-001 - Plataforma foca gestao e nao execucao real]]
