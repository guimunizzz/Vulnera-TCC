---
type: hipoteses
tags: [operacao, hipotese]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Hipoteses em Validacao

Registro de afirmações sobre o projeto que ainda não foram confirmadas por implementação, teste ou feedback externo. Uma hipótese não é regra — é uma aposta informada que precisa ser validada.

> Hipóteses confirmadas devem ser movidas para a nota canônica correspondente.
> Hipóteses refutadas devem ser registradas com o resultado e a lição aprendida.

---

## Hipóteses técnicas

### HT-01 — Geração de PDF client-side é viável para 20+ páginas
**Status**: não validado em código
**Confiança**: alta (decisão tomada por design)

`pdf-lib` deve conseguir gerar o relatório técnico completo (20+ páginas com evidências) sem travar o browser em máquinas modernas.

**Como validar**: gerar PDF com dados sintéticos de 30 páginas e medir tempo + uso de memória no browser.

**Fallback se refutado**: paginar o relatório técnico em partes menores, geradas e baixadas separadamente.

---

### HT-02 — Socket.IO funciona bem com Expo no mobile
**Status**: não validado em código
**Confiança**: média

`socket.io-client` é compatível com React Native/Expo, mas o gerenciamento de reconexão em mobile (background/foreground) tem comportamento diferente de browsers.

**Como validar**: implementar handshake básico em Expo Go e testar reconexão ao colocar o app em background.

**Fallback se refutado**: no mobile, substituir chat por polling curto ou notificação push ao invés de WebSocket.

---

### HT-03 — CVSS v3.1 calculado no back-end é suficientemente preciso
**Status**: não validado em código
**Confiança**: alta

O cálculo do score CVSS v3.1 a partir do vector string pode ser implementado com biblioteca como `cvss` (npm) sem necessidade de lógica manual.

**Como validar**: comparar score calculado pela biblioteca com o resultado do calculador oficial CVSS do NIST para 5 vectors de exemplo.

---

### HT-04 — Rate limit de 10 chamadas/hora no Gemini é suficiente para o TCC
**Status**: hipótese de produto
**Confiança**: média

10 chamadas/hora por usuário deve ser suficiente para demonstrar a feature sem esgotar a cota gratuita do Gemini nas demos e testes.

**Como validar**: monitorar uso durante o desenvolvimento; ajustar se a cota gratuita for atingida antes do esperado.

---

### HT-05 — Prisma Migrate não requer rollback manual no desenvolvimento
**Status**: não validado em escala
**Confiança**: alta

Usando `prisma migrate dev` com banco de teste limpo, não deve ser necessário escrever rollbacks manuais durante o desenvolvimento.

**Como validar**: após 10+ migrations no projeto, verificar se houve necessidade de intervenção manual.

---

## Hipóteses de produto

### HP-01 — Clientes aceitam aprovar assinatura manualmente via Admin
**Status**: hipótese não testada com usuários
**Confiança**: média

O fluxo de aprovação manual (cliente solicita → Admin aprova) é aceitável para um produto SaaS de consultoria especializada.

**Como validar**: feedback de colegas do curso usando a plataforma como usuários de teste.

---

### HP-02 — Score de maturidade 1–5 é compreensível sem treinamento
**Status**: hipótese não testada com usuários
**Confiança**: média

A escala 1–5 por controle (1 = inexistente, 5 = otimizado) deve ser intuitiva para gestores de TI sem treinamento formal no modelo.

**Como validar**: pedir a colegas que não participam do TCC para interpretar um resultado de avaliação e verificar se entendem o score.

---

### HP-03 — Três planos (Basic/Pro/Pro+) são suficientes para o modelo de negócio simulado
**Status**: hipótese de design
**Confiança**: alta

A estrutura de planos (2 apps, 5 apps, ilimitado) cobre os principais perfis de empresa sem necessidade de customização adicional.

**Como validar**: ao criar seed de dados realistas, verificar se as empresas ficam naturalmente em planos distintos.

---

## Hipóteses de DevSecOps

### HD-01 — SonarQube informativo (sem Quality Gate) é suficiente para o TCC
**Status**: decisão tomada — em validação prática
**Confiança**: alta

Ver [[ADR-007 - Sonar informativo e ZAP manual]]. Hipótese: a equipe consultará os resultados do Sonar voluntariamente sem gate bloqueante.

**Como validar**: ao final do projeto, verificar se o histórico do TECH_STATUS.md mostra tendência estável ou decrescente de débito técnico.

---

### HD-02 — OWASP ZAP não encontrará vulnerabilidades críticas não corrigíveis antes da banca
**Status**: não validado — depende da implementação
**Confiança**: média

Se as práticas de desenvolvimento seguro documentadas no vault forem seguidas, o ZAP deve encontrar apenas alertas de baixa severidade ou falsos positivos.

**Como validar**: executar ZAP baseline scan ao final da Fase 7 e comparar com a [[Politica de Desenvolvimento Seguro]].

---

## Como usar este arquivo

- ao identificar uma incerteza técnica ou de produto: adicionar como hipótese com status "não validado"
- ao validar ou refutar: mover o resultado para a nota canônica e registrar no [[Changelog do Projeto]]
- ao surgir dúvida sem resposta imediata: registrar em [[Duvidas em Aberto]] na 99-Inbox

---

## Links relacionados
[[Historico de Ideias]]
[[Decisoes Recentes]]
[[Duvidas em Aberto]]
[[Politica de Desenvolvimento Seguro]]
[[ADR-007 - Sonar informativo e ZAP manual]]
[[MOC - Operacao]]
