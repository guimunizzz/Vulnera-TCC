# Exposure & Remediation Management

> Documento técnico da iniciativa. Cobre o que existe **de fato** no código, em
> que arquivo, com qual regra e provado por qual teste.
>
> Para o *porquê* de cada decisão, ver os ADRs 033–039 em
> `docs/Vulnera/07-Decisoes/` e `docs/DECISIONS.md` (D1–D10).
>
> Critérios de aceite, casos de uso e a matriz de evidências rastreável estão em
> [`EXPOSURE_REMEDIATION_ACCEPTANCE.md`](./EXPOSURE_REMEDIATION_ACCEPTANCE.md).

---

## 1. O que a iniciativa resolve

O produto já registrava vulnerabilidades com CVSS, evidência e trilha de
auditoria. O que faltava era tudo o que vem **depois** do achado:

| Pergunta operacional | Antes | Agora |
|---|---|---|
| Onde esta falha está? | nome do projeto | contexto de risco da aplicação (CP-1) |
| Até quando tenho para corrigir? | não existia | SLA por severidade (CP-2) |
| O que corrijo primeiro? | ordenar por CVSS | Vulnera Risk Score (CP-3) |
| E o que não vamos corrigir? | fechar mentindo | aceite formal de risco (CP-4) |
| Como se corrige? | campo de texto livre | catálogo OWASP + playbooks (CP-5) |
| Como volto ao que estava olhando? | refazer os filtros | buscas salvas e watchlists (CP-6) |
| Quem está corrigindo o quê? | não existia | quadro de remediação (CP-7) |

---

## 2. Mapa dos checkpoints

| CP | Entrega | Estado |
|----|---------|--------|
| CP-0 | Baseline: branch, build do web destravado, ADR-033, decisões D1–D10 | ✅ |
| CP-1 | Application Context (ambiente, criticidade, exposição, dados) | ✅ |
| CP-2 | SLA Engine (`SlaPolicy` + ciclo por finding) | ✅ |
| CP-3 | Vulnera Risk Score | ✅ |
| CP-4 | Risk Acceptance | ✅ |
| CP-5 | Remediation Playbooks + OWASP Top 10 | ✅ |
| CP-6 | Saved Queries / Watchlists | ✅ |
| CP-7 | Quadro de remediação + `assignedTo` ponta a ponta | ✅ |
| CP-8 | Exposure Graph / Cadeias de Exposição | ⛔ não implementado — ver §9 |

---

## 3. CP-1 · Contexto de risco da aplicação

`Application` ganhou quatro campos que descrevem **onde** o finding vive:

| Campo | Valores |
|---|---|
| `environment` | `PROD` · `HOMOL` · `DEV` |
| `criticality` | `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` |
| `internetFacing` | booleano |
| `dataSensitivity` | `PUBLIC` · `INTERNAL` · `CONFIDENTIAL` · `RESTRICTED` |

**O contexto viaja embutido no DTO do finding** (`applicationContext`), não numa
segunda requisição: o PENTESTER recebe 403 em `GET /applications`, e é
justamente ele quem mais precisa saber se o achado está numa aplicação crítica
exposta ou num ambiente de desenvolvimento interno. Precedente: FEAT-09.

Mudar o contexto **recalcula o VRS** dos findings daquela aplicação. O gancho é
injetado na factory (`setRiskContextChangedHook`) para que `ApplicationService`
continue sem conhecer `Vulnerability`.

---

## 4. CP-2 · SLA de remediação

**Persiste o prazo, deriva o estado** — ADR-034.

```
SlaPolicy:  criticalDays / highDays / mediumDays / lowDays   (por empresa, ou a padrão)
Vulnerability: slaStartedAt · slaDueAt · slaDueSoonAt · slaPausedMs · slaPolicyId
```

Estados derivados (`src/utils/sla.util.ts`):

| Estado | Significado |
|---|---|
| `NO_SLA` | severidade `NONE` — não há prazo (≠ "no prazo") |
| `ON_TRACK` | dentro do prazo |
| `DUE_SOON` | nos últimos 20% do ciclo |
| `BREACHED` | prazo vencido, ainda aberto |
| `ACCEPTED` | aceite de risco vigente — relógio pausado |
| `RESOLVED_IN_SLA` / `RESOLVED_LATE` | encerrado dentro/fora do prazo |

