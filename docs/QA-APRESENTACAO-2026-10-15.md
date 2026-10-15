<!-- Registra a rodada de testes e prioriza defeitos antes da apresentação; existe para preservar evidências e orientar Rafael nas correções e no ensaio. -->
# QA da apresentação — 15/10/2026

**Resultado: rodada de QA concluída; correções pendentes.** A aplicação executa os percursos principais, mas há problemas relevantes de segurança, integridade, formulários e relatórios. Aprovação das suítes existentes não equivale a ausência dos defeitos encontrados na exploração.

Base: branch `dev`, commit `e9df684`. Stack real `http://localhost:8086`, API `http://localhost:3001/api`, MySQL publicado na porta 3307. Código de produção, dependências, schema, migrations, lockfiles e `AGENTS.md` não foram alterados. Não houve commit, push, PR ou deploy nesta rodada de diagnóstico.

## Atualização — correções seletivas autorizadas

**15/10/2026, branch `codex/fix-qa-company-onboarding`, destino do PR `dev`: QA-01, QA-02 e QA-03 corrigidos; QA-25 ajustado para “Sugestões por IA (em breve)”.** As seções seguintes preservam a descoberta original. Os outros 21 achados não foram corrigidos nesta alteração.

| Item | Correção e comprovação |
| --- | --- |
| QA-01 | `CompanyController.update` aceita objeto com somente `name/cnpj/planId`, valida escalares e rejeita campos extras com 400 `INVALID_COMPANY_FIELD`; cria DTO novo. `CompanyRepository.update` repete a projeção dos três campos no sink. Regressão HTTP segura recebeu 200 antes do patch e 400 após, sem alterar User/Company; relações alternativas, JSON cru `__proto__`, campos de sistema, operações Prisma em escalares e chamada interna contaminada também cobertos. Updates legítimos completos/parciais, ADMIN e TEN-02 preservados. Investigação e revisão independentes não encontraram bypass/regressão acionável |
| QA-02 | `usersApi.me` lê perfil autoritativo; `auth.store.updateUser` atualiza só a sessão de origem, preserva tokens rotacionados e limpa cache quando muda escopo. OWNER ganha edição SLA antes de novo login; respostas tardias não alteram outra sessão |
| QA-03 | Onboarding consulta `/companies/me`, guarda Company já criada, reconcilia criação cuja resposta se perdeu e retoma apenas perfil/assinatura. Reentrada usa dados reais salvos e impede recadastrar a empresa; erros de verificação oferecem nova tentativa. Sucesso só após perfil e pedido concluídos |
| QA-25 | Texto da sugestão por IA recebeu “(em breve)”. Não se implementou IA nem se alteraram os demais itens/valores da landing |

Regressões novas falharam antes do patch. Validação final: **API focal 29/29 e full 648/648 em 43 suítes; Web focal 14/14 e check 357/357 em 32 suítes; contraste 66/66; builds API/Web aprovados.** Lint focal dos arquivos alterados aprovado. `npm run check` global API **continua bloqueado** exclusivamente pelos dois imports não usados anteriores em `vulnerability.service.ts:45`; não foi declarado verde nem ampliado o escopo para removê-los.

Chrome no build de produção: **10/10** verificações, usando cadastro/Company/pedido reais novos `QA-FIX-20261015-*` e falhas 503 controladas no browser para perfil/assinatura. Foram confirmados um único POST de Company, OWNER/edição SLA sem relogin, reentrada, resumo com os dados salvos, 375 px sem overflow e pedido final 201. Preview isolado recebeu a mesma configuração de CSP/API do Docker; o contexto de teste recebeu permissão local de rede para a ponte do preview, sem mudar configuração da aplicação ou navegador do usuário. Evidências de resultado e capturas preservadas na coleção local gerenciada `artifacts/validation/qa-fixes-2026-10-15/` do Codex Security. Não houve deploy da stack em execução nesta correção.

