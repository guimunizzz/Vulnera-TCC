---
type: documentacao-tecnica
tags: [devsecops, seguranca]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# OWASP ZAP

## Objetivo
Realizar testes dinâmicos de segurança (DAST) na API do Vulnera para identificar vulnerabilidades em tempo de execução — injeções, configurações incorretas, headers ausentes, endpoints expostos. No TCC, serve como evidência prática de teste de segurança aplicado ao próprio produto.

## Papel no projeto
- análise de segurança dinâmica manual antes de marcos importantes do desenvolvimento
- identificação de vulnerabilidades que análise estática não detecta (XSS refletido, CORS mal configurado, missing headers, etc.)
- geração de relatório HTML exportável como evidência no TCC
- demonstra que a equipe aplicou segurança não apenas no código, mas também testou o comportamento da aplicação em execução

## Como se encaixa no Vulnera

### Quando roda
O OWASP ZAP **não roda no CI automático** — seria lento demais para cada PR e requer a aplicação em execução.

Roda **manualmente** antes de marcos importantes:
- ao final de cada fase do roadmap
- antes de apresentações e banca
- quando features críticas de segurança forem implementadas (autenticação, upload, JWT)

Decisão documentada em [[ADR-007 - Sonar informativo e ZAP manual]].

### Comando de execução

```bash
# Subir a aplicação localmente primeiro
docker compose up -d
cd apps/api && npm run dev   # terminal 1

# Executar ZAP baseline scan
docker run --rm \
  -v $(pwd)/zap-reports:/zap/wrk/ \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t http://host.docker.internal:3000 \
  -r zap-report.html
```

O relatório `zap-report.html` é gerado em `zap-reports/` na raiz do projeto.

### Tipos de scan disponíveis

| Scan | Comando | Descrição | Uso no projeto |
|---|---|---|---|
| Baseline | `zap-baseline.py` | Varredura passiva — não realiza ataque ativo | Uso padrão — seguro para qualquer momento |
| Full Scan | `zap-full-scan.py` | Varredura ativa com exploração | Apenas em ambiente isolado de teste |
| API Scan | `zap-api-scan.py` | Varredura baseada em OpenAPI/Swagger | Pode ser usado com spec do `express` |

No TCC, o **Baseline Scan** é suficiente para demonstrar a prática. O API Scan é um bônus se houver tempo.

### Scan com especificação OpenAPI

Se o `express` estiver configurado, é possível usar a spec para guiar o scan:

```bash
docker run --rm \
  -v $(pwd)/zap-reports:/zap/wrk/ \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t http://host.docker.internal:3000/api \
  -f openapi \
  -r zap-api-report.html
```

## O que o ZAP verifica

Exemplos de checks relevantes para o Vulnera:

| Check | Relevância |
|---|---|
| Missing security headers | Helmet configurado corretamente? |
| CORS misconfiguration | Origens restritas? |
| Information disclosure | API revela stack trace em erros 500? |
| Authentication bypass | Rotas protegidas acessíveis sem token? |
| Cross-site scripting (XSS) | Inputs refletidos sem escape? |
| SQL injection (básico) | Inputs chegam ao banco sem filtro? |
| Insecure cookies | Refresh token cookie com HttpOnly e Secure? |
| Content-Type sniffing | `X-Content-Type-Options: nosniff` presente? |

## Como documentar os resultados

1. Exportar relatório HTML: `zap-reports/zap-report-fase-{N}.html`
2. Registrar data e fase no relatório
3. Para cada alerta encontrado:
   - identificar se é falso positivo, aceito ou corrigível
   - corrigir o que for corrigível antes da próxima fase
4. Guardar relatório como evidência — mencionar no capítulo de DevSecOps do TCC

## Simplificações do TCC
- apenas Baseline Scan (passivo) como padrão — Full Scan exigiria ambiente dedicado
- sem autenticação configurada no ZAP para rotas protegidas — varredura das rotas públicas principalmente
- frequência manual, não automatizada — viabilidade acadêmica
- relatórios armazenados localmente, não em servidor de artefatos

## Riscos e cuidados
- rodar Full Scan em ambiente de desenvolvimento pode danificar dados de teste — usar apenas Baseline no ambiente padrão
- o ZAP image pode demorar para baixar na primeira vez (~500 MB)
- `host.docker.internal` funciona em Mac/Windows; em Linux pode ser necessário usar `--network host` ou o IP da máquina
- relatórios antigos devem ser versionados com indicação da fase para rastreabilidade

## Valor para a banca
- demonstra teste dinâmico de segurança além da análise estática
- relatório HTML é evidência visual direta de que segurança foi testada
- alinha com o propósito do próprio produto (plataforma de gestão de segurança)
- diferencia o TCC como projeto que pratica o que prega

## Links relacionados
[[SonarQube]]
[[GitHub Actions CI]]
[[Seguranca da Aplicacao]]
[[Politica de Desenvolvimento Seguro]]
[[ADR-007 - Sonar informativo e ZAP manual]]
[[MOC - Arquitetura]]
