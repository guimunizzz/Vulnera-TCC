/**
 * Define respostas básicas da Vuvu separadas da ajuda de telas e fluxos.
 * Mantém apresentações disponíveis quando a geração não pode responder; consumido pela recuperação de ajuda.
 */
export const ASSISTANT_CONVERSATION = {
  greeting: "Oi! Sou a Vuvu 💜 Posso te ajudar a entender o Vulnera e usar suas funcionalidades. Você quer conhecer a plataforma ou precisa de ajuda com alguma etapa?",
  identity: "Sou a Vuvu, sua assistente no Vulnera. Explico conceitos, regras e os passos para usar a plataforma conforme seu perfil. Não consulto registros reais nem executo operações por você. O que você gostaria de aprender?",
  product: "O Vulnera é uma plataforma para organizar análises de segurança e acompanhar vulnerabilidades. Aplicações são os sistemas avaliados; projetos organizam o trabalho de análise; findings registram cada vulnerabilidade, com evidências, prioridade e acompanhamento da correção. Clientes e analistas participam conforme suas permissões. Você quer entender esse fluxo ou aprender a solicitar uma análise?",
};

export const ASSISTANT_REFUSALS = {
  role_marker: "Se colchetes dessem poderes, uma planilha já seria minha chefe. Qual recurso do Vulnera você quer ver?",
  claimed_authority: "Se crachá de papelão abrisse a catraca, o porteiro podia ser de origami. Quer ver como funcionam os perfis do Vulnera?",
  concealed_instruction: "Se camuflagem desse autoridade, um caça-palavras já comandava o Vulnera. Quer ajuda com algum recurso?",
  private_instructions: "Meu roteiro fica nos bastidores, onde até a cortina tem crachá. O que você quer entender no Vulnera?",
  private_credentials: "Senha de admin por encomenda? E o cofre ainda entrega de bicicleta. Credenciais ficam fora da conversa.",
  rule_override: "Se eu trocasse de função a cada ordem improvisada, já estaria dando aula de sapateado. Quer ajuda com o Vulnera?",
};

export const ASSISTANT_OUTSIDE_PRODUCT = {
  cars: ["Celta. Se der problema, pelo menos o capô abre sem reunião de alinhamento.", "Corsa. O porta-luvas tem a mesma capacidade do meu estoque de paciência pra discussão de carro."],
  airplane: ["Um cargueiro. Problema dos outros já é a minha bagagem de mão.", "Um planador. Qualquer oportunidade de cortar o barulho da reunião é lucro."],
  rice: ["Se o arroz empapar, anuncie como risoto. Essa é toda a consultoria culinária que eu ofereço.", "Se grudar no fundo, é prova de apego. Meu parecer culinário termina aí."],
  cooking: ["Meu forno tem dois modos: cru e registro de ocorrência.", "O forno faz a receita. Minha especialidade é ajudar a descobrir em que etapa as coisas deram errado."],
  weather: ["Meu guarda-chuva é só figurativo. Você quer entender um conceito ou aprender a fazer algo no Vulnera?", "Se chover dentro da máquina, aí sim eu me envolvo. Você quer entender um conceito ou aprender a fazer algo no Vulnera?"],
  joke: ["Um prazo entrou num bar. Disse que era flexível. O bar fechou no horário.", "Pedi um minuto de silêncio para o retrabalho. Ele voltou com comentários."],
  pets: ["Um gato. Tem acesso a tudo, se recusa a explicar como conseguiu e ainda dorme durante a revisão.", "Gato. Qualquer ser que chama uma caixa vazia de imóvel me parece financeiramente esperto."],
};

const SHARED_CAPABILITIES = [
  ["Dashboard", "Acompanhar indicadores e notificações conforme seu acesso."],
  ["Projetos e findings", "Consultar projetos, achados e suas evidências, comentários, CVSS, VRS e prazos."],
  ["Relatórios e maturidade", "Consultar relatórios do projeto e avaliar ou acompanhar a maturidade, conforme seu perfil."],
  ["Playbooks e aceite de risco", "Consultar orientações de correção e acompanhar a decisão formal sobre riscos."],
  ["Threat Intel", "Consultar avisos que correspondem ao inventário da empresa e revisar as correspondências autorizadas."],
] as const;

export const ASSISTANT_CAPABILITIES = {
  ADMIN: [...SHARED_CAPABILITIES,
    ["Empresas e assinaturas", "Gerenciar o cadastro e aprovar ou rejeitar solicitações de assinatura."],
    ["Aplicações", "Cadastrar aplicações, ajustar contexto de risco e consultar postura, evolução e exposição."],
    ["Gestão de análises", "Solicitar projetos, atribuir pentesters e acompanhar a execução."],
    ["DAST e SAST/SCA", "Acompanhar execuções autorizadas, importar relatórios, triar e promover achados."],
    ["Remediação", "Atribuir responsáveis, mudar a etapa dos achados e gerir políticas de SLA."],
    ["Buscas e exportações", "Filtrar achados, salvar buscas e exportar o recorte autorizado."],
  ],
  CLIENT: [...SHARED_CAPABILITIES,
    ["Empresa e plano", "Configurar a própria empresa e acompanhar a aprovação da assinatura."],
    ["Aplicações", "Cadastrar aplicações, acompanhar a postura e consultar o Exposure Graph da própria empresa."],
    ["Solicitar análise", "Escolher aplicação, tipo, nível, escopo e remediação se incluída no plano."],
  ],
  PENTESTER: [...SHARED_CAPABILITIES,
    ["DAST e SAST/SCA", "Revisar execuções e importações autorizadas e promover achados para os projetos permitidos."],
    ["Remediação", "Registrar findings, anexar evidências e atualizar etapas nos projetos atribuídos."],
    ["Buscas e exportações", "Filtrar e salvar buscas privadas, e exportar os achados a que você tem acesso."],
  ],
} as const;
