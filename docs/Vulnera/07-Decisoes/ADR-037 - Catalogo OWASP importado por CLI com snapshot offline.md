---
type: decisao
tags: [decision, owasp, playbooks, xss, csp, ssrf, licenca]
status: vigente
codigo: ADR-037
data: 2026-09-16
---

# ADR-037 - Catálogo OWASP importado por CLI, com snapshot offline e três camadas contra XSS

## Contexto

O CP-5 acrescentou os **Remediation Playbooks**: o "como corrigir" do produto,
com o conteúdo oficial do OWASP Top 10 e playbooks escritos pela própria
empresa. Três problemas precisavam de decisão antes da primeira linha de código.

**1. Não existe API da OWASP.** O conteúdo é Markdown versionado no GitHub. O
mapeamento categoria → Cheat Sheets existe, oficial, em
`OWASP/CheatSheetSeries/IndexTopTen.md` — sem ele, seria preciso adivinhar quais
folhas pertencem a cada categoria, ou seja, inventar um mapeamento e chamá-lo de
OWASP.

**2. Conteúdo de terceiros renderizado como Markdown é a maior superfície de
XSS armazenado do produto** — e não só o da OWASP: playbooks são escritos por
usuários, e um playbook da empresa A pode ser lido por… a empresa A, mas o
mesmo componente renderiza os dois.

**3. A demo do TCC precisa funcionar sem Internet.**

## Decisão

### A importação é CLI, nunca endpoint HTTP

```
npm run sync:owasp-playbooks              # rede  -> banco
npm run sync:owasp-playbooks -- --snapshot # rede  -> prisma/seeds/owasp/
npm run db:seed:playbooks                  # disco -> banco   (sem rede)
```

Um `fetch` ao GitHub dentro de um request transformaria indisponibilidade do
GitHub em indisponibilidade do Vulnera, e daria a qualquer ADMIN um gatilho de
tráfego externo a partir da aplicação.

### As URLs são constantes, e passam por allow-list

Nada aceita URL de usuário, de env var ou de parâmetro. `assertFonteOficial()`
confere protocolo, host e prefixo de caminho antes de cada busca — mesmo
espírito do `validateTargetUrl` do `zap-runner.service.ts` (ADR-028). Além
disso: `redirect: "manual"` (um 302 para outro host é justamente como se
contorna uma allow-list), timeout curto e teto de tamanho de resposta.

### Snapshot versionado com hash

`prisma/seeds/owasp/` guarda os 11 arquivos oficiais e um `MANIFEST.json` com
`sha256` de cada um. O seed offline usa **o mesmo pipeline** do sync — só troca
a função `buscar`. Se fossem caminhos diferentes, o catálogo semeado e o
sincronizado poderiam divergir, e a divergência só apareceria em produção.

### Três camadas independentes contra XSS

| Camada         | Onde                                | O que faz                                    |
|----------------|-------------------------------------|----------------------------------------------|
| Escrita        | `markdown-sanitize.util.ts` (API)   | o perigoso não entra no banco                |
| Renderização   | `lib/markdown.ts` (web)             | marked sem HTML bruto + DOMPurify allow-list |
| Navegador      | `config/csp.ts` (`vite preview`)    | `script-src` sem `'unsafe-inline'`           |

Nenhuma é suficiente sozinha: um playbook gravado antes de a camada 1 existir
passa pela 2; um furo na 2 é contido pela 3.

**Não se escreveu sanitizador de HTML próprio.** O trabalho da camada 1 é mais
estreito e verificável: remover construções perigosas de um texto que deveria
ser Markdown e neutralizar esquemas de URL que não sejam `https`. O HTML que
sobreviver ainda passa pelo DOMPurify.

**Bloco de código é preservado em todas as camadas.** Um playbook de XSS precisa
poder MOSTRAR `<script>alert(1)</script>` como exemplo.

### System é imutável, inclusive para ADMIN

`isSystem = true ⟺ companyId IS NULL`. `isSystem` **nunca** vem do corpo de uma
requisição — seria a porta para um tenant publicar um "playbook oficial" falso,
visível para todas as empresas. Quem precisa adaptar, **clona**: a cópia vira
playbook da casa e **preserva a procedência**, porque obra derivada de conteúdo
CC BY-SA continua exigindo atribuição.

### Licença visível no produto

CC BY-SA 4.0, com link para a fonte e para a licença, exibida na tela — e
**só** quando o conteúdo de fato tem origem OWASP. Creditar a OWASP num playbook
escrito pela própria empresa seria atribuição falsa.

## Justificativa

1. **Indisponibilidade externa não pode virar indisponibilidade interna.**
2. **A demo não pode depender do GitHub responder.**
3. **Conteúdo de terceiros é conteúdo não confiável** — inclusive o oficial.
4. **A CSP só vale se for real.** Ela é aplicada no `vite preview` (o modo que o
   Docker usa e que o ZAP escaneia) e o hash do único script inline é calculado
   do HTML **realmente servido**, nunca copiado à mão.

## Consequências

- **A CSP não é aplicada no servidor de desenvolvimento**, de propósito: o
  `@vitejs/plugin-react` injeta um preâmbulo inline de Fast Refresh que muda a
  cada boot, e cobri-lo exigiria `'unsafe-inline'` em `script-src` — uma CSP sem
  a única diretiva que faz diferença contra XSS.
- **`style-src 'unsafe-inline'` é concessão consciente**: o design system usa
  `style={{…}}` em dezenas de componentes; estilo inline não executa JavaScript.
- **A tradução pt-BR da OWASP não é uniforme.** Nove categorias usam "Como
  Prevenir"; o A10 usa "Como Previnir" (sic), além de outros dois headings
  divergentes. O parser casa por **assinatura**, não por lista de sinônimos —
  listar as três exceções resolveria hoje e quebraria em silêncio na próxima
  revisão da tradução, com o A10 entrando no catálogo sem remediação (foi o que
  aconteceu no primeiro seed real).
- **O A06 pt-BR lista referências sem link.** Não há URL a extrair e inventar
  uma seria falsificar a fonte; os links do A06 vêm das Cheat Sheets.
- **`IndexTopTen.md` tem onze seções** — a décima primeira é "A11 – Next Steps",
  que não é categoria do Top 10 e é filtrada.
- **CLIENT é read-only no catálogo.** Playbook é conhecimento técnico de
  remediação e a maior superfície de XSS armazenado do produto.
- **Dependências novas no web:** `marked` e `dompurify`.

## Alternativas descartadas

**Endpoint HTTP de sync.** Descartada — ver a decisão.

**Importar o conteúdo das ~122 Cheat Sheets.** Descartada na v1: multiplica o
volume e a superfície de sanitização por dez, para um ganho que o LINK já
entrega.

**Sanitizador de HTML próprio.** Descartada: é problema conhecido por falhar em
silêncio (mXSS explora a diferença entre como a regex lê a marcação e como o
parser do navegador a lê).

**Guardar HTML pré-renderizado.** Descartada: seria guardar o vetor.

## Relacionado
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-030 - Execucao assincrona sem fila]]
[[ADR-038 - Buscas salvas guardam a pergunta, nunca a resposta]]
