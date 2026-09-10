---
type: documentacao-tecnica
tags: [devsecops, seguranca]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# OWASP ZAP

> [!warning] Nota atualizada em 2026-09-10 — o ZAP tem **dois papéis** desde set/2026
> Esta nota descrevia apenas o uso **manual** do ZAP como ferramenta de DevSecOps contra a própria aplicação ([[ADR-007 - Sonar informativo e ZAP manual]]), que continua válido e está documentado abaixo.
> A partir da Fase 9 (2026-09-05), o ZAP também é o **motor de um módulo do produto**: o [[DAST]] sobe um container do ZAP por scan, conduzido pela API HTTP dele, contra a URL que o pentester informar. Ver a seção "Papel 2" e `docs/DAST.md`.

## Os dois papéis, lado a lado

| | **Papel 1 — ferramenta de DevSecOps** | **Papel 2 — motor do módulo DAST** |
|---|---|---|
| Alvo | A própria aplicação Vulnera | Qualquer URL que o pentester informar |
| Quem dispara | A equipe, manualmente, no terminal | O `PENTESTER`/`ADMIN`, pela interface do produto |
| Quando | Ao fim de fases e antes de marcos | Sob demanda, a qualquer momento |
| Como roda | `zap-baseline.py` num container efêmero | `zap.sh -daemon` num container por scan, dirigido pela API HTTP |
| Saída | Relatório HTML guardado como evidência do TCC | [[DastFinding]] persistidos + HTML do ZAP + PDF client-side |
| Decisão | [[ADR-007 - Sonar informativo e ZAP manual]] | [[ADR-028 - Execucao do ZAP via Docker spawn]], [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]] |

---

# Papel 1 — ZAP como ferramenta de DevSecOps

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

## Simplificações do TCC (papel 1)
- apenas Baseline Scan (passivo) como padrão — Full Scan exigiria ambiente dedicado
- sem autenticação configurada no ZAP para rotas protegidas — varredura das rotas públicas principalmente
- frequência manual, não automatizada — viabilidade acadêmica
- relatórios armazenados localmente, não em servidor de artefatos

## Riscos e cuidados (papel 1)
- rodar Full Scan em ambiente de desenvolvimento pode danificar dados de teste — usar apenas Baseline no ambiente padrão
- o ZAP image pode demorar para baixar na primeira vez (~500 MB)
- `host.docker.internal` funciona em Mac/Windows; em Linux pode ser necessário usar `--network host` ou o IP da máquina
- relatórios antigos devem ser versionados com indicação da fase para rastreabilidade

---

# Papel 2 — ZAP como motor do módulo DAST

> Visão de produto em [[DAST]]; passo a passo, troubleshooting e comandos exatos em `docs/DAST.md`.

## Como o produto executa o ZAP

- **Um container por scan**, nomeado `vulnera-zap-<scanId>` e destruído ao fim ou no cancelamento (`docker rm -f`). Nunca um daemon compartilhado entre scans — isolamento é o ponto ([[ADR-028 - Execucao do ZAP via Docker spawn]]).
- **Modo daemon (`zap.sh -daemon`), conduzido pela API HTTP do ZAP**: spider → scan passivo → scan ativo → relatórios. A troca do `zap-full-scan.py` para o daemon aconteceu na Fase 9.1 porque o script empacotado é uma caixa preta sem progresso — qualquer barra construída sobre ele seria estimativa de tempo fingindo ser medição ([[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]).
- **`api.key` aleatória por scan** — nunca `api.disablekey`.
- **DooD (Docker-out-of-Docker)**: a imagem da API traz `docker-cli` e o socket do host é montado no container. Risco assumido e documentado, não eliminado.
- **`execFile("docker", [...])`, jamais shell** — imune a command injection.
- **Fallback simulado** quando o Docker não está disponível; o registro nasce com `simulated = true` e a interface **declara isso** em vez de fingir um scan real.

## Limites operacionais

| Variável | Papel |
|---|---|
| `DAST_MAX_CONCURRENT_SCANS` | Teto de scans simultâneos (padrão 2); o excedente entra em fila FIFO no watchdog |
| `DAST_ZAP_MEMORY` / `DAST_ZAP_CPUS` | `--memory`/`--memory-swap`/`--cpus` do container. ⚠️ Precisam andar junto com o `-Xmx` derivado: o `zap.sh` calcula o heap a partir da RAM do **host**, não do limite do cgroup — sozinho, o `--memory` só troca "sem teto" por "morre de OOM no meio do active scan" |
| `DAST_HEARTBEAT_TIMEOUT_MS` | Silêncio máximo antes de o watchdog abortar um scan (2 min) |
| `DAST_SCAN_TIMEOUT_MS`, `DAST_ZAP_STARTUP_TIMEOUT_MS`, `DAST_ZAP_SPIDER_MAX_DURATION_MIN` | Tempos-limite de execução, de subida do daemon e do spider |
| `DAST_ALLOW_PRIVATE_TARGETS` | Libera loopback/faixas privadas — **só em desenvolvimento** |
| `DAST_FORCE_SIMULATE` | Força o gerador simulado; é o que mantém a suíte de testes independente de Docker |
| `DAST_ZAP_IMAGE`, `DAST_ZAP_NETWORK`, `DAST_REPORTS_DIR` | Imagem, rede e destino dos relatórios |

Medição real que motivou os limites de recurso (Fase 9.2): **antes**, dois scans simultâneos ocupavam ~960% de 1200% de CPU e cresciam sem teto de RAM (`936MiB` e `1.39GiB` contra os `7.7GiB` da VM inteira do Docker); **depois**, `912MiB / 2GiB @ 64%`.

## Segurança do papel 2

- **SSRF**: a URL é validada antes de qualquer `docker run` — loopback e faixas privadas bloqueados por padrão. Limitação conhecida: a checagem é sobre o literal da URL, não sobre o DNS resolvido (DNS rebinding não é coberto).
- **Path traversal**: leitura de relatório só por `resolveReportPath` (whitelist de extensão + prefixo obrigatório do diretório de relatórios).
- **XSS do relatório de terceiro**: o HTML original do ZAP é servido em `<iframe sandbox>`, não injetado na página.
- **Acesso ao socket Docker pela API**: o maior risco do módulo, aceito e registrado no [[ADR-028 - Execucao do ZAP via Docker spawn]].

## ⚠️ Ética e escopo

O papel 2 executa **ataque ativo contra o alvo informado**. Só se aponta para alvos próprios ou com autorização — em laboratório, o OWASP Juice Shop. Isso põe em tensão o [[ADR-001 - Plataforma foca gestao e nao execucao real]], que segue vigente e não foi revisado; a tensão está registrada na própria ADR-001.

---

## Valor para a banca (os dois papéis)
- **papel 2:** o produto não só prega segurança, ele **executa** varredura dinâmica de verdade — é o módulo em que o Vulnera deixa de ser apenas gestão
- demonstra teste dinâmico de segurança além da análise estática
- relatório HTML é evidência visual direta de que segurança foi testada
- alinha com o propósito do próprio produto (plataforma de gestão de segurança)
- diferencia o TCC como projeto que pratica o que prega

## Links relacionados
[[DAST]]
[[DastScan]]
[[DastFinding]]
[[Fluxo - Scan DAST]]
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]
[[SonarQube]]
[[GitHub Actions CI]]
[[Seguranca da Aplicacao]]
[[Politica de Desenvolvimento Seguro]]
[[ADR-007 - Sonar informativo e ZAP manual]]
[[MOC - Arquitetura]]
