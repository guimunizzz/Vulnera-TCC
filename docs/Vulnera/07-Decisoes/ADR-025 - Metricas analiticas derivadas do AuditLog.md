---
type: decisao
tags: [decision, backend, metricas, dashboard]
status: vigente
codigo: ADR-025
data: 2026-08-09
---

# ADR-025 - Métricas analíticas derivadas do AuditLog

## Contexto

Os dashboards das Fases 3 a 6 eram rasos por uma razão estrutural: **não havia agregação no backend**. A auditoria da Fase 6.5 encontrou, no backend inteiro, duas chamadas a `.count()` e **zero** `groupBy`, `aggregate` ou `queryRaw`. Os três dashboards por papel buscavam a lista completa de `/vulnerabilities` e somavam em `useMemo` no cliente.

Pior: **não existia série temporal nenhuma**. O schema não tem tabela de snapshot, e `Vulnerability` guarda apenas o estado ATUAL — nada registra "quantos findings estavam abertos em 15 de junho".

A Fase 6.5 exigia burndown, MTTR, aging e risk score ao longo do tempo. A pergunta era: de onde vem o histórico?

## Decisão

### 1. O histórico é RECONSTRUÍDO, não armazenado. Sem migration.

Duas fontes, ambas já existentes:

1. **`Vulnerability.createdAt`** — quando o finding nasceu.
2. **`AuditLog` com `action = "STATUS_CHANGE"`** — quando mudou de estado. O `diffJson` guarda `{"from":"OPEN","to":"FIXED"}` (`vulnerability.service.ts`, ~linha 235). **O estado destino está registrado**, o que torna MTTR, burndown e a série de resolvidos reconstruíveis.

Nenhuma alteração de schema foi necessária.

**⚠️ Limitação inerente:** o `AuditLog` só passou a existir na Fase 3, e o `STATUS_CHANGE` de `Vulnerability` na Fase 5. Um finding que tenha mudado de estado antes disso não tem trilha — entra nas contagens pelo estado ATUAL, mas não contribui para o MTTR nem para a série de resolvidos. Em produção real, isso significaria um "buraco" no início da série; no ambiente do TCC, todos os dados são posteriores à Fase 5.

### 2. Toda agregação no banco

`groupBy`/`count`/`aggregate` do Prisma onde ele alcança. `$queryRaw` **parametrizado** onde não alcança, que são dois casos:

- **Truncar `DateTime` por dia/semana/mês.** O Prisma não tem `groupBy: { createdAt: 'day' }`.
- **Ler dentro do `diffJson`**, que é `TEXT` com JSON.

**`JSON_VALID(diffJson)` antes de `JSON_EXTRACT`** é obrigatório: o `diffJson` é uma coluna compartilhada por todas as ações auditadas, e o MySQL aborta a query inteira se `JSON_EXTRACT` receber texto que não seja JSON. Sem o guarda, uma entrada malformada de outra ação derrubaria o cálculo do MTTR.

### 3. Fórmula do risk score

```
riskScore = Σ ( cvss² / 10 )   sobre os findings ABERTOS
```

- **É soma, não média.** Risco acumula: 50 findings médios são piores que 5. A média diria o contrário — e diria também que fechar um finding baixo *piora* a nota, o que destruiria a confiança no número na primeira vez que acontecesse.
- **É quadrática.** Um CVSS 9,8 não vale três CVSS 3,2. Com o quadrado, um 10,0 pesa 25× um 2,0 — próximo de como uma equipe de fato prioriza.
- **Dividida por 10** para dar unidade legível: um finding de CVSS 10,0 contribui com exatamente 10 pontos. "47 pontos de risco" se lê como "o equivalente a 4,7 críticos perfeitos em aberto".
- **Só conta abertos**, o que faz a linha CAIR quando o time trabalha.
- Finding sem `cvssScore` contribui com 0 — sem vetor não há como estimar, e chutar seria pior.

**O que ela não é:** não é CVSS ambiental, não é métrica normalizada da indústria e não é comparável com o "risk score" de ferramenta comercial. É métrica interna; o valor está em ser consistente ao longo do tempo e entre aplicações da mesma empresa.

