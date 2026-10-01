<!-- Relatório de implementação e aceite do DAST; orienta operação local, revisão e banca. -->
# Validação do OWASP ZAP — 28–29/09/2026

Branch: `feat/dast-real-explicit-mode`. Escopo solicitado diretamente nesta sessão; commit local detalhado, sem push. Sem alteração de schema, migration, dependências, lockfile ou AGENTS.md.

## Por que aparecia “resultado simulado”

O runner anterior substituía qualquer falha real por um relatório fictício, concluindo o scan como `COMPLETED`. Os registros examinados tinham um `SCAN_TIMEOUT` e dois `ZAP_HTTP_TIMEOUT`. A configuração permitia dois ZAP de 2 GiB numa WSL de 4 GB; a JVM tinha heap de 1331 MiB por processo e o container não usava swap. Isso cria pressão de recursos, mas **não comprova OOM como causa das três falhas**: também houve uma falha isolada. O pipeline sempre executava active scan e suas consultas tinham prazo de 20 s sem retry. Evidências históricas em `DAST-DIAGNOSTICO-2026-09-28.md`.

## Aceite dos pedidos

| Pedido | Implementação e verificação |
| --- | --- |
| Branch própria e commit detalhado | Branch acima; identificação final obtida com `git log -1`. |
| Escolha antes do scan | Radios Simulado/Real no diálogo. Simulado é o padrão. Teste de UI verifica o payload explícito. |
| Simulado sem DAST real | `runScan(SIMULATED)` não consulta Docker nem HTTP; gera relatório fictício identificado. Teste do runner prova ausência de chamadas; smoke mede zero acessos extras ao alvo. |
| Segundo aviso para real | Segunda etapa mostra URL/impacto e exige checkbox de autorização. API também rejeita confirmação ausente ou diferente de `true`; voltar e mudar URL exige confirmar novamente. |
| Real de baixo impacto | GET sequencial em até 30 páginas, profundidade 2, mesma origem/subárvore, sem query, formulários, POST ao alvo, JavaScript ou active scan. Redirect validado antes do próximo acesso. |
| Retry | Até três tentativas de leituras transitórias de status/relatório, backoff limitado, deadline global e cancelamento. Testes cobrem recuperação e esgotamento. Navegação não é repetida: a resposta perdida pode esconder uma ação já realizada. |
| Falha explicada, sem mock | `FAILED`, `simulated=false`, sem findings fictícios. Mensagens para alvo, HTTP, Docker, inicialização, memória/heap e timeout; diagnóstico persistido antes de remover container. |
| Scan de verdade | Daemon OWASP ZAP 2.17.0 produziu JSON/HTML e alertas passivos reais no alvo Docker descartável. Resultados e durações nas evidências. |
| Validar/documentar | Testes, build, smoke real e interface descritos abaixo; PRD, BACKLOG, ADR-042, manual e histórico atualizados. |

POST não é um método HTTP seguro para o alvo por definição. O POST para **criar o scan no Vulnera** permanece; o scanner envia somente GET ao alvo neste perfil. GET também pode causar efeitos em aplicações mal projetadas, por isso o segundo aviso informa o risco. “Passivo” descreve a análise das respostas pelo ZAP, não ausência de tráfego. Não há exploração automática de SQLi/XSS; ausência de alertas não significa ausência de vulnerabilidades.

## Implementação

A confirmação de escopo de 29/09 mantém a fila FIFO/watchdog existente, com uma execução por vez. Não foi adicionado broker de mensageria: ele acrescentaria consumo e operação na WSL de 4 GB e não tornaria um alvo inacessível alcançável. A garantia do produto é de procedência: modo real nunca é substituído por mock; só é concluído após a análise passiva e a leitura/processamento do relatório do daemon ZAP. Falha persistente é registrada, com causa, e falsos positivos continuam sujeitos à triagem manual.

API mantém Controller → Service → Repository e factory existentes. O campo `simulated` persiste a escolha desde QUEUED, e a auditoria registra modo/confirmação. Não existe fallback automático. Demonstrações não podem ser promovidas a Vulnerability ou comparadas operacionalmente, inclusive pela API.

