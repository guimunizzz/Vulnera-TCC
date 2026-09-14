---
type: tcc
tags: [academico, banca]
status: em-construcao
---

# Evidencias para Banca

Catálogo de evidências a serem coletadas e apresentadas à banca avaliadora. Organizadas por categoria, com indicação do que já existe e o que precisa ser gerado.

---

## 1. Evidências de produto funcional

### 1.1 Demo ao vivo (prioridade máxima)
**O que mostrar**:
- login como três perfis diferentes (Admin, Pentester, Cliente)
- fluxo completo: onboarding → aprovação → projeto → finding → evidência → relatório
- ~~chat em tempo real entre Pentester e Cliente~~ — **fora do escopo do MVP**, não implementado
- push notification no mobile ao criar finding crítico
- avaliação de maturidade com radar chart
- download de relatório PDF (executivo e técnico)
- ~~sugestão de finding via IA Gemini~~ — **IA cortada do escopo em 2026-08-03** ([[Adr 017 ia cortada do escopo do mvp]])
- **scan DAST ao vivo** (módulo [[DAST]]): informar a URL, acompanhar a barra de progresso real com as fases do ZAP, triar um achado, promover para `Vulnerability` mostrando o aviso de "vetor CVSS sugerido", e comparar com uma execução anterior do mesmo alvo

**Ambiente**: seed com dados realistas pré-carregados — não criar ao vivo.

**Checklist de ambiente (24h antes)**:
- [ ] `docker compose up -d` sem erros
- [ ] API respondendo em `localhost:3000`
- [ ] Web respondendo em `localhost:3001`
- [ ] Mobile com QR code ou emulador disponível
- [ ] Banco com seed de dados realistas
- [ ] Mailhog disponível para mostrar e-mails
- [ ] Prometheus + Grafana disponíveis para mostrar dashboards

### 1.2 Screenshots do produto
- [ ] Dashboard Admin (visão geral operacional)
- [ ] Dashboard Cliente (projetos e maturidade)
- [ ] Tela de finding com CVSS, severidade e histórico de status
- [ ] Tela de maturidade com radar chart
- [ ] DAST: banner do motor (vagas/fila), scan em progresso com fase nomeada, tabela de achados com coluna de triagem
- [ ] DAST: diálogo de promoção com o aviso de vetor CVSS **sugerido**
- [ ] DAST: painel de comparação entre duas execuções (resolvidos / novos / continuam abertos)
- [ ] Relatório PDF gerado (executivo e técnico)
- [ ] App mobile (lista de projetos + detalhe de finding)
- [ ] Notificação push no mobile

---

## 2. Evidências de qualidade e testes

### 2.1 Resultados dos testes automatizados
- [ ] Screenshot do CI com todos os checks passando (verde)
- [ ] Output do Jest mostrando canários passando
- [ ] Cobertura de código (relatório lcov)
- [ ] Pipeline completo do GitHub Actions concluído com sucesso

### 2.2 SonarQube
- [ ] Screenshot do dashboard do SonarQube com métricas
- [ ] TECH_STATUS.md com histórico de qualidade
- [ ] Zero Security Vulnerabilities no painel final
- [ ] Todos os Security Hotspots revisados

### 2.3 OWASP ZAP — papel 1 (ferramenta contra a própria aplicação)
- [ ] Relatório HTML do baseline scan pré-banca (`zap-reports/zap-report-prebanca.html`)
- [ ] Justificativa para cada alerta encontrado (falso positivo ou corrigido)

### 2.4 OWASP ZAP — papel 2 (motor do módulo DAST, funcionalidade de produto)
- [x] Dois relatórios reais em `docs/evidencias/dast/` com contraste deliberado: controle negativo (`example.com`, 13 alertas só de cabeçalho ausente) e controle positivo (OWASP Juice Shop, 16 alertas, incluindo *Backup File Disclosure* com 31 instâncias)
- [ ] Medição de recurso antes/depois do teto por container (`docker stats`): de `1.39GiB / 7.7GiB @ 564%` para `912MiB / 2GiB @ 64%`
- [ ] Evidência do watchdog: três scans disparados juntos → dois containers no `docker ps` + um na fila
- [ ] Saída da suíte E2E (Playwright) contra a stack real
- Ver [[OWASP ZAP]] para a distinção entre os dois papéis
- [ ] Screenshot da execução do scan