**Limite preexistente mantido:** se o POST de assinatura já gravou PENDING e somente sua resposta se perde, repetir o pedido ainda pode duplicar pendência. A API não expõe PENDING ao CLIENT; deduplicação geral ficou registrada no backlog, sem mudar regras de assinatura/schema nesta correção. Nenhum dado demo anterior foi editado ou removido. A autorização desta alteração não incluiu corrigir os outros achados de QA.

## Testes realizados

| Verificação | Resultado e interpretação |
| --- | --- |
| API completa | **643/643 testes, 43/43 suítes aprovadas**, banco `vulnera_test` explicitamente protegido |
| Cobertura API | 91,79% linhas total; services ponderados 94,34% (2085/2210). `owasp-sync.service` 62,5% e `rate-limit.service` 78% continuam abaixo de 80% individualmente |
| Web completa | **345/346**, 31 suítes. APP-CTX-01 excedeu 5 s sob carga; repetição com o mesmo limite passou em **1,753 s**. A execução integral não ficou verde |
| Caracterização dos defeitos Web | **11/11**; repetição junto de APP-CTX-01 **12/12**. São provas do comportamento defeituoso com APIs simuladas, não correções nem novos casos de sucesso do produto |
| Builds | API TypeScript e Web TypeScript/Vite aprovados; aviso anterior de chunk grande no Web |
| Lint | Web: 0 erros/9 avisos. API: **2 erros preexistentes** em imports não usados de `vulnerability.service.ts:45`; `npm run check` API continua vermelho |
| Contraste dos tokens | **66/66**; não substitui inspeção dos fundos reais |
| HTTP real | **192 verificações: 177 esperadas, 13 inesperadas, 2 não avaliadas** por erro de contrato no roteiro inicial. Há ainda smoke de saúde/auth/CORS **10/10** |
| Navegador real | **80 capturas na varredura inicial**, 19 caminhos distintos, público/ADMIN/CLIENT OWNER/CLIENT MEMBER/PENTESTER; desktop 1440 e mobile 375 px; público também 320 px. Complementos incluem 768 px, formulários, downloads, teclado e relatórios |
| Layout | Sem overflow horizontal do documento nas 80 capturas iniciais; o histórico de relatórios tem **corte interno confirmado** em 375 px. Tabelas DAST usam rolagem horizontal interna |
| Acessibilidade automática | axe WCAG A/AA nas 68 telas autenticadas da varredura; seletor de pentester sem nome acessível em desktop/mobile. Landing posterior à intro conferida em 1440/768/375/320 sem violações axe nessa inspeção |
| Artefatos | PDFs Executivo (3 páginas), Técnico (5) e DAST simulado (7) baixados, renderizados e inspecionados. Executivo Top5 e Técnico Sumário cortam título longo. CSV filtrado e evidência TXT baixados |

Os percursos UI reais concluídos incluem cadastro, empresa/solicitação de assinatura, aprovação com confirmação e cancelamento, aplicação, wizard de projeto, finding com CVSS em tempo real, edição, comentário, upload/download, DAST simulado/consentimento do modo real sem execução, bloqueio de promoção do demo, triagem com nota persistida após recarga, relatórios, busca salva e fixada, tema claro, exportação CSV, sessão após recarga e logout. A matriz HTTP cobre também SLA, aceite de risco, maturidade, atribuição, canários de tenancy, buscas, transições e consolidação de relatório.

## Prioridade antes da apresentação

1. **QA-01 — fechar a entrada de relações aninhadas no update de Company.** A prova segura alterou apenas o nome de um usuário QA; não houve elevação de papel ou troca de senha. O mesmo caminho recebe tipos Prisma com campos privilegiados, portanto merece correção antes de liberar a instância a terceiros.
2. **QA-02/03 — estabilizar o cadastro.** Novo OWNER perde ações até novo login; falha parcial da assinatura prende o wizard.
3. **QA-06/07/08 — revisar os relatórios.** Executivo sobrepõe/corta título, histórico corta data no celular e geração consecutiva encontra o próprio limite de requisições.
4. **QA-04/05 — preservar integridade ao salvar.** Maturidade recusada salva parcialmente; campos apagados de finding reaparecem após sucesso 200.
5. **QA-25 — alinhar o discurso da landing com o MVP.** Há promessa explícita de sugestões por IA, funcionalidade removida do escopo.

