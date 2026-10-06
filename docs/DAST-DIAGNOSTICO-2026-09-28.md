<!-- Registra a análise do runner e do ambiente para explicar o fallback e orientar Rafael na implementação de scans reais de baixo impacto. -->

# Diagnóstico DAST — 28/09/2026

Análise concluída; recomendações ainda não implementadas. Escopo: código, configuração efetiva Docker/WSL, logs da API e consulta somente leitura dos scans. Nenhum novo scan foi disparado. Não foi alterado código, configuração operacional, schema ou dado de aplicação.

## Evidências do ambiente

- `.wslconfig`: `memory=4GB`, `swap=2GB`.
- Docker informa 4.105.834.496 bytes (~3,824 GiB) e 8 CPUs disponíveis.
- API efetivamente configurada com `DAST_MAX_CONCURRENT_SCANS=2`, `DAST_ZAP_MEMORY=2g`, `DAST_ZAP_CPUS=4`, `DAST_SCAN_TIMEOUT_MS=1800000`, rede `vulnera-net`.
- O compose foi dimensionado explicitamente para uma VM de ~7,7 GiB, conforme comentário em `docker-compose.yml:80`. Dois tetos de 2 GiB excedem a memória disponível antes de considerar SO, MySQL, API e web. Teto não significa consumo constante, mas não existe orçamento agregado adequado a esta VM.
- Na coleta, sem ZAP em execução: web ~22 MiB, API ~120 MiB, MySQL ~87 MiB, Mailhog ~2 MiB. Esse retrato não mede o pico durante os scans.
- O Java já recebe heap explícito: `2g` produz `-Xmx1331m`. Não falta configuração de heap. O runner também usa `--memory-swap` igual a `--memory`, impedindo swap para o container ZAP; o swap de 2 GB da WSL não aumenta esse orçamento.
- O JavaScript compilado dentro da API confirma o timeout de 20 s, active scan automático e fallback presentes no fonte.

## Execuções encontradas

Horários em UTC, em 28/09/2026; São Paulo = UTC−3. Tempos aproximados incluem o fallback.

| Scan | Início | Fim | Duração | Erro real registrado na API |
| --- | --- | --- | --- | --- |
| `cmul734r20003l401f2fj87ok` | 11:59:33 | 12:29:49 | 30 min 13 s | `SCAN_TIMEOUT` |
| `cmul7btl30007l4016114j2h0` | 12:06:18 | 12:33:17 | 26 min 57 s | `ZAP_HTTP_TIMEOUT` |
| `cmul8ps7q001dl40134kkh3zv` | 12:45:09 | 12:55:17 | 10 min 7 s | `ZAP_HTTP_TIMEOUT` |

Todos estão no banco como `COMPLETED`, `simulated=true`, `phase=SIMULATED`, `errorMessage=null`; o aviso contém a tradução do erro. Os dois primeiros se sobrepuseram por ~23 minutos. O terceiro falhou sozinho: concorrência não explica todas as falhas.

## Causa confirmada e hipóteses

**Confirmado:** a frase relatada é a tradução exata de `ZAP_HTTP_TIMEOUT` (`zap-runner.service.ts:1090`). O evento de inatividade do socket encerra a chamada em `httpGet` (linha 351). A maioria dos comandos/consultas usa 20.000 ms (linha 372); relatórios usam 120.000 ms. Não há nova tentativa em polling: uma falha sobe ao catch de `runRealScan`, que remove o container, e `runScan` gera uma demonstração (linha 1127).

Isso significa falha de comunicação **Vulnera → daemon ZAP**, não comprova que o site ficou fora do ar nem que a JVM morreu. O timeout global de 30 minutos é outro mecanismo. Aumentá-lo não altera os 20 segundos do cliente HTTP.

**Hipóteses plausíveis:** pressão de RAM/GC, competição por CPU, spider/active scan grande ou bloqueio do daemon. A configuração e a sobreposição sustentam pressão de recursos como agravante, mas não comprovam OOM. Nenhum evento OOM foi retornado pelo histórico Docker disponível; isso não exclui eventos já perdidos.

