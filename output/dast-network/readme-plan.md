<!-- Planeja a atualização do README após validar o spider; existe para evitar alegações sem evidência e é consumido pelo agente principal e pelos mantenedores. -->

# Plano do README — 09/10/2026

Estado: proposta; README, código, docs vivos e Git não foram alterados nesta tarefa. A redação final do spider e os números da validação dependem do fechamento do agente principal. As referências de linhas abaixo correspondem ao README lido antes dessa edição.

## Diagnóstico com base no repositório

| Local atual | Problema | Correção proposta e fonte |
| --- | --- | --- |
| README:56–59 | Afirma que DAST roda spider + active scan sem intervenção. O Real vigente usa crawler GET e análise passiva; não existe active scan nessa operação. | Descrever os modos explícitos, confirmação e descoberta de endpoints conforme a implementação final do spider. Não prometer exploração, autenticação no alvo ou cobertura de toda a SPA. Fonte: `app/api/src/services/zap-runner.service.ts`, contrato do controller e documentação DAST vigente. |
| README:9–18 | O resumo DAST não explica Real vs Simulado e conserva uma nota editorial longa da correção de setembro. | Liderar com o produto e o fluxo de gestão; declarar que achados reais só viram vulnerabilidades após promoção/revisão humana. Preservar a nota histórica de forma compacta em detalhes, se necessário. |
| README:110 | A tabela de stack registra 269 testes de API e 24 de web. | Remover números da descrição da tecnologia. Concentrar números datados num único bloco de validação, após o QA final. O marco anterior de 09/10 registra 617/338, mas é anterior ao spider e não deve ser usado como validação nova. |
| README:218–223 | A seção de qualidade ainda anuncia 528 testes/41 suítes API e 206 web. | Trocar por resultados efetivamente recebidos ao concluir esta rodada, com data, command/gate e ressalvas. O check global API continua bloqueado por dois imports não usados preexistentes; não usar badge de gate verde. |
| README:108 | Afirma CI com lint, build, teste e Sonar. | O workflow atual `.github/workflows/build.yml` roda testes API com cobertura e SonarQube; dispara somente em push/PR para `main`. Não há passos de lint/build/web nesse arquivo. Escrever exatamente esse contrato. |
| README:228 | Chama a stack local de “produção real” e trata um baseline histórico como prova atual. | Usar “build da stack Docker local”, datar a evidência histórica e distinguir baseline da própria Vulnera de DAST contra alvos autorizados. Não anunciar baseline novo se ele não foi executado. |
| README:233–235 | Link de Sonar leva a documento com `Status: pendente`; não comprova Quality Gate atual. | Descrever integração disponível e evidência pendente, sem alegar execução/resultado que não foi conferido. O texto desse documento também cita triggers antigos; não editá-lo no escopo do README. |
| README:74–94 | Galeria só contém capturas de agosto, antes das entregas visuais e do DAST atual. | Dar destaque a capturas reais desta rodada e indicar data/fluxo. Manter as antigas como históricas ou usar somente as capturas realmente correspondentes à versão final. |
| README:159 | Diz Node 20+ sem relação com a imagem efetivamente usada. | Declarar Node 22 nas imagens Docker; no desenvolvimento, alinhar ao runtime escolhido para o projeto, sem prometer teste em toda versão 20+. O CI atual usa Node 20. Fontes: Dockerfiles e workflow. |
| README:166 | `docker compose up --build` prende o terminal; os seeds seguintes exigem outro terminal. | Usar `docker compose up -d --build`, acompanhar `docker compose ps`/logs e rodar os seeds quando a API estiver saudável. Migrations já são aplicadas por `prisma migrate deploy` no CMD da imagem API. |
| README:185–194 | O host setup apenas copia `.env.example`. Esse exemplo tem `SERVER_PORT=3001` e MySQL `root:1234@localhost:3306`, enquanto `server.ts` exige `PORT` e o compose publica MySQL `3307` com usuário `vulnera`. | Explicar no README os ajustes de `PORT=3001` e `DATABASE_URL=mysql://vulnera:vulnera@localhost:3307/vulnera` para o modo host usando o DB do compose. Não alterar `.env.example` neste escopo. |
| README:189–201 | Instala API/web separadamente embora a raiz defina workspaces; mobile não é workspace da raiz. | Preferir `npm install` na raiz para API/web, comandos por workspace e instalação própria em `app/mobile`. Deixar host/mobile dentro de `<details>` para reduzir a abertura do README. |
| README:205 | Orienta check em todo PR sem expor o gate atualmente vermelho. | Manter os comandos, acrescentar link ao relatório datado que identifica o lint API preexistente; não tratar falha como sucesso. |
| README:209–212 | “Roteiro ~10 minutos” não abrange automaticamente as trilhas adicionais; `docs/DEMO.md` também contém extensão de remediação. | Linkar roteiro principal e adicionar percurso breve explícito cadastro → projeto → DAST → triagem → promoção → remediação → relatório. O tempo só deve ser anunciado para a trilha definida. |
| README:275 e rodapé | Cita `CLAUDE.md` como guia principal. | Usar `AGENTS.md` como regra atual e `PRD_VIVO.md` como estado. Arquivos antigos continuam existentes, mas não são a fonte de convenções fornecida pelo usuário. |
| README:293 | Declara ausência de rate limiting. | É falso: `app.ts`, `auth.routes.ts`, middleware/service/config e ADR-040 implementam limites global, tenant, user, escrita, endpoints e auth. A limitação atual é store em memória por instância, com reset no restart e sem cota compartilhada entre réplicas. |
| README:295 | Declara chunk único e tamanho fixo ~1,4 MB. | Há `React.lazy()` na landing e no canvas de dashboard; as páginas privadas ainda são importadas diretamente em `App.tsx`. Descrever split parcial e bundle principal grande, sem um tamanho novo não medido. |
| README:290 | Afirma versão exata 6.28.0 e fix somente na major 7. | `package.json` usa range `^6.28.0`; a afirmação de CVE/fix depende da versão realmente resolvida e de fonte/audit atual. Não reproduzir a alegação exata como fato sem verificar; apontar a limitação histórica e a pendência de revisão de dependências. |
| README:294 | Ausência de DELETE de Evidence. | Continua correto: `evidence.routes.ts` só tem GET/list, POST/upload e GET/download. Não anunciar exclusão. |
| README:296 | Push não validado em celular físico. | Continua como limitação material; não anunciar mobile validado nesta rodada web/DAST. |
| README:291–292 | Docker sem lockfile e CSP só no preview. | Continuam corretos pelos Dockerfiles e `vite.config.ts`; manter de forma concisa e com links às decisões. |

