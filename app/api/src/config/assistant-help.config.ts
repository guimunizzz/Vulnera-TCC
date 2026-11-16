/**
 * Ajuda versionada conferida contra páginas, guards e serviços do Vulnera.
 * Evita enviar o repositório ou registros ao provedor; consumida pelo serviço
 * de recuperação e pela alternativa local da apresentação (atualizada em 2026-11-15).
 */
import type { UserRole } from "../models/user.model";
import type { AssistantActionId, AssistantTopic } from "../models/assistant.model";

const ALL: readonly UserRole[] = ["ADMIN", "CLIENT", "PENTESTER"];
export const ASSISTANT_ACTIONS: Record<AssistantActionId, { label: string; path: string; roles: readonly UserRole[] }> = {
  dashboard: { label: "Abrir dashboard", path: "/dashboard", roles: ALL },
  projects: { label: "Abrir projetos", path: "/projects", roles: ALL },
  applications: { label: "Abrir aplicações", path: "/applications", roles: ["ADMIN", "CLIENT"] },
  "new-analysis": { label: "Solicitar análise", path: "/new-analysis", roles: ["ADMIN", "CLIENT"] },
  findings: { label: "Abrir findings", path: "/findings", roles: ["ADMIN", "PENTESTER"] },
  dast: { label: "Abrir DAST", path: "/dast", roles: ["ADMIN", "PENTESTER"] },
  remediation: { label: "Abrir remediação", path: "/remediation", roles: ["ADMIN", "PENTESTER"] },
  playbooks: { label: "Abrir playbooks", path: "/playbooks", roles: ALL },
  "sla-settings": { label: "Abrir configuração de SLA", path: "/settings/sla", roles: ["ADMIN", "CLIENT"] },
  "sast-sca": { label: "Abrir SAST/SCA", path: "/sast-sca", roles: ["ADMIN", "PENTESTER"] },
  "threat-intel": { label: "Abrir Threat Intel", path: "/threat-intel", roles: ALL },
  "exposure-graph": { label: "Abrir Exposure Graph", path: "/exposure-graph", roles: ["ADMIN", "CLIENT"] },
};

