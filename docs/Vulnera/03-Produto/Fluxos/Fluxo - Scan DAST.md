---
type: fluxo
tags: [feature, flow, dast]
status: ativo
---

> [!info] Nota criada em 2026-09-10
> Fluxo do módulo [[DAST]]. Passo a passo operacional detalhado (com comandos e troubleshooting) em `docs/DAST.md`.

> [!info] Operação atualizada em 2026-10-09
> Modos explícitos e análise passiva real desde 2026-09-28 (ADR-042). Alvos locais e de rede privada são aceitos permanentemente desde 2026-10-09; não há flag de liberação. A execução depende do acesso do container do ZAP ao alvo.

# Fluxo - Scan DAST

## Objetivo

Executar uma varredura dinâmica automatizada contra uma URL, triar o que ela encontrou, levar o que for real para o fluxo normal de remediação do produto e, depois da correção, **provar** que ela funcionou.

## Ator principal

Pentester (ou Admin). `CLIENT` não participa deste fluxo em momento algum.

## Pré-condições

- usuário autenticado com role `PENTESTER` ou `ADMIN`;
- para o modo **Real**, Docker disponível para a API e alvo acessível do container do ZAP; indisponibilidade termina em falha, sem fallback;
- escolha explícita de **Simulado** ou **Real — análise passiva**; Real exige confirmação de autorização;
- para **promover** um achado: existir um [[Project]] em que o ator seja [[ProjectMember]] — `ADMIN` é exceção e promove para qualquer projeto.

---

## Passos principais

### 1. Disparar o scan

1. Pentester abre **DAST** no menu e clica em **Novo scan**.
2. Informa a URL HTTP/HTTPS do alvo, sem credenciais embutidas. O backend remove o fragmento e aceita tanto endereços públicos quanto locais/privados. Seleciona **Real — análise passiva** e confirma a autorização no segundo aviso, ou **Simulado** para demonstrar a interface sem acessar o alvo.
3. O [[DastScan]] nasce `QUEUED` e a tela vai direto para o acompanhamento.
4. O watchdog tira da fila FIFO quando há vaga (teto padrão de 1 simultâneo). Para o modo Real, o runner sobe `vulnera-zap-<scanId>`.

### 2. Acompanhar

5. O ZAP roda em modo daemon Protected e é conduzido pela API HTTP dele: **início → navegação GET → análise passiva → relatórios**. O crawler visita até 30 páginas, profundidade 2, na mesma origem e subárvore, sem queries, formulários, JavaScript ou active scan. Redirects são validados antes do próximo GET. O percentual indica etapa e quantidade limitada; não mede tempo restante nem cobertura do site inteiro.
6. Polling de 3s. O botão **Parar** destrói o container (`docker rm -f`) e o scan vira `CANCELLED`.
7. Ao terminar: `COMPLETED` com os quatro contadores (Alto/Médio/Baixo/Info), tabela de [[DastFinding]], HTML original do ZAP e PDF gerado no navegador. Zero alertas é válido. Somente a escolha **Simulado** gera demonstração identificada; falha real termina `FAILED` com a causa tratada.

### 3. Triar

8. Cada achado recebe um estado: **Por triar** (`NEW`), **Confirmado**, **Falso-positivo** ou **Risco aceito**, com nota opcional.
9. O status salva **no clique** (a nota exige commit explícito). O filtro "N por triar" mostra o que falta.
10. Toda mudança de triagem grava [[AuditLog]] (`entityType: "DastFinding"`, `action: "STATUS_CHANGE"`, com `from`/`to`). `companyId` é `null` — o silo fica fora da cadeia multi-tenant ([[ADR-029 - DAST como silo]]).

### 4. Promover para Vulnerability