O daemon roda em Protected com contexto explícito; o crawler da aplicação limita os GETs e não chama o spider/active scan do ZAP. A fila passiva deve zerar antes da publicação. O prazo HTTP passou a 45 s; espera tem heartbeat e AbortSignal. O timeout de relatório é 120 s, sempre limitado pelo prazo total. Erros transitórios de leitura podem ser retentados. Ações não são reiniciadas automaticamente e falhas permanentes não ficam em loop.

O container é inspecionado e seus últimos logs são coletados antes do `rm -f`; foi removido `--rm`, que apagava a evidência de OOM. A chave do ZAP é removida do log salvo. Na validação, conexão recusada gerava HTTP 500: a implementação passou a ler o erro estruturado mesmo nesse status e a reconhecer evidência de rede nos logs, sem inventar OOM. Reinício da API encerra scans órfãos e limpa seus containers.

## Validação executada

- **API focal: 81/81**, três suítes (`dast`, `dast-triage`, `zap-runner`), após corrigir uma asserção que diferenciava maiúscula/minúscula no texto de demonstração. Cobre contrato, consentimento, permissões, promoção, retries, OOM simulado, cancelamento, escopo/redirect, alvo inacessível e demo sem chamadas externas.
- **API completa na rodada inicial: 568/569**, 43 suítes; única falha foi a asserção de texto acima, corrigida e reexecutada na rodada focal. Dois testes adicionais de erro HTTP 500/rede foram acrescentados depois. Não se afirma uma execução completa final de 571/571.
- **Web: 239/240**, 21 arquivos. Os três novos testes DAST passaram. O teste preexistente `remediation-page-flow.test.tsx:47` falhou esperando a região “Aberto: 1 finding(s)” enquanto a página exibia skeleton; repetiu a falha isoladamente. Nenhum arquivo de Remediação foi modificado. Fica anotado como problema fora do escopo, conforme AGENTS.md §0.2 S6.
- **Web lint: 0 erros, 9 avisos preexistentes. Contraste: 66/66.** `npm run check` da API permanece bloqueado pelos dois imports não usados já documentados em `vulnerability.service.ts` (`UserEntity`, `UserResponseDTO`). Os testes foram executados separadamente; não se afirma check global verde.
- Build TypeScript da API no host aprovado. Build de produção da API/Web em Docker: aprovado (`docker compose build api web`). Typecheck adicional incluindo os arquivos E2E também aprovado. O ambiente Node do host não conseguiu iniciar o worker Vitest e o build web local tinha dependências ausentes; a validação web foi feita com as dependências da imagem Docker, sem editar lockfile manualmente.
- **Smoke real final aprovado:** ZAP 2.17.0, `COMPLETED`, `simulated=false`, 65.578 ms no runner (67.649 ms incluindo consulta de logs). Seis tipos de alertas reais: anti-CSRF, CSP, anti-clickjacking, HttpOnly, SameSite e X-Content-Type-Options. Somente `GET /`, `GET /about`, `GET /redirect`. Formulário POST, link externo, caminho `/delete` e URL com query não foram acessados. A fila passiva passou de quatro registros para zero antes do relatório.
- **Demo aprovada:** `COMPLETED`, `simulated=true`, zero requisições adicionais. **Porta fechada aprovada:** `FAILED`, `TARGET_UNREACHABLE`, `simulated=false`, sem relatório fictício, em 47.215 ms.
- Imagem observada: `ghcr.io/zaproxy/zaproxy@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef`. Evidência pequena versionada em `docs/evidencias/dast/smoke-2026-09-28.json`.
- **Navegador real + stack atualizada:** formulário ofereceu os dois modos; segundo aviso mostrou a URL e botão desabilitado até a autorização. Scan `cmulc5ofp0003oc012ggwrcgp` concluiu em 45.507 ms, `DONE`, 100%, sem selo simulado: 11 findings normalizados (5 médios, 6 baixos) em duas páginas GET. A demonstração `cmulc7fn9000koc01gtae3j8h` concluiu em 3 s, com 15 findings fictícios, aviso explícito, comparação e promoção desabilitadas. O log do alvo permaneceu em dois GETs depois da demonstração. A falha `cmulc8xq50015oc018a46a0he` terminou em 73.047 ms, `FAILED`, `simulated=false`, zero findings, exibindo na tela `TARGET_UNREACHABLE` e orientação sobre DNS, porta, TLS, firewall e rede Docker. Estados finais reconferidos em 29/09.
- Stack recriada com imagens construídas; API/MySQL saudáveis e Web em `:8086`. Os três registros desta validação ficam no banco de desenvolvimento para inspeção; alvo descartável removido ao terminar. Evidência dos estados persistidos em `docs/evidencias/dast/ui-2026-09-28.json`.
- Playwright E2E completo não foi executado. Seus helpers foram adaptados ao contrato real e agora exigem `E2E_DAST_TARGET_URL` explícito, falhando se receberem demonstração ou estado terminal de erro; não usam um site externo por padrão.