export const ASSISTANT_TOPICS: readonly AssistantTopic[] = [
  {
    id: "overview", title: "Dashboard e visão geral", keywords: ["dashboard", "visao geral", "plataforma", "inicio", "indicadores", "quem e voce", "quem e a vuvu"],
    screens: ["dashboard"], roles: ALL, actions: ["projects", "playbooks"],
    guidance: "O Vulnera organiza aplicações, projetos de análise, findings e acompanhamento da correção. O dashboard resume o que seu perfil pode acessar. Abra Projetos para acompanhar uma análise.",
    byRole: { ADMIN: "Como ADMIN, você tem visão administrativa global; os detalhes continuam nas telas de cada recurso.", CLIENT: "Como CLIENT, você acompanha a própria empresa e os findings dentro dos projetos.", PENTESTER: "Como PENTESTER, você acompanha os projetos aos quais foi atribuído e suas atividades de análise." },
  },
  {
    id: "applications", title: "Cadastro de aplicações", keywords: ["aplicacao", "aplicacoes", "cadastrar", "cadastro", "inventario", "ativo"],
    screens: ["applications", "application-dashboard"], roles: ALL, actions: ["applications", "new-analysis"],
    guidance: "1. Abra Aplicações e escolha cadastrar uma aplicação.\n2. Preencha os campos da tela e confirme.\n3. Use uma aplicação ativa ao solicitar uma análise. Cadastro e quantidade disponível respeitam as permissões e o plano.",
    byRole: { ADMIN: "ADMIN seleciona explicitamente a empresa da aplicação.", CLIENT: "CLIENT cadastra na própria empresa; não escolhe outra empresa.", PENTESTER: "PENTESTER não acessa o cadastro de aplicações. Peça a um CLIENT ou ADMIN para preparar a aplicação." },
  },
  {
    id: "new-analysis", title: "Solicitar uma análise", keywords: ["solicitar", "solicito", "solicitacao", "analise", "nova analise", "novo projeto"],
    screens: ["new-analysis"], roles: ALL, actions: ["new-analysis", "applications", "projects"],
    guidance: "1. Cadastre uma aplicação ativa em Aplicações.\n2. Abra Solicitar análise, selecione a aplicação e preencha os passos do formulário.\n3. Revise e confirme. A solicitação cria um projeto; não executa um scan automaticamente. Assinatura ativa, capacidade do plano e regras da aplicação são verificadas pela plataforma.",
    byRole: { PENTESTER: "PENTESTER não solicita análise. Essa ação é de CLIENT ou ADMIN; acompanhe os projetos atribuídos a você." },
  },
  {
    id: "projects", title: "Projetos e status", keywords: ["projeto", "projetos", "status", "andamento", "revisao", "concluido", "pendente"],
    screens: ["projects", "project-detail"], roles: ALL, actions: ["projects"],
    guidance: "Em Projetos, abra um projeto para consultar os detalhes e os findings. O fluxo é Pendente → Em andamento → Em revisão → Concluído. Em revisão pode voltar para Em andamento quando precisa de retrabalho. Relatórios ficam disponíveis nas etapas de revisão e conclusão.",
    byRole: { ADMIN: "ADMIN gerencia os projetos autorizados no contexto administrativo.", CLIENT: "CLIENT vê os projetos da empresa e pode editar metadados permitidos; não muda o status da análise.", PENTESTER: "PENTESTER só acessa projetos atribuídos e pode alterar o status quando autorizado." },
  },
  {
    id: "findings", title: "Findings e permissões", keywords: ["finding", "findings", "vulnerabilidade", "vulnerabilidades", "achado", "achados"],
    screens: ["findings", "finding-detail", "finding-editor"], roles: ALL, actions: ["findings", "projects"],
    guidance: "Cada finding pertence a um projeto e representa uma vulnerabilidade individual. Abra o detalhe para consultar descrição, severidade, status, evidências e comentários. A criação, edição e transições são feitas por ADMIN ou PENTESTER autorizado no projeto.",
    byRole: { CLIENT: "CLIENT consulta os findings pela aba do projeto da própria empresa, sem criar ou editar findings; a listagem global é restrita a ADMIN e PENTESTER." },
  },
  {
    id: "evidence-comments", title: "Evidências e comentários", keywords: ["evidencia", "evidencias", "anexo", "anexos", "comentario", "comentarios", "comentar", "upload"],
    screens: ["finding-detail", "finding-editor"], roles: ALL, actions: ["projects", "findings"],
    guidance: "As evidências ficam no finding e documentam a prova do achado. Upload é permitido a ADMIN ou PENTESTER autorizado. Quem pode consultar o finding pode comentar. O próprio autor ou ADMIN pode excluir um comentário. No detalhe do finding, evidências são consultadas; o envio pertence ao fluxo de edição.",
    byRole: { CLIENT: "CLIENT pode consultar evidências e comentar nos findings autorizados da empresa, mas não envia evidências nem edita o finding." },
  },
  {
    id: "dast", title: "DAST e triagem humana", keywords: ["dast", "zap", "scan", "varredura", "triagem", "promover", "falso positivo", "automatizada"],
    screens: ["dast", "dast-detail", "dast-report"], roles: ALL, actions: ["dast", "projects"],
    guidance: "DAST usa o OWASP ZAP para analisar um alvo autorizado. Resultados de scan ficam separados dos findings do projeto. Uma pessoa faz a triagem: novo, confirmado, falso positivo ou risco aceito. Promoção de um resultado confirmado para finding exige projeto autorizado e CVSS revisado por humano. Demonstração simulada não permite promoção. O assistente não inicia scans.",
    byRole: { CLIENT: "O módulo DAST é restrito a ADMIN e PENTESTER. Como CLIENT, acompanhe os findings publicados no projeto.", PENTESTER: "PENTESTER acessa os próprios scans, além das autorizações necessárias para o projeto da promoção." },
  },
  {
    id: "cvss-vrs", title: "CVSS e VRS", keywords: ["cvss", "vrs", "severidade", "prioridade", "risco", "score", "pontuacao"],
    screens: ["finding-detail", "finding-editor", "application-dashboard"], roles: ALL, actions: ["projects", "findings"],
    guidance: "CVSS descreve a severidade técnica da vulnerabilidade a partir de um vetor revisado por uma pessoa. VRS é a prioridade contextual calculada pelo Vulnera, considerando também fatores da aplicação e do negócio. Eles têm objetivos diferentes. Consulte os valores e a explicação no finding; o assistente não recalcula nem substitui esses resultados.",
  },
  {
    id: "sla", title: "SLA de remediação", keywords: ["sla", "prazo", "prazos", "vencido", "vencimento", "politica"],
    screens: ["sla-settings", "remediation"], roles: ALL, actions: ["sla-settings", "projects"],
    guidance: "SLA é o prazo de remediação aplicado pelo Vulnera segundo a política e a severidade do finding. A tela do finding mostra o prazo e o estado. Aceites de risco aprovados podem pausar o prazo conforme as regras da plataforma. O assistente explica o conceito sem calcular datas ou mudar políticas.",
    byRole: { ADMIN: "ADMIN pode configurar políticas e reaplicar SLA pela funcionalidade existente.", CLIENT: "Em Configuração de SLA, CLIENT OWNER pode configurar a política da empresa; CLIENT MEMBER apenas consulta. A reaplicação é de ADMIN.", PENTESTER: "PENTESTER acompanha o prazo no finding e na remediação; não acessa a configuração de SLA." },
  },
  {
    id: "risk-acceptance", title: "Aceite de risco", keywords: ["aceite", "aceitar risco", "justificativa", "aprovacao", "revogar", "compensatorio"],
    screens: ["finding-detail"], roles: ALL, actions: ["projects"],
    guidance: "Aceite de risco é uma decisão registrada separadamente do status do finding, com justificativa, validade e histórico. ADMIN, CLIENT OWNER ou PENTESTER autorizado podem solicitar. ADMIN ou CLIENT OWNER decidem a solicitação. Não equivale a corrigir a vulnerabilidade. Use a seção de aceite no finding autorizado; o assistente não solicita nem aprova nada.",
  },
  {
    id: "remediation", title: "Remediação e playbooks", keywords: ["remediacao", "corrigir", "correcao", "playbook", "playbooks", "quadro", "responsavel"],
    screens: ["remediation", "playbooks", "playbook-detail"], roles: ALL, actions: ["remediation", "playbooks", "projects"],
    guidance: "Playbooks reúnem orientações de correção e validação. O catálogo System da OWASP é imutável; ADMIN e PENTESTER autorizados podem criar conteúdo customizado. O quadro de remediação permite acompanhar e alterar o trabalho dentro das permissões existentes, sem arrastar cartões. Consulte o finding para detalhes da correção.",
    byRole: { CLIENT: "CLIENT lê os playbooks e acompanha os findings pelos projetos; o quadro global de remediação é restrito a ADMIN e PENTESTER." },
  },
  {
    id: "maturity-reports", title: "Maturidade e relatórios", keywords: ["maturidade", "relatorio", "relatorios", "relatorio do projeto", "relatorio executivo", "relatorio tecnico", "pdf", "exportar", "excel", "executivo", "tecnico"],
    screens: ["maturity", "project-detail"], roles: ALL, actions: ["projects"],
    guidance: "1. Abra um projeto autorizado.\n2. Na aba de relatórios, gere o PDF executivo ou técnico quando o projeto estiver Em revisão ou Concluído.\n3. A avaliação de maturidade depende da empresa selecionada; ADMIN avalia e os demais perfis consultam quando autorizados. A listagem de findings também oferece exportação Excel; ela é distinta dos PDFs e respeita os filtros e permissões. Não há rota genérica de maturidade ou relatórios para abrir sem contexto.",
  },
  {
    id: "dast-reports", title: "Relatórios do scan DAST", keywords: ["relatorio", "relatorios", "pdf", "relatorio dast", "relatorio do dast", "relatorio zap", "relatorio do zap", "pdf dast", "pdf do dast", "pdf do zap"],
    screens: ["dast-detail", "dast-report"], roles: ALL, actions: ["dast"],
    guidance: "1. Abra DAST e selecione um scan autorizado.\n2. Quando o scan estiver concluído, use Baixar PDF no detalhe do scan.\n3. Para consultar o HTML original, use Ver relatório do ZAP, que abre em outra aba. Esses relatórios pertencem ao scan; não exigem um projeto Em revisão ou Concluído. O assistente apenas orienta e não gera o arquivo.",
    byRole: { CLIENT: "Relatórios de scans DAST são restritos a ADMIN e PENTESTER autorizado. Como CLIENT, consulte os relatórios publicados no seu projeto; não há acesso ao relatório original do ZAP." },
  },
  {
    id: "onboarding", title: "Primeiro acesso e plano", keywords: ["onboarding", "plano", "assinatura", "empresa", "primeiro acesso"],
    screens: ["onboarding", "subscriptions"], roles: ALL, actions: ["dashboard", "applications", "projects"],
    guidance: "O onboarding prepara a empresa e a assinatura. Assinaturas pendentes precisam de aprovação administrativa; contratar um plano não é um pagamento real. A solicitação de projeto verifica assinatura ativa e limites. Se uma etapa não estiver disponível, consulte a situação na tela e peça orientação ao responsável pelo acesso.",
    byRole: { PENTESTER: "Como PENTESTER, seu trabalho ocorre nos projetos atribuídos; o cadastro comercial da empresa é conduzido pelo CLIENT ou ADMIN." },
  },
  {
    id: "sast-sca", title: "Importação SAST/SCA", keywords: ["sast", "sca", "sarif", "cyclonedx", "sbom", "semgrep", "trivy", "importacao", "importo"],
    screens: ["sast-sca", "code-import-detail"], roles: ALL, actions: ["sast-sca", "projects"],
    guidance: "1. Abra SAST/SCA e use Importar relatório para escolher um projeto autorizado e enviar SARIF ou CycloneDX. O botão de ajuda explica como gerar o relatório; o Vulnera não executa esses scanners.\n2. Abra a importação para conferir os achados, o Security Graph e o PDF.\n3. Faça a triagem e revise o CVSS ao promover um achado para Vulnerability. Reimportar compara com a execução anterior; uma correção não confirmada exige decisão humana para reabrir a vulnerabilidade. O assistente apenas orienta e não importa, tria ou promove dados.",
    byRole: { CLIENT: "SAST/SCA é restrito a ADMIN e PENTESTER autorizado. Como CLIENT, acompanhe pelos seus projetos os findings já publicados; não há acesso à lista ou aos relatórios brutos das importações.", PENTESTER: "Como PENTESTER, você acessa apenas importações dos projetos aos quais foi atribuído." },
  },
  {
    id: "threat-intel", title: "Threat Intel e inventário de tecnologias", keywords: ["threat intel", "inventario de tecnologias", "cve", "cves", "kev", "epss", "nvd", "osv"],
    screens: ["threat-intel"], roles: ALL, actions: ["threat-intel"],
    guidance: "Threat Intel cruza o inventário de tecnologias da empresa com CVEs publicadas. Consulte as abas Afeta você, Inventário, Feed e Fontes; KEV indica exploração conhecida e EPSS estima a probabilidade de exploração. Tecnologias observadas pelo DAST e pelo SBOM entram como sugestões para confirmação. A API determina quais empresas e ações cada pessoa pode acessar. O assistente não consulta o inventário, não sincroniza fontes e não confirma, tria ou promove registros.",
    byRole: { ADMIN: "ADMIN pode administrar o inventário, triar, promover e sincronizar agora; a promoção continua vinculada ao projeto de destino.", CLIENT: "CLIENT vê somente sua empresa. OWNER pode editar o inventário e triar; MEMBER consulta. CLIENT não promove findings nem dispara sincronização.", PENTESTER: "PENTESTER vê empresas com projetos atribuídos, pode triar e promover somente em projeto autorizado; não edita inventário nem dispara sincronização." },
  },
  {
    id: "exposure-graph", title: "Exposure Graph da empresa", keywords: ["exposure", "exposure graph", "grafo da empresa", "superficie de ataque", "mapa 3d"],
    screens: ["exposure-graph"], roles: ALL, actions: ["exposure-graph", "projects"],
    guidance: "Abra Exposure Graph para ver as aplicações ativas da empresa do usuário, as categorias OWASP e os achados abertos por severidade e origem (DAST, SAST, SCA e manual). Alterne o grafo 2D e o mapa 3D e selecione uma aplicação para ver o contexto e navegar para os detalhes. É uma visualização dos dados existentes, não uma comprovação de caminho de ataque nem um novo scan. É necessário ter empresa vinculada; ADMIN sem empresa não tem grafo próprio. O assistente não consulta ou altera esses dados.",
    byRole: { PENTESTER: "Exposure Graph é restrito a ADMIN e CLIENT com empresa vinculada. Como PENTESTER, acompanhe o contexto dos projetos atribuídos; o assistente não oferece atalho para esse grafo." },
  },
];
