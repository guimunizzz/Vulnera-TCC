---
type: entidade
tags: [domain, source-of-truth, owasp, remediation, xss]
status: ativo
---

# RemediationPlaybook

## Definição
O "como corrigir" do produto: conteúdo de remediação em Markdown, vindo do
**OWASP Top 10** ou escrito pela própria empresa.

## Papel no sistema
Alimenta o bloco "Como corrigir" do detalhe de um [[Vulnerability]], resolvido
pela categoria OWASP do achado — o playbook da casa primeiro, o oficial depois.

## Duas origens, uma tabela
| Origem | `isSystem` | `companyId` | Quem edita |
|---|---|---|---|
| OWASP Top 10 | `true` | `null` | **ninguém**, nem ADMIN |
| Da empresa | `false` | a empresa | ADMIN e PENTESTER dela |

A invariante `isSystem = true ⟺ companyId IS NULL` é imposta no service, e
`isSystem` **nunca** vem do corpo de uma requisição — seria a porta para um
tenant publicar um "playbook oficial" falso, visível para todas as empresas.

## Campos importantes
- `title`, `summary`, `owaspCategory`, `cweIds`
- `rootCause`, `remediation`, `validationSteps`, `secureExample`,
  `compensatingControls` — todos **Markdown**
- `references` — só `https`
- `source`, `sourceUrl`, `sourceVersion`, `sourceKey` (chave do sync)
- `clonedFromId` — obra derivada preserva a procedência

## Regras associadas
- Conteúdo OWASP é **CC BY-SA 4.0**, com atribuição visível na tela. Um playbook
  escrito do zero **não** credita a OWASP.
- Quem precisa adaptar o oficial **clona**; o clone vira da casa e continua
  creditando.
- `CLIENT` é read-only: é a maior superfície de XSS armazenado do produto.
- Sanitização em **três camadas**: escrita, renderização e CSP.

## Relacionado
[[Vulnerability]]
[[ADR-037 - Catalogo OWASP importado por CLI com snapshot offline]]
