---
type: funcionalidade
tags: [feature, dast, seguranca]
status: ativo
---

> [!info] Nota criada em 2026-09-10
> Módulo entregue em três sessões: Fase 9 (2026-09-05, base), Fase 9.1 (2026-09-09, scan real na stack Docker) e Fase 9.2 (2026-09-09, triagem/promoção/comparação). Documentação técnica completa em `docs/DAST.md` — esta nota é a visão de produto.

# DAST

## Objetivo

Dar ao **pentester** um fluxo com URL, modo e confirmação do Real: a plataforma sobe um container do OWASP ZAP, roda Spider tradicional e análise passiva, normaliza os alertas e devolve findings estruturados dentro do Vulnera. Não executa JavaScript, formulários ou active scan. O Demo gera exemplos locais sem acessar o alvo; falhas reais permanecem falhas ([[ADR-042 - DAST explicito e baseline passivo]], [[ADR-046 - Spider tradicional e perfil por execucao]]).

É o único módulo em que a plataforma **executa** análise em vez de apenas gerenciá-la. Isso põe em tensão o [[ADR-001 - Plataforma foca gestao e nao execucao real]], que segue marcado como vigente e não foi revisado quando o módulo entrou — a execução aqui é contida a um escopo estreito (um alvo por scan, uma ferramenta, dois papéis, container descartável), mas quem defende o trabalho precisa saber que ela existe. Ver o aviso na própria ADR-001.

## O ciclo completo

```
scan → triagem → promoção → remediação no fluxo normal → novo scan → comparação
```

Até 2026-09-09 o módulo parava no primeiro passo: o scan rodava, mostrava dezenas de alertas e a única saída era um PDF. A Fase 9.2 fechou o beco — ver [[Fluxo - Scan DAST]].

## Componentes

| Componente | O que é |
|---|---|
| Novo scan | URL HTTP/HTTPS sem credenciais embutidas, escolha de modo e confirmação no Real. Redes internas/loopback são aceitas conforme ADR-045 |
| Banner de estado do motor | Docker disponível, vagas ocupadas (padrão uma), fila e avisos do watchdog, antes do disparo |
| Acompanhamento | Barra por fase (`STARTING`/`SPIDER`/`PASSIVE`/`REPORT`), cronômetro, fila e botão **Parar**; 100% não significa cobertura completa |
| Tabela de findings | Filtro por risco, busca por título, linha expansível com URL, parâmetro, CWE, evidência, descrição e solução |
| Triagem | Por triar / Confirmado / Falso-positivo / Risco aceito + nota. Salva no clique; filtro "N por triar" |
| Promoção | Diálogo que leva o achado para uma [[Vulnerability]] em um [[Project]] real, com rascunho pré-preenchido e revisão humana obrigatória do vetor CVSS |
| Comparação | Diff entre duas execuções do mesmo alvo: **resolvidos**, **novos**, **continuam abertos** |
| Saídas | PDF gerado no cliente (mesmo estilo dos relatórios Executivo/Técnico) e o HTML original do ZAP em `<iframe sandbox>` |
| Selo "simulado" | Modo Demo escolhido explicitamente: achados fictícios, sem tráfego nem fallback automático. Triagem disponível; promoção/comparação indisponíveis |

## Quem usa

Exclusivo de `PENTESTER` e `ADMIN`. `CLIENT` não tem item de menu e qualquer rota `/dast/*` ou `/api/dast/*` forçada devolve 403/redirecionamento — **não existe meio-termo de visibilidade** aqui, diferente de [[Vulnerability]], que o cliente lê. Cada PENTESTER só enxerga os próprios scans (ownership fina no service, não no middleware).

Ver [[Matriz de Permissoes]] e [[Jornada - Pentester]].

## O que o módulo deliberadamente NÃO faz

- não autentica no alvo (usa o JWT do próprio Vulnera, sem SSO/SAML novo);
- não agenda scans (sem cron, sem recorrência);
- não usa fila externa — Redis/BullMQ ficaram fora ([[ADR-030 - Execucao assincrona sem fila]]);
- não escaneia múltiplos alvos numa execução;
- não calcula nota agregada estilo [[Maturidade]];
- não resolve findings por "misses consecutivos" entre scans — a comparação é explícita, pedida pelo usuário;
- **não inventa vetor CVSS**: sugere e exige revisão humana ([[RN10 - Severidade via CVSS com override justificado]]).

## Limites operacionais

- no máximo **2 scans simultâneos** (`DAST_MAX_CONCURRENT_SCANS`), o resto entra em fila FIFO;
- cada container tem teto de RAM e CPU (`DAST_ZAP_MEMORY`, `DAST_ZAP_CPUS`) — sem isso, dois scans reais ocupavam ~960% de 1200% de CPU e cresciam sem teto de memória;
- scan sem pulso por 2 min é abortado pelo watchdog;
- reiniciar a API durante um scan perde aquele scan (sem fila persistente); órfãos são marcados `FAILED` no boot.

## Regras e decisões associadas

- [[ADR-028 - Execucao do ZAP via Docker spawn]] — um container por scan, `execFile` sem shell, risco do socket Docker assumido
- [[ADR-029 - DAST como silo]] — findings do ZAP não contaminam o cadastro de vulnerabilidades
- [[ADR-030 - Execucao assincrona sem fila]]
- [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]
- [[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]]
- [[RN10 - Severidade via CVSS com override justificado]] — intacta: nenhum `cvssScore` do produto é estimado
- [[RN17 - Pentester so ve Projects atribuidos]] — pentester só promove para projeto em que é membro (`ADMIN` é exceção)

## Relacionado

[[DastScan]]
[[DastFinding]]
[[Enum - DAST]]
[[Fluxo - Scan DAST]]
[[Findings]]
[[OWASP ZAP]]
[[Relatorios]]
[[MOC - Produto]]