## Problemas confirmados e reprodução

Legenda: **real** = navegador/HTTP da stack; **caracterização** = teste de componente com falha controlada + código; P1 = prioritário, P2 = corrigir fluxo/experiência, P3 = acabamento/robustez. Priorização considera o roteiro de apresentação, sem afirmar indisponibilidade geral.

| ID | Prioridade / prova | Reprodução e efeito | Referência |
| --- | --- | --- | --- |
| QA-01 | P1, HTTP real | CLIENT envia relação `users.update` a `PUT /companies/:id`; resposta 200 e `/users/me` confirma nome alterado. DTO não filtra propriedades em runtime. **Elevação de role/senha não executada**; exposição desses campos é inferência do tipo Prisma | `company.controller.ts:93,131`; `company.service.ts:71`; `company.repository.ts:28`; API-01 no relatório HTTP |
| QA-02 | P1 no cadastro, UI real | Cadastrar conta → empresa → pedido201 → SLA. Store ainda tem `companyId:null/companyRole:null`; “Salvar política” ausente. Novo login devolve OWNER e o botão aparece | `onboarding-page.tsx:64`; `sla-settings-page.tsx:156`; capturas `journey-onboarding-sla-antes-relogin.png` e `...depois-relogin.png` |
| QA-03 | P1 sob falha parcial, caracterização | Empresa201 seguida de falha ao solicitar assinatura. Confirmar de novo repete criação da empresa e recebe `USER_ALREADY_HAS_COMPANY`, sem retomar só a assinatura | `onboarding-page.tsx:64`; QA-ONB-02 |
| QA-04 | P2, HTTP real | Lote de scores `[4,6]`: segundo valor inválido retorna 400, mas a primeira resposta fica salva e média permanece0/BASIC. Lote válido posterior restaurou somente o registro QA | `maturity.service.ts:72,81,92`; API-02 |
| QA-05 | P2, UI real + caracterização | Editar finding → apagar Impacto/Recomendação → salvar200 → reabrir. Valores antigos reaparecem; o payload omite ambos porque usa `undefined` | `finding-editor-page.tsx:135`; `browser-final.json` |
| QA-06 | P2 visual, PDFs reais | Finding com título de 121 caracteres → PDF Executivo → Top5: sai da página e se sobrepõe a CVSS/categoria no mesmo y. PDF Técnico também corta esse título no Sumário | `lib/pdf/executive.ts:214,224`; `pdf-executivo-p2.png`; `pdf-tecnico-p2.png` |
| QA-07 | P2 visual, UI real | Projeto → Relatórios → largura375. Tabela chega a x398 dentro de painel331px com `overflow-x:hidden`; coluna Data é cortada e não pode ser rolada | `project-detail-page.tsx:377`; `final-relatorios-mobile.png` |
| QA-08 | P2, UI/HTTP real | Abrir histórico e gerar Executivo/Técnico em sequência. GET histórico, GET report-data e POST metadata usam o mesmo bucket (burst2, 3/min). Há429 no metadata **depois do download** e no próximo report-data; UI exibe erro genérico. Técnico foi baixado com sucesso após esperar recomposição | `routes/report.routes.ts`; `routes/project.routes.ts:18`; `project-detail-page.tsx:152`; `browser-final.json → http` e `browser-complement.json` |
| QA-09 | P2, caracterização | Falha definitiva no GET de findings do dashboard CLIENT vira contadores0 e “Nenhum finding registrado ainda”, sem aviso ou tentativa | `hooks/use-findings.ts:159`; QA-DASH-01 |
| QA-10 | P2, caracterização | Falha ao listar assinaturas pendentes deixa só o cabeçalho, sem erro/recuperação | `admin/pending-subscriptions-page.tsx:20,68`; QA-SUB-01 |
| QA-11 | P2, caracterização | Falha no GET de maturidade aparece como ausência de avaliação; ADMIN ainda pode receber CTA de criar outra | `maturity-assessment-page.tsx:51,149,180`; QA-MAT-01 |
| QA-12 | P2, caracterização | Falha no GET do finding em edição abre formulário vazio, “Salvar alterações” habilitado e sem recuperação | `finding-editor-page.tsx:59,151`; QA-FIND-02 |
| QA-13 | P2 acessibilidade, DOM real + caracterização | Área de upload é DIV com `tabIndex:-1`, sem role/teclado, input `display:none`. Tab não abre o seletor de arquivos | `evidence-uploader.tsx:88–110`; `browser-deep.json` |
| QA-14 | P2 acessibilidade, axe real | Em detalhes do projeto ADMIN, seletor “Selecione um pentester...” não tem label/aria-label; leitor de tela não recebe o propósito | `project-detail-page.tsx`; `browser-survey.json → select-name` |
| QA-15 | P2, UI real + caracterização | CLIENT em finding sem responsável recebe “atribua no quadro de remediação”, mas o destino é restrito a ADMIN/PENTESTER. Smoke final confirmou redirecionamento ao dashboard sem explicação | `finding-detail-page.tsx:178`; `App.tsx`; `browser-last-smoke.json`; QA-FIND-03 |
| QA-16 | P2, UI real + caracterização | PENTESTER clica breadcrumb da aplicação no finding; guarda o leva ao dashboard, sem explicação | `finding-detail-page.tsx:127`; `App.tsx`; `browser-complement.json` |
| QA-17 | P2, HTTP real + UI | PENTESTER Bruno (`companyId:null`) vê “Duplicar e adaptar”; criar/clonar recebe422 `USER_HAS_NO_COMPANY`, mesmo atribuído a projeto | `playbooks-page.tsx:60,217`; `remediation-playbook.service.ts:323`; API-08 |
| QA-18 | P3 visual, UI real | PENTESTER abre histórico de relatórios; coluna autor mostra `cmue2b9em0003pxogpar7imm9`. Catálogo de nomes só é consultado por ADMIN | `project-detail-page.tsx:93,110,392`; `final-autor-relatorio-pentester.png` |
| QA-19 | P2 resiliência, caracterização | Access token expira; refresh sofre falha temporária de rede; interceptor apaga a sessão inteira e força login | `lib/api/client.ts:79–87`; QA-AUTH-01 |
| QA-20 | P2, HTTP real | Atualizar perfil próprio com nome vazio/email fora de formato recebe200. Valores QA foram restaurados | `user.controller.ts:63`; API-03 |
| QA-21 | P2, HTTP real | Application aceita nome de três espaços com200; cards/seletores perdem identificação. Nome QA restaurado | `application.controller.ts:90,123`; API-04 |
| QA-22 | P3, HTTP real | `description` objeto em Application/Project alcança Prisma e retorna500 em vez de 400 | `application.controller.ts:47,136`; `project.controller.ts:126`; API-05 |
| QA-23 | P3, HTTP real | Login com email objeto retorna500 em vez de erro de campo | `auth.controller.ts:59`; API-06 |
| QA-24 | P3, HTTP real | `page=Infinity` retorna500; paginação fracionária é aceita. Falta garantir inteiro finito | `vulnerability.controller.ts:173`; `vulnerability-comment.controller.ts:19`; API-07 |
| QA-25 | P2 apresentação, UI real + código | Plano PRO da landing promete “Sugestões por IA”, enquanto o MVP exclui IA/Gemini desde03/08. Visitante recebe promessa de funcionalidade ausente | `landing/sections/pricing.tsx`; `complement-landing-planos.png` |

