/**
 * Catálogo de achados manuais do seed de cenários (prisma/seed-cenarios.ts).
 *
 * Cada modelo é um achado que um pentester escreveria de verdade: descrição
 * técnica, impacto em linguagem de negócio e recomendação acionável. `{rota}`
 * é trocado por uma rota da aplicação, para o mesmo tipo de falha aparecer em
 * lugares diferentes, como acontece num pentest real. O score e a severidade
 * NÃO ficam aqui: saem do vetor pelo `calculateCvss` do produto.
 */

export type TipoDeApp = "web" | "api" | "mobile" | "interno";

export interface ModeloDeAchado {
  titulo: string;
  owasp: string;
  vetor: string;
  descricao: string;
  impacto: string;
  recomendacao: string;
  tipos: TipoDeApp[];
}

const TODOS: TipoDeApp[] = ["web", "api", "mobile", "interno"];

export const CATALOGO: ModeloDeAchado[] = [
  {
    titulo: "SQL Injection em {rota}",
    owasp: "A03",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    descricao:
      "O parâmetro de filtro de {rota} é concatenado na consulta SQL sem prepared statement. Payloads booleanos (`' AND 1=1-- -` / `' AND 1=2-- -`) mudam a resposta, e a extração por UNION foi confirmada com sqlmap em homologação.",
    impacto: "Leitura e alteração de todo o banco da aplicação, inclusive dados pessoais e credenciais com hash.",
    recomendacao: "Trocar a concatenação por consultas parametrizadas em toda a camada de acesso a dados e revisar o usuário do banco para não ter privilégios de DDL.",
    tipos: ["web", "api", "interno"],
  },
  {
    titulo: "IDOR permite ler registros de outros usuários em {rota}",
    owasp: "A01",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    descricao:
      "{rota} devolve o registro pelo identificador sequencial informado na URL e só confere se há sessão válida, não se o registro pertence ao usuário. Trocar o id por um vizinho devolveu dados de outra conta.",
    impacto: "Qualquer usuário autenticado lê dados pessoais de outros clientes, o que configura incidente comunicável à ANPD.",
    recomendacao: "Validar a posse do recurso no backend em toda leitura por id e trocar ids sequenciais por identificadores não previsíveis.",
    tipos: ["web", "api", "mobile"],
  },
  {
    titulo: "Escalonamento de privilégio por alteração do papel em {rota}",
    owasp: "A01",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
    descricao:
      "O corpo da requisição de {rota} aceita o campo `role`, e o backend grava o valor enviado sem checar se quem pede é administrador (mass assignment).",
    impacto: "Um usuário comum se promove a administrador e passa a ter acesso total ao sistema.",
    recomendacao: "Usar uma lista explícita de campos editáveis por perfil e mover qualquer mudança de papel para um fluxo administrativo auditado.",
    tipos: ["web", "api", "interno"],
  },
  {
    titulo: "XSS armazenado no campo de comentário de {rota}",
    owasp: "A03",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N",
    descricao:
      "O texto enviado em {rota} é gravado sem sanitização e renderizado com `innerHTML` na tela de outros usuários. O payload `<img src=x onerror=alert(document.domain)>` executou na sessão do atendente.",
    impacto: "Sequestro de sessão de atendentes e administradores que abrem o registro contaminado.",
    recomendacao: "Escapar a saída por contexto, remover o `innerHTML` e adotar uma Content-Security-Policy sem `unsafe-inline`.",
    tipos: ["web", "interno"],
  },
  {
    titulo: "XSS refletido no parâmetro de busca de {rota}",
    owasp: "A03",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    descricao: "O termo pesquisado em {rota} volta na página sem escape. Um link montado com script no parâmetro executa no navegador da vítima.",
    impacto: "Phishing com o domínio legítimo e roubo de sessão de quem clicar no link.",
    recomendacao: "Escapar o valor refletido e configurar CSP restritiva; validar o formato do termo no backend.",
    tipos: ["web"],
  },
  {
    titulo: "Token JWT aceito sem validar expiração em {rota}",
    owasp: "A07",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
    descricao:
      "O middleware de {rota} verifica a assinatura do JWT mas ignora `exp`. Um token capturado há 40 dias continuou aceito.",
    impacto: "Token vazado vira acesso permanente à conta, sem forma de revogação.",
    recomendacao: "Validar `exp`, `nbf` e `aud`, reduzir a vida do access token para minutos e usar refresh token com revogação.",
    tipos: ["api", "mobile"],
  },
  {
    titulo: "Ausência de rate limiting na autenticação de {rota}",
    owasp: "A07",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L",
    descricao: "{rota} aceitou 5.000 tentativas de senha em 4 minutos sem bloqueio, atraso progressivo ou CAPTCHA.",
    impacto: "Viabiliza força bruta e credential stuffing com listas vazadas.",
    recomendacao: "Limitar tentativas por IP e por conta, com bloqueio progressivo e alerta de anomalia.",
    tipos: ["web", "api", "mobile"],
  },
  {
    titulo: "Enumeração de usuários pela resposta de {rota}",
    owasp: "A07",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    descricao: "{rota} responde \"usuário não encontrado\" e \"senha incorreta\" de forma diferente, e o tempo de resposta também muda.",
    impacto: "Permite montar a lista de contas válidas para ataques direcionados.",
    recomendacao: "Responder com a mesma mensagem e o mesmo tempo para os dois casos.",
    tipos: ["web", "api", "mobile"],
  },
  {
    titulo: "Recuperação de senha com token previsível em {rota}",
    owasp: "A07",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N",
    descricao: "O token de redefinição enviado por {rota} é derivado do timestamp e do id do usuário, e não expira após o uso.",
    impacto: "Tomada de conta de qualquer usuário sem acesso ao e-mail dele.",
    recomendacao: "Gerar o token com CSPRNG, guardar só o hash, expirar em 30 minutos e invalidar após o primeiro uso.",
    tipos: ["web", "api"],
  },
  {
    titulo: "SSRF no importador por URL de {rota}",
    owasp: "A10",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N",
    descricao:
      "{rota} baixa o arquivo da URL informada sem restringir destino. `http://169.254.169.254/latest/meta-data/` devolveu credenciais temporárias da instância.",
    impacto: "Acesso a credenciais da nuvem e a serviços internos que não deveriam ser alcançáveis.",
    recomendacao: "Permitir só domínios conhecidos, bloquear faixas privadas e de metadados e usar IMDSv2.",
    tipos: ["api", "web"],
  },
  {
    titulo: "Upload sem validação de tipo em {rota}",
    owasp: "A04",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N",
    descricao: "{rota} confia na extensão e no Content-Type enviados pelo cliente. Um `.php` renomeado para `.jpg` foi aceito e servido do mesmo domínio.",
    impacto: "Hospedagem de conteúdo malicioso no domínio da empresa e risco de execução no servidor de mídia.",
    recomendacao: "Validar a assinatura de bytes, renomear o arquivo, servir de um domínio separado e com `Content-Disposition: attachment`.",
    tipos: ["web", "api", "mobile"],
  },
  {
    titulo: "Path traversal no download de anexos em {rota}",
    owasp: "A01",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    descricao: "O parâmetro `arquivo` de {rota} aceita `../`. `../../../../etc/passwd` devolveu o arquivo do sistema.",
    impacto: "Leitura de arquivos de configuração com segredos e de anexos de outros clientes.",
    recomendacao: "Resolver o caminho e conferir que continua dentro do diretório permitido; nunca usar o nome enviado pelo cliente.",
    tipos: ["web", "api", "interno"],
  },
  {
    titulo: "Desserialização insegura em {rota}",
    owasp: "A08",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    descricao: "{rota} desserializa o corpo da requisição com tipagem polimórfica habilitada. Um gadget conhecido executou `id` no servidor.",
    impacto: "Execução remota de código no servidor da aplicação.",
    recomendacao: "Desabilitar a tipagem polimórfica, aceitar só DTOs explícitos e atualizar a biblioteca de serialização.",
    tipos: ["api", "interno"],
  },
  {
    titulo: "Segredo de API exposto no bundle JavaScript",
    owasp: "A02",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    descricao: "O JavaScript servido ao cliente contém a chave de um provedor de mensageria com permissão de envio.",
    impacto: "Uso da conta da empresa para spam ou phishing e custo financeiro direto.",
    recomendacao: "Revogar a chave, mover a chamada para o backend e incluir varredura de segredos no CI.",
    tipos: ["web", "mobile"],
  },
  {
    titulo: "Senhas armazenadas com hash rápido sem salt",
    owasp: "A02",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N",
    descricao: "A tabela de usuários guarda as senhas como SHA-1 sem salt. 62% dos hashes de uma amostra foram quebrados em uma hora com uma GPU comum.",
    impacto: "Num vazamento do banco, quase todas as senhas ficam expostas e reutilizáveis em outros serviços.",
    recomendacao: "Migrar para Argon2id ou bcrypt, re-hashando no próximo login e forçando troca nas contas antigas.",
    tipos: ["web", "api", "interno"],
  },
  {
    titulo: "TLS 1.0 e cifras fracas habilitados em {rota}",
    owasp: "A02",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N",
    descricao: "O servidor de {rota} negocia TLS 1.0 e suítes CBC com SHA-1.",
    impacto: "Facilita interceptação em redes hostis e reprova auditorias PCI DSS.",
    recomendacao: "Aceitar só TLS 1.2+ com suítes AEAD e habilitar HSTS.",
    tipos: ["web", "api"],
  },
  {
    titulo: "CORS aceita qualquer origem com credenciais em {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:L/A:N",
    descricao: "{rota} reflete o cabeçalho Origin recebido em `Access-Control-Allow-Origin` e envia `Allow-Credentials: true`.",
    impacto: "Qualquer site visitado pela vítima lê dados da conta dela na API.",
    recomendacao: "Usar lista fixa de origens permitidas e nunca refletir o Origin com credenciais.",
    tipos: ["api"],
  },
  {
    titulo: "Content-Security-Policy ausente em {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    descricao: "As respostas de {rota} não trazem CSP, X-Frame-Options nem X-Content-Type-Options.",
    impacto: "Remove a camada que conteria um XSS e permite clickjacking.",
    recomendacao: "Publicar CSP em report-only, ajustar e depois aplicar em bloqueio; adicionar os demais cabeçalhos de segurança.",
    tipos: ["web"],
  },
  {
    titulo: "Cookie de sessão sem Secure e HttpOnly em {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N",
    descricao: "O cookie de sessão emitido em {rota} não tem as flags Secure, HttpOnly e SameSite.",
    impacto: "Sessão roubável por script ou por downgrade de conexão.",
    recomendacao: "Emitir o cookie com `Secure; HttpOnly; SameSite=Lax`.",
    tipos: ["web", "interno"],
  },
  {
    titulo: "Stack trace detalhado exposto em {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    descricao: "Um parâmetro malformado em {rota} devolve a pilha de exceção com caminhos de arquivo, versões de bibliotecas e a query SQL.",
    impacto: "Acelera o reconhecimento e a exploração de outras falhas.",
    recomendacao: "Responder com erro genérico e id de correlação; detalhes só no log.",
    tipos: ["web", "api", "interno"],
  },
  {
    titulo: "Painel administrativo exposto à internet em {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N",
    descricao: "{rota} é alcançável de fora da VPN e mostra a tela de login do console de gestão do servidor de aplicação.",
    impacto: "Superfície de ataque desnecessária para força bruta e exploração de CVEs do console.",
    recomendacao: "Restringir o acesso por rede (VPN ou allowlist) e exigir MFA.",
    tipos: ["web", "interno"],
  },
  {
    titulo: "Versão do servidor exposta no cabeçalho de {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N",
    descricao: "As respostas de {rota} trazem `Server` e `X-Powered-By` com a versão exata.",
    impacto: "Facilita achar CVEs aplicáveis à versão em uso.",
    recomendacao: "Remover ou generalizar os cabeçalhos de versão.",
    tipos: ["web", "api"],
  },
  {
    titulo: "Biblioteca com CVE conhecida usada em {rota}",
    owasp: "A06",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    descricao: "{rota} usa uma versão de biblioteca com vulnerabilidade pública e exploit disponível. A versão corrigida existe há mais de um ano.",
    impacto: "Exploração com ferramenta pronta, sem esforço de pesquisa por parte do atacante.",
    recomendacao: "Atualizar a dependência e adotar SCA no pipeline com bloqueio para severidade alta.",
    tipos: TODOS,
  },
  {
    titulo: "Falta de log de tentativas de login malsucedidas",
    owasp: "A09",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N",
    descricao: "Falhas de autenticação não são registradas, e o SIEM não recebe nenhum evento da aplicação.",
    impacto: "Ataques de força bruta e uso de credencial vazada passam despercebidos.",
    recomendacao: "Registrar sucesso e falha de login com IP e usuário, enviar ao SIEM e alertar picos.",
    tipos: ["web", "api", "interno"],
  },
  {
    titulo: "Dados pessoais gravados em log de aplicação em {rota}",
    owasp: "A09",
    vetor: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    descricao: "{rota} registra o corpo inteiro das requisições, incluindo CPF, data de nascimento e token de sessão.",
    impacto: "Quem tem acesso ao log tem acesso a dados pessoais e sessões; viola o princípio da necessidade da LGPD.",
    recomendacao: "Mascarar campos sensíveis antes de logar e restringir o acesso aos logs.",
    tipos: ["api", "interno"],
  },
  {
    titulo: "CSRF em ação que altera dados em {rota}",
    owasp: "A01",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N",
    descricao: "{rota} altera o e-mail da conta via POST sem token anti-CSRF e com cookie sem SameSite.",
    impacto: "Uma página maliciosa muda o e-mail da vítima e depois redefine a senha.",
    recomendacao: "Usar token anti-CSRF ou exigir cabeçalho customizado, e SameSite=Lax no cookie.",
    tipos: ["web"],
  },
  {
    titulo: "Lógica de cupom permite desconto acumulado em {rota}",
    owasp: "A04",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N",
    descricao: "Enviar o mesmo cupom em requisições paralelas a {rota} aplica o desconto várias vezes (condição de corrida).",
    impacto: "Prejuízo financeiro direto em pedidos com valor zerado.",
    recomendacao: "Aplicar o cupom numa transação com trava e validar o total no fechamento do pedido.",
    tipos: ["web", "api"],
  },
  {
    titulo: "Armazenamento inseguro de token no dispositivo",
    owasp: "A02",
    vetor: "CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    descricao: "O app guarda o refresh token em AsyncStorage, legível em backup não criptografado e em aparelho com root.",
    impacto: "Quem tiver o aparelho por alguns minutos leva a sessão da conta.",
    recomendacao: "Usar Keychain/Keystore (expo-secure-store) e vincular o token ao dispositivo.",
    tipos: ["mobile"],
  },
  {
    titulo: "Certificate pinning ausente no app",
    owasp: "A02",
    vetor: "CVSS:3.1/AV:A/AC:H/PR:N/UI:R/S:U/C:H/I:L/A:N",
    descricao: "O app aceita qualquer certificado confiado pelo sistema; um proxy com CA instalada intercepta todo o tráfego.",
    impacto: "Interceptação de credenciais em redes corporativas ou dispositivos comprometidos.",
    recomendacao: "Implementar pinning da chave pública com chave de backup e plano de rotação.",
    tipos: ["mobile"],
  },
  {
    titulo: "Deep link aceita redirecionamento arbitrário em {rota}",
    owasp: "A01",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
    descricao: "O parâmetro `next` do deep link {rota} abre qualquer URL dentro do WebView autenticado.",
    impacto: "Phishing dentro do app, com aparência legítima.",
    recomendacao: "Aceitar só caminhos internos de uma lista fixa.",
    tipos: ["mobile"],
  },
  {
    titulo: "Exportação sem paginação derruba o serviço em {rota}",
    owasp: "A04",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H",
    descricao: "{rota} gera o relatório do período inteiro em memória. Pedir 5 anos de dados esgotou a memória do pod em 40 segundos.",
    impacto: "Indisponibilidade do serviço causada por um único usuário autenticado.",
    recomendacao: "Paginar ou gerar em background com limite de período e de linhas.",
    tipos: ["api", "interno", "web"],
  },
  {
    titulo: "Conta de serviço com privilégio excessivo no banco",
    owasp: "A01",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:H/A:H",
    descricao: "A aplicação conecta ao banco com um usuário DBA, com permissão de DDL e acesso a todos os schemas.",
    impacto: "Qualquer injeção vira comprometimento total do banco, inclusive de outros sistemas.",
    recomendacao: "Criar um usuário por aplicação com só as permissões de DML necessárias.",
    tipos: ["interno", "api"],
  },
  {
    titulo: "MFA ausente para perfis administrativos",
    owasp: "A07",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N",
    descricao: "Contas com papel de administrador entram só com usuário e senha, sem segundo fator.",
    impacto: "Uma senha vazada ou adivinhada dá controle total da aplicação.",
    recomendacao: "Exigir MFA (TOTP ou WebAuthn) para todos os perfis administrativos.",
    tipos: ["web", "interno"],
  },
  {
    titulo: "Dependência de CDN sem Subresource Integrity em {rota}",
    owasp: "A08",
    vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    descricao: "{rota} carrega scripts de CDN de terceiros sem o atributo `integrity`.",
    impacto: "Um comprometimento da CDN injeta código em todas as sessões dos clientes.",
    recomendacao: "Adicionar SRI aos recursos externos ou servi-los do próprio domínio.",
    tipos: ["web"],
  },
  {
    titulo: "Endpoint de debug habilitado em produção em {rota}",
    owasp: "A05",
    vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    descricao: "{rota} responde em produção e devolve variáveis de ambiente, inclusive a string de conexão do banco.",
    impacto: "Exposição de credenciais de infraestrutura.",
    recomendacao: "Desabilitar os endpoints de diagnóstico em produção e rotacionar as credenciais expostas.",
    tipos: ["api", "web"],
  },
];

