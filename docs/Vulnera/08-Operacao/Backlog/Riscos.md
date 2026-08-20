---
type: backlog
tags: [risco, operacao]
status: ativo
---

> [!danger] Risco novo em 2026-07-26 — cronograma sem buffer
> O prazo caiu de 4 para 3 meses. As 13 semanas restantes cobrem 6 fases **sem folga para imprevisto** — o plano anterior tinha 2 semanas de buffer.
>
> **Mitigação definida:** com atraso acumulado > 1 semana até o fim da Fase 6, a Fase 7 (Mobile + IA) encolhe primeiro — mobile vira demonstração de telas com dados de seed, sem push funcional.
>
> **Risco secundário:** três decisões seguem em aberto (F-01 Factory Method, F-02 provedor de IA, F-03 domínios de maturidade). A F-01 é a mais cara de adiar — cada fase implementada multiplica o custo de reintroduzir o padrão.

# Riscos

## Tabela de riscos

| # | Risco | Probabilidade | Impacto | Status |
|---|---|---|---|---|
| R1 | Iann abandonar o projeto | Alta | Médio | Monitorar |
| R2 | Escopo inflar além do planejado | Alta | Alto | Monitorar |
| R3 | Gemini exceder cotas gratuitas | Média | Baixo | Mitigado |
| R4 | Complexidade de Socket.IO + mobile | Média | Médio | Monitorar |
| R5 | PDF client-side travar o navegador | Baixa | Médio | Mitigado |
| R6 | Rafael sobrecarregado | Alta | Alto | Monitorar |
| R7 | Dessincronização entre web, mobile e back | Média | Alto | Mitigado |
| R8 | Apresentação sem tempo de ensaio | Média | Alto | Prevenido |
| R9 | Demo sem dados realistas | Baixa | Médio | Prevenido |
| R10 | SonarQube/ZAP com achados não corrigidos na banca | Média | Alto | Monitorar |

---

## Detalhamento dos riscos

### R1 — Iann abandonar o projeto
**Probabilidade**: Alta
**Impacto**: Médio

Iann está em situação de cursando — há risco real de evasão ou sobrecarga de disciplinas.

**Mitigação**:
- nenhuma tarefa de Iann está no caminho crítico do MVP
- suas tarefas (documentação, seed, tickets) são passáveis para Rafael ou Guilherme sem retrabalho de arquitetura
- todas as decisões técnicas estão documentadas no vault — não há conhecimento bloqueado por integrante

**Ação**: monitorar engajamento no final da Fase 1; redistribuir tarefas se necessário no planejamento da Fase 2.

---

### R2 — Escopo inflar
**Probabilidade**: Alta
**Impacto**: Alto

O projeto tem potencial para crescer indefinidamente — notificações avançadas, múltiplos tipos de relatório, integração com ferramentas externas de pentest, etc.

**Mitigação**:
- [[Fora do Escopo]] documentada explicitamente no vault
- ADRs registram decisões de simplificação (mobile read-only, PDF client-side, Gemini assistivo)
- roadmap com fases explícitas — features que aparecerem fora do roadmap entram em backlog, não no sprint

**Ação**: qualquer feature nova passa pelo teste: "está na Fase atual ou anterior?". Se não, vai para backlog com nota no vault.

---

### R3 — Gemini exceder cotas gratuitas
**Probabilidade**: Média
**Impacto**: Baixo

O tier gratuito do Gemini tem limite de requisições por minuto e por dia.

**Mitigação**:
- rate limit rigoroso por usuário (10 chamadas/hora) — [[ADR-006 - Gemini com rate limit agressivo]]
- fallback silencioso: se quota estourar, o formulário de finding é exibido sem sugestão (sem erro visível)
- Gemini é assistivo, não essencial — a plataforma funciona completamente sem ele

**Status**: mitigado em design — implementar rate limit desde o início.

---

### R4 — Complexidade de Socket.IO + mobile
**Probabilidade**: Média
**Impacto**: Médio

WebSocket + Expo + gerenciamento de conexão em React Native é uma combinação com bastante atrito.

**Mitigação**:
- mobile é read-mostly — chat no mobile não é requisito da Fase 4
- no mobile, chat pode ser substituído por "só notificação push" inicialmente
- Socket.IO client funciona em Expo — é tecnicamente suportado, mas requer teste cuidadoso de reconexão

**Ação**: implementar chat mobile por último; validar reconexão no Expo antes de expor como feature.

