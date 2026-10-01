# Busca de findings — guia de uso

> Como filtrar achados na página **Findings** e na aba Findings de um projeto.
> Escrito para quem usa o sistema e para a banca. A decisão técnica por trás
> está no `docs/Vulnera/07-Decisoes/ADR-028`.

A barra de busca aceita **linguagem estruturada** e **texto solto**, misturados
na mesma linha. Não é preciso decorar nada: digitar `sql injection` já funciona.

---

## 1. As três formas de filtrar

Elas são **a mesma coisa** — mexer numa muda as outras, porque compartilham o
mesmo estado.

| Forma | Para quê |
| --- | --- |
| **Barra de busca** | Escrever o recorte inteiro de uma vez, ou colar um que alguém mandou |
| **Botões Severidade / Status / OWASP** | Marcar opções vendo quantos resultados cada uma tem |
| **Chips** | Ver o que está filtrando agora e remover um item de cada vez |

---

## 2. Não precisa decorar nada: a caixa de sugestões

**Clique na barra e ela mostra o que existe.** Sem digitar nada, abre a lista de
filtros disponíveis, cada um com o que faz e um exemplo pronto:

```
FILTROS DISPONÍVEIS
  projeto       Projeto de análise · projeto = Pentest Web
  aplicacao     Aplicação analisada · aplicacao = Portal
  empresa       Empresa dona do finding · empresa = TechNova
  severidade    Gravidade do achado · severidade = HIGH, CRITICAL
  status        Em que ponto do ciclo está · status != CLOSED
  owasp         Categoria do OWASP Top 10 · owasp = A03
  titulo        Texto no título e na descrição · titulo ~ injection
```

Escolher um campo **já emenda o `=`** e a caixa passa a mostrar os **valores
daquele campo**, com a contagem de cada um:

```
VALORES DE SEVERIDADE
  Crítica      CRITICAL    5
  Alta         HIGH        5
  Média        MEDIUM      4
  Baixa        LOW         3
  Informativa  NONE
```

Digitar filtra a lista. `sev` já deixa só `severidade`; `crit` já deixa só
`Crítica`.

**Teclado:** ↑ ↓ navegam · Enter escolhe · Esc fecha · Tab segue adiante.
Com a caixa fechada, Enter aplica o filtro.

⚠️ **A caixa só oferece o que ela consegue completar.** Quem não é ADMIN não vê
`empresa`, e o PENTESTER não vê `aplicacao` — esses papéis não têm acesso à
lista de nomes correspondente, então o campo levaria a um beco sem saída (ver
a limitação Q-01). Dentro de um projeto, `projeto`, `aplicacao` e `empresa`
também somem: ali o contexto já os fixou.

---

## 3. Sintaxe

```
severidade = HIGH                       igual
severidade = HIGH, CRITICAL             vários valores no mesmo campo
status != CLOSED                        diferente
titulo ~ injection                      contém
projeto = "Portal E-commerce"           aspas para valores com espaço
sql injection                           texto solto: busca em título e descrição
```

Expressões separadas por espaço combinam. `AND` entre elas é opcional e
significa o mesmo:

```
severidade = HIGH, CRITICAL status != CLOSED
severidade = HIGH, CRITICAL AND status != CLOSED
```

### Campos aceitos

| Termo | Filtra por | Valores |
| --- | --- | --- |
| `severidade` | Severidade final do finding | `CRITICAL` `HIGH` `MEDIUM` `LOW` `NONE` |
| `status` | Estado atual | `OPEN` `IN_PROGRESS` `FIXED` `CLOSED` |
| `owasp` | Categoria OWASP Top 10 2021 | `A01` a `A10` |
| `projeto` | Projeto de análise | nome, escolhido na lista |
| `aplicacao` | Aplicação analisada | nome, escolhido na lista |
| `empresa` | Empresa dona do finding | nome, escolhido na lista — **só ADMIN** |
| `titulo` | Texto no título e na descrição | qualquer texto |

**Acento e caixa não importam**, nem no campo nem no valor: `aplicação`,
`aplicacao`, `Severidade = high` e `severidade = HIGH` são equivalentes. Os
nomes em inglês também funcionam (`severity`, `status`, `company`, `project`).

### Operadores

