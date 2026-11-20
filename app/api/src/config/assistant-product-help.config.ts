/**
 * Ajuda de domínio/produto curada do vault e conferida nas regras implementadas.
 * Amplia a orientação sem enviar documentação técnica ou registros ao provedor.
 * Consumidor: catálogo do assistente; fontes e divergências em docs/ASSISTENTE_CONTEUDO_PRODUTO.md.
 */
import type { AssistantTopic } from "../models/assistant.model";
import type { UserRole } from "../models/user.model";

const ALL: readonly UserRole[] = ["ADMIN", "CLIENT", "PENTESTER"];

export const ASSISTANT_PRODUCT_TOPICS: readonly AssistantTopic[] = [
  {
    id: "analysis-origins", title: "Tipos e origens dos achados",
    keywords: ["o que e dast", "o que e sast", "o que e sca", "diferenca entre dast e sast", "diferenca entre sast e sca", "diferenca entre dast sast e sca", "origem do achado", "origem dos achados", "procedencia", "finding manual"],
    screens: ["findings", "finding-detail", "sast-sca", "code-import-detail", "dast-detail"], roles: ALL, actions: ["projects", "dast", "sast-sca"],
    guidance: "DAST observa uma aplicação em execução. SAST analisa código e SCA analisa componentes e dependências. No Vulnera, DAST tem fluxo próprio de scan; SAST/SCA recebe relatórios importados. Um finding manual é registrado por uma pessoa autorizada. A origem informa de onde veio o achado; não prova exploração, não substitui triagem nem revisão humana do CVSS. Resultados brutos de ferramentas e vulnerabilidades publicadas no projeto são etapas distintas.",
    byRole: { CLIENT: "Como CLIENT, acompanhe os findings publicados nos seus projetos; os módulos e relatórios brutos de DAST/SAST/SCA são restritos a ADMIN e PENTESTER autorizado." },
  },
  {
    id: "analysis-scope", title: "Escopo, nível e elegibilidade da análise",
    keywords: ["escopo", "escopo da analise", "nivel da analise", "basico intermediario avancado", "servico de remediacao", "assinatura ativa", "aplicacao ja tem projeto", "mesma aplicacao"],
    screens: ["new-analysis", "project-detail", "applications"], roles: ALL, actions: ["new-analysis", "applications", "projects"],
    guidance: "Ao solicitar uma análise, indique aplicação, tipo, nível Básico/Intermediário/Avançado, o que está incluído no escopo, exclusões e restrições. SAST, DAST, Maturidade e Combo descrevem o trabalho solicitado; criar o projeto não executa scanners automaticamente. A aplicação precisa estar ativa e sua empresa deve ter assinatura ativa e capacidade no plano. A implementação atual bloqueia outro projeto para uma aplicação que já tenha um, inclusive concluído. Remediação só pode ser contratada se incluída no plano; a opção não concede ao CLIENT permissão de alterar status de findings.",
    byRole: { PENTESTER: "PENTESTER acompanha o escopo nos projetos atribuídos; a solicitação e os metadados são conduzidos por CLIENT ou ADMIN autorizado." },
  },
  {
    id: "finding-lifecycle", title: "Ciclo de correção e reabertura do finding",
    keywords: ["status do finding", "status de finding", "ciclo do finding", "reabrir", "reabertura", "revalidacao", "corrigido", "fechado", "fixed", "closed"],
    screens: ["finding-detail", "finding-editor", "remediation", "project-detail"], roles: ALL, actions: ["projects", "findings"],
    guidance: "O ciclo implementado é Aberto → Em andamento → Corrigido → Fechado. Em andamento pode voltar para Aberto, sem reiniciar o prazo. Corrigido pode voltar para Em andamento se a validação reprovar a correção; isso inicia um novo ciclo de SLA. Fechado é terminal: um problema posterior deve ser registrado como novo finding. Corrigido não é sinônimo de correção validada. Revalidação é uma atividade, não um estado separado; aceite de risco também é um registro separado e não corrige o achado. ADMIN e PENTESTER membro do projeto fazem as transições permitidas; CLIENT acompanha em leitura.",
  },
  {
    id: "owasp-categories", title: "Classificação OWASP Top 10",
    keywords: ["owasp", "top 10", "categoria owasp", "categorias owasp", "a01", "a02", "a03", "a04", "a05", "a06", "a07", "a08", "a09", "a10"],
    screens: ["finding-detail", "finding-editor", "findings", "playbooks"], roles: ALL, actions: ["projects", "playbooks"],
    guidance: "A plataforma usa as categorias OWASP Top 10 2021: A01 controle de acesso; A02 criptografia; A03 injeção; A04 design inseguro; A05 configuração de segurança; A06 componentes vulneráveis ou desatualizados; A07 identificação e autenticação; A08 integridade de software e dados; A09 registros e monitoramento de segurança; A10 SSRF. A categoria é obrigatória no finding e identifica o tipo de problema. Ela não é uma nota de severidade: CVSS mede severidade técnica e VRS indica prioridade contextual. Playbooks ajudam a consultar correção e validação para a categoria, sem comprovar que a falha foi corrigida.",
  },
  {
    id: "cvss-metrics", title: "Vetor, métricas e faixas do CVSS",
    keywords: ["vetor", "vetor cvss", "metricas do cvss", "metricas cvss", "metricas de cvss", "vetor de ataque", "complexidade de ataque", "privilegios necessarios", "confidencialidade", "integridade", "disponibilidade", "faixas de severidade"],
    screens: ["finding-detail", "finding-editor"], roles: ALL, actions: ["projects", "findings"],
    guidance: "O CVSS v3.1 usa oito métricas base: vetor de ataque, complexidade, privilégios necessários, interação do usuário, escopo e impactos em confidencialidade, integridade e disponibilidade. A nota vai de 0 a 10: 0 sem severidade; 0,1–3,9 baixa; 4–6,9 média; 7–8,9 alta; 9–10 crítica. Severidade calculada e severidade aplicada podem diferir apenas com ajuste justificado. A categoria OWASP é independente. Consulte o vetor, a nota e a justificativa no finding autorizado; o assistente explica os critérios, sem calcular ou alterar seus registros.",
  },
  {
    id: "application-context", title: "Contexto de risco e prioridade VRS",
    keywords: ["criticidade", "sensibilidade dos dados", "dados restritos", "exposta a internet", "exposicao a internet", "ambiente de producao", "fatores do vrs", "prioridade contextual"],
    screens: ["application-dashboard", "finding-detail", "applications"], roles: ALL, actions: ["applications", "projects"],
    guidance: "O contexto da aplicação descreve criticidade para o negócio, ambiente, exposição à internet e sensibilidade dos dados. O VRS combina esse contexto com o CVSS para indicar prioridade de 0 a 100. CVSS mede a falha; VRS ajuda a priorizá-la onde ela está. Prazo de SLA e origem manual/DAST/SAST/SCA não entram nessa nota. Alterar só o rótulo de severidade, sem mudar o vetor, não muda o VRS. Um score alto não comprova exploração. Os valores e fatores reais devem ser consultados no finding; o assistente não os consulta, recalcula ou modifica.",
    byRole: { PENTESTER: "PENTESTER consulta o contexto nos projetos e findings atribuídos; o cadastro de aplicações continua sujeito às permissões próprias da plataforma." },
  },
  {
    id: "sla-policy-lifecycle", title: "Salvar política e reaplicar prazos",
    keywords: ["salvar politica", "reaplicar", "reaplicacao", "novo prazo", "sem sla", "sem prazo", "dias corridos", "pausa do sla"],
    screens: ["sla-settings", "finding-detail", "remediation"], roles: ALL, actions: ["sla-settings", "projects"],
    guidance: "A política define dias corridos de remediação por severidade; empresas sem política própria usam a padrão. Salvar a política vale para novos findings e não altera prazos já atribuídos. Reaplicar aos abertos é uma ação separada, exclusiva de ADMIN e registrada no histórico. Severidade sem impacto não tem SLA; isso não significa estar no prazo. Aceite aprovado vigente pausa o relógio, sem apagar o risco nem zerar o prazo. Ao terminar a pausa, seu período é contabilizado. O prazo vencido indica atraso de remediação, não comprovação de exploração.",
    byRole: { CLIENT: "CLIENT OWNER pode editar a política da própria empresa; MEMBER apenas consulta. Nenhum deles reaplica prazos aos findings existentes.", PENTESTER: "PENTESTER acompanha os prazos, mas não configura políticas nem reaplica SLA." },
  },
  {
    id: "risk-governance", title: "Validade e aprovação do aceite de risco",
    keywords: ["aprovar meu proprio", "aprovar o proprio", "aprovar proprio", "validade do aceite", "expiracao do aceite", "segregacao", "controles compensatorios", "risco aceito"],
    screens: ["finding-detail"], roles: ALL, actions: ["projects"],
    guidance: "Aceitar risco é decidir formalmente não corrigir agora, com motivo, justificativa de negócio, controles compensatórios quando aplicáveis e validade. O solicitante não pode aprovar o próprio pedido, nem se for ADMIN. ADMIN e CLIENT OWNER autorizado podem decidir; PENTESTER solicita, mas não aprova; CLIENT MEMBER acompanha. A validade da aprovação é obrigatória e limitada a 365 dias. Aprovação não fecha o finding: o risco continua registrado e o SLA fica pausado enquanto vigente. Expiração ou revogação encerram a pausa. Uma decisão já tomada não é editada; sua revogação fica no histórico.",
  },
  {
    id: "saved-searches", title: "Filtros, buscas salvas e watchlists",
    keywords: ["busca salva", "buscas salvas", "watchlist", "watchlists", "filtros combinados", "combinar filtros", "fixar busca", "compartilhar busca"],
    screens: ["findings", "project-detail"], roles: ALL, actions: ["findings", "projects"],
    guidance: "A busca combina campos diferentes com E e valores do mesmo campo com OU: Alta ou Crítica, junto com Aberto, retorna apenas achados que atendam aos dois critérios. Uma busca salva guarda filtros, não uma cópia dos resultados. Ao reabrir, considera os dados atuais e as permissões de quem consulta. Buscas podem ser privadas ou compartilhadas com a empresa; PENTESTER só cria privadas. Uma watchlist da empresa pode ser lida pelo time autorizado e editada pelo dono. Fixar na barra lateral cria um atalho, sem ampliar acesso a outras empresas ou projetos.",
    byRole: { CLIENT: "CLIENT não acessa a página global de findings; acompanhe e filtre os achados dentro dos seus projetos. Um link ou busca salva não libera essa página nem outros dados." },
  },
  {
    id: "maturity-checklist", title: "Checklist e notas de maturidade",
    keywords: ["checklist", "questionario", "nota de maturidade", "escala de maturidade", "dominios de maturidade", "media da maturidade", "conformidade"],
    screens: ["maturity"], roles: ALL, actions: ["projects"],
    guidance: "A avaliação de maturidade é um checklist da empresa, organizado em domínios e perguntas. Cada resposta recebe nota inteira de 1 a 5; notas 4 ou 5 indicam conformidade naquele controle. A nota geral é a média simples das respostas preenchidas: abaixo de 2,5 é Básico; de 2,5 até menos de 4 é Intermediário; a partir de 4 é Avançado. O produto atual não aplica pesos ou penalização automática por findings, nem promete comparação histórica. Maturidade mede práticas e controles, não a severidade de um finding. ADMIN cria e preenche; CLIENT da empresa e PENTESTER autorizado consultam.",
  },
  {
    id: "company-access", title: "Empresa, OWNER, MEMBER e projetos atribuídos",
    keywords: ["owner", "member", "papel na empresa", "permissoes da empresa", "outra empresa", "projeto atribuido", "projetos atribuidos"],
    screens: ["dashboard", "projects", "onboarding"], roles: ALL, actions: ["projects"],
    guidance: "A empresa reúne suas aplicações, projetos e achados. CLIENT acessa somente a empresa à qual está vinculado. OWNER e MEMBER continuam sendo CLIENT: OWNER tem responsabilidades de gestão e decisões de risco/SLA quando permitidas; MEMBER acompanha e comenta nos achados autorizados. PENTESTER acessa projetos aos quais foi atribuído; ADMIN tem atribuições administrativas. Receber um link ou orientação do assistente não concede acesso. O assistente não troca papéis, vincula empresas, adiciona participantes ou lê os registros da pessoa.",
  },
  {
    id: "notifications", title: "Central de notificações",
    keywords: ["notificacao", "notificacoes", "sino", "nao lidas", "marcar como lida", "marcar todas como lidas"],
    screens: ["dashboard"], roles: ALL, actions: ["projects"],
    guidance: "A central de notificações é aberta pelo sino da plataforma e reúne avisos destinados à sua conta. Consulte as não lidas e marque uma ou todas como lidas. Ler ou marcar um aviso não aprova uma assinatura, confirma uma vulnerabilidade nem altera o estado do trabalho relacionado. Abra o contexto indicado para consultar a situação e agir somente com as permissões do seu perfil. A orientação não garante envio por e-mail ou recebimento de push; o assistente não consulta sua caixa de avisos nem marca notificações por você.",
  },
];