## Estrutura editorial proposta

1. Cabeçalho visual em HTML: nome, frase curta de produto, badges de tecnologia e navegação rápida por âncoras.
2. Uma captura principal real da interface atual, com link para o arquivo maior e legenda datada.
3. O percurso do produto, com tabela HTML de capacidades: inventário/projetos, findings/CVSS, DAST, remediação/SLA/VRS, playbooks/aceite, relatórios/maturidade/mobile.
4. Galeria HTML enxuta: DAST real + descoberta de endpoints/execução, finding promovido + quadro ou dashboard. Cada captura corresponde a um fluxo verificado.
5. Execução local em poucos comandos; tabela HTML de portas; credenciais e roteiro ligados a `docs/DEMO.md`.
6. Como demonstrar DAST: modos, endereço alcançável do ZAP, escolha final do spider, acompanhamento, resultados e promoção. Sem IP pessoal permanente como URL de instalação; usar `<ip-do-alvo>` nos comandos e legendar o exemplo real datado.
7. Stack e arquitetura: tabela HTML, Mermaid atualizado para incluir ZAP efêmero/rede/socket/volume de relatório, camadas e montagem por Factory Method.
8. Validação datada: números finais enviados pelo root, comandos e limites; distinguir qualidade automatizada, navegador real e evidências históricas.
9. Limitações atuais, links de documentação e estrutura do monorepo. Trabalho futuro em `<details>`.
10. Contribuidores: preservar a atribuição existente sem inventar nomes. O antigo print externo “Contribuidores - Agosto” pode ficar em detalhes históricos se o usuário quiser mantê-lo; evitar torná-lo a imagem principal.

## HTML que permanece legível sem CSS inline

O pedido inclui `<div style>` e tabelas HTML. Usar `style` apenas como aprimoramento opcional; a estrutura deve permanecer compreensível quando o GitHub remover esse atributo. Não depender de grid, flex, background, sombras, JS, `<style>` ou classes externas para organizar conteúdo.

Cabeçalho proposto:

```html
<div align="center" style="text-align:center; padding:24px 0;">
  <h1>Vulnera</h1>
  <p><strong>Da descoberta à remediação de vulnerabilidades.</strong></p>
  <p>Aplicações, projetos, scans autorizados, triagem e relatórios em uma plataforma com controle por empresa e papel.</p>
  <p>
    <a href="#executar-localmente">Executar localmente</a> ·
    <a href="#produto-em-acao">Produto em ação</a> ·
    <a href="docs/DEMO.md">Roteiro da apresentação</a> ·
    <a href="docs/DAST.md">DAST</a>
  </p>
</div>
```

Usar headings Markdown fora dos blocos HTML para âncoras previsíveis. Dentro de HTML bruto, usar `<p>`, `<strong>`, `<code>`, `<a>` e listas HTML em vez de esperar que Markdown seja interpretado. Separar blocos por linhas em branco. Comandos ficam em fences Markdown fora de `<div>`/`<table>`.

Tabela de capacidades:

```html
<table>
  <thead>
    <tr><th>Capacidade</th><th>O que o produto entrega</th><th>Quem usa</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>DAST</strong></td>
      <td>Execução autorizada, descoberta conforme o perfil validado, análise passiva, triagem e promoção revisada.</td>
      <td>ADMIN e PENTESTER</td>
    </tr>
    <tr>
      <td><strong>Remediação</strong></td>
      <td>Responsável, estados do finding, SLA e orientação OWASP.</td>
      <td>Escrita por ADMIN/PENTESTER; acompanhamento do cliente nas telas permitidas.</td>
    </tr>
  </tbody>
</table>
```