| Operador | Lê-se | Onde vale |
| --- | --- | --- |
| `=` (ou `:`) | é | todos os campos |
| `!=` | não é | campos de lista (severidade, status, owasp) |
| `~` | contém | só `titulo` |

---

## 4. Como os filtros se combinam

🎯 **Entre campos diferentes é E. Dentro do mesmo campo é OU.**

```
severidade = HIGH, CRITICAL status = OPEN
```

lê-se: *(severidade Alta **ou** Crítica) **e** status Aberto*.

É a combinação que quase sempre se quer: "me mostre o que é grave **e** ainda
está aberto", não "o que é grave **ou** está aberto".

O `!=` é atalho para o resto da lista: `status != CLOSED` é exatamente
`status = OPEN, IN_PROGRESS, FIXED`. Por isso, ao recarregar a página, o chip
pode aparecer na segunda forma — é o mesmo recorte, escrito por extenso.

---

## 5. As contagens ao lado de cada opção

Abrindo **Severidade**, **Status** ou **OWASP**, cada opção mostra um número:

```
Crítica   4
Alta      1
Média     2
Baixa
```

Esse número é **quantos resultados aquela opção traria, considerando os outros
filtros já aplicados**. Com `status = OPEN` marcado, "Crítica 4" significa
*4 findings críticos **abertos***, não 4 críticos no total. Opção sem número
não traria nenhum resultado.

⚠️ **Uma exceção proposital:** a contagem de severidade **não** leva em conta o
filtro de severidade — e o mesmo vale para status e OWASP dentro de si mesmos.
Se levasse, ao marcar "Alta" todas as outras apareceriam com zero, e seria
impossível descobrir que ainda vale a pena marcar "Crítica" também.

---

## 6. Compartilhar uma busca

Na página **Findings**, o filtro fica na URL. Isso significa que:

- **copiar a URL e mandar para alguém** reproduz exatamente a mesma lista (desde
  que a pessoa tenha acesso aos mesmos projetos);
- **voltar e avançar** no navegador desfazem e refazem filtros;
- **recarregar** não perde o recorte.

```
/findings?severity=HIGH,CRITICAL&status=OPEN&sortBy=severity&sortOrder=desc
```

Na aba Findings de um projeto o filtro **não** vai para a URL, de propósito: ali
o endereço identifica o projeto, e um filtro temporário não deveria virar parte
do link daquela página.

---

## 7. Ordenar e paginar

Clicar no cabeçalho de **Finding**, **Severidade**, **Status** ou **Criado em**
ordena; clicar de novo inverte. A ordenação acontece **no servidor**, sobre o
conjunto inteiro — não só sobre a página que está na tela.

Severidade ordena por gravidade real (Crítica → Alta → Média → Baixa), não em
ordem alfabética.

---

## 8. Quando algo está errado

Uma expressão que o sistema não entende vira um **chip vermelho** com o motivo,
e **não é aplicada** — o resto do filtro continua valendo:

| O que aconteceu | O que aparece |
| --- | --- |
| `gravidade = HIGH` | campo desconhecido: "gravidade" |
| `severidade = URGENTE` | "URGENTE" não é severidade válida |
| `severidade =` | severidade sem valor |
| `projeto = "Portal` | aspas não fechadas |
| `severidade ~ HIGH` | o operador ~ só vale para texto |

O chip fica visível de propósito: um filtro escrito errado que fosse
silenciosamente ignorado mostraria uma lista diferente da que a pessoa pediu,
sem nenhum aviso.

⚠️ **Um valor ruim invalida a expressão inteira.** `severidade = HIGH, URGENTE`
não filtra por Alta — porque mostrar metade do que foi pedido, sem avisar, é
pior que não filtrar.

---

## 9. Quem vê o quê

A busca **nunca** mostra mais do que o papel permite. Isso é garantido no
servidor, não na tela:

| Papel | Alcance |
| --- | --- |
| **ADMIN** | Findings de todas as empresas |
| **PENTESTER** | Apenas dos projetos onde é membro — "todos os projetos" significa todos os **dele** |
| **CLIENT** | Apenas da própria empresa. Não tem a página global; vê os findings dela no painel, no projeto e no app mobile |

O filtro `empresa` só tem efeito para ADMIN. Para os demais papéis ele é
**descartado**, não recusado: o recorte continua sendo o de sempre.