---

## 3. Evidências de arquitetura e documentação

### 3.1 Diagramas
- [ ] Diagrama de alto nível da arquitetura (do `Visao Geral.md`)
- [ ] Diagrama de fluxo de uma requisição (Controller → Guard → Service → Repository → DB)
- [ ] MER conceitual
- [ ] Diagrama de máquina de estados do Project e da Vulnerability

### 3.2 Código representativo
Trechos selecionados para mostrar na monografia (não código extenso):
- [ ] Guard de ownership mostrando `companyId === user.companyId`
- [ ] DTO com `class-validator` (ValidationPipe)
- [ ] Service de cálculo CVSS
- [ ] Repository com query parametrizada via Prisma
- [ ] Configuração de rate limiting no endpoint Gemini

### 3.3 ADRs
- [ ] 7 ADRs completos na monografia (ou como apêndice)
- [ ] Cada ADR com contexto, decisão e alternativas descartadas

---

## 4. Evidências de DevSecOps

### 4.1 Docker
- [ ] `docker-compose.yml` funcional (mostrável na apresentação)
- [ ] Build do CI com Dockerfiles rootless passando
- [ ] Screenshot dos containers rodando

### 4.2 CI/CD
- [ ] Workflow do GitHub Actions completo (`.github/workflows/ci.yml`)
- [ ] Branch protection configurada em `main`
- [ ] PR bloqueada por falha de canário (screenshot histórico)

### 4.3 Observabilidade
- [ ] Screenshot do Grafana — dashboard operacional (latência, throughput, erros)
- [ ] Screenshot do Grafana — dashboard de negócio (findings por severidade, projetos ativos)
- [ ] Screenshot do Prometheus com métricas expostas

---

## 5. Evidências de segurança da aplicação

- [ ] JWT com expiração curta verificável (inspect do token)
- [ ] Refresh token armazenado como hash no banco (mostrar no `psql` ou Prisma Studio)
- [ ] Logs sem dados sensíveis (mostrar output do Pino em runtime)
- [ ] AuditLog registrado para ações sensíveis (mostrar registros no banco)
- [ ] Resultado do ZAP sem achados críticos

---

## 6. Evidências do processo

### 6.1 Vault do Obsidian
O vault em si é uma evidência — demonstra documentação de engenharia além do código:
- [ ] Screenshot do vault com estrutura completa de notas
- [ ] Exemplo de ADR completo na apresentação
- [ ] Exemplo de entidade com definição, regras e links relacionados

### 6.2 Git
- [ ] Gráfico de commits mostrando contribuições dos 3 integrantes
- [ ] Histórico de PRs e merges ao longo do projeto
- [ ] Demonstrar branch `develop` e `main` com histórico de CI

---

## 7. Plano B para demo

Se algum componente falhar na hora da banca:

| Componente | Plano B |
|---|---|
| API não sobe | Vídeo gravado do fluxo completo |
| Mobile não conecta | Screenshots do app funcional |
| Gemini sem quota | Screenshots da sugestão IA em funcionamento |
| Grafana não sobe | Screenshots dos dashboards |
| Banco sem dados | Seed manual rápido via `npm run seed` |

---

## Checklist final pré-banca

- [ ] Todos os testes passando no CI
- [ ] ZAP executado e relatório gerado
- [ ] SonarQube sem vulnerabilidades abertas
- [ ] Seed de dados realistas carregado
- [ ] Demo ensaiada ao menos 3 vezes
- [ ] Vídeo de backup gravado
- [ ] Screenshots de todas as telas disponíveis
- [ ] Monografia revisada e formatada
- [ ] Slides aprovados por todos os integrantes

---

## Links relacionados
[[Estrutura da Monografia]]
[[Casos Didaticos]]
[[Testes]]
[[OWASP ZAP]]
[[SonarQube]]
[[Observabilidade]]