Galeria de captura real, com legenda visível e alt informativo:

```html
<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/evidencias/screenshots/08-dast-real.png">
        <img src="docs/evidencias/screenshots/08-dast-real.png" alt="Scan real concluído, contadores e achado promovido na interface Vulnera" width="600" />
      </a>
      <p><strong>DAST real</strong><br />Captura de 09/10/2026 contra a stack Docker. Perfil e números conforme a evidência final.</p>
    </td>
    <td width="50%" valign="top">
      <a href="docs/evidencias/screenshots/09-dast-descoberta.png">
        <img src="docs/evidencias/screenshots/09-dast-descoberta.png" alt="Acompanhamento e endpoints descobertos pelo perfil spider validado" width="600" />
      </a>
      <p><strong>Descoberta de endpoints</strong><br />Adicionar somente depois da implementação e captura real aprovadas.</p>
    </td>
  </tr>
</table>
```

Esses nomes são propostas, não arquivos existentes. Para tela pequena, priorizar uma captura principal de largura total antes da galeria e poucas colunas com texto curto. Não confiar em `style="display:grid"` como layout no GitHub.

## Quickstart proposto

```bash
git clone https://github.com/guimunizzz/Vulnera-TCC.git
cd Vulnera-TCC
docker compose up -d --build
docker compose ps
# quando a API estiver saudável:
docker compose exec api npm run db:seed
docker compose exec api npm run db:seed:playbooks
```

Tabela HTML de acesso: web `http://localhost:8086`, API `http://localhost:3001/api`, Mailhog `http://localhost:8025`, MySQL host `localhost:3307`. Não incluir reset de banco como requisito. O segundo seed usa snapshot OWASP offline. ZAP é iniciado por scan; não adicionar daemon ZAP permanente ao compose.

Explicação curta de rede DAST: IP LAN para outra máquina; `host.docker.internal` para servidor no host Docker Desktop; nome e porta interna para alvo na mesma rede Docker. Loopback dentro do ZAP aponta para o ZAP. Endereços públicos/privados são aceitos sem flag; formato HTTP/HTTPS sem credenciais e confirmação continuam. Finalizar texto de descoberta depois do spider, sem reutilizar a descrição do crawler anterior.

## Evidências disponíveis e o que falta

Inspecionadas visualmente:

- `output/dast-network/scan-result.jpg`: UI real em 09/10/2026, scan anterior ao spider, 5 findings e badge “Promovido”. É boa evidência do percurso; a legenda precisa explicitar que é perfil anterior se a evidência final mudar.
- `output/landing-merge-desktop.png`: landing real da integração de 01/10/2026. Útil como captura secundária datada; não prova a execução desta rodada.

Inventariadas, sem atribuir resultado novo:

- `output/dast-network/zap-report.jpg`, PDFs real/demo, páginas renderizadas e JSON do scan anterior.
- `output/visual-qa/dashboard-loaded-dark.png`: arquivo de setembro, não validado visualmente por este agente.
- `docs/evidencias/screenshots/01` a `07`: capturas de agosto, anteriores ao visual autenticado atual.

Antes da edição definitiva:

1. Receber contrato/perfil final do spider (configuração, escopo, limites, métodos e cancelamento), observabilidade de URLs descobertas e resultados da execução real.
2. Receber prints novos de acompanhamento/descoberta e resultado, com aprovação do root. Não inventar screenshot de funcionalidade ainda inexistente.
3. Receber números de QA e checks finais; preservar ressalva do lint global API quando aplicável.
4. Escolher quais imagens irão para caminho versionado sob `docs/evidencias/screenshots/`. Só então copiar as capturas aprovadas; `output/` é evidência local, não destino de links permanentes no README.
5. Manter dados brutos do alvo/PDFs/relatórios fora da galeria pública; usar capturas necessárias à demonstração e links para o relatório textual de validação.
6. Conferir arquivos/links/âncoras, sintaxe de tabelas HTML e legibilidade com atributos `style` removidos. Pré-visualização local não comprova renderização do GitHub; não alegar preview GitHub sem conferi-lo.

## Documentação a destacar na edição final

- `AGENTS.md`, `PRD_VIVO.md`, `docs/BACKLOG.md` — regras/estado/futuro.
- `docs/DEMO.md` — roteiro e credenciais locais de demonstração.
- `docs/DAST.md`, relatório datado desta entrega e ADRs 042/045 + ADR do spider se houver.
- `docs/EXPOSURE_REMEDIATION.md`, `docs/FINDINGS_QUERY.md`, `docs/DESIGN_SYSTEM.md`, `docs/FRONTEND_WEB.md`.
- `docs/PLANO-ACAO-SAST-HIGH.md` como pendência de validação/correção de SAST, sem promover os findings a vulnerabilidades confirmadas.
- Evidências históricas ZAP/Sonar com data e estado real, evitando transformar seus próprios textos antigos em prova atual.