---

## 10. Baixar em CSV

O botão **Exportar** na barra baixa o recorte atual como planilha.

- **Com filtro aplicado** → exporta **exatamente o recorte**, não só a página
  que está na tela. O botão diz quantas linhas vão sair: *"Exportar 5 em CSV"*.
- **Sem filtro nenhum** → exporta **tudo** que você pode ver.
- O arquivo sai como `findings-vulnera-AAAA-MM-DD-filtrado.csv` ou
  `-completo.csv`, para não confundir os dois na pasta de downloads.

**Colunas:** ID · Título · Severidade (por extenso e em código) · Severidade
calculada pelo CVSS · Score · Status · OWASP (sigla e nome) · Projeto ·
Aplicação · Empresa · Criado em (formato brasileiro e ISO).

Severidade, OWASP e data aparecem **duas vezes** de propósito: a versão por
extenso é para ler, a versão em código é para filtrar, ordenar e cruzar com
`PROCV`/`VLOOKUP`.

O arquivo é montado **no seu navegador**, a partir dos mesmos dados da tela —
o servidor não gera nem guarda planilha nenhuma. É a mesma escolha dos
relatórios em PDF (ADR-003).

⚠️ **Abre direto no Excel em português**: o separador é `;` e o arquivo leva
marca de codificação UTF-8, então acento não vira `Ã§`. Em ferramentas que
esperam vírgula (algumas importações de BI), configure o delimitador como `;`.

⚠️ **Segurança:** células que começariam com `=`, `+`, `-` ou `@` recebem uma
aspa simples antes. Sem isso, um finding intitulado `=cmd|...` seria executado
como **fórmula** por quem abrisse a planilha — a classe de ataque conhecida
como *CSV injection*. O conteúdo continua legível; só deixa de ser executável.

---

## 11. Limitações conhecidas

| # | Limitação | Por quê |
| --- | --- | --- |
| Q-01 | **`projeto`, `aplicacao` e `empresa` precisam ser ESCOLHIDOS na caixa de sugestões**, não digitados à mão — a API aceita identificador, não nome. Digitar o nome produz um chip inválido. E a caixa só oferece o campo para quem consegue buscar a lista: `empresa` só para ADMIN, `aplicacao` só para ADMIN e CLIENT. | Nome não é único: "Portal" pode ser de duas empresas. Deixar o servidor adivinhar resolveria a ambiguidade no lugar errado e de forma invisível. Oferecer um campo sem ter como completá-lo seria oferecer um beco sem saída. |
| Q-02 | **`%` e `_` na busca textual são curingas.** Procurar por `100%` traz mais do que deveria. | O efeito é excesso de resultado, nunca vazamento de escopo. Escapar exigiria tratar dois caminhos de consulta de formas diferentes, o que é pior. |
| Q-03 | **`!=` não sobrevive ao recarregar**: volta escrito como a lista equivalente. | O que a URL guarda é o filtro que está **de fato** aplicado, não a frase que o gerou. |
| Q-04 | **Não há filtro por responsável nem por intervalo de datas na barra.** O intervalo existe na API (`createdFrom`/`createdTo`) mas ainda não tem controle na tela. | Fora do escopo desta entrega; a API já está pronta para quando entrar. |
| Q-05 | **Sem busca por operadores compostos** (`OU` entre campos diferentes, parênteses). | O caso real é sempre E entre campos; suportar expressão booleana completa custaria um parser muito maior para um ganho que ninguém pediu. |
| Q-06 | **A exportação para em 10.000 linhas.** Passando disso, o arquivo sai com as 10.000 primeiras e a tela AVISA quantas saíram. | É o limite de montar o arquivo na memória de uma aba, não do produto. Truncar em silêncio entregaria uma planilha incompleta com cara de completa. |
| Q-07 | **Exportar um recorte grande leva alguns segundos**, porque a listagem é paginada de 100 em 100 e a exportação percorre as páginas em sequência. O botão mostra o progresso. | Buscar as páginas em paralelo economizaria segundos que ninguém está contando, ao custo de dez consultas simultâneas no banco. |

---

_Documento vivo. A sintaxe é definida em `app/web/src/lib/finding-query.ts`, e
cada regra descrita aqui tem teste correspondente em `finding-query.test.ts`._
