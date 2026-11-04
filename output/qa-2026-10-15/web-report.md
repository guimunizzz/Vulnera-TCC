<!-- O QUE FAZ: registra o QA automatizado e a revisão de fluxos web para a apresentação. POR QUE EXISTE: separa falhas comprovadas, revisão estática e limitações. QUEM CONSOME: Rafael e o relatório consolidado de QA. -->

# QA Web — 2026-10-15

Escopo: código atual de `app/web`, dependências da mesma imagem Docker de `vulnera-web` em execução, testes em contêineres descartáveis. Nenhuma mudança no produto, banco, imagem em execução, schema, dependência ou lockfile. O navegador real é coberto pelo agente principal; este relatório não reivindica validação visual própria.

## Validação automatizada

- Check global: **345/346 testes aprovados em 31 suítes (30 aprovadas; uma com timeout)**, 425,49 s. Comando: `npm run check -- -- --maxWorkers=1 --silent`, com `src`, `scripts`, `.eslintrc.json` e `vitest.config.ts` montados somente leitura na imagem existente. Log `web-check.log`. Única falha: APP-CTX-01 excedeu 5 s na execução integral; **repetição focal com o mesmo limite padrão passou em 1,753 s**, sem mudar código ou limite. O check integral não é declarado verde.
- Lint: **0 erros, 9 avisos** (Fast Refresh e dependência de hook preexistentes).
- Contraste: **66/66 pares aprovados**, 77 primitivos em gamut, temas escuro/claro. Isso mede tokens; não prova contraste de todo fundo decorativo real.
- Testes adicionais: **11/11 aprovados**, em 14,45 s; repetição após ajustar apenas os papéis dos atores no roteiro de QA: **11/11 mais APP-CTX-01 (12/12, 23 casos não selecionados)**, 12,42 s, com timeout padrão de 5 s. Logs `web-characterization.log` e `web-focused.log`. `web-characterization.test.tsx` contém cenários com APIs simuladas, sem dados reais. **As asserções caracterizam os defeitos atuais: um teste passar aqui comprova o comportamento ruim, não a correção do produto.**
- Build `tsc --noEmit && vite build`: **aprovado**, Vite em 46,12 s; aviso de chunk principal acima de 500 kB permanece. Log `web-build.log`.

## Achados para corrigir antes ou depois da apresentação

