---
type: decisao
tags: [decision, source-of-truth]
status: vigente
codigo: ADR-007
---

# ADR-007 - Sonar informativo e ZAP manual

## Contexto
O Vulnera é uma plataforma de segurança — sua própria segurança técnica e qualidade de código têm peso acadêmico direto. A equipe decidiu incorporar duas ferramentas de DevSecOps:

- **SonarQube**: análise estática contínua (SAST) integrada ao CI
- **OWASP ZAP**: teste dinâmico de segurança (DAST) da aplicação em execução

O debate central foi: **qual o nível de integração de cada ferramenta no fluxo de desenvolvimento?**

Duas forças em tensão:
1. **Rigor técnico**: Quality Gates bloqueantes no SonarQube + ZAP automatizado no CI garantem zero regressão de qualidade
2. **Viabilidade acadêmica**: configuração pesada de Quality Gates + scan DAST em CI aumentam o tempo de pipeline, o custo de manutenção e o risco de bloqueios desnecessários em projeto com deadline fixo de 7 meses

## Decisão
**SonarQube opera em modo informativo (não bloqueia merge). OWASP ZAP roda manualmente antes de marcos importantes.**

### SonarQube — informativo
- roda em cada PR via GitHub Actions
- resultado visível no PR como comentário (não como check bloqueante)
- sem Quality Gate configurado como required check
- equipe acompanha tendência via `TECH_STATUS.md` atualizado automaticamente no `develop`

### OWASP ZAP — manual, por marcos
- não roda no CI
- roda manualmente antes de: fim de cada fase do roadmap, apresentações, banca
- comando único via Docker: `zap-baseline.py` contra `localhost:3000`
- relatório HTML exportado como evidência no TCC

## Alternativas consideradas

### Alternativa A: SonarQube com Quality Gate bloqueante
- **Prós**: zero merge de código com débito técnico acima do threshold; disciplina contínua
- **Contras**: configurar Quality Gates consistentes no SonarQube Community Edition é trabalhoso; thresholds inadequados causam bloqueios falsos e friction desnecessária; um code smell pontual não deveria barrar feature crítica com deadline em 2 dias

### Alternativa B: ZAP automatizado no CI
- **Prós**: detecção automática de regressão de segurança dinâmica
- **Contras**: ZAP DAST exige a aplicação em execução dentro do pipeline — requer ambiente de staging dedicado (outro container, setup de banco, migrations, seed) adicionando > 10 min por execução; risco de falsos positivos quebrando CI em commits legítimos; escopo muito além do necessário para TCC

### Alternativa C (adotada): informativo + manual por marcos
- **SonarQube informativo**: fornece visibilidade sem friction; equipe toma decisões conscientes sobre débito técnico sem ser bloqueada por configuração imprecisa
- **ZAP manual por marcos**: scan ocorre quando relevante (antes de entregas), relatório vira evidência documentada, sem overhead de CI

## Consequências positivas

### SonarQube informativo
- CI continua rápido (scan adiciona ~2 min, não bloqueia)
- visibilidade de tendência: se o número de code smells cresce sem parar, a equipe percebe e toma ação
- `TECH_STATUS.md` automatizado cria histórico do estado técnico do projeto ao longo do tempo
- evidência real de uso de ferramenta SAST para a banca

### ZAP manual
- relatório HTML é evidência visual direta — melhor para o TCC do que um log de CI
- execução antes da banca garante que os resultados refletem o estado final do produto
- comandos simples e reproduzíveis — qualquer integrante executa sem configuração adicional
- falsos positivos são avaliados manualmente, não quebram CI

## Trade-offs e limitações
- regressões de qualidade de código podem entrar em `main` se a equipe ignorar os avisos do SonarQube
- vulnerabilidades dinâmicas introduzidas entre um marco e outro só são detectadas no próximo ZAP manual
- requer disciplina da equipe para consultar os resultados mesmo sem gate bloqueante

## Mitigação dos trade-offs
- `TECH_STATUS.md` atualizado automaticamente no `develop` cria pressão visível sobre débito técnico
- política definida: todo Security Hotspot do SonarQube deve ser revisado (marcado como "reviewed" ou corrigido) antes da banca
- ZAP agendado para ao menos 3 execuções: fim da Fase 3 (MVP core), fim da Fase 5 (features completas), pré-banca

## Impacto no sistema

| Área | Impacto |
|---|---|
| CI pipeline | SonarQube scan em PRs — job `sonarqube` não é required check |
| Branch protection | Required checks: `lint`, `test`, `docker-build` — SonarQube não está na lista |
| Qualidade visível | `TECH_STATUS.md` no `develop` com snapshot de métricas |
| Segurança dinâmica | Relatórios ZAP em `zap-reports/` versionados por fase |
| Evidência TCC | Relatórios HTML do ZAP + histórico do TECH_STATUS.md |

## Quando revisar
Revisar esta decisão se:
- o time quiser formalizar um Quality Gate antes da entrega final (aumenta rigor, aceitável perto da banca)
- surgir uma pipeline com ambiente de staging real onde o ZAP possa rodar automaticamente
- o projeto evoluir para além do TCC com processo de release formal

## Links relacionados
[[SonarQube]]
[[OWASP ZAP]]
[[GitHub Actions CI]]
[[Seguranca da Aplicacao]]
[[Politica de Desenvolvimento Seguro]]
[[MOC - Arquitetura]]