### 4. MTTR é MEDIANA, não média

Um finding esquecido por 400 dias entre nove corrigidos em 2 dias dá média de 42 dias — que não descreve nenhum caso real. A mediana devolve 2, o comportamento típico. O outlier não some: aparece no **aging**, que é a métrica feita para encontrá-lo. Cada MTTR vem acompanhado do número de amostras, sem o qual a mediana não se defende.

### 5. Agregação por período em UTC

O Prisma grava `DateTime` em UTC no MySQL, e `DATE_FORMAT(createdAt, ...)` lê o valor cru da coluna. Fixar UTC faz o mesmo dado produzir o mesmo gráfico independentemente de onde a API roda, e torna o teste de fuso determinístico (`MET-10`). O frontend exibe as datas na hora local; **a fronteira do bucket é UTC**.

### 6. O risk score da SÉRIE é uma aproximação — e isso é declarado

O `summary` soma o CVSS real de cada finding aberto agora. A série precisaria reconstruir, para cada período passado, quais findings estavam abertos e com que CVSS — o que exigiria a tabela de snapshot que a decisão 1 evitou.

A aproximação usa o CVSS *típico* de cada faixa de severidade (ponto médio da faixa do `schema.prisma`) aplicado ao acumulado do período. **Serve para ver TENDÊNCIA, que é o que a linha existe para mostrar; não serve para ler o valor absoluto de um ponto isolado.** Está comentado no código e dito na interface.

### 7. Insights são regras determinísticas, não IA

[[Adr 017 ia cortada do escopo do mvp]] continua valendo. Cada insight é um `if` sobre um número já agregado, produzindo uma frase e um filtro que reproduz o recorte. As chaves do filtro são as mesmas que a filtragem cruzada dos gráficos usa — um vocabulário só de filtro no produto inteiro.

## Consequências

- **Quatro endpoints novos, todos aditivos.** Nenhum contrato existente foi tocado.
- **Desempenho medido com 502 findings e 573 transições** (mediana de 5 execuções): `summary?compare=previous` 17 ms · `timeseries` 9 ms · `insights` 14 ms · `comparison` 9 ms. O limite exigido era 500 ms.
- **Isolamento:** mesma regra das Fases 3-5 (ADMIN tudo · CLIENT a própria company · PENTESTER só onde é membro), com 403 conforme a limitação L-04. Canários `TEN-14..17`.
- **Dois bugs encontrados na validação contra o banco**, ambos silenciosos:
  1. `{ applicationId, de, ate, ...opcoes }` — o spread sobrescrevia as datas resolvidas com `undefined`. O Prisma ignora `undefined` num `where`, então as contagens funcionavam; mas em SQL cru `createdAt >= NULL` não casa nada, e **risk score e aging zeravam sem erro**.
  2. O `companyId` **não vem no JWT** (o `authMiddleware` popula só `{userId, role}`). O service lia `actor.companyId` e todo CLIENT recebia 403. Corrigido carregando o usuário do banco, como já fazem `application.service` e `report.service`.
- **`prisma/seed-demo.ts`** foi criado para a demonstração: 90 findings distribuídos em 90 dias com a trilha de auditoria correspondente, semente fixa (cenário reproduzível entre execuções), idempotente por marcação `[demo]`, e recusa rodar com `NODE_ENV=production`. Aceita `--volume=500` para o teste de carga.

## Alternativa descartada

**Criar uma tabela de snapshot diário (`VulnerabilitySnapshot`).** Daria séries exatas em vez de aproximadas e consultas triviais. Descartada porque: (a) exigiria migration e um job agendado — e não há scheduler no projeto, nem Redis/filas ([[Fora do Escopo]]); (b) o histórico começaria do zero, enquanto o `AuditLog` já tem os dados desde a Fase 5; (c) o custo de reconstrução medido foi de 9 a 17 ms, longe de justificar a complexidade. Se o volume crescer uma ordem de grandeza, a tabela de snapshot é o próximo passo natural.

## Relacionado
[[Adr 017 ia cortada do escopo do mvp]]
[[ADR-021 - Maquina de Vulnerability com 4 estados]]
[[ADR-002 - Project 1 para 1 com Application]]