**Lacuna de diagnóstico:** o erro não registra endpoint, fase e duração da chamada. O fallback sobrescreve a fase anterior; os containers já foram removidos. `--rm` pode eliminar o container antes de `describeContainerDeath` conseguir inspecionar `OOMKilled`. O `finally` também remove o container sem preservar logs. Portanto não é possível determinar retrospectivamente qual operação travou ou afirmar a causa física exata dessas execuções.

## O módulo atual não oferece um perfil passivo

O fluxo de `runRealScan` é sempre `spider → passivo → ativo → relatório` (`zap-runner.service.ts:755`). O active scan é recursivo e usa `inScopeOnly=false` (linha 559). Não há contexto explícito com allowlist nem configuração que desative os formulários do spider. A chave da API ZAP protege o controle do daemon; ela não define quais ações são seguras no alvo.

O filtro `isInScope` de `dast-findings.service.ts:169` compara hostname **depois** do scan, ao importar o relatório. Isso não é uma barreira de tráfego e não distingue porta/protocolo/caminho. O bloqueio de IP privado é outra proteção, voltada a SSRF; não torna o scan não invasivo.

“POST seguro” depende do endpoint e do corpo: um POST pode comprar, apagar, cadastrar ou enviar e-mail. Até GET pode alterar estado em aplicações mal projetadas. Trocar o método HTTP de um comando de controle do ZAP também não muda o comportamento do scanner no alvo.

Há duas alternativas distintas:

1. **Observação passiva:** ZAP em Safe Mode, analisando tráfego de navegação controlada ou tráfego previamente capturado. Não dispara spider nem active scan. A análise passiva não modifica o tráfego; as ações de navegação continuam tendo seus efeitos normais.
2. **Baseline de baixo impacto:** crawler limitado + análise passiva, sem active scan. Usar contexto com origem/caminhos autorizados, modo Protected, desabilitar processamento/submissão de formulários (`processForm=false`, `postForm=false`) e aplicar controle de métodos/destinos antes da saída, incluindo redirects. Safe Mode bloqueia o spider, portanto não basta ligá-lo no pipeline atual. Baseline é análise real, mas não garante ausência absoluta de efeitos do crawling.

POST necessário para login ou consulta deve entrar em allowlist explícita de rota/corpo, com conta de teste e sem repetição/mutação automática. Active scan deve ficar reservado a ambiente autorizado e isolado, como staging ou laboratório local.

O perfil passivo encontra problemas de headers, cookies, divulgação de informação e outros sinais presentes no tráfego observado. Não equivale a validar exploração de SQL injection, XSS ou autorização. Pode concluir corretamente com zero alertas.