Regras que não são óbvias:

- **Salvar política não recalcula nada.** Reaplicar é ação separada de ADMIN e
  gera `SLA_POLICY_APPLIED`.
- **`slaDueSoonAt` é persistido** para que os dois construtores de filtro
  expressem `DUE_SOON` como *coluna vs. agora* — ver ADR-034.
- **`IN_PROGRESS → OPEN` não mexe no relógio; `FIXED → IN_PROGRESS` abre novo
  ciclo** (ADR-033).

Rotas reais (a política é uma sub-rota de Company):
`GET/PUT /companies/:id/sla-policy`,
`GET /companies/:id/sla-policy/history` e
`POST /companies/:id/sla-policy/apply`.
Backfill: `npm run sla:backfill`.

---

## 5. CP-3 · Vulnera Risk Score

Aditivo, 0–100 — ADR-035.

```
VRS = round(cvss × 6) + criticidade + ambiente + exposição + sensibilidade
        0–60            0/5/10/15     0/3/7      0/8         0/3/7/10
```

Faixas: `MONITORAR` (0–39) · `PLANEJADO` (40–64) · `URGENTE` (65–84) ·
`IMEDIATO` (85–100).

`vrsFactors` guarda o detalhamento em JSON — a tela mostra parcela a parcela.
**SLA e proveniência ficam de fora** de propósito.

Busca: `sortBy=vrsScore`, `vrsMin`, `vrsMax`. Backfill: `npm run vrs:backfill`.

---

## 6. CP-4 · Aceite formal de risco

Entidade própria; o finding **continua aberto** — ADR-036.

```
REQUESTED → APPROVED → (EXPIRED | REVOKED)
    └────→ REJECTED
```

- `requestedById != reviewedById`, **sem exceção**.
- PENTESTER solicita, nunca aprova. `companyRole` vem do banco, nunca do JWT.
- `expiresAt` obrigatório, teto de 365 dias.
- Enquanto vigente, **o SLA fica pausado**; ao terminar, o intervalo é somado a
  `slaPausedMs` e os dois marcos são deslocados juntos.
- **Expiração preguiçosa e atômica**: `updateMany` condicional, um único
  vencedor escreve o evento de auditoria (`RISK-ACC-10`).

Busca: `?riskAcceptance=ACTIVE|EXPIRED|REQUESTED|NONE`.

---

## 7. CP-5 · Playbooks de remediação

Duas origens, uma tabela — ADR-037.

| Origem | `isSystem` | `companyId` | Quem edita |
|---|---|---|---|
| OWASP Top 10 | `true` | `null` | **ninguém** |
| Da empresa | `false` | a empresa | ADMIN e PENTESTER dela |

### Importação

```bash
npm run sync:owasp-playbooks               # rede → banco
npm run sync:owasp-playbooks -- --snapshot # rede → prisma/seeds/owasp/
npm run db:seed:playbooks                  # disco → banco  (offline)
```

Não há endpoint HTTP de sync. As URLs são constantes, com allow-list de host,
`redirect: "manual"`, timeout e teto de tamanho.

### Três camadas contra XSS

1. **Escrita** — `markdown-sanitize.util.ts` (API): o perigoso não entra.
2. **Renderização** — `lib/markdown.ts` (web): marked sem HTML bruto + DOMPurify.
3. **Navegador** — `config/csp.ts`: `script-src 'self' + hash`, sem
   `'unsafe-inline'`, aplicada no `vite preview`.

Bloco de código é preservado nas três — um playbook de XSS precisa mostrar o
payload.

### Licença

Conteúdo OWASP sob **CC BY-SA 4.0**, com atribuição visível na tela. O clone de
um System preserva a procedência (obra derivada). Um playbook escrito do zero
**não** credita a OWASP.

---

## 8. CP-6 e CP-7 · Trabalho do dia a dia

### Buscas salvas (ADR-038)

Guarda-se a **query canônica**, nunca o resultado. Abrir um atalho é navegar
para `/findings?<queryString>`, e a listagem recorta pelo escopo de quem abriu.

- `PRIVATE` (padrão) e `COMPANY`; **PENTESTER só privada**.
- Canonização na escrita: só parâmetros conhecidos, ordem estável, sem
  `page`/`pageSize`; o que for descartado é **relatado** a quem salvou.
