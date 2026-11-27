/**
 * Ajuda versionada conferida contra páginas, guards e serviços do Vulnera.
 * Evita enviar o repositório ou registros ao provedor; consumida pelo serviço
 * de recuperação e pela alternativa local da apresentação (atualizada em 2026-11-15).
 */
import type { UserRole } from "../models/user.model";
import type { AssistantActionId, AssistantTopic } from "../models/assistant.model";
import { ASSISTANT_PRODUCT_TOPICS } from "./assistant-product-help.config";
import { ASSISTANT_PRODUCT_GUIDES } from "./assistant-product-guides.config";
import { ASSISTANT_WORKFLOW_TOPICS } from "./assistant-workflow-help.config";

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
    id: "overview", title: "Dashboard e visão geral", keywords: ["dashboard", "visao geral", "plataforma", "inicio", "indicadores", "quem e voce", "quem e a vuvu", "o que e vulnera", "o que e o vulnera", "para que serve o vulnera"],
    screens: ["dashboard"], roles: ALL, actions: ["projects", "playbooks"],
    guidance: "O Vulnera organiza o trabalho de uma consultoria de segurança com suas empresas-clientes: aplicações representam os sistemas avaliados, projetos definem o trabalho de análise e findings registram vulnerabilidades e sua correção. O dashboard resume o que seu perfil pode acessar; indicadores de risco, prazo e origem têm significados diferentes e não comprovam exploração. Abra Projetos para acompanhar uma análise. O assistente explica a plataforma, mas não executa operações nem consulta os dados reais da conta.",
    byRole: { ADMIN: "Como ADMIN, você tem visão administrativa global; os detalhes continuam nas telas de cada recurso.", CLIENT: "Como CLIENT, você acompanha a própria empresa e os findings dentro dos projetos.", PENTESTER: "Como PENTESTER, você acompanha os projetos aos quais foi atribuído e suas atividades de análise." },
  },
  {
    id: "applications", title: "Cadastro de aplicações", keywords: ["aplicacao", "aplicacoes", "nova aplicacao", "criar aplicacao", "cadastrar aplicacao", "cadastrar", "cadastro", "inventario", "ativo"],
    screens: ["applications", "application-dashboard"], roles: ASSISTANT_ACTIONS.applications.roles, actions: ["applications", "new-analysis"],
    restrictedGuidance: "Aplicações é restrito a ADMIN e CLIENT. Como PENTESTER, consulte o contexto nos projetos atribuídos.",
    guidance: "1. Abra Aplicações e clique em Nova aplicação. 2. Preencha o nome e, se precisar, o endereço e a descrição. 3. Confirme o cadastro e confira a aplicação na lista. Use uma aplicação ativa para solicitar análise. Se não conseguir cadastrar, confira a situação da empresa e o limite de aplicações do plano.",
    byRole: { ADMIN: "ADMIN seleciona explicitamente a empresa da aplicação.", CLIENT: "CLIENT cadastra na própria empresa; não escolhe outra empresa." },
  },
  {
    id: "new-analysis", title: "Solicitar uma análise", keywords: ["solicitar", "solicito", "solicitacao", "analise", "nova analise", "novo projeto"],
    screens: ["new-analysis"], roles: ASSISTANT_ACTIONS["new-analysis"].roles, actions: ["new-analysis", "applications", "projects"],
    restrictedGuidance: "Solicitar análise é restrito a ADMIN e CLIENT. Como PENTESTER, acompanhe os projetos atribuídos.",
    guidance: "1. Abra Solicitar análise ou use Nova análise na linha de uma aplicação elegível. 2. Em Aplicação, escolha o alvo e depois selecione o Tipo de análise. 3. Preencha Nome, nível e escopo, incluindo o que fica fora. 4. Revise Remediação e clique em Criar projeto. Confira a solicitação na lista de projetos. Se a aplicação não aparecer, verifique se está ativa, se já tem projeto e se há assinatura ativa e capacidade. Criar projeto não inicia scan automaticamente.",
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
    guidance: "As evidências ficam no finding e documentam a prova do achado. São aceitos PNG, JPEG, PDF e TXT, até 10 MB por arquivo, com conteúdo compatível com o formato. Upload é permitido a ADMIN ou PENTESTER autorizado. Quem pode consultar o finding pode comentar. O próprio autor ou ADMIN pode excluir um comentário. No detalhe do finding, evidências são consultadas; o envio pertence ao fluxo de edição.",
    byRole: { CLIENT: "CLIENT pode consultar evidências e comentar nos findings autorizados da empresa, mas não envia evidências nem edita o finding." },
  },
  {
    id: "dast", title: "DAST e triagem humana", keywords: ["dast", "zap", "scan", "varredura", "triagem", "promover", "falso positivo", "automatizada"],
    screens: ["dast", "dast-detail", "dast-report"], roles: ASSISTANT_ACTIONS.dast.roles, actions: ["dast", "projects"],
    restrictedGuidance: "DAST é restrito a ADMIN e PENTESTER autorizado. Como CLIENT, acompanhe os findings publicados no seu projeto.",
    guidance: "DAST mostra resultados de análises de aplicações em execução. Resultados de scan ficam separados dos findings do projeto. Uma pessoa faz a triagem: novo, confirmado, falso positivo ou risco aceito. Promoção de um resultado confirmado para finding exige projeto autorizado e CVSS revisado por humano. Demonstração simulada não permite promoção. O assistente não inicia scans.",
    byRole: { PENTESTER: "PENTESTER acessa os próprios scans, além das autorizações necessárias para o projeto da promoção." },
  },
  {
    id: "cvss-vrs", title: "CVSS e VRS", keywords: ["cvss", "vrs", "severidade", "prioridade", "risco", "score", "pontuacao"],
    screens: ["finding-detail", "finding-editor", "application-dashboard"], roles: ALL, actions: ["projects", "findings"],
    guidance: "VRS é a prioridade contextual do achado no Vulnera, numa escala de 0 a 100. A mesma falha pode exigir atenção primeiro numa aplicação crítica e exposta. CVSS mede a gravidade técnica a partir de um vetor revisado por uma pessoa. Abra o finding para ver as duas notas e os fatores do VRS.",
  },
  {
    id: "sla", title: "SLA de remediação", keywords: ["sla", "prazo", "prazos", "vencido", "vencimento", "politica"],
    screens: ["sla-settings", "remediation"], roles: ALL, actions: ["sla-settings", "projects"],
    guidance: "SLA é o prazo de remediação em dias corridos, segundo a política e a severidade do finding. A tela mostra prazo e situação; sem SLA não significa estar no prazo. Salvar uma política vale para novos findings; reaplicar aos abertos é ação separada, exclusiva de ADMIN. Aceite de risco aprovado vigente pausa o relógio sem corrigir o achado. O assistente explica o conceito sem calcular datas ou mudar políticas.",
    byRole: { ADMIN: "ADMIN pode configurar políticas e reaplicar SLA pela funcionalidade existente.", CLIENT: "Em Configuração de SLA, CLIENT OWNER pode configurar a política da empresa; CLIENT MEMBER apenas consulta. A reaplicação é de ADMIN.", PENTESTER: "PENTESTER acompanha o prazo no finding e na remediação; não acessa a configuração de SLA." },
  },
  {
    id: "risk-acceptance", title: "Aceite de risco", keywords: ["aceite", "aceitar risco", "justificativa", "aprovacao", "revogar", "compensatorio"],
    screens: ["finding-detail"], roles: ALL, actions: ["projects"],
    guidance: "Aceite de risco é uma decisão registrada separadamente do status do finding, com justificativa de negócio, validade e histórico. ADMIN, CLIENT OWNER ou PENTESTER autorizado podem solicitar. ADMIN ou CLIENT OWNER autorizados decidem, mas ninguém pode aprovar o próprio pedido, nem ADMIN. PENTESTER não aprova; CLIENT MEMBER acompanha. Aceitar risco não equivale a corrigir ou fechar a vulnerabilidade. Use a seção de aceite no finding autorizado; o assistente não solicita nem aprova nada.",
  },
  {
    id: "remediation", title: "Remediação e playbooks", keywords: ["remediacao", "corrigir", "correcao", "playbook", "playbooks", "quadro", "responsavel"],
    screens: ["remediation", "playbooks", "playbook-detail"], roles: ALL, actions: ["remediation", "playbooks", "projects"],
    guidance: "Playbooks reúnem orientações de correção e validação. O catálogo System da OWASP é imutável; ADMIN e PENTESTER autorizados podem criar conteúdo customizado. Consulte o finding para detalhes da correção.",
    byRole: { ADMIN: "Use o quadro de remediação para acompanhar e atualizar o trabalho autorizado.", PENTESTER: "Use o quadro de remediação nos projetos atribuídos.", CLIENT: "CLIENT lê os playbooks e acompanha os findings pelos projetos; o quadro global de remediação é restrito a ADMIN e PENTESTER." },
  },
  {
    id: "maturity-reports", title: "Maturidade e relatórios", keywords: ["maturidade", "relatorio", "relatorios", "relatorio do projeto", "relatorio executivo", "relatorio tecnico", "pdf", "exportar", "excel", "executivo", "tecnico"],
    screens: ["maturity", "project-detail"], roles: ALL, actions: ["projects"],
    guidance: "1. Abra um projeto autorizado.\n2. Na aba de relatórios, gere o PDF executivo ou técnico quando o projeto estiver Em revisão ou Concluído.\n3. A avaliação de maturidade depende da empresa selecionada; ADMIN avalia e os demais perfis consultam quando autorizados. Não há rota genérica de maturidade ou relatórios para abrir sem contexto.",
  },
  {
    id: "dast-reports", title: "Relatórios do scan DAST", keywords: ["relatorio", "relatorios", "pdf", "relatorio dast", "relatorio do dast", "relatorio zap", "relatorio do zap", "pdf dast", "pdf do dast", "pdf do zap"],
    screens: ["dast-detail", "dast-report"], roles: ASSISTANT_ACTIONS.dast.roles, actions: ["dast"],
    guidance: "1. Abra DAST e selecione um scan autorizado.\n2. Quando o scan estiver concluído, use Baixar PDF no detalhe do scan.\n3. A opção de ver o relatório original fica ao lado do PDF quando disponível e abre em outra aba. Esses relatórios pertencem ao scan; não exigem um projeto Em revisão ou Concluído. O assistente apenas orienta e não gera o arquivo.",
  },
  {
    id: "onboarding", title: "Primeiro acesso e plano", keywords: ["onboarding", "plano", "assinatura", "empresa", "primeiro acesso"],
    screens: ["onboarding", "subscriptions"], roles: ALL, actions: ["dashboard", "applications", "projects"],
    guidance: "O onboarding prepara a empresa e a assinatura. Assinaturas pendentes precisam de aprovação administrativa; contratar um plano não é um pagamento real. A solicitação de projeto verifica assinatura ativa e limites. Se uma etapa não estiver disponível, consulte a situação na tela e peça orientação ao responsável pelo acesso.",
    byRole: { PENTESTER: "Como PENTESTER, seu trabalho ocorre nos projetos atribuídos; o cadastro comercial da empresa é conduzido pelo CLIENT ou ADMIN." },
  },
  {
    id: "sast-sca", title: "Importação SAST/SCA", keywords: ["sast", "sca", "sarif", "cyclonedx", "sbom", "semgrep", "trivy", "importacao", "importo"],
    screens: ["sast-sca", "code-import-detail"], roles: ASSISTANT_ACTIONS["sast-sca"].roles, actions: ["sast-sca", "projects"],
    restrictedGuidance: "SAST/SCA é restrito a ADMIN e PENTESTER autorizado. Como CLIENT, acompanhe os findings publicados no seu projeto.",
    guidance: "1. Abra SAST/SCA e use Importar relatório para escolher um projeto autorizado e enviar SARIF ou CycloneDX. O botão de ajuda explica como gerar o relatório; o Vulnera não executa esses scanners.\n2. Abra a importação para conferir os achados, o Security Graph e o PDF.\n3. Faça a triagem e revise o CVSS ao promover um achado para Vulnerability. Reimportar compara com a execução anterior; uma correção não confirmada exige decisão humana para reabrir a vulnerabilidade. O assistente apenas orienta e não importa, tria ou promove dados.",
    byRole: { PENTESTER: "Como PENTESTER, você acessa apenas importações dos projetos aos quais foi atribuído." },
  },
  {
    id: "threat-intel", title: "Threat Intel e inventário de tecnologias", keywords: ["threat intel", "inventario de tecnologias", "cve", "cves", "kev", "epss", "nvd", "osv"],
    screens: ["threat-intel"], roles: ALL, actions: ["threat-intel"],
    guidance: "Threat Intel cruza o inventário de tecnologias da empresa com CVEs publicadas. Consulte as abas Afeta você, Inventário, Feed e Fontes; KEV indica exploração conhecida e EPSS estima a probabilidade de exploração. Uma CVE publicada ou um indicador KEV/EPSS não comprova ataque à sua empresa. Tecnologias observadas pelo DAST e pelo SBOM entram como sugestões para confirmação. As permissões da plataforma determinam quais empresas e ações cada pessoa pode acessar. O assistente não consulta o inventário, não sincroniza fontes e não confirma, tria ou promove registros.",
    byRole: { ADMIN: "ADMIN pode administrar o inventário, triar, promover e sincronizar agora; a promoção continua vinculada ao projeto de destino.", CLIENT: "CLIENT vê somente sua empresa. OWNER pode editar o inventário e triar; MEMBER consulta. CLIENT não promove findings nem dispara sincronização.", PENTESTER: "PENTESTER vê empresas com projetos atribuídos, pode triar e promover somente em projeto autorizado; não edita inventário nem dispara sincronização." },
  },
  {
    id: "exposure-graph", title: "Exposure Graph da empresa", keywords: ["exposure", "exposure graph", "grafo da empresa", "superficie de ataque", "mapa 3d"],
    screens: ["exposure-graph"], roles: ASSISTANT_ACTIONS["exposure-graph"].roles, actions: ["exposure-graph", "projects"],
    restrictedGuidance: "Exposure Graph é restrito a ADMIN e CLIENT com empresa vinculada. Como PENTESTER, acompanhe os projetos atribuídos.",
    guidance: "Abra Exposure Graph para ver as aplicações ativas da empresa do usuário, as categorias OWASP e os achados abertos por severidade e origem (DAST, SAST, SCA e manual). Alterne o grafo 2D e o mapa 3D e selecione uma aplicação para ver o contexto e navegar para os detalhes. É uma visualização dos dados existentes, não uma comprovação de caminho de ataque nem um novo scan. É necessário ter empresa vinculada; ADMIN sem empresa não tem grafo próprio. O assistente não consulta ou altera esses dados.",
  },
  ...ASSISTANT_PRODUCT_TOPICS,
  ...ASSISTANT_WORKFLOW_TOPICS,
  ...ASSISTANT_PRODUCT_GUIDES,
];
