---
type: decisao
tags: [decision, backend, dast, assincronia]
status: vigente
codigo: ADR-030
data: 2026-09-05
---

# ADR-030 - Execução assíncrona sem fila (watchdog em vez de Redis/BullMQ)

## Contexto

Um scan DAST leva minutos (spider + active scan do ZAP) — a resposta de `POST /dast/scans` não pode esperar o scan terminar. Isso exige algum mecanismo de execução em background. A abordagem padrão de mercado é uma fila (Redis + BullMQ/Bee-Queue): o request enfileira um job, um worker separado processa, o estado vive na fila.

O Vulnera **não tem Redis** e filas estão explicitamente fora de escopo desta entrega (ver prompt da Fase DAST, seção "NÃO construir"). A pergunta era: dá pra ter execução assíncrona confiável sem fila?

## Decisão

**Fire-and-forget dentro do próprio processo Node**, com o estado inteiramente no banco (`DastScan.status`), e um **watchdog no boot** que resolve o único problema que uma fila de verdade resolveria "de graça": sobrevivência a reinício do processo.

### Mecanismo

1. `POST /dast/scans` cria o registro `QUEUED`, chama `this.runInBackground(scan.id)` **sem `await`**, e responde imediatamente com o `id`.
2. `runInBackground` roda dentro do MESMO processo Node da API — não é um worker separado, não atravessa rede, não serializa job. Atualiza `RUNNING` → chama o runner → persiste findings → atualiza `COMPLETED`/`FAILED`.
3. O frontend faz **polling** (5s) em vez de WebSocket/SSE — mais simples, e o intervalo de 5s é imperceptível frente aos minutos que o scan já leva.
4. **Watchdog de boot** (`recoverOrphanedScans`, chamado em `server.ts` antes do `app.listen`): todo `DastScan` em `QUEUED`/`RUNNING` no momento do boot é, por definição, órfão — o processo anterior morreu no meio (crash, deploy, `Ctrl+C`) e não existe mais nenhum worker rodando aquele scan. Marca `FAILED` com mensagem explícita.

### Por que isso é aceitável sem fila

- **Um scan por alvo por vez já é a única concorrência que o produto precisa controlar** (regra de negócio, não escalabilidade) — não há fila de milhares de jobs disputando workers, é no máximo um punhado de scans simultâneos de pentesters diferentes.
- **O estado nunca fica só na memória do processo.** Cada transição de status é uma escrita no banco ANTES de prosseguir — se o processo morrer entre duas transições, o pior caso é o scan ficar preso em `RUNNING` até o próximo boot, que o watchdog resolve.
- **Cancelamento não depende de matar um job de fila** — é `docker rm -f <container>` (real) ou um flag de estado (simulado) checado antes de cada persistência (ver `dast-scan.service.ts`, corrida documentada no relatório da Fase 5).

### O que uma fila de verdade daria e isto não dá

- **Sobrevivência de scans EM ANDAMENTO a um restart.** Hoje, reiniciar a API no meio de um scan real MATA o acompanhamento dele (o container Docker pode continuar rodando órfão até o timeout do próprio `docker run`, mas ninguém mais está esperando o resultado — o watchdog marca `FAILED` e o trabalho é perdido). Numa fila com worker separado, o job sobreviveria a um restart da API.
- **Distribuição entre múltiplos processos/máquinas.** Hoje só um processo Node roda todos os scans. Escalar horizontalmente (2+ instâncias da API) duplicaria a lógica de "quem está rodando qual scan" — problema que uma fila resolve nativamente e que fire-and-forget não resolve de jeito nenhum.
- **Retry automático.** Um scan que falha por erro transitório não é reenfileirado sozinho — o pentester precisa criar um novo scan manualmente.

## Consequências

- Zero dependência nova de infraestrutura (sem Redis, sem worker separado, sem fila).
- Reiniciar a API durante um scan real perde o progresso daquele scan especificamente (watchdog garante que ele não fique "fantasma" para sempre, mas não o recupera).
- Não escala horizontalmente sem retrabalho — aceitável para o volume de uso desta entrega (um produto de TCC/demo, não uma plataforma multi-instância).
- Testado sem depender de timing real: `DAST_FORCE_SIMULATE=true` faz o fallback simulado rodar em ~3s determinísticos nos testes, e o watchdog é testado diretamente chamando `recoverOrphanedScans()` contra um registro `RUNNING` semeado manualmente (`DAST-LIFE-04`).

## Alternativa descartada

**Redis + BullMQ.** Descartada por estar explicitamente fora do escopo da entrega e por ser desproporcional ao volume real (um produto acadêmico com um punhado de scans concorrentes, não uma plataforma de milhares de jobs/hora). Se o produto crescer pra multi-instância ou precisar de retry automático, é o passo natural — o contrato de `DastScanService` (criar → rodar em background → atualizar estado) já é compatível com trocar "chamar `runInBackground` direto" por "enfileirar um job que chama a mesma lógica", sem reescrever o resto do módulo.

## Relacionado
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-029 - DAST como silo]]
