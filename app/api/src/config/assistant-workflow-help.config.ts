/**
 * Aprofunda jornadas, pré-condições e limites de uso com conteúdo curado de produto.
 * Não lê registros ou docs em execução; consumido pela ajuda local e pela resposta gerada.
 */
import type { AssistantTopic } from "../models/assistant.model";
import type { UserRole } from "../models/user.model";

const ALL: readonly UserRole[] = ["ADMIN", "CLIENT", "PENTESTER"];
const ANALYSTS: readonly UserRole[] = ["ADMIN", "PENTESTER"];

export const ASSISTANT_WORKFLOW_TOPICS: readonly AssistantTopic[] = [
  {
    id: "platform-journey", title: "Jornada completa do Vulnera",
    keywords: ["fluxo completo", "jornada completa", "do cadastro ao relatorio", "como usar o vulnera", "por onde comecar no vulnera", "por onde comeco no vulnera"],
    screens: ["dashboard", "onboarding", "projects"], roles: ALL, actions: ["applications", "new-analysis", "projects"],
    guidance: "O caminho completo liga pessoas e etapas: o CLIENT prepara a empresa e solicita um plano; ADMIN analisa a assinatura. Com assinatura ativa e capacidade disponível, CLIENT ou ADMIN cadastra uma aplicação ativa e solicita sua análise. O projeto passa por Pendente, Em andamento, Em revisão e Concluído. ADMIN organiza participantes; PENTESTER trabalha nos projetos atribuídos, revisa achados e publica findings. O time acompanha correção, evidências, comentários, SLA e eventual aceite de risco. Relatórios executivo e técnico ficam disponíveis na revisão/conclusão. Solicitar projeto, iniciar scan, importar resultado e publicar finding são operações distintas, realizadas por quem tem permissão.",
    byRole: { CLIENT: "Como CLIENT, acompanhe a própria empresa e os findings dos projetos; não faça triagem de resultados brutos nem transições de findings.", PENTESTER: "Como PENTESTER, comece pelos projetos atribuídos e pelo escopo aprovado. Cadastro comercial, assinatura e solicitação de análise ficam com CLIENT/ADMIN." },
  },
  {
    id: "onboarding-subscription", title: "Empresa e aprovação da assinatura",
    keywords: ["onboarding", "primeiro acesso", "assinatura pendente", "assinatura esta pendente", "aguardar aprovacao", "empresa plano confirmacao", "cadastro interrompido"],
    screens: ["onboarding", "subscriptions", "dashboard"], roles: ["ADMIN", "CLIENT"], actions: ["dashboard", "applications"],
    guidance: "Depois de criar a conta CLIENT, o onboarding autenticado tem as etapas Empresa, Plano e Confirmação. O cliente informa os dados pedidos da empresa, escolhe um plano e solicita a assinatura. Se a empresa já foi salva e uma etapa posterior falhou, o fluxo retoma essa empresa; não crie outra por impulso. A assinatura começa Pendente de aprovação; ADMIN aprova ou rejeita. Somente aprovação leva a Ativa. Existe no máximo uma assinatura ativa por empresa. Estar cadastrado ou ter solicitado um plano não significa já poder solicitar projetos: confira a situação da assinatura. Não há promessa de aprovação imediata, cobrança real, convite ou e-mail de confirmação por este fluxo.",
    byRole: { CLIENT: "Se sua assinatura já está pendente, confira o status no Dashboard e aguarde a aprovação do ADMIN. Evite criar outra empresa ou reenviar o pedido enquanto o primeiro estiver em análise." },
  },
  {
    id: "plan-capacity", title: "Limites do plano e remediação contratada",
    keywords: ["limite do plano", "limites do plano", "capacidade do plano", "plano esgotado", "remediacao inclusa", "cota de aplicacoes"],
    screens: ["applications", "new-analysis", "subscriptions"], roles: ["ADMIN", "CLIENT"], actions: ["applications", "projects"],
    guidance: "O plano define capacidade de aplicações, projetos e se inclui remediação. Assinatura ativa, aplicação ativa, capacidade e elegibilidade são condições diferentes; resolver uma não elimina as demais. O produto também permite somente um projeto por aplicação já vinculada, inclusive quando o anterior foi concluído. Ao encontrar um limite, confira os registros e a assinatura com o responsável autorizado, sem excluir dados para contornar a regra. Ter remediação inclusa permite contratar esse escopo no projeto; não transforma CLIENT em analista nem dá permissão para editar findings. A Vuvu não consulta consumo real, muda plano ou libera cotas.",
  },
  {
    id: "evidence-files", title: "Formatos, tamanho e uso das evidências",
    keywords: ["formatos de evidencia", "formatos das evidencias", "tamanho da evidencia", "peso da evidencia", "pesar uma evidencia", "limite de evidencia", "anexar pdf", "evidencia de 11 mb", "tipos de anexo"],
    screens: ["finding-detail", "finding-editor"], roles: ALL, actions: ["projects", "findings"],
    guidance: "Evidência documenta o achado; comentário registra a conversa sobre ele. São aceitos PNG, JPEG, PDF e TXT, até 10 MB por arquivo. O conteúdo precisa corresponder ao formato; mudar só a extensão não torna um arquivo válido. Evite credenciais e dados pessoais na prova. ADMIN ou PENTESTER membro do projeto envia evidências pelo fluxo de edição; CLIENT consulta e pode comentar no finding autorizado. Imagens podem ser incorporadas ao relatório técnico; PDF/TXT aparecem como referência, sem virar imagem automaticamente. Excluir comentário é permitido ao autor ou ADMIN. A Vuvu não recebe, lê ou valida os seus anexos.",
  },
  {
    id: "project-report-content", title: "Conteúdo e disponibilidade dos relatórios",
    keywords: ["pdf executivo", "pdf tecnico", "sumario executivo", "conteudo dos relatorios", "diferenca entre relatorio executivo e tecnico", "arquivo salvo no disco"],
    screens: ["project-detail"], roles: ALL, actions: ["projects"],
    guidance: "No projeto autorizado, abra Relatórios quando a análise estiver Em revisão ou Concluído. O PDF executivo resume risco e prioridades para decisão; o técnico detalha findings, severidade, descrição, impacto, recomendação, evidências e comentários disponíveis. Um relatório reflete os dados no momento da geração, não é uma atualização automática do arquivo já baixado. O processo gera o documento, inicia seu download e registra a geração do relatório do projeto. Iniciar download não comprova que o arquivo foi salvo no disco. PDF de scan DAST e PDF de importação SAST/SCA têm origem própria e não substituem a revisão/publicação dos findings do projeto.",
  },
  {
    id: "finding-exports", title: "Exportação do recorte de findings",
    keywords: ["exportar excel", "exportacao excel", "baixar excel", "planilha de findings", "exportar planilha", "exportar csv", "exportacao csv", "csv", "xlsx", "todas as paginas", "exportar filtros", "arquivo xlsx"],
    screens: ["findings"], roles: ANALYSTS, actions: ["findings"],
    guidance: "A exportação Excel da listagem global considera todo o recorte autorizado pelos filtros, busca e ordenação, e não apenas a página visível da tabela. Um arquivo exportado é uma fotografia daquele momento e não ganha atualizações ao mudar o filtro depois. Confira o recorte antes de compartilhar; exportar não amplia autorização nem torna o conteúdo público. CSV e Excel têm apresentações próprias e não devem ser confundidos com o relatório executivo/técnico do projeto. Falha da exportação não significa que os findings foram apagados; preserve os filtros e use a opção de tentar novamente quando disponível. A listagem global é de ADMIN/PENTESTER autorizado.",
  },
  {
    id: "dast-lifecycle", title: "Fila, progresso e limites de um scan",
    keywords: ["scan na fila", "scan parado", "progresso do scan", "cancelar scan", "scan cancelado", "scan falhou", "scan concluido"],
    screens: ["dast", "dast-detail"], roles: ANALYSTS, actions: ["dast"],
    guidance: "Um scan começa Na fila, passa a Em execução quando há vaga e termina Concluído, Falhou ou Cancelado. Consulte fase, progresso e motivo exibidos no detalhe; esperar vaga não é prova de falha. Cancelar não conclui a análise e não publica vulnerabilidades. Um scan concluído confirma o término daquela execução, não que o alvo está seguro. O perfil atual combina descoberta tradicional de páginas e análise passiva; não executa JavaScript nem submete formulários nessa descoberta, portanto não cobre todos os caminhos de uma aplicação. ADMIN acompanha os scans; PENTESTER acessa os próprios. Inicie apenas análises autorizadas, dentro do escopo. A Vuvu não inicia nem cancela scans.",
  },
  {
    id: "dast-promotion", title: "Da triagem DAST ao finding publicado",
    keywords: ["promocao dast", "promover alerta", "resultado bruto", "achado confirmado", "duplicar promocao", "scan simulado"],
    screens: ["dast-detail", "finding-detail"], roles: ANALYSTS, actions: ["dast", "projects"],
    guidance: "Resultados brutos ficam ligados ao scan. A pessoa autorizada revisa a evidência e tria como Novo, Confirmado, Falso positivo ou Risco aceito. Para publicar um resultado, use a promoção, escolha projeto autorizado e revise título, descrição, categoria OWASP e vetor CVSS. O pré-preenchimento é uma sugestão para revisão humana. Um resultado já promovido aponta para a vulnerabilidade existente; repetir a promoção não cria outra cópia. Execuções simuladas são demonstração e não permitem promoção. Marcar a triagem como Risco aceito não equivale à aprovação formal do aceite de risco de uma vulnerabilidade publicada, que tem fluxo próprio.",
  },
  {
    id: "code-import-formats", title: "Preparação e formatos da importação SAST/SCA",
    keywords: ["formatos de importacao", "importar sarif", "arquivo sarif", "sarif", "cyclonedx", "sbom", "sbom sem vulnerabilidades", "importar pdf", "limite da importacao"],
    screens: ["sast-sca", "code-import-detail", "project-detail"], roles: ANALYSTS, actions: ["sast-sca", "projects"],
    guidance: "SAST/SCA importa o relatório que uma ferramenta já produziu; não executa a ferramenta de análise de código pela importação. São aceitos SARIF 2.1.0 e CycloneDX a partir de 1.4 com a seção de vulnerabilidades, em arquivo de relatório compatível. PDF, imagem, ZIP e repositório de código não substituem esses formatos. Um SBOM que só enumera componentes não demonstra vulnerabilidades; confira se a ferramenta incluiu os resultados. Há limite de 10 MB por arquivo e 5.000 achados por importação; exceder o limite causa recusa, sem truncamento silencioso. Abra Importar relatório, selecione o projeto autorizado e consulte as mensagens e o guia de ajuda da tela. ADMIN acessa os projetos; PENTESTER apenas os atribuídos.",
  },
  {
    id: "code-import-comparison", title: "Reimportação, achados novos e resolvidos",
    keywords: ["reimportacao", "reimportar", "importar nova versao", "achados persistentes", "novos persistentes resolvidos", "triagem herdada"],
    screens: ["code-import-detail", "sast-sca"], roles: ANALYSTS, actions: ["sast-sca", "projects"],
    guidance: "Importar nova versão mantém o histórico e compara com a importação anterior compatível do mesmo projeto/ferramenta/formato. Novo é o achado que não estava na anterior; Persistente continua aparecendo; Resolvido deixou de aparecer nessa comparação. Achados persistentes podem herdar a triagem anterior e apontar para a vulnerabilidade já promovida. A identificação do achado ajuda a evitar duplicidade; ela depende do conteúdo e dos identificadores disponíveis no relatório. Resolvido na comparação não fecha automaticamente um finding publicado nem comprova correção: confira mudanças no escopo, na ferramenta e na cobertura. Use Comparação e os filtros do detalhe para revisar.",
  },
  {
    id: "technology-inventory", title: "Inventário, sugestões e versão não confirmada",
    keywords: ["versao nao confirmada", "sugestao de tecnologia", "sugestoes de tecnologias", "confirmar tecnologia", "adicionar tecnologia", "ja existia ao mapear"],
    screens: ["threat-intel"], roles: ALL, actions: ["threat-intel"],
    guidance: "No Inventário de Threat Intel, uma tecnologia pode ser pacote, com ecossistema/nome/versão, ou produto, com fabricante/produto/versão. Sugestões vistas em SBOM ou scan precisam de confirmação autorizada; não entram silenciosamente em vigilância. Sem versão confirmada, o casamento de avisos é amplo e não prova que a instalação é vulnerável. Confirme produto e versão antes de decidir. Avisos que já existiam ao mapear aparecem identificados, sem notificação retroativa; avisos novos elegíveis e entradas posteriores no KEV têm regras próprias. OWNER/ADMIN podem editar conforme o escopo; MEMBER consulta e PENTESTER acompanha empresas de seus projetos. A Vuvu não lê nem confirma o inventário.",
  },
  {
    id: "threat-match-triage", title: "Revisão de correspondências e promoção Threat Intel",
    keywords: ["promover cve", "cve afeta minha empresa", "revisar correspondencia", "casamento de cve", "triagem threat intel", "epss e kev"],
    screens: ["threat-intel"], roles: ALL, actions: ["threat-intel"],
    guidance: "Afeta você mostra avisos que correspondem às tecnologias mapeadas. Confira produto/pacote, versão, condição de uso e versão corrigida; correspondência não confirma exploração na empresa. KEV informa exploração conhecida; EPSS é uma estimativa de probabilidade, não certeza nem nota CVSS. A pessoa autorizada registra triagem e nota. Promover uma CVE para vulnerabilidade exige projeto de destino autorizado e revisão humana dos campos/CVSS; não acontece automaticamente ao receber o aviso. A situação da fonte pode ser parcial ou indisponível: ausência de alerta não prova ausência de risco.",
    byRole: { CLIENT: "CLIENT OWNER pode triar no próprio escopo; MEMBER consulta. CLIENT não promove para finding nem sincroniza fontes.", PENTESTER: "PENTESTER tria no escopo autorizado e promove somente para projeto de que participa; sincronizar fontes é ação de ADMIN." },
  },
  {
    id: "severity-override", title: "Ajuste justificado da severidade e seus efeitos",
    keywords: ["override", "override de severidade", "ajuste de severidade", "alterar severidade", "justificar severidade", "severidade aplicada", "trocar vetor cvss"],
    screens: ["finding-detail", "finding-editor"], roles: ANALYSTS, actions: ["findings", "projects"],
    guidance: "A severidade calculada deriva do vetor CVSS; a aplicada pode receber ajuste manual por pessoa autorizada. O override exige justificativa com pelo menos 20 caracteres e mantém histórico de quem mudou e por quê. Não é um jeito de esconder o risco. O SLA considera a severidade aplicada, mas mudar só o rótulo não altera o VRS. Trocar o vetor recalcula a severidade técnica e descarta o override anterior, registrando essa mudança. Confirme vetor, contexto e motivo antes de ajustar; não apague evidências para justificar uma nota menor. ADMIN/PENTESTER membro do projeto fazem a operação; CLIENT consulta os valores e a justificativa.",
  },
  {
    id: "vuvu-help-controls", title: "Como usar a Vuvu e interpretar suas respostas",
    keywords: ["como usar a vuvu", "modo discreto", "recolher vuvu", "mostrar vuvu", "arrastar a vuvu", "six seven", "ajuda local", "limites da vuvu"],
    screens: ["dashboard"], roles: ALL, actions: ["dashboard", "projects"],
    guidance: "Um clique na personagem abre a conversa. Arraste para reposicionar, use as setas quando ela estiver focada ou Home para voltar ao canto. Duplo clique ou Shift+Enter com foco na personagem faz o six seven. No chat, Enter envia e Shift+Enter quebra linha; o botão Enviar também funciona por teclado. Recolher Vuvu deixa um ícone na borda para restaurar a personagem. Conversa, rascunho e posição ficam na sessão da aba. Resposta da Vuvu indica uma resposta gerada; Ajuda local indica a orientação documentada. Durante a espera você ainda pode fazer perguntas. O prazo mostrado não agenda reenvio. Pergunte sem enviar nomes, endereços, credenciais ou dados reais do achado. A Vuvu explica como usar o produto, sem consultar seus registros ou executar ações.",
  },
  {
    id: "accessibility-controls", title: "Acessibilidade e conforto visual",
    keywords: ["acessibilidade", "alto contraste", "movimento reduzido", "reduzir movimento", "aumentar texto", "tamanho do texto", "olhar da vuvu"],
    screens: ["dashboard"], roles: ALL, actions: ["dashboard"],
    guidance: "O menu Acessibilidade da plataforma oferece tamanho de texto, alto contraste, movimento reduzido e opções de leitura/foco. O texto pode chegar a 200%; telas menores podem precisar de rolagem. Movimento reduzido respeita também a preferência do sistema e reduz animações da Vuvu; alto contraste, modais e aba oculta restringem os gestos. Mesmo com animações restritas, ajuda e posicionamento explícito continuam disponíveis. No chat, Escape fecha e devolve o foco; Tab percorre os controles. Para uma tela mais livre, use o modo discreto. Essas preferências não concedem acesso nem mudam dados de negócio.",
  },
];
