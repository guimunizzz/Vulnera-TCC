---
type: documentacao-tecnica
tags: [devsecops, qualidade]
status: ativo
---

# SonarQube

## Objetivo
Analisar estaticamente o código do Vulnera para identificar bugs, vulnerabilidades, code smells e duplicações. No contexto do TCC, serve como ferramenta de monitoramento de qualidade e evidência acadêmica de boa prática.

## Papel no projeto
- análise estática contínua integrada ao CI
- monitoramento de tendência de débito técnico ao longo do desenvolvimento
- evidência documentada de qualidade para a banca
- identificação antecipada de vulnerabilidades comuns no código

## Como se encaixa no Vulnera

### Infraestrutura
SonarQube roda como container Docker via `docker-compose.yml`:

```yaml
sonarqube:
  image: sonarqube:10-community
  container_name: vulnera-sonar
  ports:
    - "9000:9000"
  environment:
    SONAR_ES_BOOTSTRAP_CHECKS_DISABLE: "true"
  volumes:
    - vulnera-sonar-data:/opt/sonarqube/data
    - vulnera-sonar-ext:/opt/sonarqube/extensions
```

Acesso local: `http://localhost:9000` (login padrão: `admin/admin` — trocar na primeira entrada).

### Integração com CI (GitHub Actions)

```yaml
sonarqube:
  runs-on: ubuntu-latest
  needs: test
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0   # necessário para análise de histórico
    - uses: SonarSource/sonarqube-scan-action@v2
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

O scan roda **apenas em PRs** — não a cada push direto (para não aumentar custo de CI em commits rápidos de desenvolvimento).

### Configuração do projeto (`sonar-project.properties`)

```properties
sonar.projectKey=vulnera
sonar.projectName=Vulnera
sonar.sources=apps/api/src,apps/web/app,apps/web/components
sonar.tests=apps/api/src
sonar.test.inclusions=**/*.spec.ts,**/*.test.ts
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**
sonar.typescript.lcov.reportPaths=coverage/lcov.info
```

## Modo de uso — não bloqueante

> **SonarQube é informativo no Vulnera. Não bloqueia merge.**

Decisão documentada em [[ADR-007 - Sonar informativo e ZAP manual]].

Motivos para não bloquear:
- Quality Gates automáticos no SonarQube Community têm alto custo de configuração para pouco ganho em projeto de TCC
- O objetivo é **monitorar tendência**, não barrar PRs por code smell pontual
- A equipe tem 3 pessoas com deadline de 7 meses — produtividade vale mais que gate estrito

## Métricas acompanhadas

| Métrica | O que mede | Meta |
|---|---|---|
| Bugs | Erros de lógica detectados estaticamente | 0 críticos |
| Vulnerabilities | Vulnerabilidades de segurança no código | 0 |
| Code Smells | Problemas de manutenibilidade | Tendência decrescente |
| Coverage | % de código coberto por testes | > 60% (meta) |
| Duplication | % de código duplicado | < 10% |
| Security Hotspots | Pontos de atenção de segurança a revisar manualmente | Todos revisados |

## TECH_STATUS.md — atualização automática

O CI atualiza automaticamente um arquivo `TECH_STATUS.md` no `develop` com o resumo do estado técnico:

```yaml
update-tech-status:
  runs-on: ubuntu-latest
  needs: test
  if: github.event_name == 'push' && github.ref == 'refs/heads/develop'
  steps:
    - run: npm run tech-status:update
    - name: Commit auto-update
      run: |
        git config user.name "vulnera-bot"
        git add TECH_STATUS.md
        git diff --staged --quiet || git commit -m "chore: atualiza TECH_STATUS.md [skip ci]"
        git push
```

## Simplificações do TCC
- **sem Quality Gate bloqueante** — análise é informativa
- SonarQube Community Edition (gratuito) — sem análise de branches paralelas
- instância local no Docker — sem servidor SonarCloud externo
- não cobre análise do app mobile (Expo/React Native) — foco no back-end e web

## Riscos e cuidados
- o container SonarQube consome ~2 GB de RAM — em máquinas com pouca memória pode ser necessário subir separado do restante
- `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE: "true"` no docker-compose contorna limitação de memória do Elasticsearch embutido — aceitável em dev local
- `SONAR_TOKEN` deve estar configurado nos GitHub Secrets — nunca em código ou workflow YAML

## Valor para a banca
- demonstra análise estática contínua integrada ao processo de desenvolvimento
- relatórios do SonarQube podem ser exportados como evidência no capítulo de DevSecOps do TCC
- mostra que o projeto tem preocupação ativa com qualidade e não apenas funcionalidade

## Links relacionados
[[GitHub Actions CI]]
[[Docker Compose]]
[[Seguranca da Aplicacao]]
[[Logs Estruturados]]
[[ADR-007 - Sonar informativo e ZAP manual]]
[[MOC - Arquitetura]]