---

### R5 — PDF client-side travar o navegador
**Probabilidade**: Baixa
**Impacto**: Médio

Relatório técnico com 20+ páginas e muitas evidências pode consumir memória significativa no browser.

**Mitigação**:
- evidências aparecem como thumbnails no PDF, não em resolução original
- paginação controlada entre seções do relatório
- geração assíncrona com loading state — não bloqueia a UI durante a geração

**Status**: mitigado em design — [[ADR-003 - PDF gerado no cliente]] já considera esse trade-off.

---

### R6 — Rafael sobrecarregado
**Probabilidade**: Alta
**Impacto**: Alto

Rafael é responsável pelas partes mais críticas: auth, máquinas de estado, CVSS, CI/CD, Gemini, observabilidade. Concentração alta de ownership técnico.

**Mitigação**:
- delegar CRUDs de menor risco a Guilherme (o que já está no plano)
- bloqueio de 2h/dia para code review — não acumular PRs
- documentação no vault reduz dependência de conhecimento tácito
- Guilherme assume ownership de chat e mobile — Rafael revisa mas não é bloqueante

**Ação**: acompanhar carga no daily async; redistribuir se Rafael estiver atrasado em 2 sprints seguidos.

---

### R7 — Dessincronização entre web, mobile e back
**Probabilidade**: Média
**Impacto**: Alto

Com 3 aplicações em desenvolvimento paralelo, tipos podem divergir entre back-end, web e mobile.

**Mitigação**:
- `packages/types/` no monorepo — tipos TypeScript compartilhados entre as 3 aplicações
- DTOs do back geram os tipos do front automaticamente via TypeScript strict
- CI valida build das 3 aplicações em cada PR

**Status**: mitigado em arquitetura — package de tipos compartilhados resolve o problema estruturalmente.

---

### R8 — Apresentação sem tempo de ensaio
**Probabilidade**: Média
**Impacto**: Alto

Demo ao vivo com banco de dados, WebSocket, mobile e IA tem muitas dependências — qualquer falha em 15 minutos de apresentação é catastrófica.

**Mitigação**:
- buffer de 3–4 semanas no cronograma (Fase 8) dedicado a ensaio
- seed com dados realistas pré-carregados — não depender de criação ao vivo
- checklist de ambiente a verificar 24h antes da banca
- plano B: screenshots e vídeo gravado se ambiente travar

**Status**: prevenido em cronograma — Fase 8 tem buffer explícito para ensaios.

---

### R9 — Demo sem dados realistas
**Probabilidade**: Baixa
**Impacto**: Médio

Uma demo com empresas chamadas "Empresa Teste" e findings como "teste" não impressiona a banca.

**Mitigação**:
- seed com 2 empresas fictícias mas plausíveis (ex: FinTech SA, E-commerce LTDA)
- 10 findings representativos com severidades variadas, descrições reais e evidências
- 1 projeto encerrado com relatório PDF gerado

**Status**: prevenido em planejamento — tarefa de seed atribuída a Iann na Fase 8.

---

### R10 — SonarQube/ZAP com achados não corrigidos na banca
**Probabilidade**: Média
**Impacto**: Alto

A banca pode questionar diretamente sobre achados do SonarQube ou do ZAP. Achados abertos sem justificativa comprometem a credibilidade do produto.

**Mitigação**:
- tratar achados logo, não acumular — cada sprint inclui revisão do painel Sonar
- todo Security Hotspot deve ser marcado como "reviewed" ou corrigido antes da banca
- relatório ZAP gerado na Fase 7 e novamente na véspera da banca
- falsos positivos documentados com justificativa no vault

**Ação**: criar sprint de hardening na Fase 7 dedicado a zerar achados críticos.

---

## Como atualizar este arquivo

Quando um risco:
- **materializar**: registrar o impacto no [[Changelog do Projeto]] e mover para "Riscos materializados" abaixo
- **ser mitigado com sucesso**: mudar status para "Resolvido"
- **novo risco surgir**: adicionar linha na tabela + seção de detalhamento

## Riscos materializados

*(nenhum até 2026-04-24)*

---

## Links relacionados
[[Roadmap Fases]]
[[Tarefas Abertas]]
[[Changelog do Projeto]]
[[ADR-001 - Plataforma foca gestao e nao execucao real]]
[[ADR-006 - Gemini com rate limit agressivo]]
[[MOC - Operacao]]