As linhas com múltiplos números indicam pontos de inspeção, não um diff nem uma correção implementada. WEB-12/13 e os dois imports da API já eram pendências documentadas; esta rodada confirmou que continuam presentes.

## Evidências visuais

- [PDF Executivo, página2: sobreposição/corte](../output/qa-2026-10-15/pdf-executivo-p2.png).
- [Histórico de relatórios cortado em375px](../output/qa-2026-10-15/final-relatorios-mobile.png).
- [SLA antes de novo login](../output/qa-2026-10-15/journey-onboarding-sla-antes-relogin.png) e [depois](../output/qa-2026-10-15/journey-onboarding-sla-depois-relogin.png).
- [DAST mobile expandido](../output/qa-2026-10-15/deep-dast-mobile.png): tabela exige rolagem horizontal; oportunidade de melhoria com detalhes em cards.
- [PDFs Executivo](../output/qa-2026-10-15/executivo.pdf), [Técnico](../output/qa-2026-10-15/tecnico.pdf) e [DAST simulado](../output/qa-2026-10-15/dast.pdf). O Executivo demonstra um defeito deliberadamente provocado em registro QA; não usar esse arquivo como relatório final da apresentação.

## Calibração dos roteiros e limites

Os JSONs preservam tentativas brutas, inclusive falhas de seletor, validações com expectativa errada e pausas insuficientes. **Não contar cada `ok:false` como um bug diferente.** Exemplos excluídos: guarda Web redireciona ao dashboard, não renderiza403; a intro pode terminar antes do clique Skip; checkbox visual usa label e funciona por Espaço; botão de tema tem role radio; texto puro com extensão `.exe` foi corretamente detectado como TXT, enquanto bytes binários inválidos receberam400. Um `.exe` de texto não comprova upload de executável.

