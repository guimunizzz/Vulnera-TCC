<!-- Registra a curadoria da ajuda de produto, suas fontes e limites; existe para revisar o atendimento do PR #77 e e consumido pelos mantenedores. -->

# Conteúdo de domínio e produto do assistente

## Ampliação da Vuvu — 2026-11-16

O catálogo atual tem **44 tópicos**: preservados os 29 anteriores e acrescentados 15 aprofundamentos em `app/api/src/config/assistant-workflow-help.config.ts`. A API principal ainda executava 17 tópicos na inspeção inicial desta rodada, porque as últimas aplicações haviam atualizado somente a Web. O fechamento da aplicação da API é registrado no relatório desta ampliação.

| Conteúdo novo | Fontes de produto e comportamento conferido |
| --- | --- |
| Jornada completa | Jornadas CLIENT/ADMIN/PENTESTER e fluxos de empresa, análise, finding, correção e relatório; distingue quem faz cada etapa. |
| Onboarding/assinatura | Fluxos Onboarding/Contratação e telas/serviços atuais: cadastro de conta seguido de Empresa, Plano e Confirmação; aprovação manual, uma assinatura ativa, retomada da empresa já salva. |
| Capacidade do plano | Plan, Subscription e regras de aplicações/projetos; remediação contratada não concede edição ao CLIENT. |
| Evidências | Evidence/Evidencias e validações vigentes: PNG/JPEG/PDF/TXT, até 10 MB, conteúdo compatível, upload somente autorizado. |
| PDFs do projeto | Report/Relatorios e fluxo de geração vigente: executivo/técnico, revisão/conclusão, dados daquele momento e limites do download/registro. |
| Exportação | Findings Globais e comportamento da exportação Excel: todo o recorte, além da página visível, respeitando autorização. |
| Scan e fila | DastScan/DAST: cinco estados, fases e limites reais da descoberta passiva/tradicional; conclusão não certifica segurança. |
| Promoção DAST | DastFinding e triagem/promoção atuais: revisão humana, deduplicação, proibição na simulação; triagem Risco aceito difere do aceite formal. |
| Importação SAST/SCA | `docs/SAST_SCA.md` e validações atuais: SARIF 2.1.0/CycloneDX 1.4+, seção de vulnerabilidades, 10 MB/5.000 achados, projeto autorizado. |
| Comparação SAST/SCA | Guia SAST/SCA e comparação vigente: novos/persistentes/resolvidos, triagem herdada e ausência de fechamento automático de findings. |
| Inventário | `docs/THREAT_INTEL.md`: sugestões dependem de confirmação, identidade/versão, avisos anteriores ao mapeamento. |
| Triagem Threat Intel | Guia/controles atuais: correspondência não confirma exploração, diferenças KEV/EPSS/CVSS, promoção autorizada e fontes parciais. |
| Override | RN10/RN21 e serviço vigente: justificativa mínima de 20 caracteres, auditoria, efeito em SLA/VRS e descarte ao mudar vetor. |
| Uso da Vuvu | Guia atual do assistente: clique/arraste/six seven/modo discreto, sessão, origem da resposta e privacidade. |
| Acessibilidade | Menu vigente/ADR-049: texto até 200%, contraste/movimento, foco/teclado e restrições das animações. |

Fontes de vault na tabela são de `docs/Vulnera/02-Dominio` e `03-Produto`. Os caminhos desta nota servem à revisão humana, não entram no contexto externo. Não foram incluídos comandos, desenvolvimento, arquitetura ou acesso a dados reais. Os fluxos antigos de onboarding/contratação ganharam nota de atualização: campos/etapas, e-mails, convites e permissões de remediação do planejamento original não foram tratados como funções disponíveis.

Continuam até três tópicos e 6.000 caracteres por chamada, sem aumentar o orçamento de saída ou a quantidade de chamadas. Empates de pontuação preferem expressões mais específicas. Novos assuntos de análise bruta são filtrados por perfil; os atalhos contextuais antigos foram preservados. A instrução de resposta pede objetivo, pré-condições, etapas, responsável e próximo passo ao explicar fluxos completos. Mais conteúdo dentro do mesmo teto pode alterar o consumo efetivo de entrada conforme a pergunta; não é promessa de custo zero.

## Critério de curadoria — PR #77

Registro histórico da ampliação anterior; os 29 tópicos citados abaixo são preservados no catálogo atual de 44.

O catálogo passou de 17 para **29 tópicos**: os anteriores foram preservados e 12 aprofundamentos acrescentados a partir do vault de domínio/produto. O conteúdo foi reescrito em linguagem de usuário e conferido contra as regras e telas vigentes. Não há leitura automática de `/docs`, do repositório ou do DOM, nem inclusão de documentação arquitetural no prompt.

Na requisição externa entram apenas título/ajuda dos tópicos selecionados, perfil e tela normalizada, além da conversa limitada já existente. A lista abaixo serve à revisão humana; caminhos de arquivos e referências de implementação não são enviados ao modelo. Até três tópicos e 6.000 caracteres de ajuda por envio; expressões específicas recebem precedência sobre um termo genérico isolado.

## Tópicos acrescentados e rastreabilidade

