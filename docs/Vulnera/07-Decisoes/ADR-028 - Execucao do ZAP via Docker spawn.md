---
type: decisao
tags: [decision, backend, dast, docker, seguranca]
status: vigente
codigo: ADR-028
data: 2026-09-05
---

# ADR-028 - Execução do ZAP via Docker spawn

## Contexto

O módulo DAST precisa rodar o OWASP ZAP (`zap-full-scan.py`) contra uma URL arbitrária informada pelo pentester, sem infraestrutura de fila (Redis/BullMQ estão fora de escopo — ver ADR-030) e sem exigir instalação manual de nada além do Docker Desktop que o projeto já usa (`docker-compose.yml` na raiz).

Três desenhos foram considerados:

1. **Um daemon ZAP persistente** (`zap.sh -daemon`), reaproveitado entre scans via API REST do próprio ZAP.
2. **Um container por scan**, subido e destruído a cada execução.
3. **ZAP instalado no host**, chamado como processo local (sem Docker).

## Decisão

**Um container Docker novo por scan**, via `docker run --rm --name vulnera-zap-<scanId>`, disparado por `execFile` (nunca `exec`/shell — ver docs/DAST.md §5) a partir de `zap-runner.service.ts`.

### Por que não modo daemon

- **Isolamento de estado.** Um daemon compartilhado acumula sessão, contexto e histórico de spider entre scans de alvos diferentes — vazamento de estado entre execuções concorrentes de pentesters diferentes é inaceitável num produto multi-usuário.
- **Cancelamento trivial.** `docker rm -f <containerName>` é atômico e determinístico porque o nome do container é derivado do `scanId`. Com um daemon, cancelar "este scan específico" exigiria a API de sessões do próprio ZAP, mais um adaptador a mais pra manter.
- **Sem estado pra vazar entre tenants.** Cada scan nasce e morre com o container — não há necessidade de "limpar" nada entre execuções.
- **Custo aceito conscientemente:** subir um container novo por scan tem overhead de alguns segundos (imagem já em cache local após o primeiro pull) frente a um daemon já quente. Aceitável porque o próprio scan leva minutos — o overhead de boot do container é ruído perto do tempo de spider+active scan.

### Por que não ZAP no host (sem Docker)

Exigiria Java + ZAP instalados na máquina que roda a API, versionamento manual, e quebraria a paridade dev/produção que o resto do projeto já garante via `docker-compose.yml`. Docker já é dependência do projeto (MySQL, Mailhog) — não introduz superfície nova.

### ⚠️ Risco assumido: acesso ao socket Docker

A API precisa poder chamar `docker run`, o que implica acesso ao Docker Engine do host (via socket ou Docker Desktop). **Isso significa que comprometer o processo da API compromete o host** — quem controla o daemon Docker pode montar volumes arbitrários, subir containers privilegiados, e escapar do container da própria API (se ela um dia rodar containerizada com o socket montado).

**Mitigação:**

1. **Sem privilégio elevado no container ZAP.** Nenhuma flag `--privileged`, nenhum `--cap-add`. O container roda com as capabilities padrão do Docker.
2. **Volume montado é de escrita restrita ao diretório do scan** (`<REPORTS_DIR>/<scanId>:/zap/wrk/:rw`) — nunca a raiz do host, nunca `/var/run/docker.sock` dentro do próprio container ZAP (o ZAP não precisa nem deveria falar com o Docker).
3. **Validação de alvo antes de qualquer `docker run`** (protocolo + SSRF, ver docs/DAST.md §5) — reduz o raio de ataque de "o que o ZAP pode alcançar", não do acesso ao Docker em si.
4. **Escopo restrito a PENTESTER/ADMIN** (RBAC) — CLIENT nunca chega perto de disparar um `docker run`.
5. **Não resolvido nesta entrega:** rodar a própria API dentro de um container sem acesso direto ao socket do host (ex: via um sidecar dedicado só a orquestrar scans, com permissão mínima) seria o próximo passo de day-2 hardening. Hoje a API roda com acesso direto ao Docker do host — aceitável para o ambiente de TCC/demo, **não recomendado tal e qual para produção multi-tenant real sem essa camada extra**.

## Consequências

- Um container por scan garante isolamento e cancelamento simples, ao custo de alguns segundos de boot por execução.
- A API precisa de acesso ao Docker do host — documentado como risco assumido, não escondido (R5 do CLAUDE.md: limitação declarada é maturidade).
- `docker rm -f` funciona em qualquer momento da execução (timeout ou cancelamento manual) — validado manualmente contra scan real na Fase 2 (container confirmado removido via `docker ps`).

## Alternativa descartada

**Daemon ZAP persistente com API de sessões.** Descartada por vazamento de estado entre tenants e complexidade de mapear "cancelar este scan" pra uma sessão específica — ver seção acima.

## Relacionado
[[ADR-029 - DAST como silo]]
[[ADR-030 - Execucao assincrona sem fila]]