O tráfego simultâneo inicial produziu429 e capturas de skeleton; não foi usado sozinho como prova de indisponibilidade. Na janela isolada, dashboard estabilizou, Application/Project receberam201, update200 confirmou QA-05 e download TXT funcionou. Relatórios têm disputa específica de bucket documentada em QA-08. O limite geral também é percebido em navegação rápida; avaliar sem desabilitar controles.

**Não exercitado nesta rodada:** mobile nativo em aparelho/emulador, push real, email, exclusão de dados, alteração de planos globais, reset/migrations, carga k6, expiração real de15min/7dias, exploração de elevação de privilégio, scan DAST real e tráfego a terceiros. Promoção/comparação de scans reais são cobertas pelas suítes existentes e por validações históricas; não foram refeitas por navegador nesta sessão. Não se declara “todos os fluxos sem bugs”.

## Dados QA e ensaio

Foram criados tenants novos com prefixos `QA-20261015-mv9hcuic` e `QA-20261015-UI-mv9hhdmd`. Dados demo existentes não foram editados; ADMIN/PENTESTER seed foram usados em sessões novas para operar os registros QA. Registros QA, logs e artefatos foram mantidos, sem limpeza/exclusão. **Os novos registros aparecem nas listas globais do ADMIN e somam às métricas globais**; usar os filtros/tenant TechNova no ensaio. O ADMIN ganhou também a nova busca privada fixada “QA-20261015 Busca UI concluída”. A eventual limpeza requer tarefa própria com autorização de exclusão.

O relatório HTTP lista IDs e estados finais; os roteiros UI preservam novos IDs em seus JSONs. Não reexecutar scripts de cadastro inadvertidamente: podem criar novos registros. Senhas aleatórias/tokens dos atores HTTP não foram publicados nas evidências.

Para uma apresentação imediata: usar contas já existentes ou refazer login após onboarding; ensaiar o PDF com os títulos reais; separar gerações de relatório por pelo menos30s após o histórico carregar; evitar os links incompatíveis de QA-15/16/17 até a correção. São contornos temporários, não resolução dos problemas.

## Arquivos e estado de entrega

- [API automatizada](../output/qa-2026-10-15/api-checks.md) e [Jest JSON](../output/qa-2026-10-15/api-jest-results.json).
- [Matriz HTTP real e oito causas da API](../output/qa-2026-10-15/api-flows-report.md).
- [Revisão Web e onze testes de caracterização](../output/qa-2026-10-15/web-report.md).
- Evidências de navegador: `output/qa-2026-10-15/browser-{survey,journeys,deep,final,complement,last-smoke}.json`, respectivos roteiros e screenshots.

QA e diagnóstico concluídos; **0/25 grupos de defeitos corrigidos nesta tarefa**. Próxima etapa: implementar correções por prioridade com regressões e nova validação. Este trabalho não fecha uma fase de implementação do roadmap e não cria decisão arquitetural nova.