| Tópico | Fontes de domínio/produto | Comportamento conferido |
| --- | --- | --- |
| Tipos e origens | `03-Produto/Modulos/DAST.md`, `02-Dominio/Entidades/DastFinding.md`, `Vulnerability.md`; guias DAST/SAST-SCA | Origem não é confirmação de exploração; resultados brutos são distintos de findings promovidos/revisados. |
| Escopo e elegibilidade | `03-Produto/Fluxos/Fluxo - Abertura de Projeto.md`, `02-Dominio/Regras de Negocio/RN05 - Project 1 para 1 com Application.md`, `RN07 - Projeto exige assinatura ativa.md` | Projeto tem quatro estados; aplicação ativa, assinatura/capacidade e remediação incluída são verificadas. Projeto já existente bloqueia nova solicitação na mesma aplicação, inclusive concluído. |
| Ciclo de finding | `02-Dominio/Estados/Maquina - Vulnerability.md`, `03-Produto/Modulos/Findings.md` | OPEN → IN_PROGRESS → FIXED → CLOSED; retornos IN_PROGRESS → OPEN e FIXED → IN_PROGRESS; CLOSED terminal. CLIENT acompanha, sem transições. |
| OWASP | `02-Dominio/Conceitos/OWASP Top 10.md`, RN11 | Categorias A01–A10 da edição usada pelo produto; categoria não equivale à severidade. |
| CVSS | `02-Dominio/Conceitos/CVSS.md`, RN10/RN21 | Vetor v3.1, oito métricas, nota 0–10, faixas e ajuste de rótulo com justificativa. |
| Contexto/VRS | `02-Dominio/Entidades/Application.md`, `Vulnerability.md`, regras comerciais atuais | Criticidade, ambiente, exposição e dados contextualizam prioridade. VRS 0–100 não inclui tempo, origem nem simples override do rótulo de severidade. |
| Política e ciclo SLA | `02-Dominio/Entidades/SlaPolicy.md`, `Vulnerability.md` | Salvar não reaplica; reaplicar é ADMIN; ausência de SLA difere de estar em dia; aceite vigente pausa sem zerar. |
| Governança do aceite | `02-Dominio/Entidades/RiskAcceptance.md`, permissões vigentes | Sem autoaprovação, inclusive ADMIN; validade de aprovação até 365 dias; não muda o status do finding; retomada após expiração/revogação. |
| Busca/watchlist | `02-Dominio/Entidades/SavedQuery.md`, `03-Produto/Modulos/Findings Globais.md` | E entre campos, OU entre valores; guarda filtros, respeita escopo atual; PENTESTER cria privada; CLIENT não recebe página global. |
| Checklist de maturidade | `03-Produto/Modulos/Maturidade.md`, `02-Dominio/Entidades/MaturityAssessment.md` | Produto atual usa respostas 1–5 e média simples; ADMIN escreve; CLIENT da empresa/PENTESTER autorizado leem. |
| Empresa/participantes | `02-Dominio/Permissoes/CompanyRole.md`, `Roles.md`, RN16/RN17 | OWNER/MEMBER não ampliam papel CLIENT; empresa e projetos atribuídos limitam acesso. Nenhum convite ou ação é executado pelo assistente. |
| Notificações | `03-Produto/Modulos/Notificacoes.md`, `02-Dominio/Entidades/Notification.md` | Central do sino, não lidas e marcação de leitura; ler não executa a ação de negócio. Sem prometer entrega de e-mail/push. |

Os caminhos de fontes na tabela são relativos a `docs/Vulnera/`. A conferência utilizou os serviços de Project, Vulnerability, Maturity, RiskAcceptance, SavedQuery, Notification e seus controles/telas atuais. Essas referências de revisão não fazem parte da ajuda enviada ao provedor.

## Material antigo que não foi tratado como funcionalidade disponível

- Documentos de abertura ainda descrevem REQUESTED/TRIAGE/PLANNED; o produto implementa PENDING/IN_PROGRESS/IN_REVIEW/COMPLETED.
- A nota histórica de Vulnerability descreve seis estados e um trecho antigo sem retornos. O código atual tem quatro estados, com os dois retornos descritos acima; aceite é entidade separada e revalidação não é novo estado.
- A nota antiga de maturidade descreve média ponderada/penalização/histórico. A implementação vigente é checklist com média simples; esses recursos não foram prometidos.
- Exemplos antigos de remediação atribuem transições ao CLIENT. O controle atual permite escrita de findings a ADMIN/PENTESTER autorizado; CLIENT permanece em leitura.
- Chat em tempo real, tickets, mensagens transacionais e convites descritos como ideia/fluxo futuro não foram incluídos como funcionalidades disponíveis. Comentários assíncronos em finding são distintos desses recursos.
- Regras técnicas, contratos HTTP, arquitetura, configuração de desenvolvimento, credenciais, documentação de testes e arquivos gerados não entram no catálogo de produto.

## Conteúdo já existente enriquecido

Propósito do Vulnera, significado de empresa/aplicação/projeto/finding, distinção CVSS/VRS/SLA, salvamento de política, segregação no aceite e interpretação de KEV/EPSS receberam mais contexto. Os 17 IDs anteriores e o catálogo de 12 atalhos foram mantidos. Nenhuma nova rota, permissão ou operação foi criada.

## Como validar

Os testes do assistente verificam perguntas representativas de cada tema novo, restrições de CLIENT/PENTESTER, preferência por expressões específicas, limite do contexto e ausência de material técnico no conteúdo enviado. A prova de configuração privada usa fixture sintética; identificador real do modelo e chave permanecem fora do snapshot público atual.