/** Comentários por estado: o que o time escreveria em cada momento do ciclo. */
export const COMENTARIOS = {
  pentester: [
    "Reproduzido em homologação com dois usuários de teste. Evidência anexada.",
    "Validei também em produção com conta de teste autorizada; o comportamento é o mesmo.",
    "O endpoint é público e aparece no sitemap, por isso a prioridade.",
    "Requisição e resposta completas estão na evidência. Usei Burp Suite.",
  ],
  cliente: [
    "Time responsável já está ciente. Vamos priorizar na próxima sprint.",
    "Precisamos de ajuda para reproduzir: em qual ambiente foi testado?",
    "Abrimos o chamado interno e definimos um responsável.",
    "A correção depende de um fornecedor; pedimos prazo para eles.",
  ],
  correcao: [
    "Correção publicada em produção. Pode reteste?",
    "Reteste feito: a falha não reproduz mais. Mantendo como corrigida.",
    "Ajuste aplicado e coberto por teste automatizado.",
  ],
  reabertura: ["Reteste falhou: a correção cobriu só um dos parâmetros. Reabrindo."],
};

export const JUSTIFICATIVAS_DE_ACEITE = [
  {
    reason: "Sistema legado com desligamento previsto para o próximo trimestre; a correção exigiria refatorar o módulo inteiro.",
    businessJustification:
      "O custo de correção supera o risco residual no período restante de vida do sistema. A substituição já está contratada e tem data definida.",
    compensatingControls: "Acesso restrito à VPN corporativa, WAF com regra específica e monitoramento de logs com alerta.",
  },
  {
    reason: "Componente de terceiro sem versão corrigida disponível; o fornecedor prometeu patch.",
    businessJustification: "Não há alternativa de mercado que atenda aos requisitos regulatórios no curto prazo. O risco foi apresentado ao comitê de segurança.",
    compensatingControls: "Funcionalidade afetada desabilitada para usuários externos e revisão semanal do status do patch.",
  },
  {
    reason: "Exposição limitada à rede interna, sem dados sensíveis no fluxo afetado.",
    businessJustification: "O impacto foi avaliado como baixo pela área de negócio, e a equipe está alocada em correções críticas.",
    compensatingControls: null,
  },
];