- Tetos: 50 por pessoa, 8 fixadas.

### Quadro de remediação (ADR-039)

`/remediation`, três colunas (`OPEN`, `IN_PROGRESS`, `FIXED`). **Sem
arrastar-e-soltar**: mover é um menu com as transições válidas, operável por
teclado.

`assignedTo` ponta a ponta: validação (quem pode ser responsável é quem já
enxerga o finding), índices, filtro nos dois construtores com o valor especial
`none`, campo `responsavel` no Query Wizard e evento `ASSIGNEE_CHANGED`.

---

## 9. CP-8 · Exposure Graph — **não implementado**

O CP-8 era condicional ("só se todos os gates anteriores estiverem verdes") e
**não foi entregue nesta rodada**. O que existe é a decisão registrada:

- **D8/D9 em `docs/DECISIONS.md`**: sem graph database; projeção do MySQL; e a
  cadeia proposta no mapeamento envolvendo `DastFinding` foi **removida da v1**
  porque o silo DAST (ADR-029) não tem vínculo com `Application` antes da
  promoção — a regra pressupunha uma relação que o modelo não tem.
- O nome oficial da feature é **Exposure Graph** / **Cadeias de Exposição**.
  Nunca "Attack Path": o produto não tem dado de alcançabilidade para afirmar
  caminho de ataque, e afirmá-lo seria a mesma categoria de erro que o ADR-029
  recusou ao falar de CVSS estimado.

Não há código, rota, tabela nem tela de grafo. Ver §12 para o resto do trabalho
pendente.

---

## 10. Os dois construtores de filtro gêmeos

`vulnerability.repository.ts` tem **dois** construtores do mesmo filtro:

| Método | Vocabulário | Usado quando |
|---|---|---|
| `where()` | Prisma | ordenação normal |
| `condicoesSql()` | SQL cru | ordenação por severidade (`FIELD()`) |

**Todo filtro novo precisa entrar nos dois.** Canários:

- **`VULN-LIST-07b`** — compara os conjuntos de resultados dos dois caminhos.
- **`ASSIGN-07` / `ASSIGN-08`** — o mesmo para responsável e para "sem dono".
- **`VULN-LIST-09`** — filtros **compostos** combinam entre si.

> ⚠️ O `VULN-LIST-09` nasceu de um bug real encontrado no CP-7: cada filtro
> composto montava a própria chave `AND` num mesmo objeto literal, e a última
> apagava as anteriores. Combinar SLA com aceite perdia o SLA **em silêncio**,
> devolvendo mais findings do que o pedido. Corrigido com uma lista única de
> condições.

---

## 11. Superfície de API acrescentada

| Método | Rota | CP |
|---|---|---|
| `GET/PUT` | `/companies/:id/sla-policy` | CP-2 |
| `GET` | `/companies/:id/sla-policy/history` | CP-2 |
| `POST` | `/companies/:id/sla-policy/apply` | CP-2 |
| `GET/POST` | `/vulnerabilities/:id/risk-acceptances` | CP-4 |
| `POST` | `/risk-acceptances/:id/approve\|reject\|revoke` | CP-4 |
| `GET` | `/playbooks`, `/playbooks/:id` | CP-5 |
| `GET` | `/playbooks/for-category/:owaspCategory` | CP-5 |
| `POST/PUT/DELETE` | `/playbooks`, `/playbooks/:id`, `/playbooks/:id/clone` | CP-5 |
| `GET/POST/PUT/DELETE` | `/saved-queries` | CP-6 |
| `POST` | `/vulnerabilities/:id/assign` | CP-7 |

Filtros novos em `GET /vulnerabilities`: `slaState`, `vrsMin`, `vrsMax`,
`riskAcceptance`, `assignedTo` (com `none`).

---

## 12. O que NÃO foi feito

Registrado aqui porque documentação incompleta é pior que ausente:

- **CP-8 (Exposure Graph)** — ver §9.
- **Pesos do VRS configuráveis por empresa** — tornaria o score incomparável
  entre tenants e exigiria versionar a fórmula junto do histórico.
- **Conteúdo das ~122 Cheat Sheets** — a v1 guarda o link.
- **CSP no servidor de desenvolvimento** — ver ADR-037.
- **Notificação ao ser atribuído** — a tabela `Notification` existe e está
  inativa no produto; ligá-la é trabalho de outra frente.
