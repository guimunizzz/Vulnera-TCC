---
type: decisao
tags: [decision, dast, zap, resiliencia]
status: vigente
codigo: ADR-042
data: 2026-09-28
---

<!-- Explica a separação entre demonstração e análise real; consumido pelos mantenedores e pela banca. -->

# ADR-042 — DAST explícito e baseline passivo

> **Atualização de 2026-10-09:** a descoberta manual abaixo foi substituída
> pelo Spider tradicional em [[ADR-046 - Spider tradicional e perfil por execucao]].
> Permanecem modos explícitos, confirmação, análise passiva e falha sem fallback.
> Os limites de 30 páginas totais e intervalo de 250 ms descrevem o método antigo.

## Contexto

Na WSL de 4 GB, três execuções reais falharam e foram substituídas por demonstrações. O produto marcava essas execuções como concluídas. A política de dois containers de 2 GiB foi dimensionada para outra máquina. O pedido atual exige modo explícito, confirmação antes do real, retries e falhas compreensíveis; o pedido anterior restringe o impacto sobre o alvo.

## Decisão

- `POST /api/dast/scans` exige `mode: REAL | SIMULATED`. `REAL` exige `confirmedRealScan: true`, validado pelo controller e pelo service. A UI usa um segundo aviso com URL e checkbox de autorização. Confirmação não substitui autorização do proprietário do alvo.
- `simulated`, já existente, guarda a escolha desde a criação. A escolha não muda durante a execução. Auditoria registra modo e confirmação. Nenhuma migration é necessária.
- Demo gera arquivos locais e achados fictícios, sem consultar Docker/HTTP pelo runner. Não serve como origem de promoção ou comparação operacional.
- Real executa um daemon ZAP e um crawler conservador conduzido pela API `core/accessUrl`, com `followRedirects=false`. Somente GET, mesma origem/subárvore, sem query, sem credenciais, sem formulários/JavaScript, até 30 páginas, profundidade 2, fila limitada e intervalo de 250 ms. Redirects são validados antes de segui-los. Nomes comuns de ações destrutivas são excluídos; isso não prova ausência de efeito colateral em aplicações mal projetadas.
- O daemon usa contexto explícito e modo Protected. Safe Mode bloqueia navegação manual via API; não é usado como uma promessa falsa de crawler inofensivo. As regras passivas do ZAP analisam o tráfego real. Não há chamada a active scan.
- Leituras de status/relatório recebem até três tentativas em erros transitórios; navegações e comandos de ação não são repetidos, pois podem ter sido aceitos apesar de a resposta ter sido perdida. Timeout HTTP padrão de 45 s, com limite absoluto, abort e heartbeat durante espera. Retry não promete sucesso em erro persistente.
- Falha real termina `FAILED`, nunca chama `simulateScan`. Diagnóstico de fase/endpoint/log saneado é gravado antes de remover o container; sem `--rm` para preservar evidência de OOM. A fila passiva precisa drenar antes de publicar relatório completo.
- Padrão operacional: um scan por vez, 2 GiB, 2 CPUs. Heap continua derivado a 65% do teto. Aumentar concorrência exige revisar o orçamento total.

Confirmação em 2026-09-29: mantém-se a fila FIFO/watchdog em memória, com uma execução por vez; sem broker adicional no MVP. Retentativas recuperam leituras transitórias, mas não garantem disponibilidade do alvo. A procedência real é preservada pela ausência de fallback e pela leitura do relatório do daemon. A triagem manual decide quais alertas são falsos positivos.

## Consequências

- Resultados reais e demonstrativos são inequívocos, inclusive antes do término.
- O modo real é baseline passivo de cobertura limitada. Não autentica no alvo, não executa SPA/JavaScript, não explora SQLi/XSS e pode concluir sem alertas. Resultados antigos de active scan não têm cobertura equivalente.
- URLs com query ou rota sensível são recusadas por esse perfil; redirects para outra origem exigem informar diretamente o destino autorizado. DNS rebinding/egress por IP resolvido continua limitação prévia documentada; contexto e filtros de URL não são isolamento de rede completo.
- O endpoint de criação mudou de contrato. Clientes antigos que enviam somente `targetUrl` recebem `INVALID_SCAN_MODE`.
- `DAST_FORCE_SIMULATE=true` passa a bloquear o real com mensagem explícita, sem alterar silenciosamente a escolha do usuário.
- Após reinício, execuções órfãs falham e seus containers são limpos. Não há retomada automática de trabalho.
- Se o daemon falhar após coletar dados, esta entrega preserva diagnóstico, mas não publica relatório parcial como completo. Recuperação de achados parciais e retenção automática dos artefatos ficam no backlog.

## Relacionado

- `docs/DAST-DIAGNOSTICO-2026-09-28.md`
- `docs/DAST.md`
- `ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker.md` — substitui o pipeline ativo e a política de fallback.
- `ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST.md` — acrescenta bloqueio de dados simulados.
- [API oficial ZAP](https://www.zaproxy.org/docs/api/)
- [Modos de operação](https://www.zaproxy.org/docs/desktop/start/features/modes/)
