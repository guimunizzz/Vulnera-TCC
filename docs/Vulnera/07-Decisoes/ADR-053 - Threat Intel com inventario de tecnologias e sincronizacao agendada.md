---
type: decisao
tags: [decision, threat-intel, cve, nvd, osv, kev, epss, inventario, notificacao, agendador, tenancy]
status: vigente
codigo: ADR-053
data: 2026-11-15
supersedes-parcialmente: ADR-030
---

<!-- Registra por que e como o Vulnera passou a acompanhar CVEs publicadas (NVD, OSV, CISA KEV, FIRST EPSS) contra um inventário de tecnologias por empresa, com sincronização agendada e notificação in-app; consumido pelos mantenedores e pela banca. -->

# ADR-053 — Threat Intel com inventário de tecnologias e sincronização agendada

> [!info] Origem
> Pedido do Rafael em 2026-11-14 ("conectar fontes de CVEs, mapear as
> tecnologias, notificar quando sai uma CVE relacionada, inventário que se
> alimenta do uso"), refinado por 9 perguntas respondidas no mesmo dia
> (D19 em `docs/DECISIONS.md`). Branch `feat/threat-intel`. Uso e validação em
> `docs/THREAT_INTEL.md`; capturas em `docs/evidencias/threat-intel/`.

> [!warning] Supersede PARCIALMENTE o [[ADR-030 - Execucao assincrona sem fila]]
> O ADR-030 continua valendo para o resto do produto (expiração preguiçosa do
> aceite de risco, scans DAST disparados pela tela). O que muda é que **existe
> um agendador**, e só para a Threat Intel — ver §4.

## Contexto

Tudo o que o Vulnera sabia sobre vulnerabilidades vinha de **dentro**: o
pentester (manual), o ZAP (DAST) e os relatórios da pipeline (SAST/SCA). Faltava
o que vem de **fora** e chega sem ninguém pedir: a CVE publicada hoje para a
biblioteca que a empresa usa. Pontos de partida:

- o sensor InternetDB do DAST já falava com o NVD (`NvdCveService`, cache
  `CveRecord`, `NVD_API_KEY`);
- o SBOM importado no SAST/SCA (ADR-052) já trazia a lista de componentes de
  cada projeto, mas só a contagem era guardada;
- o fingerprint do DAST já descobria tecnologia e versão do alvo;
- o schema tinha um model `Notification` (histórico in-app) desde a modelagem
  original, nunca usado;
- não havia nenhum processo periódico (ADR-030).

## Decisão

### 1. Quatro fontes públicas, cada uma pelo que faz melhor (D19.1)

| Fonte | Para quê | Como casa |
|---|---|---|
| **NVD** (NIST, API 2.0) | CVEs publicadas (feed) e por **produto** | `virtualMatchString` com o CPE + versão — o NVD resolve as faixas de versão |
| **OSV** (Google/OpenSSF) | avisos por **pacote** (npm, PyPI, Maven, Go, NuGet, RubyGems, crates.io, Packagist) | `querybatch` com ecossistema + nome + versão — o OSV resolve as faixas |
| **CISA KEV** | exploração ativa | catálogo inteiro (≈1,8 mil CVEs), marcado nas CVEs conhecidas |
| **FIRST EPSS** | probabilidade de exploração em 30 dias | lote das CVEs que afetam alguém |

GitHub Advisory ficou de fora (pede token; o OSV já agrega os avisos do GitHub).
O casamento de versão é **das fontes**, não do Vulnera: comparar faixas de versão
de oito ecossistemas é onde mora o erro, e as duas fontes já fazem isso bem.

### 2. Inventário por empresa, com dois tipos (D19.3, D19.4)

`TechAsset` pertence à **empresa** (não à aplicação). `PACKAGE` = ecossistema +
nome (+ versão), casado pelo OSV; `PRODUCT` = fabricante + produto do dicionário
CPE (+ versão), casado pelo NVD. Sem versão, toda CVE do pacote/produto casa e a
tela diz **"versão não confirmada"** — nunca finge precisão. Uma chave de
identidade normalizada impede a mesma tecnologia duas vezes na empresa,
inclusive entre sugestões.

### 3. O inventário se alimenta do uso, como SUGESTÃO (D19.5)

- **SBOM** importado (CycloneDX): cada componente com purl de um ecossistema do
  OSV vira sugestão na empresa do projeto. O parser passou a devolver a lista.
- **Fingerprint do DAST**: tecnologias com correspondência inequívoca (nginx,
  Apache, PHP, WordPress, Express...) e os CPEs da InternetDB. O scan não tem
  empresa (SG-FUT-04b): a sugestão vai para a empresa dona da aplicação cuja URL
  tem o **mesmo host** do alvo. Sem aplicação com esse host, nada é sugerido.
- Ninguém entra na vigilância sem confirmação. Descartada fica gravada e não é
  sugerida de novo.

### 4. Sincronização agendada dentro da API (D19.2)

Um `setInterval` no processo da API (`agendador.ts`), como o watchdog do DAST:
1 min após o boot e a cada `THREAT_INTEL_SYNC_INTERVAL_MIN` (padrão 6 h);
desligável com `THREAT_INTEL_SYNC_ENABLED=false`. Só o `server.ts` liga o
relógio — os testes, que importam o `app.ts`, nunca. O ADMIN tem "Sincronizar
agora". Confirmar uma tecnologia dispara o **backfill** só dela, em segundo
plano; pedidos durante outra execução entram numa fila e rodam logo depois.

Cada execução: KEV → feed do NVD (desde a anterior; 2 dias na primeira; teto de
7) → NVD por produto (incremental por `lastModStartDate`) → OSV por pacote →
EPSS → notificações. Tecnologias iguais em empresas diferentes são consultadas
**uma vez**. Uma fonte que falha vira **PARTIAL** com o motivo, as outras
seguem; o NVD com 403/429/5xx encerra as consultas ao NVD daquela execução.

### 5. Notificação in-app, com regra (D19.6, D19.7)

Reaproveita o `Notification` que já existia (só ganhou `link`). Notifica:

- CVE **nova** (publicada depois de a tecnologia entrar no inventário) com
  **CVSS ≥ 7 ou KEV**;
- CVE já conhecida que **entra no KEV** depois do mapeamento (exploração ativa é
  fato novo);
- cada evento **uma vez**; CVE sem nota ainda espera o NVD analisar.

O que já existia ao mapear aparece como **"já existia ao mapear"** e não
notifica. Destinatários (D19.6, "todos"): os ADMIN, os CLIENT da empresa e os
PENTESTER membros de algum projeto dela. Mais de 3 eventos numa execução viram
**um resumo** por pessoa. Web: sino no topo com contagem a cada 60 s.

### 6. Triagem e promoção (D19.8)

Cada casamento tem triagem (mesmo vocabulário do DAST/SAST) e pode ser
promovido a `Vulnerability` num projeto da empresa: `sourceType = THREAT_INTEL`,
A06, vetor CVSS revisado por humano (RN10), SLA e VRS. A origem nova entra na
visão unificada (D18).

### 7. Quem pode o quê (D19.9)

| | ADMIN | CLIENT OWNER | CLIENT MEMBER | PENTESTER membro |
|---|---|---|---|---|
| ver | qualquer empresa | a própria | a própria | empresas dos seus projetos |
| inventário | sim | sim | não | não |
| triar | sim | sim | não | sim |
| promover | sim | não | não | só para projeto de que é membro |
| sincronizar agora | sim | não | não | não |

A empresa do CLIENT vem do banco, nunca da query (SEC2). Recurso de outra
empresa pedido por id é **404**, não 403.

## Alternativas consideradas

- **Inventário por aplicação** — casa com o contexto de risco, mas obrigaria a
  repetir a mesma biblioteca em cada aplicação; o Rafael escolheu por empresa.
- **Comparar versões no Vulnera** a partir do feed do NVD — evitaria uma
  consulta por produto, mas reimplementaria a lógica de faixas de oito
  ecossistemas. Rejeitado.
- **Worker separado** (container próprio) — isolaria o relógio da API, ao custo
  de mais um serviço no compose; o volume do TCC não justifica.
- **E-mail / push** — o compose tem MailHog e o mobile tem push, mas o Rafael
  escolheu só a central in-app nesta versão.

## Consequências

- ✅ O Vulnera passa a trazer informação de fora, com prova de origem (fonte,
  aliases, referências) e sem inventar nota: sem CVSS, "sem nota ainda".
- ✅ O SBOM e o DAST ganham uso novo sem tela nova de cadastro.
- ⚠️ **Uma instância da API**: a flag de "rodando" é por processo, e a execução
  RUNNING no banco só evita a sobreposição grosseira. Com várias instâncias,
  trocar por lock no banco (`shortcut:` comentado em `threat-intel-sync.service.ts`).
- ⚠️ **NVD por produto depende da análise do NVD**: CVE recém-publicada ainda sem
  `configurations` não casa por CPE até o NVD analisá-la (dias, às vezes
  semanas). O OSV, para pacotes, costuma ser bem mais rápido.
- ⚠️ Sem chave, o NVD aceita 5 consultas a cada 30 s: cada produto do inventário
  custa ~6,5 s por execução. `NVD_API_KEY` reduz para 0,7 s.
- ⚠️ O OSV busca o detalhe de cada aviso a cada execução (sem cache por
  `modified`); suficiente para o volume do TCC.