| ID | Prioridade | Reprodução/efeito | Evidência de código | Prova preparada |
|---|---|---|---|---|
| WEB-01 | P1 se demonstrar cadastro | Concluir cadastro de empresa não atualiza `auth.store.user`. A sessão mantém `companyId=null` e `companyRole=null`; o novo OWNER continua sem ações de governança dependentes de OWNER até novo login. | `onboarding-page.tsx:64`; `settings/sla-settings-page.tsx:156`; `risk-acceptance-panel.tsx:96` | QA-ONB-01 |
| WEB-02 | P1 em falha parcial | Se criar a empresa der 201 e solicitar assinatura falhar, Confirmar tenta criar a empresa novamente. API recusa `USER_ALREADY_HAS_COMPANY`; o wizard não consegue retomar só o pedido de assinatura. | `onboarding-page.tsx:64`; `company.service.ts:44`; `company.service.ts:55` | QA-ONB-02 |
| WEB-03 | P2 | Falha definitiva de leitura de findings vira “0”, “0%” e “Nenhum finding registrado ainda” no dashboard CLIENT, sem aviso/nova tentativa. O hook é compartilhado por três dashboards. | `hooks/use-findings.ts:159`; `components/dashboard/client-dashboard.tsx:31`; `admin-dashboard.tsx:78` | QA-DASH-01 |
| WEB-04 | P2 | Falha ao carregar assinaturas pendentes deixa só o cabeçalho; não há erro, lista vazia informativa ou botão para recuperar. | `pages/admin/pending-subscriptions-page.tsx:20`; `:68` | QA-SUB-01 |
| WEB-05 | P2 | Falha ao carregar a avaliação de maturidade é apresentada como “Nenhuma avaliação de maturidade ainda”. ADMIN ainda recebe CTA Criar avaliação; CLIENT recebe afirmação incorreta de que o administrador não preencheu. | `pages/maturity-assessment-page.tsx:51`; `:149`; `:180` | QA-MAT-01 |
| WEB-06 | P2 | Na edição de finding, apagar Impacto/Recomendação e salvar omite os dois campos do JSON (`undefined`). O banco conserva os valores anteriores e eles reaparecem na reconsulta. | `pages/finding-editor-page.tsx:135`; `repositories/vulnerability.repository.ts:192` | QA-FIND-01, payload JSON |
| WEB-07 | P2 | Falha no GET do finding em `/findings/:id/edit` abre formulário vazio com “Salvar alterações” habilitado, sem mensagem ou recuperação. Pode fazer a pessoa preencher tudo de novo para depois receber outra recusa. | `pages/finding-editor-page.tsx:59`; `:151` | QA-FIND-02 |
| WEB-08 | P2 acessibilidade | Área de upload só tem `div onClick`; sem `tabIndex`, sem handler de teclado, input file `hidden`. Usuário de teclado não consegue abrir o seletor de evidências. | `components/findings/evidence-uploader.tsx:88`; `:98`; `:110` | QA-EVID-01 |
| WEB-09 | P2 navegação | CLIENT vê “atribua no quadro de remediação” em finding sem responsável, mas `/remediation` é restrita a ADMIN/PENTESTER e o redireciona silenciosamente ao dashboard. | `pages/finding-detail-page.tsx:178`; `App.tsx:74` | QA-FIND-03 + guarda de rota |
| WEB-10 | P2 navegação | PENTESTER vê breadcrumb clicável da aplicação, mas o destino `/applications/:id/dashboard` é restrito a ADMIN/CLIENT e o envia ao dashboard. | `pages/finding-detail-page.tsx:127`; `App.tsx:81` | QA-FIND-04 + guarda de rota |
| WEB-11 | P2 resiliência | Após access token expirar, um 401 seguido de falha de rede no refresh apaga a sessão inteira, forçando novo login. A falha temporária não é distinguida de refresh recusado. | `lib/api/client.ts:79`; `:85`; `:87` | QA-AUTH-01 |
| WEB-12 | P2 visual, já documentado | PDF Executivo Top 5 desenha título sem quebra/largura e metadados no mesmo y. Títulos longos sobrepõem CVSS/categoria; defeito anterior ainda presente. | `lib/pdf/executive.ts:214`; `:224` | Revisão estática; renderização deve ser confirmada pelo fluxo real |
| WEB-13 | P3 visual, já documentado | Histórico de relatórios mostra ID interno para CLIENT/PENTESTER porque resolve autor por catálogo consultado apenas por ADMIN. | `pages/project-detail-page.tsx:93`; `:110`; `:392` | Revisão estática |

Prioridades P1 acima são condicionais ao roteiro: impedem uma demonstração limpa de cadastro/recuperação parcial. Não indicam indisponibilidade geral da aplicação existente.

Outras limitações de UX por leitura: onboarding não apresenta erro/carregamento/nova tentativa do catálogo de planos (`onboarding-page.tsx:38`, `:135`); tabela do histórico de relatórios usa `overflow-hidden` e pode cortar colunas em viewport estreita (`project-detail-page.tsx:377`, confirmar no navegador); edição bem-sucedida de finding permanece sem confirmação explícita de sucesso (`finding-editor-page.tsx:138`). Estes pontos não foram contabilizados como defeitos adicionais comprovados.

## Cobertura e limites

A suíte existente cobre listagens/filtros, wizard de projeto/cancelamentos, criação administrativa de aplicações, contexto de risco, roteamento/RBAC, DAST simulado/real e confirmação, SLA, remediação, buscas salvas/query, CSV/Markdown, cache/retry, tema, overlays/foco e componentes da landing. Os arquivos E2E existentes incluem 9 cenários Exposure & Remediation, 5 DAST, 1 criação de projetos e 1 captura de evidências, mas **não foram executados por este agente**, pois alguns criam/movem registros ou iniciam scans no banco real. A execução em navegador fica com o agente principal.

Não foram feitas instalação npm, correção de bugs, publicação, scans reais, exclusões, reset, cadastro ou upload contra a aplicação. Os testes adicionais usam mock HTTP/API em jsdom; não provam layout/responsividade nem o banco real. Nenhuma alegação de “todos os fluxos reais aprovados” decorre deste relatório.