11. No achado de um scan **real**, **Promover**. O backend devolve um **rascunho**: título, descrição já com a proveniência do scan, categoria OWASP deduzida do CWE e vetor CVSS **sugerido** pela faixa de risco. Dados simulados não podem ser promovidos.
12. ⚠️ A tela marca o vetor como **sugestão**. O pentester revisa e confirma — só então `calculateCvss` roda, sobre o vetor revisado ([[RN10 - Severidade via CVSS com override justificado]] intacta).
13. Escolhe o [[Project]] de destino. Pentester que não seja membro dele recebe `403 FORBIDDEN` — promover não é porta lateral para escrever em projeto alheio. `ADMIN` não passa por essa checagem, como no `create` normal de [[Vulnerability]].
14. A [[Vulnerability]] nasce `OPEN`, com `sourceType = "DAST_IMPORT"` e `sourceDastFindingId` apontando para o achado; `applicationId` e `companyId` são herdados do Project ([[RN09 - Vulnerability pertence a um Project]]).
15. Se o finding ainda estava `NEW`, ele passa a `CONFIRMED` — "promovido mas ainda por triar" é um estado sem sentido. Se o pentester já tinha dito outra coisa de propósito (falso-positivo promovido para registro, risco aceito), a decisão dele prevalece.
16. Grava [[AuditLog]] (`entityType: "Vulnerability"`, `action: "CREATE"`, com `sourceType`, `sourceDastFindingId` e `scanId` no `diffJson`) — [[RN20 - Criacao de Vulnerability gera auditoria]].
17. Segunda tentativa de promover o mesmo achado: `409 FINDING_ALREADY_PROMOTED`, inclusive em cliques simultâneos (o `P2002` do `@unique` é traduzido para o mesmo 409).

### 5. Remediar

18. Daqui em diante o achado é uma vulnerabilidade normal do produto: evidências, comentários, [[Maquina - Vulnerability]], relatório e dashboards. Ver [[Fluxo - Registro de Finding]] e [[Fluxo - Revalidacao]].

### 6. Comparar e provar a correção

19. Depois da remediação, rodar um **novo scan real do mesmo alvo**. A comparação exige duas execuções reais concluídas e recusa dados simulados.
20. Na aba **Comparar com execução anterior**, escolher a execução mais antiga. O resultado sai em três grupos: **Resolvidos**, **Novos** e **Continuam abertos**.
21. O diff é por `fingerprint` (`sha256(pluginId | normalizedUrl | param)`), que **não inclui a evidência** — é o que faz um problema não corrigido aparecer como "continua aberto" em vez de virar um par falso de "sumiu um / surgiu outro".
22. Alvos diferentes devolvem `422 SCANS_TARGET_MISMATCH`; scan comparado consigo mesmo, `CANNOT_COMPARE_SCAN_WITH_ITSELF`; scan não concluído, `SCAN_NOT_COMPLETED`.

A comparação evidencia o que foi observado em cada execução; não altera automaticamente o estado da `Vulnerability` nem garante cobertura de páginas que o crawler não visitou.

### Alvo na rede local durante a apresentação

Para o Vite do colega com `vite --host`, informe `http://10.87.169.107:5173/` se esse for o IP real da máquina. A porta precisa responder pela rede Docker, além de estar acessível no navegador do Rafael. Para um alvo no host do Docker Desktop, use `host.docker.internal:<porta>`. `localhost` dentro do container do ZAP aponta para o próprio ZAP.

---

## Pós-condições

- `DastScan` em `COMPLETED`/`FAILED`/`CANCELLED`; execuções reais concluídas têm contadores e relatórios JSON + HTML no disco da API;
- findings triados, com autor e data;
- os achados reais promovidos explicitamente existem como `Vulnerability` de `sourceType = "DAST_IMPORT"`, dentro de um Project;
- `AuditLog` de cada triagem e de cada promoção;
- comparação entre execuções disponível como evidência de correção.

## Histórico preservado

- **2026-09-10 — desenho inicial, substituído em 2026-09-28:** daemon conduzido por spider, scan passivo e active scan; até 2 execuções simultâneas; falhas reais podiam gerar fallback simulado. ADR-042 introduziu modos explícitos, navegação GET limitada, análise passiva e falha real sem fallback.
- **2026-09-10 — restrição de rede, substituída em 2026-10-09:** loopback e faixas privadas eram bloqueados por padrão, com liberação de desenvolvimento por variável. O bloqueio e a variável foram removidos por solicitação do Rafael.

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
