---
type: decisao
tags: [decision, backend, dast, docker, seguranca, ux]
status: vigente
codigo: ADR-031
data: 2026-09-09
---

# ADR-031 - ZAP em modo daemon por scan, DooD na stack Docker e visibilidade do resultado simulado

## Contexto

`docs/DAST-DOCKER-GAP.md` (2026-09-06) documentou que, com a stack inteira em `docker compose up` (porta de entrada 8086), **todo scan caía silenciosamente no gerador simulado**. O relatório apontou três causas encadeadas e uma lacuna de produto:

1. A imagem da API não tinha o binário `docker` (`execFile("docker", …)` falhava com `ENOENT`).
2. O socket do daemon do host não estava montado no container da API.
3. Mesmo resolvendo 1 e 2, o caminho passado no `-v` do `docker run` era interpretado pelo daemon do **host**, não pelo filesystem do container da API — o ZAP escreveria `report.json` num diretório que a API nunca leria.
4. **Lacuna de produto:** nada na aplicação distinguia um resultado simulado de um scan real (§5 do relatório).

O relatório recomendava a Opção A (rodar a API fora do container quando fosse usar o DAST) e tratava a Opção B (resolver o DooD) como caminho só se "tudo num `docker compose up`" fosse inegociável.

**Requisito novo trazido pelo Rafael em 2026-09-09:** scan real funcionando com o container do ZAP sendo criado sob demanda, **limite de 2 scans simultâneos com aviso em caso de erro**, e **percentual de progresso na UI** — com queda para o resultado simulado, e mensagem amigável, quando o scan real falhar.

O requisito de percentual é o que derruba a Opção A como suficiente: `zap-full-scan.py` é uma caixa preta que só devolve texto no stdout ao terminar. Não existe percentual pra ler. Qualquer barra de progresso construída sobre ele seria estimativa de tempo disfarçada de medição.

## Decisão

**Quatro decisões, tomadas juntas porque uma não funciona sem as outras.**

### 1. O ZAP passa a rodar em modo daemon — ainda UM CONTAINER POR SCAN

`docker run -d --rm --name vulnera-zap-<scanId> … zap.sh -daemon -host 0.0.0.0 -port <porta> -config api.key=<aleatória> -silent`, e o runner conduz o scan pela API HTTP do próprio ZAP:

```
/JSON/spider/action/scan/      -> /JSON/spider/view/status/   (0..100)
/JSON/pscan/view/recordsToScan/                                (fila do passivo)
/JSON/ascan/action/scan/       -> /JSON/ascan/view/status/     (0..100)
/OTHER/core/other/jsonreport/  e  /OTHER/core/other/htmlreport/
```

⚠️ **Isto NÃO reabilita o desenho recusado no [[ADR-028 - Execucao do ZAP via Docker spawn]].** O que aquele ADR descartou foi um **daemon PERSISTENTE COMPARTILHADO** entre scans, e a razão era vazamento de estado entre tenants. Aqui cada scan continua nascendo e morrendo com o seu próprio container: o isolamento e o cancelamento por `docker rm -f <containerName>` seguem idênticos. A seção "Por que não modo daemon" do ADR-028 vale para o daemon compartilhado; a parte que diz que o daemon exigiria "a API de sessões do próprio ZAP" está **substituída** por esta decisão — o `scanId` do ZAP é sempre `0` num daemon dedicado a um scan só, então não há sessão pra mapear.

Ganhos, além do percentual:

- **A "Causa 3" desaparece do desenho, não é contornada.** Os relatórios chegam pela API HTTP e quem escreve no disco é o processo Node, no mesmo caminho que ele depois lê. Não existe mais bind mount de relatório, então não existe mais tradução de caminho host↔container pra errar.
- **Chave de API aleatória por scan** (`randomBytes(16)`), nunca `api.disablekey=true`.

⚠️ **Armadilha que custou a maior parte da sessão, registrada aqui porque não é óbvia:** o ZAP em daemon é um *proxy* antes de ser um servidor de API. Ele só trata a requisição como "para mim" quando o header `Host` bate com o endereço **e a porta** em que ele mesmo escuta; qualquer outra coisa ele tenta encaminhar e devolve `502 Bad Gateway`. Publicar uma porta efêmera (`-p 127.0.0.1::8080`) portanto **não funciona**. As duas saídas adotadas, uma por modo de execução:

- **API em container** (compose): API e ZAP na mesma rede `vulnera-net`, endereço `http://vulnera-zap-<scanId>:8080` — mesma porta dos dois lados, e nenhuma porta publicada no host.
- **API no host** (`npm run dev`): o runner escolhe uma porta livre e usa **a mesma dentro e fora** (`-p 127.0.0.1:P:P` + `zap.sh -port P`), presa ao loopback.

### 2. DooD na stack: `docker-cli` na imagem da API + socket do host montado

`app/api/Dockerfile` instala `docker-cli` e adiciona o usuário `vulnera` ao grupo root (GID 0); `docker-compose.yml` monta `/var/run/docker.sock`. As Causas 1 e 2 do relatório, resolvidas como o próprio relatório desenhou.