## Como executar nesta máquina

1. Mantenha Docker Desktop/WSL ativos. Padrão: uma execução, 2 GiB para ZAP, 2 CPUs, heap de 65%, navegação limitada a um minuto, startup até três minutos.
2. Após alterar código: `docker compose build api web` e `docker compose up -d --no-deps api web`, sem scans em andamento. Não resete volumes/banco.
3. Acesse `http://localhost:8086/dast`, Novo scan, informe a URL autorizada e escolha Real. Avance, confira o endereço e marque a autorização.
4. O endereço deve ser alcançável **do container**. `localhost` no ZAP é o próprio ZAP. Para uma aplicação local, use a rede Docker e nome do serviço, ou endereço de host adequado ao ambiente. IPs privados literais dependem de `DAST_ALLOW_PRIVATE_TARGETS`; não afrouxe a configuração para alvos desconhecidos.
5. Em falha, leia a mensagem na UI. Diagnóstico interno: `docker compose exec api cat /app/dast-reports/<scanId>/diagnostics.json`. Logs gerais: `docker compose logs --tail=100 api`. Não exponha esse volume publicamente.

O compose define as variáveis no próprio serviço; editar somente `app/api/.env` não muda a configuração efetiva. As variáveis interpoladas podem ser definidas no ambiente do compose ou `.env` da raiz. Aumentar RAM não é pré-requisito comprovado para este baseline pequeno; escopos maiores exigem medição.

### Reproduzir o smoke controlado (PowerShell, raiz)

```powershell
npm run build --workspace=@vulnera/api
docker run --rm --name vulnera-dast-validation --network vulnera-net --user 0 -e NODE_PATH=/app/node_modules -e DAST_ZAP_NETWORK=vulnera-net -e DAST_FORCE_SIMULATE=false -e DAST_ZAP_CPUS=2 -e DAST_REPORTS_DIR=/evidence -v "${PWD}/app/api:/work:ro" -v "${PWD}/output/dast-real-validation:/evidence" -v /var/run/docker.sock:/var/run/docker.sock --entrypoint node vulnera-tcc-api /work/scripts/dast-smoke.cjs
```

O script cria/remove somente seu alvo descartável, valida tráfego e relatórios reais, demo e porta fechada. Precisa das imagens da API e do ZAP já disponíveis. A síntese versionada fica em `docs/evidencias/dast/`; os relatórios brutos locais, ignorados pelo Git, em `output/dast-real-validation/`.

## Limites e trabalho futuro

- Retry aumenta tolerância a falhas transitórias; não garante sucesso com alvo inacessível, falta permanente de recursos ou erro de configuração.
- Cobertura limitada: sem login, SPA/JS, formulários, queries, active scan e retomada/relatório parcial. A fila passiva não drenada é falha explícita.
- DNS rebinding/egress por IP resolvido é limitação anterior: filtro de URL/contexto não substitui isolamento de rede. Não expor a stack DooD à Internet; ela tem o socket Docker do host, conforme ADR-031.
- `stable` continua tag móvel; versão observada nesta validação é 2.17.0. Fixação por digest e telemetria contínua de pico de RAM/CPU ficam no backlog.
- A amostra observada de 603,2 MiB e aproximadamente 207% de CPU de um smoke não representa pico ou dimensionamento para qualquer site.
- Relatórios/diagnósticos não têm retenção automática. Comparação de scans antigos ativos com novos passivos tem cobertura diferente.
- Registros antigos simulados continuam históricos. Reexecutar explicitamente em Real cria novo resultado; não reclassifica os antigos.