/**
 * Onde cada falha faz sentido: upload só em rota de upload, IDOR só em rota com
 * id, e assim por diante. Modelo sem entrada aqui serve para qualquer rota.
 * Se a aplicação não tem nenhuma rota compatível, o modelo não é usado nela.
 */
export const ROTAS_COMPATIVEIS: Record<string, RegExp> = {
  "SQL Injection em {rota}": /\?|busca|extrato|relatorio|horarios|pedidos|analises|prescricoes|agenda|notas-fiscais/,
  "IDOR permite ler registros de outros usuários em {rota}": /:id|:codigo/,
  "Escalonamento de privilégio por alteração do papel em {rota}": /usuarios|perfil|colaboradores|conta/,
  "XSS armazenado no campo de comentário de {rota}": /avaliacoes|chamados|contato|prontuarios|prescricoes|consultas/,
  "XSS refletido no parâmetro de busca de {rota}": /\?/,
  "Ausência de rate limiting na autenticação de {rota}": /login|token|auth|esqueci/,
  "Enumeração de usuários pela resposta de {rota}": /login|token|auth|esqueci/,
  "Recuperação de senha com token previsível em {rota}": /esqueci|login/,
  "SSRF no importador por URL de {rota}": /importar|webhook|anexos|regras/,
  "Upload sem validação de tipo em {rota}": /upload|foto|anexos|documentos/,
  "Path traversal no download de anexos em {rota}": /download|comprovante|anexos|receitas|holerites|gravacao|notas-fiscais/,
  "Desserialização insegura em {rota}": /importar|eventos|webhooks|consents|payments|regras|catalogo/,
  "CSRF em ação que altera dados em {rota}": /email|perfil|transferir|favorecidos|conta/,
  "Lógica de cupom permite desconto acumulado em {rota}": /cupom|checkout/,
  "Deep link aceita redirecionamento arbitrário em {rota}": /:\/\/|next=/,
  "Exportação sem paginação derruba o serviço em {rota}": /exportar|relatorios|extrato|analises/,
  "Painel administrativo exposto à internet em {rota}": /admin|console|actuator/,
  "Endpoint de debug habilitado em produção em {rota}": /debug|actuator/,
};