**O GID 0 merece explicação.** No Docker Desktop o socket é `srw-rw---- root root`: sem GID 0 o processo recebe `permission denied` e todo scan volta a cair no simulado. Rodar o container inteiro como root resolveria também, mas joga fora a separação de usuário que o Dockerfile já tinha. Em host Linux o socket costuma ser `root:docker` (GID 999/998) — nesse caso o certo é `group_add` no compose com o GID local, não este GID 0.

**Aumento de superfície de risco, aceito explicitamente** (é a ressalva que o §6 do relatório pediu que fosse reavaliada antes de adotar a Opção B): rodando localmente, comprometer a API significava comprometer o processo Node no host, que já tinha o mesmo acesso ao Docker do usuário que o executava. Com o socket montado num container **que também serve tráfego HTTP de rede**, escapar do container da API passa a dar controle do daemon do host inteiro. Isso é aceitável para máquina de desenvolvimento e para a demonstração do TCC; **não é aceitável para produção multi-tenant**, onde a resposta certa é a Opção C do relatório (sidecar dedicado à orquestração, com permissão mínima) — mesmo "day-2 hardening" que o ADR-028 já listava como não resolvido.

### 3. Watchdog: no máximo 2 scans simultâneos, fila FIFO e aviso

`dast-watchdog.service.ts`, em memória do processo, singleton injetado pela factory. `create()` não dispara mais o scan: enfileira. Três responsabilidades:

- **Concorrência.** `DAST_MAX_CONCURRENT_SCANS` (default 2). Cada scan é uma JVM de ~1GB; cinco disparados juntos derrubam a máquina — inclusive no dia da apresentação.
- **Travamento.** O runner pulsa a cada poll (~3s). Sem pulso por `DAST_HEARTBEAT_TIMEOUT_MS` (default 2min), o watchdog aborta e registra alerta — senão um scan travado ocuparia uma das duas vagas para sempre.
- **Aviso.** Todo erro/abort vira alerta no anel dos últimos 20 (exposto em `GET /api/dast/scans/status`, mostrado no banner da UI) **e** `console.warn`/`console.error` no log do servidor.

**Por que memória e não banco** (mesma linha do [[ADR-030 - Execucao assincrona sem fila]]): a fila só faz sentido enquanto este processo vive, e o `recoverOrphanedScans()` do boot já cobre o que sobra de um restart. Introduzir Redis/BullMQ continua desproporcional ao volume do produto.

### 4. O resultado simulado deixa de ser invisível

Colunas novas em `DastScan` (migration `20260909131426_add_dast_progress_and_simulated_flag`): `progress` (0..100), `phase`, `simulated`, `warningMessage`. As quatro vão para o DTO e para a UI:

- Barra de progresso com percentual **real** e nome da fase, na listagem e no detalhe.
- Selo "simulado" no scan e alerta explicando, em PT-BR, por que o ZAP não rodou.
- Banner do módulo com estado do Docker, vagas ocupadas, fila e avisos do watchdog — **antes** de o usuário disparar o scan.

E o comportamento pedido: **scan real que falha cai no simulado em vez de morrer**, marcado com `simulated: true` e `warningMessage` amigável (`friendlyFailureReason()` traduz o código técnico). A única falha que **não** vira fallback é o cancelamento — quem cancelou não quer resultado nenhum.

Persistência do percentual tem throttle (grava só quando a fase muda ou o percentual anda 1 ponto, no máximo 1x/s): sem isso seriam ~20 escritas/minuto por scan só pra informar.

## Consequências

- **`docker compose up --build` passa a rodar scan real**, sem passo manual. Validado nesta sessão contra `https://example.com`: 47s, 7 alertas reais do ZAP 2.17.0, `simulated: false`, progresso percorrendo STARTING → SPIDER → PASSIVE → ACTIVE → REPORT → DONE.
- A recomendação da Opção A (API fora do container) do `DAST-DOCKER-GAP.md` **deixa de ser necessária**, mas continua funcionando — o runner detecta os dois modos por `DAST_ZAP_NETWORK`.
- O socket do Docker montado num container de rede é uma superfície de risco maior que a de antes. Documentado acima, não escondido.
- Um terceiro scan simultâneo **espera** em vez de rodar. Isso é visível na UI (posição na fila), não um silêncio.
- `ADR-028` continua vigente no essencial (um container por scan, `execFile` nunca shell, validação de alvo antes do `docker run`); só a subseção "Por que não modo daemon" precisa ser lida junto com este ADR.

## Alternativas descartadas

**Manter `zap-full-scan.py` e estimar o progresso pelo tempo decorrido.** Seria uma barra que mente: andaria igual num alvo de 30s e num de 20min. Percentual inventado é pior que nenhum percentual, porque o usuário passa a confiar nele.

**Dois containers ZAP fixos no `docker-compose.yml`** (um por vaga), em vez de criar sob demanda. Removeria a necessidade do socket — mas manteria ~2GB de RAM ocupados o tempo todo, mesmo sem scan nenhum, e reintroduziria exatamente o estado compartilhado entre scans que o ADR-028 recusou.

**Sidecar de orquestração (Opção C do relatório).** Resolve o risco do socket, mas é peça de infraestrutura nova, desproporcional ao produto hoje. Fica registrada como o caminho certo se isso virar produção.

## Relacionado
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-029 - DAST como silo]]
[[ADR-030 - Execucao assincrona sem fila]]
[[ADR-022 - Stack completa no Docker Compose]]
