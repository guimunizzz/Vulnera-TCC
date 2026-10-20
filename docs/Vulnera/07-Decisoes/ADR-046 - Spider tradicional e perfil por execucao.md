---
type: decisao
tags: [decision, dast, spider, historico]
status: vigente
codigo: ADR-046
data: 2026-10-09
---

<!-- Explica a descoberta pelo ZAP e a procedência no PDF; consumido pelos mantenedores e pela banca. -->

# ADR-046 — Spider tradicional e perfil por execução

## Contexto

O usuário solicitou Spider para achar outros endpoints na mesma branch da
liberação de alvos internos. A fase SPIDER do ADR-042 fazia um crawler manual
de `<a href>` entre aspas, sem iniciar o Spider do ZAP. Também não havia
metadados para distinguir no PDF o método de cada execução histórica.

## Decisão

- Substituir a descoberta manual por `/spider/action/scan`, com contexto
  ancorado na origem/subárvore e `subtreeOnly=true`. Queries, credenciais e
  nomes conhecidos de ações sensíveis, inclusive percent-encoded, são excluídos.
- Usar parsers de links/recursos/robots.txt/sitemap; desabilitar forms e POST,
  parsers Git/SVN/DS_Store, JavaScript/AJAX e active scan. `recurse=false`
  controla o seeding pela árvore prévia, não desliga a descoberta de links.
- Manter uma thread, profundidade 2, 30 filhos por nó e parsing até 1 MB.
  Duração padrão 1 min, limitada a 1–10 pela env existente. Não há promessa
  de limite global de 30 páginas nem de cobertura completa ao retornar 100%.
- Polling valida status/resultados e mantém heartbeat/cancelamento; timeout
  interrompe o Spider e falha sem publicar relatório completo. Regras passivas
  precisam drenar antes da publicação. Leituras podem ter retry; ações não.
- Gravar `discovery.json` por execução com URLs em escopo, perfil e limites,
  sem chave da API. `/report/data` só lê após ownership, valida o conteúdo e
  expõe campos selecionados; artefato ausente/inválido/demo retorna `null`.
- PDF real sem artefato declara perfil histórico não registrado; não presume
  que a execução anterior usou Spider ou o perfil passivo atual. Nenhum schema,
  migration, dependência ou lockfile novo.

## Consequências

- A prova de tráfego revelou que o contexto do ZAP compara URLs sem query.
  Por isso, aplicar também `/spider/action/excludeFromScan` com `.*\?.*`
  antes de iniciar a descoberta. Filtrar somente a lista final não evita
  requests com parâmetros; a validação cobre o tráfego recebido pelo alvo.

- Descoberta usa os parsers do motor, incluindo endpoints que o crawler
  manual ignorava; permanece limitada à navegação pública sem JavaScript.
- Rotas exclusivamente client-side, login e APIs com query podem não ser
  descobertas. A conclusão é operacional, não prova cobertura exaustiva.
- Thread única limita concorrência, mas não representa intervalo fixo entre
  requests; a API oficial Spider atual não oferece `setOptionRequestWaitTime`.
- Arquivo por scan evita atribuir o método novo a resultados antigos. Perda
  desse artefato reduz informação da metodologia, sem fabricar procedência.
- A política de alcance de rede do ADR-045 permanece; contexto de URL não
  equivale a isolamento físico/egress nem impede efeitos de GET mal projetado.

## Relacionado

- ADR-042 — substitui parcialmente o método de descoberta; Real/Demo/passivo permanecem.
- ADR-045 — suporte a redes internas.
- [API oficial Spider](https://raw.githubusercontent.com/zaproxy/zap-api-python/master/src/zapv2/spider.py)
- [Configuração oficial Spider](https://www.zaproxy.org/docs/desktop/addons/spider/automation/)
- `docs/DAST-SPIDER-VALIDACAO-2026-10-09.md`
