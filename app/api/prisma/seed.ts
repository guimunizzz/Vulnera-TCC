/**
 * prisma/seed.ts
 *
 * Estrutura de demonstração da Vulnera — o que a banca vê. Idempotente:
 * roda quantas vezes precisar sem duplicar nada (upsert por chave natural
 * onde o schema permite; find-then-create onde não permite, mesmo padrão já
 * usado no arquivo desde a Fase 3 pra Subscription/Owner). Pra garantir um
 * estado 100% limpo antes da apresentação real, prefira
 * `npm run db:reset` (que já chama este script) a confiar cegamente na
 * idempotência — ver docs/DEMO.md.
 *
 * NÃO confundir com `prisma/seed-demo.ts`: aquele acrescenta 90 findings
 * genéricos ao longo de 90 dias só pra alimentar os gráficos analíticos da
 * Fase 6.5 (volume, não narrativa). Este arquivo é o cenário CURADO — nomes,
 * descrições e evidências pensados pra fazer sentido numa demo ao vivo.
 *
 * Seções:
 *   1-5. Planos, Admin, TechNova, Subscription ACTIVE, Owner  (desde a Fase 3)
 *   6.   Catálogo de maturidade (domínios + perguntas)         (Fase 8)
 *   7.   2 pentesters + 1 CLIENT membro (além do Owner)        (Fase 8)
 *   8.   5 aplicações realistas + 1 projeto cada                (Fase 8)
 *   9.   Pentesters atribuídos aos projetos                     (Fase 8)
 *   10.  10 findings curados (2 CRITICAL/3 HIGH/3 MEDIUM/2 LOW,
 *        vetores CVSS reais, evidência em disco, comentários)   (Fase 8)
 *   11.  1 avaliação de maturidade respondida                   (Fase 8)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// PNG 1×1 transparente válido (assinatura de bytes 89 50 4E 47 — a mesma que
// o upload real da Fase 5 exige via magic number). Evidência de VERDADE em
// disco, não só uma linha no banco apontando pra um arquivo inexistente.
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function main() {
  console.log("🌱 Seeding database...");

  // ========================================================================
  // 1. Plans
  // ========================================================================
  const basicPlan = await prisma.plan.upsert({
    where: { name: "BASIC" },
    update: {},
    create: {
      name: "BASIC",
      maxApplications: 2,
      maxProjects: 1,
      includesRemediation: false,
      price: 499.0,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { name: "PRO" },
    update: {},
    create: {
      name: "PRO",
      maxApplications: 5,
      maxProjects: 3,
      includesRemediation: true,
      price: 1499.0,
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { name: "Enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      maxApplications: 999,
      maxProjects: 999,
      includesRemediation: true,
      price: 0.0,
      isActive: true,
    },
  });

  // ========================================================================
  // 2. Admin
  // ========================================================================
  const adminHash = await bcrypt.hash("admin12345", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@vulnera.local" },
    update: {},
    create: {
      email: "admin@vulnera.local",
      password: adminHash,
      name: "Vulnera Admin",
      role: "ADMIN",
    },
  });

  // ========================================================================
  // 3. TechNova
  // ========================================================================
  const technova = await prisma.company.upsert({
    where: { cnpj: "00.000.000/0001-00" },
    update: {},
    create: {
      name: "TechNova Solutions",
      cnpj: "00.000.000/0001-00",
      planId: proPlan.id,
    },
  });

  // ========================================================================
  // 4. Subscription ACTIVE
  // ========================================================================
  const existingSub = await prisma.subscription.findFirst({
    where: { companyId: technova.id, status: "ACTIVE" },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        companyId: technova.id,
        planId: proPlan.id,
        status: "ACTIVE",
        startDate: new Date(),
        approvedBy: admin.id,
      },
    });
  }

  // ========================================================================
  // 5. Owner da TechNova
  // ========================================================================
  const ownerHash = await bcrypt.hash("demo12345", 12);
  await prisma.user.upsert({
    where: { email: "owner@technova.demo" },
    update: {},
    create: {
      email: "owner@technova.demo",
      password: ownerHash,
      name: "TechNova Owner",
      role: "CLIENT",
      companyId: technova.id,
      companyRole: "OWNER",
    },
  });

  // ========================================================================
  // 6. Maturidade — catálogo (domínios + perguntas)
  // ========================================================================
  // Checklist simplificado (decisão de 2026-08-03): sem peso, sem nível por
  // domínio — só perguntas objetivas em escala 1-5. Ajustar aqui se o
  // Rafael preferir outro recorte de domínios.
  const CATALOGO_MATURIDADE: Array<{ nome: string; descricao: string; perguntas: string[] }> = [
    {
      nome: "Gestão de Acesso",
      descricao: "Como contas e permissões são criadas, revisadas e protegidas.",
      perguntas: [
        "Existe MFA obrigatório para acessos administrativos?",
        "Contas de acesso seguem o princípio do menor privilégio?",
        "Há revisão periódica de usuários e permissões ativas?",
        "Senhas seguem uma política mínima de complexidade e expiração?",
      ],
    },
    {
      nome: "Backup e Recuperação",
      descricao: "Capacidade de recuperar dados e serviços após um incidente.",
      perguntas: [
        "Backups são realizados de forma automatizada e regular?",
        "A restauração completa de um backup já foi testada nos últimos 12 meses?",
        "Existe um plano de recuperação de desastres documentado?",
        "Backups ficam armazenados em local fisicamente separado do ambiente de produção?",
      ],
    },
    {
      nome: "Segurança de Rede",
      descricao: "Segmentação, filtragem e exposição controlada dos ambientes.",
      perguntas: [
        "Existe segmentação de rede entre ambientes de produção e desenvolvimento?",
        "Firewalls e/ou WAFs estão configurados e atualizados?",
        "Acessos remotos exigem VPN ou solução equivalente?",
        "Portas e serviços expostos à internet são revisados periodicamente?",
      ],
    },
    {
      nome: "Gestão de Vulnerabilidades",
      descricao: "Processo de encontrar, priorizar e corrigir falhas de segurança.",
      perguntas: [
        "Existe um processo formal de triagem e priorização das vulnerabilidades encontradas?",
        "Dependências e bibliotecas de terceiros são monitoradas por vulnerabilidades conhecidas?",
        "Há um prazo definido (SLA) de correção por severidade?",
        "Testes de segurança são realizados antes de releases importantes?",
      ],
    },
    {
      nome: "Monitoramento e Logs",
      descricao: "Visibilidade sobre o que acontece nos sistemas e capacidade de detectar anomalias.",
      perguntas: [
        "Eventos de autenticação e autorização são registrados em log?",
        "Existe alerta automático para atividades suspeitas?",
        "Logs são centralizados e protegidos contra alteração?",
        "Há retenção mínima de logs definida por política?",
      ],
    },
    {
      nome: "Conscientização",
      descricao: "Preparo das pessoas para reconhecer e evitar riscos de segurança.",
      perguntas: [
        "Colaboradores recebem treinamento periódico de segurança da informação?",
        "Existe um canal claro para reportar incidentes ou suspeitas de phishing?",
        "Simulações de phishing já foram realizadas na empresa?",
        "Existe uma política de segurança da informação formalizada e divulgada?",
      ],
    },
    {
      nome: "Segurança no Código",
      descricao: "Práticas seguras aplicadas durante o desenvolvimento do software.",
      perguntas: [
        "Revisão de código inclui verificação de práticas de segurança?",
        "Segredos (chaves, senhas, tokens) são gerenciados fora do código-fonte?",
        "Existe pipeline de CI com verificação automatizada de segurança (SAST e/ou dependências)?",
        "Ambientes de homologação usam dados sintéticos, não dados reais de produção?",
      ],
    },
  ];

  const controlIdsPorPergunta = new Map<string, string>();
  for (const [domainIndex, dominio] of CATALOGO_MATURIDADE.entries()) {
    const domain = await prisma.maturityDomain.upsert({
      where: { name: dominio.nome },
      update: { description: dominio.descricao, sortOrder: domainIndex },
      create: { name: dominio.nome, description: dominio.descricao, sortOrder: domainIndex },
    });

    for (const [questionIndex, pergunta] of dominio.perguntas.entries()) {
      let control = await prisma.maturityControl.findFirst({ where: { domainId: domain.id, name: pergunta } });
      if (!control) {
        control = await prisma.maturityControl.create({
          data: { domainId: domain.id, name: pergunta, sortOrder: questionIndex },
        });
      }
      controlIdsPorPergunta.set(pergunta, control.id);
    }
  }
  console.log(`  ✓ catálogo de maturidade: ${CATALOGO_MATURIDADE.length} domínios, ${controlIdsPorPergunta.size} perguntas`);

  // ========================================================================
  // 7. Pentesters + 2º usuário CLIENT (membro, não-owner)
  // ========================================================================
  const senhaDemo = await bcrypt.hash("senha12345", 12);

  const pentester1 = await prisma.user.upsert({
    where: { email: "bruno.pentester@vulnera.local" },
    update: {},
    create: { email: "bruno.pentester@vulnera.local", password: senhaDemo, name: "Bruno Pentester", role: "PENTESTER" },
  });
  const pentester2 = await prisma.user.upsert({
    where: { email: "camila.pentester@vulnera.local" },
    update: {},
    create: { email: "camila.pentester@vulnera.local", password: senhaDemo, name: "Camila Pentester", role: "PENTESTER" },
  });

  const clientMemberHash = await bcrypt.hash("demo12345", 12);
  await prisma.user.upsert({
    where: { email: "fernanda@technova.demo" },
    update: {},
    create: {
      email: "fernanda@technova.demo",
      password: clientMemberHash,
      name: "Fernanda Analista",
      role: "CLIENT",
      companyId: technova.id,
      companyRole: "MEMBER",
    },
  });

  // ========================================================================
  // 8. Aplicações (5) + 1 projeto cada
  // ========================================================================
  async function upsertApplication(data: {
    name: string;
    url?: string;
    environment: string;
    techStack: string;
    description: string;
  }) {
    const existing = await prisma.application.findFirst({ where: { companyId: technova.id, name: data.name } });
    if (existing) return existing;
    return prisma.application.create({ data: { ...data, companyId: technova.id } });
  }

  async function upsertProject(data: {
    applicationId: string;
    name: string;
    analysisType: string;
    analysisLevel: string;
    hasRemediation: boolean;
    status: string;
    scopeIn?: string;
    scopeOut?: string;
  }) {
    const existing = await prisma.project.findFirst({ where: { applicationId: data.applicationId } });
    if (existing) return existing;
    const startedAt = data.status !== "PENDING" ? new Date(Date.now() - 20 * 86_400_000) : null;
    const closedAt = data.status === "COMPLETED" ? new Date(Date.now() - 2 * 86_400_000) : null;
    return prisma.project.create({
      data: {
        applicationId: data.applicationId,
        companyId: technova.id,
        name: data.name,
        analysisType: data.analysisType,
        analysisLevel: data.analysisLevel,
        hasRemediation: data.hasRemediation,
        status: data.status,
        scopeIn: data.scopeIn,
        scopeOut: data.scopeOut,
        startedAt,
        closedAt,
      },
    });
  }

  const appEcommerce = await upsertApplication({
    name: "Portal E-commerce",
    url: "https://loja.technova.com.br",
    environment: "PROD",
    techStack: "Next.js + Node.js + PostgreSQL",
    description: "Loja virtual B2C da TechNova — catálogo, carrinho e checkout.",
  });
  const appMobile = await upsertApplication({
    name: "App Mobile TechNova",
    environment: "PROD",
    techStack: "React Native + Expo",
    description: "Aplicativo mobile para clientes finais (iOS/Android).",
  });
  const appB2B = await upsertApplication({
    name: "API B2B Integração",
    url: "https://api-b2b.technova.com.br",
    environment: "PROD",
    techStack: "Node.js + Express + PostgreSQL",
    description: "API de integração com parceiros e revendedores.",
  });
  const appInterno = await upsertApplication({
    name: "Sistema Interno de Gestão",
    url: "https://intranet.technova.local",
    environment: "PROD",
    techStack: "Java + Spring Boot + Oracle",
    description: "ERP interno — financeiro, estoque e RH.",
  });
  const appPortalCliente = await upsertApplication({
    name: "Portal do Cliente",
    url: "https://portal.technova.com.br",
    environment: "PROD",
    techStack: "React + Node.js + MySQL",
    description: "Área logada do cliente — pedidos, notas fiscais e suporte.",
  });

  const projEcommerce = await upsertProject({
    applicationId: appEcommerce.id,
    name: "Pentest Web — Portal E-commerce",
    analysisType: "DAST",
    analysisLevel: "INTERMEDIATE",
    hasRemediation: true,
    status: "IN_REVIEW",
    scopeIn: "loja.technova.com.br (produção) — catálogo, carrinho, checkout, área de conta",
    scopeOut: "Gateway de pagamento de terceiros (fora do perímetro contratado)",
  });
  const projMobile = await upsertProject({
    applicationId: appMobile.id,
    name: "Análise Mobile — App TechNova",
    analysisType: "SAST",
    analysisLevel: "BASIC",
    hasRemediation: false,
    status: "IN_PROGRESS",
    scopeIn: "Binário Android/iOS + comunicação com a API B2B",
  });
  const projB2B = await upsertProject({
    applicationId: appB2B.id,
    name: "Pentest API — Integração B2B",
    analysisType: "DAST",
    analysisLevel: "ADVANCED",
    hasRemediation: true,
    status: "IN_REVIEW",
    scopeIn: "api-b2b.technova.com.br — todos os endpoints autenticados e públicos",
  });
  const projInterno = await upsertProject({
    applicationId: appInterno.id,
    name: "Auditoria Interna — Sistema de Gestão",
    analysisType: "COMBO",
    analysisLevel: "INTERMEDIATE",
    hasRemediation: true,
    status: "COMPLETED",
    scopeIn: "intranet.technova.local — módulos financeiro e RH",
  });
  const projPortalCliente = await upsertProject({
    applicationId: appPortalCliente.id,
    name: "Pentest Web — Portal do Cliente",
    analysisType: "DAST",
    analysisLevel: "BASIC",
    hasRemediation: false,
    status: "IN_REVIEW",
    scopeIn: "portal.technova.com.br — área logada",
  });

  console.log("  ✓ 5 aplicações + 5 projetos");

  // ========================================================================
  // 9. Pentesters atribuídos aos projetos
  // ========================================================================
  async function upsertMember(projectId: string, userId: string) {
    const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!existing) await prisma.projectMember.create({ data: { projectId, userId } });
  }

  await upsertMember(projEcommerce.id, pentester1.id);
  await upsertMember(projMobile.id, pentester1.id);
  await upsertMember(projB2B.id, pentester1.id);
  await upsertMember(projB2B.id, pentester2.id);
  await upsertMember(projInterno.id, pentester2.id);
  await upsertMember(projPortalCliente.id, pentester2.id);

  console.log("  ✓ pentesters atribuídos aos 5 projetos");

  // ========================================================================
  // 10. Findings curados (2 CRITICAL / 3 HIGH / 3 MEDIUM / 2 LOW)
  // ========================================================================
  // Vetores validados contra o cvss.util.ts real do projeto antes de entrar
  // aqui (não são chutados) — score e severidade batem com o que o app
  // calcularia se alguém reabrir o vetor no editor.
  interface FindingSeed {
    title: string;
    owasp: string;
    vector: string;
    score: number;
    severity: string;
    description: string;
    impact: string;
    recommendation: string;
    status: string;
    projectId: string;
    applicationId: string;
    createdBy: string;
    evidenceProof?: string;
    comments?: Array<{ authorId: string; content: string }>;
  }

  const findingsSeed: FindingSeed[] = [
    {
      title: "SQL Injection no formulário de busca de produtos",
      owasp: "A03",
      vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      score: 9.8,
      severity: "CRITICAL",
      description:
        "O parâmetro 'q' do endpoint /api/produtos/busca concatena a entrada diretamente na query SQL sem uso de prepared statements, permitindo extração completa do banco de dados via técnicas de UNION-based injection. Confirmado com sqlmap em ambiente de homologação.",
      impact:
        "Um atacante não autenticado pode ler, alterar ou apagar todos os dados de clientes, pedidos e pagamentos armazenados no banco de dados da loja.",
      recommendation:
        "Substituir a concatenação de string por queries parametrizadas (prepared statements) em toda a camada de acesso a dados. Adicionar um WAF como camada extra de defesa em profundidade.",
      status: "OPEN",
      projectId: projEcommerce.id,
      applicationId: appEcommerce.id,
      createdBy: pentester1.id,
      evidenceProof: "Print do sqlmap identificando a injeção e extraindo a versão do banco de dados (MySQL 8.0.34).",
      comments: [
        { authorId: pentester1.id, content: "Confirmado em homologação com sqlmap. Recomendo priorizar antes do próximo deploy — o endpoint é público." },
      ],
    },
    {
      title: "Falha de autenticação expõe API de integração a qualquer requisição",
      owasp: "A07",
      vector: "AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
      score: 10,
      severity: "CRITICAL",
      description:
        "Os endpoints /api/parceiros/* validam o token JWT quanto à assinatura, mas não verificam se o token expirou nem se o escopo do parceiro corresponde ao recurso solicitado. Um token de um parceiro consegue ler/alterar dados de qualquer outro parceiro.",
      impact:
        "Qualquer parceiro autenticado (ou um token vazado/expirado ainda aceito) pode acessar e alterar dados comerciais sigilosos de todos os outros parceiros da integração B2B.",
      recommendation:
        "Validar expiração e escopo (claim 'partnerId') do JWT em cada requisição, com testes automatizados cobrindo o cenário de acesso cruzado entre parceiros.",
      status: "OPEN",
      projectId: projB2B.id,
      applicationId: appB2B.id,
      createdBy: pentester1.id,
    },
    {
      title: "Componente com CVE conhecida — biblioteca de parsing XML desatualizada",
      owasp: "A06",
      vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      score: 7.5,
      severity: "HIGH",
      description:
        "A API B2B usa uma biblioteca de parsing de XML em versão com CVE pública conhecida, vulnerável a XXE (XML External Entity), no endpoint de importação de catálogo de parceiros.",
      impact: "Um parceiro malicioso pode ler arquivos arbitrários do servidor via payload XML manipulado.",
      recommendation: "Atualizar a biblioteca para a versão corrigida e desabilitar resolução de entidades externas por padrão (XXE hardening).",
      status: "IN_PROGRESS",
      projectId: projB2B.id,
      applicationId: appB2B.id,
      createdBy: pentester2.id,
    },
    {
      title: "Controle de acesso quebrado permite escalonamento de privilégio",
      owasp: "A01",
      vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
      score: 8.1,
      severity: "HIGH",
      description:
        "Um usuário comum do sistema interno consegue alterar seu próprio campo 'role' via requisição direta ao endpoint PATCH /api/usuarios/:id, sem que o backend valide se quem faz a alteração tem permissão de administrador.",
      impact: "Qualquer colaborador com acesso ao sistema pode se promover a administrador e obter acesso total ao ERP.",
      recommendation: "Mover a validação de papel/permissão para o backend (nunca confiar em campo enviado pelo cliente) e auditar mudanças de role.",
      status: "OPEN",
      projectId: projInterno.id,
      applicationId: appInterno.id,
      createdBy: pentester2.id,
    },
    {
      title: "Upload de arquivo sem validação de tipo no app mobile",
      owasp: "A04",
      vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N",
      score: 7.1,
      severity: "HIGH",
      description:
        "O endpoint de upload de foto de perfil aceita qualquer tipo de arquivo baseado apenas na extensão declarada pelo cliente, sem verificar a assinatura de bytes (magic number) do conteúdo real.",
      impact: "Um atacante pode enviar um arquivo executável disfarçado de imagem e potencialmente obter execução de código no servidor de mídia.",
      recommendation:
        "Validar o tipo real do arquivo pela assinatura de bytes (magic number), não pela extensão — exatamente como o Vulnera já faz no próprio upload de evidências (Fase 5).",
      status: "FIXED",
      projectId: projMobile.id,
      applicationId: appMobile.id,
      createdBy: pentester1.id,
      evidenceProof: "Upload de um arquivo .php renomeado para .jpg, aceito pelo sistema antes da correção.",
    },
    {
      title: "Cabeçalho Content-Security-Policy ausente",
      owasp: "A05",
      vector: "AV:A/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:N",
      score: 5.1,
      severity: "MEDIUM",
      description: "O Portal do Cliente não envia o cabeçalho Content-Security-Policy em nenhuma resposta, facilitando a exploração de eventuais falhas de XSS.",
      impact: "Em caso de uma futura falha de XSS, a ausência de CSP remove uma camada de mitigação importante.",
      recommendation: "Configurar CSP restritiva no servidor web, começando em modo report-only antes de aplicar em bloqueio.",
      status: "FIXED",
      projectId: projPortalCliente.id,
      applicationId: appPortalCliente.id,
      createdBy: pentester2.id,
      comments: [
        { authorId: pentester2.id, content: "CSP configurado em modo report-only por 1 semana sem falso positivo, depois promovido a bloqueio. Corrigido." },
      ],
    },
    {
      title: "IDOR na consulta de pedidos",
      owasp: "A01",
      vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      score: 6.5,
      severity: "MEDIUM",
      description:
        "O endpoint GET /api/pedidos/:id retorna os dados do pedido apenas validando que o usuário está autenticado, sem checar se o pedido pertence a ele. Basta incrementar o ID para ver pedidos de outros clientes.",
      impact: "Qualquer cliente autenticado pode ler dados pessoais e de compra (endereço, itens, valor) de qualquer outro cliente da loja.",
      recommendation: "Validar no backend que o companyId/userId do pedido corresponde ao do solicitante antes de retornar os dados.",
      status: "IN_PROGRESS",
      projectId: projEcommerce.id,
      applicationId: appEcommerce.id,
      createdBy: pentester1.id,
      comments: [{ authorId: pentester1.id, content: "Reproduzido com dois usuários de teste — incrementar o :id do pedido é suficiente." }],
    },
    {
      title: "Ausência de rate limiting no login",
      owasp: "A07",
      vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L",
      score: 6.5,
      severity: "MEDIUM",
      description: "O endpoint de login do sistema interno aceita tentativas ilimitadas de autenticação sem bloqueio temporário ou CAPTCHA.",
      impact: "Viabiliza ataques de força bruta e credential stuffing contra contas de colaboradores.",
      recommendation: "Implementar bloqueio progressivo por IP/usuário após N tentativas falhas, com CAPTCHA a partir da 3ª tentativa.",
      status: "OPEN",
      projectId: projInterno.id,
      applicationId: appInterno.id,
      createdBy: pentester2.id,
    },
    {
      title: "Cookie de sessão sem flag Secure",
      owasp: "A05",
      vector: "AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N",
      score: 3.1,
      severity: "LOW",
      description: "O cookie de sessão do Portal do Cliente não carrega a flag Secure, permitindo que seja transmitido em texto claro caso a conexão HTTPS seja rebaixada.",
      impact: "Em cenários de downgrade de conexão (ex: rede pública maliciosa), o cookie de sessão pode ser interceptado.",
      recommendation: "Adicionar as flags Secure e HttpOnly ao cookie de sessão.",
      status: "CLOSED",
      projectId: projPortalCliente.id,
      applicationId: appPortalCliente.id,
      createdBy: pentester2.id,
      comments: [{ authorId: pentester2.id, content: "Flags adicionadas e validadas em produção. Fechando o finding." }],
    },
    {
      title: "Versão do servidor exposta no cabeçalho HTTP",
      owasp: "A05",
      vector: "AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N",
      score: 2.2,
      severity: "LOW",
      description: "As respostas da API B2B incluem o cabeçalho 'Server: nginx/1.18.0', revelando a versão exata do servidor web em uso.",
      impact: "Facilita a etapa de reconhecimento de um atacante, que pode buscar CVEs conhecidas para a versão exata identificada.",
      recommendation: "Remover ou generalizar o cabeçalho Server na configuração do servidor web.",
      status: "CLOSED",
      projectId: projB2B.id,
      applicationId: appB2B.id,
      createdBy: pentester1.id,
    },
  ];

  let findingsCriados = 0;
  for (const f of findingsSeed) {
    const existing = await prisma.vulnerability.findFirst({ where: { projectId: f.projectId, title: f.title } });
    if (existing) continue;

    const vuln = await prisma.vulnerability.create({
      data: {
        title: f.title,
        description: f.description,
        owaspCategory: f.owasp,
        cvssVector: f.vector,
        cvssScore: f.score,
        severityCalculated: f.severity,
        severityFinal: f.severity,
        impact: f.impact,
        recommendation: f.recommendation,
        status: f.status,
        projectId: f.projectId,
        applicationId: f.applicationId,
        companyId: technova.id,
        createdBy: f.createdBy,
      },
    });
    findingsCriados++;

    await prisma.auditLog.create({
      data: {
        actorId: f.createdBy,
        companyId: technova.id,
        entityType: "Vulnerability",
        entityId: vuln.id,
        action: "CREATE",
        diffJson: JSON.stringify({ title: vuln.title, severity: vuln.severityFinal, owaspCategory: vuln.owaspCategory }),
      },
    });

    if (f.evidenceProof) {
      const uploadsRoot = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
      const relativeDir = path.join(technova.id, vuln.id);
      const fileName = `${randomUUID()}.png`;
      const absoluteDir = path.join(uploadsRoot, relativeDir);
      fs.mkdirSync(absoluteDir, { recursive: true });
      const bytes = Buffer.from(PLACEHOLDER_PNG_BASE64, "base64");
      fs.writeFileSync(path.join(absoluteDir, fileName), bytes);

      await prisma.evidence.create({
        data: {
          vulnerabilityId: vuln.id,
          fileName,
          originalName: "evidencia.png",
          filePath: path.join(relativeDir, fileName),
          mimeType: "image/png",
          sizeBytes: bytes.length,
          proof: f.evidenceProof,
          uploadedBy: f.createdBy,
        },
      });
    }

    if (f.comments) {
      for (const c of f.comments) {
        await prisma.vulnerabilityComment.create({
          data: { vulnerabilityId: vuln.id, authorId: c.authorId, content: c.content },
        });
      }
    }
  }
  console.log(`  ✓ ${findingsCriados} findings curados (2 CRITICAL / 3 HIGH / 3 MEDIUM / 2 LOW), evidência(s) e comentários`);

  // ========================================================================
  // 11. Avaliação de maturidade (respondida)
  // ========================================================================
  const existingAssessment = await prisma.maturityAssessment.findFirst({ where: { companyId: technova.id } });
  if (!existingAssessment) {
    // Notas variadas por domínio — de propósito NÃO uniformes: uma empresa
    // real está sempre mais madura em uns pontos do que em outros, e é isso
    // que faz o radar da Fase 8 valer a pena mostrar (um heptágono
    // perfeitamente regular pareceria dado inventado).
    const respostas: Array<{ pergunta: string; score: number; notes?: string }> = [
      { pergunta: "Existe MFA obrigatório para acessos administrativos?", score: 4 },
      { pergunta: "Contas de acesso seguem o princípio do menor privilégio?", score: 3 },
      { pergunta: "Há revisão periódica de usuários e permissões ativas?", score: 2, notes: "Revisão feita manualmente, sem periodicidade fixa." },
      { pergunta: "Senhas seguem uma política mínima de complexidade e expiração?", score: 4 },

      { pergunta: "Backups são realizados de forma automatizada e regular?", score: 5 },
      { pergunta: "A restauração completa de um backup já foi testada nos últimos 12 meses?", score: 4 },
      { pergunta: "Existe um plano de recuperação de desastres documentado?", score: 5 },
      { pergunta: "Backups ficam armazenados em local fisicamente separado do ambiente de produção?", score: 3 },

      { pergunta: "Existe segmentação de rede entre ambientes de produção e desenvolvimento?", score: 3 },
      { pergunta: "Firewalls e/ou WAFs estão configurados e atualizados?", score: 3 },
      { pergunta: "Acessos remotos exigem VPN ou solução equivalente?", score: 2 },
      { pergunta: "Portas e serviços expostos à internet são revisados periodicamente?", score: 3 },

      { pergunta: "Existe um processo formal de triagem e priorização das vulnerabilidades encontradas?", score: 2, notes: "Sem SLA formal por severidade ainda — em construção com a Vulnera." },
      { pergunta: "Dependências e bibliotecas de terceiros são monitoradas por vulnerabilidades conhecidas?", score: 2 },
      { pergunta: "Há um prazo definido (SLA) de correção por severidade?", score: 3 },
      { pergunta: "Testes de segurança são realizados antes de releases importantes?", score: 2 },

      { pergunta: "Eventos de autenticação e autorização são registrados em log?", score: 3 },
      { pergunta: "Existe alerta automático para atividades suspeitas?", score: 2 },
      { pergunta: "Logs são centralizados e protegidos contra alteração?", score: 2 },
      { pergunta: "Há retenção mínima de logs definida por política?", score: 3 },

      { pergunta: "Colaboradores recebem treinamento periódico de segurança da informação?", score: 2 },
      { pergunta: "Existe um canal claro para reportar incidentes ou suspeitas de phishing?", score: 3 },
      { pergunta: "Simulações de phishing já foram realizadas na empresa?", score: 1, notes: "Nunca realizada — recomendado como próximo passo." },
      { pergunta: "Existe uma política de segurança da informação formalizada e divulgada?", score: 3 },

      { pergunta: "Revisão de código inclui verificação de práticas de segurança?", score: 3 },
      { pergunta: "Segredos (chaves, senhas, tokens) são gerenciados fora do código-fonte?", score: 4 },
      { pergunta: "Existe pipeline de CI com verificação automatizada de segurança (SAST e/ou dependências)?", score: 2 },
      { pergunta: "Ambientes de homologação usam dados sintéticos, não dados reais de produção?", score: 3 },
    ];

    const assessment = await prisma.maturityAssessment.create({
      data: { companyId: technova.id, evaluatedBy: admin.id, notes: "Primeira avaliação de maturidade da TechNova, realizada junto com o início do contrato PRO." },
    });

    let soma = 0;
    for (const r of respostas) {
      const controlId = controlIdsPorPergunta.get(r.pergunta);
      if (!controlId) continue; // não deveria acontecer — catálogo acima de propósito tem as mesmas strings
      await prisma.maturityScore.create({
        data: { assessmentId: assessment.id, controlId, score: r.score, isCompliant: r.score >= 4, notes: r.notes },
      });
      soma += r.score;
    }

    const media = Math.round((soma / respostas.length) * 100) / 100;
    const level = media >= 4 ? "ADVANCED" : media >= 2.5 ? "INTERMEDIATE" : "BASIC";
    await prisma.maturityAssessment.update({ where: { id: assessment.id }, data: { overallScore: media, level } });

    console.log(`  ✓ avaliação de maturidade: ${respostas.length} respostas, média ${media} (${level})`);
  }

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
