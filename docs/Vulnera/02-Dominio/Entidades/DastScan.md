---
type: entidade
tags: [domain, source-of-truth, dast]
status: ativo
---

> [!info] Nota criada em 2026-09-10
> Entidade introduzida pelo módulo [[DAST]] (Fase 9, 2026-09-05) e estendida nas Fases 9.1/9.2 (2026-09-09). Os nomes de campo abaixo são os **reais do `schema.prisma`** (camelCase), não a convenção conceitual snake_case usada nas notas de entidade mais antigas — o módulo já existe em código e o código é a verdade.

# DastScan

## Definição

Uma **execução** de scan dinâmico (DAST) do OWASP ZAP contra uma `targetUrl`. Um scan = um container `vulnera-zap-<id>` = uma URL de alvo.

## Papel no sistema

É a unidade de trabalho do módulo [[DAST]]: o pentester informa uma URL, a plataforma sobe o container, conduz spider → passivo → ativo pela API HTTP do ZAP e persiste o resultado. O registro é também o que a interface consulta por polling enquanto o scan corre — o progresso vive no banco, não em memória, porque quem responde o `GET /dast/scans/:id` pode ser outro processo (ou o mesmo depois de um restart).

## Campos críticos

| Campo | Papel |
|---|---|
| `targetUrl` | Alvo do scan. `VarChar(2048)`, validado contra SSRF antes de qualquer `docker run` |
| `status` | [[Enum - DAST]] `DastScanStatus` — `QUEUED`/`RUNNING`/`COMPLETED`/`FAILED`/`CANCELLED` |
| `requestedById` | FK → [[User]]. Base da ownership fina: PENTESTER só enxerga os próprios scans |
| `containerName` | Derivado do `id` (`vulnera-zap-<id>`) e **persistido** para permitir `docker rm -f` no cancelamento sem recalcular nada |
| `progress` / `phase` | 0-100 consolidado das fases e rótulo curto da fase corrente (`SPIDER`, `PASSIVE`, `ACTIVE`, `REPORT`…). `phase` é `String` e não enum de propósito: é rótulo de UI, não máquina de estados — `status` já é a máquina |
| `simulated` | `true` quando o resultado veio do gerador simulado (Docker indisponível ou queda no fallback). Antes de 2026-09-09 essa informação existia só dentro do `report.json` e era invisível na aplicação inteira |
| `warningMessage` | Aviso quando o scan **concluiu** com ressalva (tipicamente o fallback simulado). Distinto de `errorMessage`, que só existe em `FAILED` |
| `htmlReportPath` / `jsonReportPath` | Caminhos dos relatórios gravados pelo processo Node. Leitura sempre por `resolveReportPath` (whitelist de extensão + prefixo obrigatório) |
| `alertsHigh/Medium/Low/Info` | Contadores desnormalizados, gravados na mesma `$transaction` do insert dos findings |
| `durationMs`, `startedAt`, `finishedAt` | Medição da execução — o que distingue um scan real (dezenas de segundos a minutos) de um simulado (~3s) |

## Relacionamentos

- solicitado por um [[User]] (`requestedById`)
- possui múltiplos [[DastFinding]] (`onDelete: Cascade`)
- **não** tem FK para [[Project]], [[Application]] ou [[Company]] — silo consciente, ver [[ADR-029 - DAST como silo]]

## Estados

`QUEUED → RUNNING → COMPLETED | FAILED | CANCELLED`

Não é uma máquina de estados de domínio como [[Maquina - Vulnerability]] — é o ciclo de vida de um processo. Transições não são pedidas por usuário (exceto `CANCELLED`, via `POST /:id/cancel`), e sim escritas pelo runner e pelo watchdog:

- `QUEUED` → entra na fila FIFO do watchdog; vira `RUNNING` só quando há vaga (teto de `DAST_MAX_CONCURRENT_SCANS`, padrão 2)
- `RUNNING` sem pulso por `DAST_HEARTBEAT_TIMEOUT_MS` (2 min) é abortado pelo watchdog
- scan `QUEUED`/`RUNNING` encontrado no boot da API só pode ser órfão de um restart anterior — marcado `FAILED` antes de a API aceitar tráfego

## Regras e decisões associadas

- [[ADR-028 - Execucao do ZAP via Docker spawn]] — um container por scan, `execFile` sem shell
- [[ADR-030 - Execucao assincrona sem fila]] — fire-and-forget dentro do processo Node
- [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]] — daemon + API HTTP, watchdog, progresso real
- Visível apenas para `PENTESTER` e `ADMIN` — `CLIENT` recebe 403 em qualquer rota `/dast/*` ([[Matriz de Permissoes]])

## Observações

O índice composto `[status, targetUrl(length: 191)]` existe para o lock "um scan por alvo de cada vez". O prefixo de 191 caracteres é obrigatório: `targetUrl` é `VarChar(2048)` e o índice completo estouraria o teto de bytes por índice do MySQL.

## Links relacionados

[[DastFinding]]
[[DAST]]
[[Fluxo - Scan DAST]]
[[Enum - DAST]]
[[OWASP ZAP]]
[[MOC - Dominio]]
