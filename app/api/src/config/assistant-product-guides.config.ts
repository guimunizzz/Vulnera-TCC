/**
 * Reúne passos conferidos nas telas para dúvidas de uso do Vulnera.
 * A ajuda local e a resposta gerada usam as mesmas orientações por perfil.
 */
import type { AssistantTopic } from "../models/assistant.model";

const ALL = ["ADMIN", "CLIENT", "PENTESTER"] as const;
const ANALYSTS = ["ADMIN", "PENTESTER"] as const;

export const ASSISTANT_PRODUCT_GUIDES: readonly AssistantTopic[] = [
  {
    id: "project-participants", title: "Atribuir pentesters a um projeto",
    keywords: ["atribuir pentester", "atribuir um pentester", "adicionar pentester", "adicionar um pentester", "remover pentester", "pentesters atribuidos", "participantes do projeto", "quem trabalha no projeto"],
    screens: ["projects", "project-detail"], roles: ALL, actions: ["projects"],
    guidance: "Abra Projetos, selecione o projeto autorizado e vá a Visão geral → Pentesters atribuídos. O cartão mostra quem participa da análise. Se a lista estiver vazia, a atribuição ainda precisa ser feita por ADMIN.",
    byRole: {
      ADMIN: "Para atribuir, selecione um pentester no cartão e clique em Adicionar. Confira se ele aparece na lista. Para retirar uma atribuição, use Remover na linha correspondente.",
      CLIENT: "CLIENT consulta o cartão dos próprios projetos. Se precisar trocar um participante, peça a um ADMIN.",
      PENTESTER: "PENTESTER consulta o cartão nos projetos a que já foi atribuído. A gestão de participantes é de ADMIN.",
    },
  },
  {
    id: "application-dashboard-reading", title: "Ler o dashboard de uma aplicação",
    keywords: ["dashboard da aplicacao", "painel da aplicacao", "dashboard de uma aplicacao", "postura atual", "evolucao da aplicacao", "insights da aplicacao", "comparativo da aplicacao", "comparar aplicacoes", "achados por origem"],
    screens: ["application-dashboard"], roles: ["ADMIN", "CLIENT"], actions: ["applications"],
    guidance: "Em Aplicações, abra o dashboard da aplicação autorizada. Use Postura atual para ver a situação de risco e os achados por origem; Evolução para observar mudanças ao longo do tempo; Insights para ler os destaques; Comparativo para olhar a postura das aplicações da mesma empresa. Comece pela aba que responde sua dúvida. Um achado numa análise bruta ainda não publicado não deve ser tratado como finding aberto no projeto. Confira a origem, o recorte e a aplicação na tela antes de comparar números.",
  },
  {
    id: "findings-filter-practice", title: "Aplicar filtros e corrigir um filtro inválido",
    keywords: ["filtro invalido", "filtro vermelho", "chip vermelho", "corrigir filtro", "barra de filtros", "sugestoes da busca", "contagens dos filtros", "contagem do filtro", "numeros dos filtros", "ordenar achados", "como filtro"],
    screens: ["findings", "project-detail"], roles: ALL, actions: ["findings", "projects"],
    guidance: "1. Abra a lista de achados autorizada e clique na barra de filtros para ver sugestões. 2. Escolha o campo e o valor. Os números ao lado de uma opção indicam quantos resultados ela traria considerando os demais filtros. 3. Se aparecer um chip vermelho, leia o motivo e corrija ou remova a expressão. A expressão inválida não é aplicada; as válidas continuam valendo. Pelo teclado, setas percorrem sugestões, Enter seleciona e Esc fecha. Em um projeto, alguns campos somem porque o recorte do projeto já está fixo.",
    byRole: { CLIENT: "Como CLIENT, entre pelo seu projeto e abra a aba de achados." },
  },
  {
    id: "remediation-board-steps", title: "Atribuir responsável e mover um finding no quadro",
    keywords: ["atribuir responsavel", "atribuir um responsavel", "trocar responsavel", "responsavel no quadro", "sem responsavel", "mover para", "mover um finding", "mover um achado", "mover cartao", "colunas do quadro"],
    screens: ["remediation", "finding-detail"], roles: ANALYSTS, actions: ["remediation", "findings"],
    guidance: "1. Abra Remediação e filtre por projeto ou responsável para encontrar o cartão. 2. Use o menu de responsável no cartão. A pessoa escolhida precisa ter acesso ao finding. 3. Para mudar a etapa, abra Mover para… e escolha uma transição disponível. As colunas mostram Aberto, Em andamento e Corrigido. Se a etapa desejada não aparecer, verifique o status atual e seu acesso ao projeto. No detalhe do finding você consulta o responsável atribuído.",
  },
  {
    id: "playbook-duplicate", title: "Consultar e adaptar um playbook",
    keywords: ["duplicar playbook", "duplicar um playbook", "duplicar e adaptar", "adaptar playbook", "editar playbook oficial", "playbook personalizado", "copia do playbook"],
    screens: ["playbooks", "playbook-detail", "finding-detail"], roles: ALL, actions: ["playbooks"],
    guidance: "No finding, confira a orientação de Como corrigir. Em Playbooks, escolha a categoria correspondente e abra o conteúdo. O playbook oficial da OWASP é somente leitura.",
    byRole: {
      ADMIN: "Para adaptar, abra o playbook oficial e use Duplicar e adaptar. Edite a cópia e salve. A atribuição da fonte permanece na cópia.",
      PENTESTER: "Use Duplicar e adaptar no playbook oficial, revise a cópia e salve quando o seu perfil permitir. A atribuição da fonte permanece na cópia.",
      CLIENT: "CLIENT consulta os playbooks. Se precisar de uma versão adaptada, peça a um analista autorizado.",
    },
  },
  {
    id: "finding-revalidation-steps", title: "Revalidar um achado corrigido",
    keywords: ["como revalidar", "revalidar um finding", "revalidar um achado", "revalidar uma correcao", "depois de marcar corrigido", "correcao reprovada", "validar correcao no finding"],
    screens: ["finding-detail", "remediation", "project-detail"], roles: ANALYSTS, actions: ["findings", "projects"],
    guidance: "1. Abra o finding autorizado que está Corrigido. 2. Confira a recomendação e as evidências, e registre o resultado da revalidação no contexto do finding. 3. Se a correção for validada, o responsável autorizado pode fechar o achado. Se a correção falhar, ele pode voltar para Em andamento, iniciando um novo ciclo de SLA. Confira o estado exibido depois da mudança. A revalidação faz parte do trabalho da equipe; ela não é outro status.",
  },
  {
    id: "dast-comparison-workflow", title: "Comparar execuções DAST do mesmo alvo",
    keywords: ["comparar scans", "comparar dois scans", "comparar dast", "comparacao dast", "comparar com execucao anterior", "scan anterior", "resolvidos no dast", "continua aberto no scan"],
    screens: ["dast-detail", "dast-report"], roles: ANALYSTS, actions: ["dast"],
    guidance: "1. No DAST, abra o detalhe da execução autorizada mais recente. 2. Entre em Comparar com execução anterior e escolha uma execução anterior do mesmo alvo. 3. Confira Novos, Resolvidos e Continuam abertos. A ausência de um alerta pode decorrer de diferença de cobertura e não fecha um finding publicado. Se a opção não aparecer, confira se a execução é simulada e se há uma execução anterior comparável.",
  },
  {
    id: "dast-cybergraph-reading", title: "Ler a representação de uma execução DAST",
    keywords: ["cybergraph", "grafo do dast", "grafo do scan", "nos do dast", "grafo da varredura"],
    screens: ["dast-detail"], roles: ANALYSTS, actions: ["dast"],
    guidance: "No detalhe do scan autorizado, abra CyberGraph e selecione um nó para ver o que a execução observou. Volte à aba de achados para fazer a triagem. Se a visualização não mostrar algo, confira os filtros e a lista de achados. O grafo descreve aquela execução; ele não comprova exploração nem mostra todos os caminhos da aplicação.",
  },
  {
    id: "code-import-triage-steps", title: "Triar e promover achados de uma importação",
    keywords: ["triar uma importacao", "triagem da importacao", "triar sast", "promover achado sast", "promover achado sca", "promover achado importado", "sast para finding", "falso positivo na importacao"],
    screens: ["sast-sca", "code-import-detail"], roles: ANALYSTS, actions: ["sast-sca"],
    guidance: "1. Em SAST/SCA, abra a importação autorizada e vá a Achados. Use os filtros para localizar os pendentes. 2. Confira os detalhes e marque a triagem adequada; ao precisar, registre uma nota. 3. Use a opção de promover para revisar categoria e CVSS antes de confirmar. O destino é o projeto da importação. Se o achado já foi promovido, abra o finding existente. A importação e a triagem por si só não publicam findings.",
  },
  {
    id: "code-graph-tour", title: "Usar o Security Graph e o tour da importação",
    keywords: ["ver na lista para triar", "security graph", "grafo da importacao", "grafo de codigo", "ver tour", "tour do sast", "reabrir tour"],
    screens: ["sast-sca", "code-import-detail"], roles: ANALYSTS, actions: ["sast-sca"],
    guidance: "1. Abra uma importação autorizada e selecione Security Graph. 2. Abra um ramo ou selecione um nó para consultar apresentação por pasta, arquivo ou pacote. 3. Use Ver na lista para triar para voltar ao achado na lista. Se um item não aparecer, confira os filtros e se falsos positivos estão ocultos. Use Ver tour para rever a ajuda guiada; Pular tour encerra a visita.",
  },
  {
    id: "report-types-navigation", title: "Escolher o relatório ou exportação certa",
    keywords: ["qual relatorio baixar", "qual pdf baixar", "tipos de pdf", "diferenca entre relatorio e exportacao", "pdf da importacao", "relatorio da importacao", "pdf da analise de codigo"],
    screens: ["project-detail", "dast-report", "code-import-detail"], roles: ALL, actions: ["projects"],
    guidance: "Para decisões do projeto, abra o projeto Em revisão ou Concluído → Relatórios e escolha o executivo ou técnico. Para uma lista em planilha, confira o botão de exportação na lista de achados e os filtros aplicados. Um arquivo baixado reflete o recorte daquele momento.",
    byRole: {
      ADMIN: "Para uma execução DAST ou importação SAST/SCA, abra o detalhe da execução ou importação e use Baixar PDF. Esses documentos mostram os resultados daquele fluxo, separados do relatório do projeto.",
      PENTESTER: "Para uma execução DAST ou importação SAST/SCA autorizada, use Baixar PDF no detalhe. Esses documentos não substituem o relatório do projeto.",
      CLIENT: "CLIENT consulta o projeto autorizado e seus relatórios. Resultados brutos de análise são revisados pelos analistas.",
    },
  },
  {
    id: "threat-notifications-reading", title: "Entender por que um aviso não apareceu no sino",
    keywords: ["cve nao notificou", "nao avisou no sino", "nao recebi aviso", "cve sem notificacao", "aviso sem notificacao", "ja existia ao mapear", "por que nao fui notificado", "fonte do threat intel"],
    screens: ["threat-intel", "dashboard"], roles: ALL, actions: ["threat-intel"],
    guidance: "1. Em Threat Intel → Afeta você, abra a CVE e confira a tecnologia e o selo já existia ao mapear. Avisos anteriores ao mapeamento aparecem na lista sem notificação retroativa. 2. Um aviso novo elegível pode aparecer no sino; uma CVE ainda sem nota pode aguardar pontuação. 3. Consulte Fontes para ver se houve atualização parcial e confira o escopo do seu perfil. A falta de aviso não comprova ausência de risco, e a correspondência não comprova exploração.",
  },
];