Referências oficiais: [riscos do scanning](https://www.zaproxy.org/faq/is-there-any-danger-when-scanning-with-zap-against-a-live-website-e-g-create-delete-update-corrupt-data/), [Safe/Protected Modes](https://www.zaproxy.org/docs/desktop/start/features/modes/), [formulários e limites do spider](https://www.zaproxy.org/docs/desktop/addons/spider/options/), [Baseline Scan](https://www.zaproxy.org/docs/docker/baseline-scan/).

## Mudanças recomendadas, por prioridade

1. **Separar real de demo:** falha real termina `FAILED`, com código técnico e orientação; simulação somente quando solicitada explicitamente. Preservar achados reais parciais, quando recuperáveis, com marcação inequívoca de cobertura incompleta. Nunca substituí-los por dados inventados. `DAST_FORCE_SIMULATE=false` sozinho não desativa o fallback atual.
2. **Introduzir perfil passivo/baseline:** remover chamada ao active scan nesse perfil, restringir crawling e tráfego, limitar threads, profundidade, URLs e taxa. O rate limiting da API Vulnera não limita requisições enviadas pelo ZAP ao alvo. Testar a saída num servidor local que registre métodos e caminhos antes de usar em site real.
3. **Adequar ao computador:** começar com um scan simultâneo, container 2 GiB e 2 CPUs, spider de 1 minuto e escopo pequeno. É ponto inicial de medição, não garantia de conclusão. Não reduzir heap indiscriminadamente; isso pode agravar pausas de GC.
4. **Tolerar lentidão de leitura:** timeout configurável e poucas novas tentativas apenas em consultas idempotentes de status, com backoff e limite total. Não repetir cegamente comandos que iniciam scans. Coordenar orçamento HTTP com heartbeat de 120 s e distinguir “daemon vivo” de “operação progredindo”.
5. **Preservar diagnóstico:** endpoint sem chave/segredos, fase, latência, último progresso, RAM/CPU, estado OOM/exit code e logs saneados antes da limpeza. Usar retenção limitada e imagem ZAP com versão/digest fixos para reprodução. Aumentar timeout sem essas evidências só prolonga a falha.
6. **Concluir passivo corretamente:** hoje a espera passiva desiste após 120 s e o runner não drena a fila novamente depois do active scan. Para um relatório passivo confiável, aguardar fila zero ou declarar explicitamente resultado parcial.
7. **Impedir contaminação do produto:** `DastTriageService.promote` e a seleção de scans comparáveis não bloqueiam `simulated=true`. Impedir promoção/comparação operacional de demo ou segregar esses dados; não excluir automaticamente registros existentes.

Configuração inicial proposta para `services.api.environment` no compose (não aplicada):

```yaml
DAST_MAX_CONCURRENT_SCANS: "1"
DAST_ZAP_MEMORY: "2g"
DAST_ZAP_CPUS: "2"
DAST_ZAP_SPIDER_MAX_DURATION_MIN: "1"
DAST_ZAP_STARTUP_TIMEOUT_MS: "300000"
DAST_SCAN_TIMEOUT_MS: "1800000"
DAST_FORCE_SIMULATE: "false"
```

Essas variáveis já existem, mas **não desligam o active scan nem o fallback**. Isso exige mudança de código. O compose atual fixa os valores principais em `environment`; editar somente `app/api/.env` ou um `.env` não referenciado pelo compose não os substitui. Alteração de ambiente exige recriar a API; mudança de fonte exige também rebuild. Um simples restart mantém o ambiente antigo. Recriar a API interrompe trabalhos em memória, então aplicar sem scans pendentes.

Se ainda houver pressão de memória após serializar os scans e limitar o escopo, considerar elevar a WSL a 6 GB, medindo a folga do Windows. Não é necessário começar comprando hardware nem reservar 8 GB automaticamente. O aumento depende do consumo dos demais programas e não corrige o fallback ou a política de scan.

## Critérios de aceite da futura correção

- Alvo local controlado com páginas estáticas, links, formulários, redirects e rotas que registram todas as requisições.
- Relatório real com `simulated=false`; zero alertas é resultado válido.
- Nenhuma chamada a `/ascan/action/scan/` no perfil passivo/baseline.
- Baseline não envia POST/PUT/PATCH/DELETE nem sai da allowlist; testes também cobrem redirects e rotas GET com efeitos conhecidamente indesejados.
- Só um ZAP em execução sob carga de fila; medir pico de RAM/CPU e latência HTTP com WSL de 4 GB.
- Lentidão transitória no status se recupera sem iniciar outro scan. Falha persistente preserva motivo/etapa e não fabrica achados.
- Demo não pode ser promovida como finding real ou sugerir correções por comparação com scan real.

Validação desta análise: inspeção estática, comparação dos trechos compilados relevantes, Docker/WSL e SELECT via Prisma no container. Não foram executados `npm run check`, testes de integração, benchmark ou scan real novo. As recomendações de desempenho ainda precisam de medição após implementação. Os marcos históricos de scans reais bem-sucedidos em setembro permanecem válidos; não provam funcionamento para todo alvo e orçamento de hardware.
