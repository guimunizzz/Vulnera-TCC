---
type: entidade
tags: [domain, source-of-truth, busca, watchlist, tenancy]
status: ativo
---

# SavedQuery

## Definição
Uma busca da listagem de findings, guardada com nome — o atalho pessoal ou a
watchlist do time.

## Papel no sistema
🎯 **Guarda a PERGUNTA, nunca a RESPOSTA.** `queryString` é a query canônica da
API (`severity=CRITICAL&status=OPEN`), não a lista de findings que ela devolveu.
Abrir um atalho é navegar para `/findings?<queryString>`, e a listagem recorta
pelo escopo de **quem abriu** — por isso a mesma watchlist devolve conjuntos
diferentes para pessoas com acessos diferentes, que é o correto.

## Campos importantes
- `name` (único por dono), `description`
- `queryString` — canônica: só parâmetros conhecidos, ordem estável, sem
  `page`/`pageSize`
- `scope` — `PRIVATE` · `COMPANY`
- `ownerId`, `companyId`, `pinned`

## Regras associadas
- **`PENTESTER` só cria busca privada** — ele atravessa empresas, e
  "compartilhar com a empresa" não teria destinatário definido.
- Watchlist `COMPANY` é **do time para ler, do dono para editar**.
- Tetos: 50 buscas por pessoa, 8 fixadas na barra lateral.
- A busca salva **não é passe de acesso**: pode conter `companyId` alheio, e
  executá-la não entrega nada.
- Pedir busca alheia devolve **404**, não 403 — um 403 confirmaria que existe.

## Relacionado
[[Vulnerability]]
[[ADR-038 - Buscas salvas guardam a pergunta, nunca a resposta]]
