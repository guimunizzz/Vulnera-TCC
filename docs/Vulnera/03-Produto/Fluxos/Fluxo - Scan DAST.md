---
type: fluxo
tags: [feature, flow, dast]
status: ativo
---

> [!info] Nota criada em 2026-09-10
> Fluxo do módulo [[DAST]]. Passo a passo operacional detalhado (com comandos e troubleshooting) em `docs/DAST.md`.

# Fluxo - Scan DAST

## Objetivo

Executar uma varredura dinâmica automatizada contra uma URL, triar o que ela encontrou, levar o que for real para o fluxo normal de remediação do produto e, depois da correção, **provar** que ela funcionou.

## Ator principal

Pentester (ou Admin). `CLIENT` não participa deste fluxo em momento algum.

## Pré-condições

- usuário autenticado com role `PENTESTER` ou `ADMIN`;
- Docker disponível para a API (o banner da tela diz se está — se não estiver, o scan roda em modo **simulado** e a tela declara isso);
- para **promover** um achado: existir um [[Project]] em que o ator seja [[ProjectMember]] — `ADMIN` é exceção e promove para qualquer projeto.

---

## Passos principais

### 1. Disparar o scan

1. Pentester abre **DAST** no menu e clica em **Novo scan**.
2. Informa a URL do alvo. O backend valida contra **SSRF** antes de qualquer container subir — loopback e faixas privadas são bloqueados por padrão (liberáveis só em dev via `DAST_ALLOW_PRIVATE_TARGETS`).
3. O [[DastScan]] nasce `QUEUED` e a tela vai direto para o acompanhamento.
4. O watchdog tira da fila FIFO quando há vaga (teto de 2 simultâneos) e o runner sobe `vulnera-zap-<scanId>`.

### 2. Acompanhar

5. O ZAP roda em modo daemon e é conduzido pela API HTTP dele: **spider → scan passivo → scan ativo → relatórios**. O percentual e o nome da fase na tela são **medição**, não estimativa de tempo.
6. Polling de 3s. O botão **Parar** destrói o container (`docker rm -f`) e o scan vira `CANCELLED`.
7. Ao terminar: `COMPLETED` com os quatro contadores (Alto/Médio/Baixo/Info) e a tabela de [[DastFinding]]. Se o resultado veio do fallback, o selo **simulado** e a explicação aparecem junto.

### 3. Triar

8. Cada achado recebe um estado: **Por triar** (`NEW`), **Confirmado**, **Falso-positivo** ou **Risco aceito**, com nota opcional.
9. O status salva **no clique** (a nota exige commit explícito). O filtro "N por triar" mostra o que falta.
10. Toda mudança de triagem grava [[AuditLog]] (`entityType: "DastFinding"`, `action: "STATUS_CHANGE"`, com `from`/`to`). `companyId` é `null` — o silo fica fora da cadeia multi-tenant ([[ADR-029 - DAST como silo]]).

### 4. Promover para Vulnerability

11. No achado, **Promover**. O backend devolve um **rascunho**: título, descrição já com a proveniência do scan, categoria OWASP deduzida do CWE e vetor CVSS **sugerido** pela faixa de risco.
12. ⚠️ A tela marca o vetor como **sugestão**. O pentester revisa e confirma — só então `calculateCvss` roda, sobre o vetor revisado ([[RN10 - Severidade via CVSS com override justificado]] intacta).
13. Escolhe o [[Project]] de destino. Pentester que não seja membro dele recebe `403 FORBIDDEN` — promover não é porta lateral para escrever em projeto alheio. `ADMIN` não passa por essa checagem, como no `create` normal de [[Vulnerability]].
14. A [[Vulnerability]] nasce `OPEN`, com `sourceType = "DAST_IMPORT"` e `sourceDastFindingId` apontando para o achado; `applicationId` e `companyId` são herdados do Project ([[RN09 - Vulnerability pertence a um Project]]).
15. Se o finding ainda estava `NEW`, ele passa a `CONFIRMED` — "promovido mas ainda por triar" é um estado sem sentido. Se o pentester já tinha dito outra coisa de propósito (falso-positivo promovido para registro, risco aceito), a decisão dele prevalece.
16. Grava [[AuditLog]] (`entityType: "Vulnerability"`, `action: "CREATE"`, com `sourceType`, `sourceDastFindingId` e `scanId` no `diffJson`) — [[RN20 - Criacao de Vulnerability gera auditoria]].
17. Segunda tentativa de promover o mesmo achado: `409 FINDING_ALREADY_PROMOTED`, inclusive em cliques simultâneos (o `P2002` do `@unique` é traduzido para o mesmo 409).

### 5. Remediar

18. Daqui em diante o achado é uma vulnerabilidade normal do produto: evidências, comentários, [[Maquina - Vulnerability]], relatório e dashboards. Ver [[Fluxo - Registro de Finding]] e [[Fluxo - Revalidacao]].

### 6. Comparar e provar a correção

19. Depois da remediação, rodar um **novo scan do mesmo alvo**.
20. Na aba **Comparar com execução anterior**, escolher a execução mais antiga. O resultado sai em três grupos: **Resolvidos**, **Novos** e **Continuam abertos**.
21. O diff é por `fingerprint` (`sha256(pluginId | normalizedUrl | param)`), que **não inclui a evidência** — é o que faz um problema não corrigido aparecer como "continua aberto" em vez de virar um par falso de "sumiu um / surgiu outro".
22. Alvos diferentes devolvem `422 SCANS_TARGET_MISMATCH`; scan comparado consigo mesmo, `CANNOT_COMPARE_SCAN_WITH_ITSELF`; scan não concluído, `SCAN_NOT_COMPLETED`.

---

## Pós-condições

- `DastScan` em `COMPLETED`/`FAILED`/`CANCELLED`, com contadores e relatórios (JSON + HTML) no disco da API;
- findings triados, com autor e data;
- os achados confirmados existem como `Vulnerability` de `sourceType = "DAST_IMPORT"`, dentro de um Project;
- `AuditLog` de cada triagem e de cada promoção;
- comparação entre execuções disponível como evidência de correção.

## Regras de negócio relacionadas

- [[RN09 - Vulnerability pertence a um Project]]
- [[RN10 - Severidade via CVSS com override justificado]]
- [[RN11 - Toda Vulnerability deve ter categoria OWASP]]
- [[RN17 - Pentester so ve Projects atribuidos]]
- [[RN20 - Criacao de Vulnerability gera auditoria]]

## Relacionado

[[DAST]]
[[DastScan]]
[[DastFinding]]
[[Vulnerability]]
[[Fluxo - Registro de Finding]]
[[Fluxo - Revalidacao]]
[[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]]
[[Jornada - Pentester]]
[[MOC - Produto]]
