/**
 * prisma/seed-cenarios.ts — volume realista com as features novas do Vulnera.
 *
 * Roda DEPOIS do `seed.ts` (precisa do admin, dos planos, da TechNova e dos
 * pentesters) e é a terceira etapa do `npm run db:seed:all`. Acrescenta:
 *
 *   - 3 empresas novas com perfis diferentes (banco, saúde, logística), com
 *     usuários, aplicações, projetos e maturidade, e uma 4ª aguardando aprovação;
 *   - ~600 achados manuais com histórico (criação, andamento, correção,
 *     reabertura) espalhados em 150 dias, para métricas, SLA e MTTR;
 *   - SAST e SCA a partir de relatórios REAIS (Semgrep e Trivy contra o OWASP
 *     NodeGoat, SBOM do próprio Vulnera), importados pelo CodeScanService;
 *   - DAST a partir de um scan REAL do OWASP ZAP (Juice Shop), gravado pelo
 *     mesmo parser e repositório do scan de verdade;
 *   - Threat Intel: inventário por empresa e uma sincronização REAL com NVD,
 *     OSV, CISA KEV e EPSS (sem internet o seed avisa e segue);
 *   - aceites de risco, buscas salvas, triagens e promoções pelos services.
 *
 * Tudo que tem regra de negócio passa pelos services (via factories): o seed
 * não pode criar um estado que o produto não criaria. Gravação direta só onde
 * o produto não tem caminho para datas passadas (histórico dos achados).
 *
 * IDEMPOTENTE POR BLOCO: cada projeto, importação e scan só é criado se ainda
 * não existir; rodar de novo não duplica. Para um banco limpo: `npm run db:reset`.
 *
 * Uso: `npm run db:seed:all` (recomendado) ou `tsx prisma/seed-cenarios.ts --volume=800`.
 * Fixtures e procedência: prisma/seeds/cenarios/fixtures/MANIFEST.md.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../src/database/prisma.database";
import { calculateCvss } from "../src/utils/cvss.util";
import { makeCodeScanService } from "../src/factories/code-scan.factory";
import { makeDastTriageService } from "../src/factories/dast-triage.factory";
import { makeThreatIntelService, makeThreatIntelSyncService } from "../src/factories/threat-intel.factory";
import { makeRiskAcceptanceService } from "../src/factories/risk-acceptance.factory";
import { makeSavedQueryService } from "../src/factories/saved-query.factory";
import { DastScanRepository } from "../src/repositories/dast-scan.repository";
import { extractFindingsFromReport } from "../src/services/dast-findings.service";
import { resolveReportPath } from "../src/services/zap-runner.service";
import type { NovoAtivoDTO } from "../src/services/threat-intel/threat-intel.service";
import type { UserRole } from "../src/models/user.model";
import { CATALOGO, COMENTARIOS, JUSTIFICATIVAS_DE_ACEITE, ROTAS_COMPATIVEIS, type TipoDeApp } from "./seeds/cenarios/catalogo";

const FIXTURES = path.join(__dirname, "seeds", "cenarios", "fixtures");
const DIA_MS = 86_400_000;
const JANELA_DIAS = 150;
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

type Actor = { userId: string; role: UserRole };

/** Semente fixa: todo mundo gera o mesmo banco, e a demo ensaiada não muda. */
function criarAleatorio(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}
const rnd = criarAleatorio(20261115);
const escolher = <T>(lista: T[]): T => lista[Math.floor(rnd() * lista.length)];
const diasAtras = (d: number) => new Date(Date.now() - d * DIA_MS);

// ===========================================================================
// Cenário: empresas, aplicações e o que cada uma tem
// ===========================================================================

interface AppDef {
  name: string;
  url?: string;
  environment: "PROD" | "HOMOL" | "DEV";
  techStack: string;
  description: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  internetFacing: boolean;
  dataSensitivity: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  businessOwner: string;
  technicalOwner: string;
  tipo: TipoDeApp;
  rotas: string[];
  /** Fatia do volume total de achados que vai para esta aplicação. */
  peso: number;
  projeto: { name: string; analysisType: string; analysisLevel: string; hasRemediation: boolean; status: string; scopeIn: string };
  pentesters: string[];
}

interface EmpresaDef {
  name: string;
  cnpj: string;
  plano: "BASIC" | "PRO" | "Enterprise";
  owner: { email: string; name: string };
  membro?: { email: string; name: string };
  /** Média-alvo da avaliação de maturidade (1 a 5). */
  maturidade: number;
  apps: AppDef[];
  ativos: NovoAtivoDTO[];
}

const NOVO_PENTESTER = { email: "diego.pentester@vulnera.local", name: "Diego Pentester" };

/** TechNova já existe (seed.ts): aqui só ganha um ciclo novo de pentest por aplicação. */
const TECHNOVA_CICLO: Record<string, Pick<AppDef, "tipo" | "rotas" | "peso" | "pentesters">> = {
  "Portal E-commerce": {
    tipo: "web",
    rotas: ["/api/produtos/busca", "/api/carrinho/cupom", "/conta/pedidos/:id", "/checkout/pagamento", "/conta/perfil", "/api/avaliacoes", "/admin/login"],
    peso: 40,
    pentesters: ["bruno.pentester@vulnera.local"],
  },
  "App Mobile TechNova": {
    tipo: "mobile",
    rotas: ["technova://pedido?next=", "/v2/auth/login", "/v2/perfil/foto", "/v2/pedidos/:id", "/v2/notificacoes"],
    peso: 25,
    pentesters: ["bruno.pentester@vulnera.local"],
  },
  "API B2B Integração": {
    tipo: "api",
    rotas: ["/api/parceiros/:id/contratos", "/api/parceiros/catalogo/importar", "/api/parceiros/token", "/api/parceiros/notas-fiscais", "/api/health/debug"],
    peso: 30,
    pentesters: ["bruno.pentester@vulnera.local", "camila.pentester@vulnera.local"],
  },
  "Sistema Interno de Gestão": {
    tipo: "interno",
    rotas: ["/financeiro/relatorios/exportar", "/rh/colaboradores/:id", "/usuarios/:id", "/login", "/anexos/download"],
    peso: 25,
    pentesters: ["camila.pentester@vulnera.local"],
  },
  "Portal do Cliente": {
    tipo: "web",
    rotas: ["/pedidos?busca=", "/notas-fiscais/:id", "/suporte/chamados", "/conta/email", "/esqueci-senha"],
    peso: 20,
    pentesters: ["camila.pentester@vulnera.local"],
  },
};

const EMPRESAS: EmpresaDef[] = [
  {
    name: "Banco Aurora Digital",
    cnpj: "00.000.000/0002-00",
    plano: "Enterprise",
    owner: { email: "owner@aurora.demo", name: "Helena Duarte (CISO)" },
    membro: { email: "rafaela@aurora.demo", name: "Rafaela Lima (AppSec)" },
    maturidade: 3.6,
    apps: [
      {
        name: "Internet Banking Aurora",
        url: "https://ib.aurora.demo",
        environment: "PROD",
        techStack: "React + Node.js (NestJS) + PostgreSQL",
        description: "Internet banking de pessoa física: extrato, Pix, pagamentos e investimentos.",
        criticality: "CRITICAL",
        internetFacing: true,
        dataSensitivity: "RESTRICTED",
        businessOwner: "Diretoria de Canais Digitais",
        technicalOwner: "Tribo Contas",
        tipo: "web",
        rotas: ["/ib/extrato?periodo=", "/ib/pix/transferir", "/ib/favorecidos/:id", "/ib/login", "/ib/comprovantes/download", "/ib/perfil/email"],
        peso: 70,
        projeto: { name: "Pentest Web — Internet Banking", analysisType: "COMBO", analysisLevel: "ADVANCED", hasRemediation: true, status: "IN_PROGRESS", scopeIn: "ib.aurora.demo — área logada, Pix e comprovantes" },
        pentesters: ["camila.pentester@vulnera.local", NOVO_PENTESTER.email],
      },
      {
        name: "API Open Finance",
        url: "https://api.aurora.demo",
        environment: "PROD",
        techStack: "Java 17 + Spring Boot + Oracle",
        description: "APIs reguladas do Open Finance Brasil: contas, consentimentos e iniciação de pagamento.",
        criticality: "CRITICAL",
        internetFacing: true,
        dataSensitivity: "RESTRICTED",
        businessOwner: "Diretoria de Open Finance",
        technicalOwner: "Squad Integrações Reguladas",
        tipo: "api",
        rotas: ["/open-banking/accounts/v2/accounts/:id", "/open-banking/consents/v2", "/token", "/open-banking/payments/v3/pix", "/actuator/env"],
        peso: 60,
        projeto: { name: "Pentest API — Open Finance", analysisType: "DAST", analysisLevel: "ADVANCED", hasRemediation: true, status: "IN_REVIEW", scopeIn: "Endpoints de fase 2 e 3 do Open Finance, com certificados de teste" },
        pentesters: [NOVO_PENTESTER.email],
      },
      {
        name: "App Aurora",
        environment: "PROD",
        techStack: "React Native + Expo",
        description: "Aplicativo do banco para iOS e Android.",
        criticality: "HIGH",
        internetFacing: true,
        dataSensitivity: "RESTRICTED",
        businessOwner: "Diretoria de Canais Digitais",
        technicalOwner: "Squad Mobile",
        tipo: "mobile",
        rotas: ["aurora://pix?next=", "/mobile/v3/login", "/mobile/v3/cartoes/:id", "/mobile/v3/documentos/upload"],
        peso: 40,
        projeto: { name: "Análise Mobile — App Aurora", analysisType: "COMBO", analysisLevel: "INTERMEDIATE", hasRemediation: true, status: "IN_PROGRESS", scopeIn: "APK e IPA da versão 5.12 e a API mobile" },
        pentesters: ["camila.pentester@vulnera.local"],
      },
      {
        name: "Motor Antifraude",
        environment: "PROD",
        techStack: "Python + Kafka + Redis",
        description: "Pontuação de risco em tempo real das transações.",
        criticality: "HIGH",
        internetFacing: false,
        dataSensitivity: "CONFIDENTIAL",
        businessOwner: "Prevenção a Fraudes",
        technicalOwner: "Squad Risco",
        tipo: "interno",
        rotas: ["/regras/importar", "/analises/exportar", "/admin/console", "/eventos/replay"],
        peso: 30,
        projeto: { name: "Auditoria — Motor Antifraude", analysisType: "SAST", analysisLevel: "INTERMEDIATE", hasRemediation: true, status: "COMPLETED", scopeIn: "Console administrativo e APIs internas" },
        pentesters: [NOVO_PENTESTER.email],
      },
      {
        name: "Portal RH Aurora",
        url: "https://rh-homol.aurora.demo",
        environment: "HOMOL",
        techStack: "Angular + .NET 6 + SQL Server",
        description: "Portal do colaborador: holerites, férias e benefícios.",
        criticality: "MEDIUM",
        internetFacing: false,
        dataSensitivity: "CONFIDENTIAL",
        businessOwner: "Gente e Gestão",
        technicalOwner: "TI Corporativa",
        tipo: "interno",
        rotas: ["/colaboradores/:id", "/holerites/download", "/login"],
        peso: 20,
        projeto: { name: "Pentest Web — Portal RH", analysisType: "DAST", analysisLevel: "BASIC", hasRemediation: false, status: "IN_REVIEW", scopeIn: "Ambiente de homologação" },
        pentesters: ["camila.pentester@vulnera.local"],
      },
    ],
    ativos: [
      { kind: "PACKAGE", ecosystem: "Maven", packageName: "com.fasterxml.jackson.core:jackson-databind", version: "2.9.10.1" },
      { kind: "PACKAGE", ecosystem: "Maven", packageName: "org.springframework:spring-webmvc", version: "5.3.17" },
      { kind: "PACKAGE", ecosystem: "npm", packageName: "axios", version: "0.21.1" },
      { kind: "PRODUCT", cpePart: "a", cpeVendor: "postgresql", cpeProduct: "postgresql", version: "13.2" },
    ],
  },
  {
    name: "Clínica Vida+ Saúde",
    cnpj: "00.000.000/0003-00",
    plano: "PRO",
    owner: { email: "owner@vidamais.demo", name: "Dr. Marcos Teixeira" },
    membro: { email: "julia@vidamais.demo", name: "Júlia Campos (TI)" },
    maturidade: 2.7,
    apps: [
      {
        name: "Portal do Paciente",
        url: "https://paciente.vidamais.demo",
        environment: "PROD",
        techStack: "Next.js + Node.js + MongoDB",
        description: "Resultados de exames, agendamentos e receitas digitais.",
        criticality: "HIGH",
        internetFacing: true,
        dataSensitivity: "RESTRICTED",
        businessOwner: "Diretoria Assistencial",
        technicalOwner: "Squad Paciente",
        tipo: "web",
        rotas: ["/paciente/exames/:id", "/paciente/agendamentos", "/paciente/receitas/download", "/login", "/paciente/perfil"],
        peso: 55,
        projeto: { name: "Pentest Web — Portal do Paciente", analysisType: "DAST", analysisLevel: "INTERMEDIATE", hasRemediation: true, status: "IN_PROGRESS", scopeIn: "paciente.vidamais.demo — área logada" },
        pentesters: ["bruno.pentester@vulnera.local"],
      },
      {
        name: "Telemedicina",
        url: "https://tele.vidamais.demo",
        environment: "PROD",
        techStack: "WebRTC + Node.js + Redis",
        description: "Consultas por vídeo, com gravação e anexos.",
        criticality: "HIGH",
        internetFacing: true,
        dataSensitivity: "RESTRICTED",
        businessOwner: "Diretoria Assistencial",
        technicalOwner: "Squad Telemedicina",
        tipo: "api",
        rotas: ["/api/consultas/:id/sala", "/api/consultas/:id/gravacao", "/api/medicos/agenda", "/api/anexos"],
        peso: 45,
        projeto: { name: "Pentest API — Telemedicina", analysisType: "DAST", analysisLevel: "ADVANCED", hasRemediation: true, status: "IN_REVIEW", scopeIn: "APIs de sala, gravação e anexos" },
        pentesters: [NOVO_PENTESTER.email],
      },
      {
        name: "Prontuário Eletrônico",
        environment: "PROD",
        techStack: "Java + Spring + SQL Server",
        description: "Prontuário, prescrição e evolução clínica. Acesso só pela rede da clínica.",
        criticality: "CRITICAL",
        internetFacing: false,
        dataSensitivity: "RESTRICTED",
        businessOwner: "Diretoria Clínica",
        technicalOwner: "TI Corporativa",
        tipo: "interno",
        rotas: ["/prontuarios/:id", "/prescricoes", "/relatorios/exportar", "/admin/usuarios/:id"],
        peso: 40,
        projeto: { name: "Auditoria — Prontuário Eletrônico", analysisType: "COMBO", analysisLevel: "ADVANCED", hasRemediation: true, status: "IN_PROGRESS", scopeIn: "Módulos de prontuário e prescrição" },
        pentesters: ["bruno.pentester@vulnera.local", NOVO_PENTESTER.email],
      },
      {
        name: "API de Agendamento",
        url: "https://agenda-homol.vidamais.demo",
        environment: "HOMOL",
        techStack: "Node.js + Express + PostgreSQL",
        description: "Agenda integrada com convênios.",
        criticality: "MEDIUM",
        internetFacing: true,
        dataSensitivity: "CONFIDENTIAL",
        businessOwner: "Central de Agendamento",
        technicalOwner: "Squad Integrações",
        tipo: "api",
        rotas: ["/v1/horarios", "/v1/agendamentos/:id", "/v1/webhooks/convenio"],
        peso: 20,
        projeto: { name: "Pentest API — Agendamento", analysisType: "DAST", analysisLevel: "BASIC", hasRemediation: false, status: "PENDING", scopeIn: "Ambiente de homologação" },
        pentesters: [NOVO_PENTESTER.email],
      },
    ],
    ativos: [
      { kind: "PRODUCT", cpePart: "a", cpeVendor: "apache", cpeProduct: "http_server", version: "2.4.49" },
      { kind: "PACKAGE", ecosystem: "npm", packageName: "jsonwebtoken", version: "8.5.1" },
      { kind: "PACKAGE", ecosystem: "npm", packageName: "socket.io-parser", version: "4.0.4" },
      { kind: "PACKAGE", ecosystem: "Maven", packageName: "org.apache.logging.log4j:log4j-core", version: "2.14.1" },
    ],
  },
  {
    name: "Rota Express Logística",
    cnpj: "00.000.000/0004-00",
    plano: "BASIC",
    owner: { email: "owner@rotaexpress.demo", name: "Paulo Rezende" },
    maturidade: 1.9,
    apps: [
      {
        name: "Portal de Rastreamento",
        url: "https://rastreio.rotaexpress.demo",
        environment: "PROD",
        techStack: "PHP (Laravel) + MySQL",
        description: "Rastreamento público de encomendas e comprovantes de entrega.",
        criticality: "MEDIUM",
        internetFacing: true,
        dataSensitivity: "INTERNAL",
        businessOwner: "Operações",
        technicalOwner: "Fornecedor externo",
        tipo: "web",
        rotas: ["/rastreio?codigo=", "/rastreio/:codigo/comprovante", "/contato"],
        peso: 50,
        projeto: { name: "Pentest Web — Rastreamento", analysisType: "DAST", analysisLevel: "BASIC", hasRemediation: false, status: "IN_REVIEW", scopeIn: "rastreio.rotaexpress.demo" },
        pentesters: [NOVO_PENTESTER.email],
      },
      {
        name: "App do Motorista",
        environment: "PROD",
        techStack: "Flutter + Firebase",
        description: "Rotas, baixa de entregas e fotos de comprovante.",
        criticality: "HIGH",
        internetFacing: true,
        dataSensitivity: "CONFIDENTIAL",
        businessOwner: "Operações",
        technicalOwner: "Fornecedor externo",
        tipo: "mobile",
        rotas: ["/driver/v1/entregas/:id", "/driver/v1/login", "/driver/v1/fotos"],
        peso: 30,
        projeto: { name: "Análise Mobile — App do Motorista", analysisType: "COMBO", analysisLevel: "BASIC", hasRemediation: false, status: "IN_PROGRESS", scopeIn: "APK da versão 2.3" },
        pentesters: [NOVO_PENTESTER.email],
      },
    ],
    ativos: [
      { kind: "PACKAGE", ecosystem: "Packagist", packageName: "facade/ignition", version: "2.5.1" },
      { kind: "PACKAGE", ecosystem: "Packagist", packageName: "laravel/framework", version: "8.22.0" },
      { kind: "PRODUCT", cpePart: "a", cpeVendor: "f5", cpeProduct: "nginx", version: "1.18.0" },
    ],
  },
];

const TECHNOVA_ATIVOS: NovoAtivoDTO[] = [
  { kind: "PACKAGE", ecosystem: "npm", packageName: "express", version: "4.17.1" },
  { kind: "PACKAGE", ecosystem: "npm", packageName: "lodash", version: "4.17.20" },
  { kind: "PACKAGE", ecosystem: "Maven", packageName: "org.apache.logging.log4j:log4j-core", version: "2.14.1" },
  { kind: "PRODUCT", cpePart: "a", cpeVendor: "f5", cpeProduct: "nginx", version: "1.18.0" },
];

/** Empresa que acabou de se cadastrar: aparece na fila de aprovação do admin. */
const EMPRESA_PENDENTE = { name: "Mercado Verde Orgânicos", cnpj: "00.000.000/0005-00", owner: { email: "owner@mercadoverde.demo", name: "Lívia Santos" } };

// ===========================================================================
// Contexto compartilhado
// ===========================================================================

const ctx = {
  admin: null as unknown as Actor,
  senhaCliente: "",
  senhaPentester: "",
  usuarios: new Map<string, string>(), // email → id
  resumo: { empresas: 0, achados: 0, comentarios: 0, evidencias: 0, aceites: 0, buscas: 0, importacoes: 0, scans: 0, ativos: 0, promocoes: 0 },
};

const comoActor = (email: string, role: UserRole): Actor => ({ userId: ctx.usuarios.get(email)!, role });

async function garantirUsuario(email: string, name: string, role: UserRole, extra: { companyId?: string; companyRole?: string } = {}) {
  const senha = role === "PENTESTER" ? ctx.senhaPentester : ctx.senhaCliente;
  const u = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name, role, password: senha, ...extra } });
  ctx.usuarios.set(email, u.id);
  return u;
}

async function garantirProjeto(companyId: string, applicationId: string, p: AppDef["projeto"], pentesters: string[]) {
  const existente = await prisma.project.findFirst({ where: { applicationId, name: p.name } });
  if (existente) return { projeto: existente, novo: false };
  const startedAt = p.status === "PENDING" ? null : diasAtras(JANELA_DIAS + 5);
  const projeto = await prisma.project.create({
    data: { ...p, applicationId, companyId, startedAt, closedAt: p.status === "COMPLETED" ? diasAtras(6) : null, requestedAt: diasAtras(JANELA_DIAS + 10) },
  });
  for (const email of pentesters) await prisma.projectMember.create({ data: { projectId: projeto.id, userId: ctx.usuarios.get(email)! } });
  return { projeto, novo: true };
}

// ===========================================================================
// Achados manuais com histórico
// ===========================================================================

interface AlvoDeAchados {
  companyId: string;
  projectId: string;
  applicationId: string;
  tipo: TipoDeApp;
  rotas: string[];
  quantidade: number;
  pentesters: string[];
  clientes: string[];
  owner: string;
}

async function gerarAchados(a: AlvoDeAchados): Promise<string[]> {
  const rotasDo = (titulo: string) => a.rotas.filter((r) => ROTAS_COMPATIVEIS[titulo]?.test(r) ?? true);
  const modelos = CATALOGO.filter((m) => m.tipos.includes(a.tipo) && rotasDo(m.titulo).length > 0);
  const semRotaUsados = new Set<string>();
  const abertosParaAceite: string[] = [];
  const agora = Date.now();

  for (let i = 0; i < a.quantidade; i++) {
    let modelo = escolher(modelos);
    // Achado sem rota (ex.: "MFA ausente") aparece no máximo uma vez por projeto.
    if (!modelo.titulo.includes("{rota}")) {
      if (semRotaUsados.has(modelo.titulo)) modelo = escolher(modelos.filter((m) => m.titulo.includes("{rota}")));
      else semRotaUsados.add(modelo.titulo);
    }
    const rota = escolher(rotasDo(modelo.titulo));
    const preencher = (t: string) => t.split("{rota}").join(rota);
    const { score, severity } = calculateCvss(modelo.vetor);

    // Mais achados antigos que recentes: é o formato de quem é analisado há meses.
    const idade = Math.floor(Math.pow(rnd(), 0.7) * JANELA_DIAS);
    const criadoEm = new Date(agora - idade * DIA_MS - Math.floor(rnd() * DIA_MS));
    const autor = escolher(a.pentesters);

    // Crítico é tratado antes: a chance de já estar corrigido cresce com a idade e a severidade.
    const pesoSev = severity === "CRITICAL" ? 0.25 : severity === "HIGH" ? 0.15 : 0;
    // Depois de ~2 meses quase tudo já foi tratado; o que segue aberto é recente.
    const remediado = rnd() < Math.min(0.95, 0.05 + idade / 70 + pesoSev);
    let status = remediado ? (idade > 30 && rnd() < 0.75 ? "CLOSED" : "FIXED") : rnd() < 0.3 ? "IN_PROGRESS" : "OPEN";

    // Ajuste manual de severidade em ~3%: o cliente rebaixa porque há controle compensatório.
    const rebaixa = severity === "HIGH" && rnd() < 0.06;
    const severityFinal = rebaixa ? "MEDIUM" : severity;

    const vuln = await prisma.vulnerability.create({
      data: {
        title: preencher(modelo.titulo),
        description: preencher(modelo.descricao),
        owaspCategory: modelo.owasp,
        cvssVector: modelo.vetor,
        cvssScore: score,
        severityCalculated: severity,
        severityFinal,
        severityOverrideReason: rebaixa ? "Endpoint atrás de WAF com regra específica e acessível só por parceiros com mTLS." : null,
        impact: modelo.impacto,
        recommendation: modelo.recomendacao,
        status,
        projectId: a.projectId,
        applicationId: a.applicationId,
        companyId: a.companyId,
        createdBy: autor,
        assignedTo: status === "IN_PROGRESS" || (status === "OPEN" && rnd() < 0.4) ? escolher(a.clientes) : null,
        createdAt: criadoEm,
      },
    });
    ctx.resumo.achados++;

    // MTTR e burndown são reconstruídos do AuditLog: sem estas linhas, as métricas ficam vazias.
    const logs: { action: string; diff: object; em: Date; ator: string }[] = [
      { action: "CREATE", diff: { title: vuln.title, severity: severityFinal, owaspCategory: modelo.owasp }, em: criadoEm, ator: autor },
    ];
    const comentarios: { autor: string; texto: string; em: Date }[] = [];
    if (rnd() < 0.35) comentarios.push({ autor, texto: escolher(COMENTARIOS.pentester), em: new Date(criadoEm.getTime() + 3600_000) });

    if (status !== "OPEN") {
      const inicio = new Date(criadoEm.getTime() + Math.floor(rnd() * 4 + 1) * DIA_MS);
      if (inicio.getTime() < agora) {
        logs.push({ action: "STATUS_CHANGE", diff: { from: "OPEN", to: "IN_PROGRESS" }, em: inicio, ator: escolher(a.clientes) });
        if (rnd() < 0.4) comentarios.push({ autor: escolher(a.clientes), texto: escolher(COMENTARIOS.cliente), em: inicio });
      }
      if (remediado) {
        const base = severity === "CRITICAL" ? 4 : severity === "HIGH" ? 10 : severity === "MEDIUM" ? 20 : 35;
        const corrigido = new Date(inicio.getTime() + Math.max(1, Math.round(base * (0.4 + rnd() * 1.6))) * DIA_MS);
        if (corrigido.getTime() < agora) {
          logs.push({ action: "STATUS_CHANGE", diff: { from: "IN_PROGRESS", to: "FIXED" }, em: corrigido, ator: escolher(a.clientes) });
          comentarios.push({ autor: escolher(a.clientes), texto: COMENTARIOS.correcao[0], em: corrigido });
          if (status === "CLOSED") {
            const fechado = new Date(corrigido.getTime() + Math.floor(rnd() * 5 + 1) * DIA_MS);
            logs.push({ action: "STATUS_CHANGE", diff: { from: "FIXED", to: "CLOSED" }, em: fechado < new Date() ? fechado : new Date(), ator: autor });
            comentarios.push({ autor, texto: COMENTARIOS.correcao[1], em: fechado });
          } else if (rnd() < 0.08) {
            // Reabertura: alimenta a taxa de reabertura do dashboard.
            const reaberto = new Date(corrigido.getTime() + Math.floor(rnd() * 8 + 1) * DIA_MS);
            if (reaberto.getTime() < agora) {
              logs.push({ action: "STATUS_CHANGE", diff: { from: "FIXED", to: "OPEN" }, em: reaberto, ator: autor });
              comentarios.push({ autor, texto: COMENTARIOS.reabertura[0], em: reaberto });
              status = "OPEN";
              await prisma.vulnerability.update({ where: { id: vuln.id }, data: { status } });
            }
          }
        } else {
          // A data de correção cairia no futuro: o achado ainda está em andamento.
          status = "IN_PROGRESS";
          await prisma.vulnerability.update({ where: { id: vuln.id }, data: { status } });
        }
      }
    }

    await prisma.auditLog.createMany({
      data: logs.map((l) => ({ actorId: l.ator, companyId: a.companyId, entityType: "Vulnerability", entityId: vuln.id, action: l.action, diffJson: JSON.stringify(l.diff), createdAt: l.em })),
    });
    const passados = comentarios.filter((c) => c.em.getTime() < agora);
    if (passados.length) {
      await prisma.vulnerabilityComment.createMany({ data: passados.map((c) => ({ vulnerabilityId: vuln.id, authorId: c.autor, content: c.texto, createdAt: c.em })) });
      ctx.resumo.comentarios += passados.length;
    }

    // Evidência em disco num a cada ~8 achados (PNG válido: o download real confere a assinatura).
    if (rnd() < 0.12) await gravarEvidencia(a.companyId, vuln.id, autor, `Requisição e resposta de ${rota} mostrando o comportamento descrito.`);

    if (status === "OPEN" && (severityFinal === "MEDIUM" || severityFinal === "LOW")) abertosParaAceite.push(vuln.id);
  }
  return abertosParaAceite;
}

async function gravarEvidencia(companyId: string, vulnerabilityId: string, uploadedBy: string, proof: string) {
  const uploadsRoot = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
  const relativeDir = path.join(companyId, vulnerabilityId);
  const fileName = `${randomUUID()}.png`;
  fs.mkdirSync(path.join(uploadsRoot, relativeDir), { recursive: true });
  const bytes = Buffer.from(PNG_1X1, "base64");
  fs.writeFileSync(path.join(uploadsRoot, relativeDir, fileName), bytes);
  await prisma.evidence.create({
    data: { vulnerabilityId, fileName, originalName: "evidencia.png", filePath: path.join(relativeDir, fileName), mimeType: "image/png", sizeBytes: bytes.length, proof, uploadedBy },
  });
  ctx.resumo.evidencias++;
}

// ===========================================================================
// Aceites de risco e buscas salvas (pelos services)
// ===========================================================================

/** Um pedido de aceite por projeto; o desfecho alterna entre aprovado, rejeitado e pendente. */
async function criarAceite(vulnIds: string[], solicitante: Actor, decisor: Actor) {
  const vulnerabilityId = vulnIds[0];
  if (!vulnerabilityId) return;
  const n = ctx.resumo.aceites++;
  const j = JUSTIFICATIVAS_DE_ACEITE[n % JUSTIFICATIVAS_DE_ACEITE.length];
  const service = makeRiskAcceptanceService();
  const pedido = await service.request(solicitante, vulnerabilityId, { ...j, requestedExpiresAt: new Date(Date.now() + 180 * DIA_MS) });
  if (n % 3 === 0) await service.approve(decisor, pedido.id, { expiresAt: new Date(Date.now() + 120 * DIA_MS), reviewNote: "Aprovado pelo comitê de risco com revisão em 120 dias." });
  if (n % 3 === 1) await service.reject(decisor, pedido.id, { reviewNote: "Risco alto demais para a exposição atual. Corrigir na próxima sprint." });
}

async function criarBuscas(dono: Actor) {
  const service = makeSavedQueryService();
  const buscas = [
    { name: "Críticas e altas em aberto", queryString: "severity=CRITICAL,HIGH&status=OPEN,IN_PROGRESS", scope: "COMPANY" as const, pinned: true },
    { name: "SLA estourado", queryString: "slaState=BREACHED", scope: "COMPANY" as const, pinned: true },
    { name: "Sem responsável", queryString: "assignedTo=none&status=OPEN", scope: "PRIVATE" as const },
    { name: "Vindas de ferramentas", queryString: "sourceType=DAST_IMPORT,SAST_IMPORT,SCA_IMPORT,THREAT_INTEL", scope: "PRIVATE" as const },
  ];
  for (const b of buscas) {
    try {
      await service.create(dono, b);
      ctx.resumo.buscas++;
    } catch (e) {
      // Nome repetido para o mesmo dono = já semeada antes.
      if (!/ALREADY_EXISTS|Unique constraint/i.test((e as Error).message)) throw e;
    }
  }
}

// ===========================================================================
// Maturidade
// ===========================================================================

async function criarMaturidade(companyId: string, media: number) {
  if (await prisma.maturityAssessment.findFirst({ where: { companyId } })) return;
  const controles = await prisma.maturityControl.findMany({ orderBy: [{ domainId: "asc" }, { sortOrder: "asc" }] });
  const assessment = await prisma.maturityAssessment.create({
    data: { companyId, evaluatedBy: ctx.admin.userId, notes: "Avaliação inicial feita no onboarding.", createdAt: diasAtras(45) },
  });
  let soma = 0;
  for (const c of controles) {
    const score = Math.max(1, Math.min(5, Math.round(media + (rnd() - 0.5) * 2.4)));
    soma += score;
    await prisma.maturityScore.create({ data: { assessmentId: assessment.id, controlId: c.id, score, isCompliant: score >= 4 } });
  }
  const overall = Math.round((soma / controles.length) * 100) / 100;
  await prisma.maturityAssessment.update({
    where: { id: assessment.id },
    data: { overallScore: overall, level: overall >= 4 ? "ADVANCED" : overall >= 2.5 ? "INTERMEDIATE" : "BASIC" },
  });
}

// ===========================================================================
// SAST / SCA — relatórios reais pelo CodeScanService
// ===========================================================================

async function importar(actor: Actor, projectId: string, arquivo: string, conteudo?: string) {
  const buffer = conteudo !== undefined ? Buffer.from(conteudo) : fs.readFileSync(path.join(FIXTURES, arquivo));
  const r = await makeCodeScanService().importReport(actor, projectId, { originalName: arquivo, buffer });
  ctx.resumo.importacoes++;
  return r;
}

async function promoverCodigo(actor: Actor, findingId: string) {
  const service = makeCodeScanService();
  const d = await service.getPromotionDraft(actor, findingId);
  if (d.alreadyPromotedTo) return null;
  const vetor = d.cvssVector || "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N";
  const v = await service.promote(actor, findingId, {
    title: d.title,
    description: d.description,
    owaspCategory: d.owaspCategory,
    cvssVector: vetor,
    impact: d.impact ?? undefined,
    recommendation: d.recommendation ?? undefined,
  });
  ctx.resumo.promocoes++;
  return v;
}

async function cenarioDeCodigo(technovaId: string) {
  const portal = await prisma.application.findFirst({ where: { companyId: technovaId, name: "Portal do Cliente" } });
  if (!portal) return;
  const camila = comoActor("camila.pentester@vulnera.local", "PENTESTER");
  const { projeto, novo } = await garantirProjeto(
    technovaId,
    portal.id,
    { name: "Revisão de código — Portal do Cliente", analysisType: "SAST", analysisLevel: "INTERMEDIATE", hasRemediation: true, status: "IN_PROGRESS", scopeIn: "Repositório do backend Node.js (SAST) e dependências (SCA)" },
    ["camila.pentester@vulnera.local"],
  );
  if (!novo) return;
  const service = makeCodeScanService();

  // 1ª importação SAST: o relatório real como saiu do Semgrep.
  const sarif = fs.readFileSync(path.join(FIXTURES, "nodegoat-semgrep.sarif"), "utf8");
  const v1 = await importar(camila, projeto.id, "nodegoat-semgrep.sarif", sarif);
  const achadosV1 = await service.listFindings(camila, v1.id);

  // Triagem: o eval vira vulnerabilidade; cookie sem domain é falso positivo (o proxy define).
  const evalFinding = achadosV1.find((f) => /eval/i.test(f.ruleId));
  if (evalFinding) {
    const vuln = await promoverCodigo(camila, evalFinding.id);
    // O time marcou como corrigido... mas o código não mudou (ver a 2ª importação).
    if (vuln) {
      await prisma.vulnerability.update({ where: { id: vuln.id }, data: { status: "FIXED" } });
      await prisma.auditLog.create({
        data: { actorId: ctx.usuarios.get("owner@technova.demo")!, companyId: technovaId, entityType: "Vulnerability", entityId: vuln.id, action: "STATUS_CHANGE", diffJson: JSON.stringify({ from: "OPEN", to: "FIXED" }) },
      });
    }
  }
  for (const f of achadosV1.filter((x) => /cookie-session-no-domain|cookie-session-no-path/.test(x.ruleId))) {
    await service.triage(camila, f.id, { triageStatus: "FALSE_POSITIVE", note: "Domain e path do cookie são definidos pelo proxy reverso (nginx), fora do código analisado." });
  }

  // 2ª importação: o mesmo relatório sem as 6 regras de cookie (corrigidas) — o eval
  // continua lá, e a tela mostra "Correção não confirmada" (CODE-FUT-03).
  const s = JSON.parse(sarif);
  s.runs[0].results = s.runs[0].results.filter((r: { ruleId: string }) => !/express-cookie-settings/.test(r.ruleId));
  await importar(camila, projeto.id, "nodegoat-semgrep.sarif", JSON.stringify(s));
  await prisma.codeScanImport.update({ where: { id: v1.id }, data: { createdAt: diasAtras(21) } });

  // SCA: SBOM real do Trivy; a CVE mais grave vira vulnerabilidade, uma vira aceite.
  const sca = await importar(camila, projeto.id, "nodegoat-trivy.cdx.json");
  const scaAchados = await service.listFindings(camila, sca.id);
  const ordenados = [...scaAchados].sort((a, b) => (b.cvssScore ?? 0) - (a.cvssScore ?? 0));
  if (ordenados[0]) await promoverCodigo(camila, ordenados[0].id);
  const dev = ordenados.find((f) => /mocha|grunt|karma|nodemon/i.test(f.packageName ?? ""));
  if (dev) await service.triage(camila, dev.id, { triageStatus: "ACCEPTED_RISK", note: "Dependência só de desenvolvimento; não vai para a imagem de produção." });
}

async function scaDoBanco(auroraId: string) {
  const ib = await prisma.application.findFirst({ where: { companyId: auroraId, name: "Internet Banking Aurora" } });
  if (!ib) return;
  const { projeto, novo } = await garantirProjeto(
    auroraId,
    ib.id,
    { name: "Análise de dependências — Internet Banking", analysisType: "SAST", analysisLevel: "BASIC", hasRemediation: true, status: "IN_PROGRESS", scopeIn: "SBOM CycloneDX do frontend e do backend" },
    ["camila.pentester@vulnera.local"],
  );
  if (!novo) return;
  // Também alimenta as sugestões do inventário de Threat Intel do banco.
  await importar(comoActor("camila.pentester@vulnera.local", "PENTESTER"), projeto.id, "vulnera-trivy.cdx.json");
}

// ===========================================================================
// DAST — scan real do ZAP gravado pelo mesmo parser e repositório
// ===========================================================================

const ALVO_DAST = "https://loja.technova.com.br/";

async function cenarioDast(technovaId: string) {
  if ((await prisma.dastScan.count({ where: { targetUrl: ALVO_DAST } })) > 0) return;
  const bruno = comoActor("bruno.pentester@vulnera.local", "PENTESTER");
  const repo = new DastScanRepository(prisma);
  let ultimo = "";

  // Dois scans do mesmo alvo com um mês de distância: dá o que comparar.
  for (const dias of [32, 3]) {
    const inicio = diasAtras(dias);
    const duracao = 34_000 + Math.floor(rnd() * 20_000);
    const scan = await prisma.dastScan.create({
      data: {
        targetUrl: ALVO_DAST,
        status: "COMPLETED",
        requestedById: bruno.userId,
        containerName: null,
        startedAt: inicio,
        finishedAt: new Date(inicio.getTime() + duracao),
        durationMs: duracao,
        progress: 100,
        phase: "DONE",
        simulated: false,
        createdAt: inicio,
      },
    });
    const jsonPath = resolveReportPath(scan.id, "report.json");
    const htmlPath = resolveReportPath(scan.id, "report.html");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, "zap-loja.json"), jsonPath);
    fs.copyFileSync(path.join(FIXTURES, "zap-loja.html"), htmlPath);
    await repo.persistFindingsAndUpdateCounters(scan.id, await extractFindingsFromReport(jsonPath, ALVO_DAST));
    await prisma.dastScan.update({ where: { id: scan.id }, data: { jsonReportPath: jsonPath, htmlReportPath: htmlPath } });
    ctx.resumo.scans++;
    ultimo = scan.id;
  }

  // Triagem do scan mais recente, como o pentester faria.
  const triagem = makeDastTriageService();
  const projeto = await prisma.project.findFirst({ where: { companyId: technovaId, name: "Pentest Web — Portal E-commerce" } });
  const achados = await prisma.dastFinding.findMany({ where: { scanId: ultimo }, orderBy: [{ risk: "desc" }] });
  // Um por tipo de alerta: o ZAP repete o mesmo alerta em cada URL, e o pentester promove uma vez só.
  const promover = ["10038", "10098", "10063"].map((p) => achados.find((f) => f.pluginId === p)).filter((f) => f !== undefined);
  for (const f of promover) {
    if (!projeto) break;
    const d = await triagem.getPromotionDraft(bruno, f.id);
    if (d.alreadyPromotedTo) continue;
    await triagem.promote(bruno, f.id, { projectId: projeto.id, title: d.title, description: d.description, owaspCategory: d.owaspCategory, cvssVector: d.cvssVector, impact: d.impact ?? undefined, recommendation: d.recommendation ?? undefined });
    ctx.resumo.promocoes++;
  }
  for (const f of achados.filter((x) => x.pluginId === "10109")) {
    await triagem.triage(bruno, f.id, { triageStatus: "FALSE_POSITIVE", note: "Alerta informativo: a aplicação é uma SPA de propósito." });
  }
  for (const f of achados.filter((x) => x.pluginId === "90004")) {
    await triagem.triage(bruno, f.id, { triageStatus: "ACCEPTED_RISK", note: "COEP não se aplica: a loja não usa SharedArrayBuffer. Revisar se isso mudar." });
  }
}

// ===========================================================================
// Threat Intel — inventário, sincronização real, triagem e promoção
// ===========================================================================

async function cenarioThreatIntel(empresas: { companyId: string; ativos: NovoAtivoDTO[] }[]) {
  const service = makeThreatIntelService();
  const sync = makeThreatIntelSyncService();

  for (const e of empresas) {
    for (const a of e.ativos) {
      try {
        await service.adicionarAtivo(ctx.admin, e.companyId, a);
        ctx.resumo.ativos++;
      } catch (err) {
        if ((err as Error).message !== "TECH_ASSET_ALREADY_EXISTS") throw err;
      }
    }
  }

  // Cada ativo novo dispara o backfill em segundo plano; espera todos e roda o feed recente.
  console.log("  … sincronizando Threat Intel com NVD, OSV, CISA KEV e EPSS (pode levar alguns minutos)");
  await sync.aguardarOcioso();
  const r = await sync.executar("MANUAL");
  await sync.aguardarOcioso();
  const [avisos, casamentosTotal, kev, notificacoes] = await Promise.all([
    prisma.threatAdvisory.count(),
    prisma.threatMatch.count(),
    prisma.threatMatch.count({ where: { advisory: { kev: true } } }),
    prisma.notification.count({ where: { category: { startsWith: "THREAT" } } }),
  ]);
  console.log(`  ✓ Threat Intel: ${avisos} avisos, ${casamentosTotal} casamentos com o inventário (${kev} no KEV), ${notificacoes} notificações`);
  const falhas = Object.entries(r?.sources ?? {}).filter(([, v]) => (v as { ok?: boolean }).ok === false).map(([k]) => k);
  if (!r || falhas.length) console.warn(`  ⚠ fontes que falharam agora: ${falhas.join(", ") || "todas"}. Sem internet, ou o NVD instável: rode "Sincronizar agora" na tela de Threat Intel depois.`);

  for (const e of empresas) {
    const casamentos = await service.listarCasamentos(ctx.admin, e.companyId, {});
    const novos = casamentos.filter((c) => c.triageStatus === "NEW");
    if (casamentos.some((c) => c.promotedVulnerability)) continue;
    const ordem = [...novos].sort((a, b) => Number(b.advisory.kev) - Number(a.advisory.kev) || (b.advisory.cvssScore ?? 0) - (a.advisory.cvssScore ?? 0));
    const projeto = await prisma.project.findFirst({ where: { companyId: e.companyId, status: { not: "PENDING" } }, orderBy: { requestedAt: "asc" } });
    const alvo = ordem[0];
    if (alvo && projeto) {
      const d = await service.rascunhoDePromocao(ctx.admin, alvo.id);
      await service.promover(ctx.admin, alvo.id, {
        projectId: projeto.id,
        title: d.title,
        description: d.description,
        owaspCategory: d.owaspCategory,
        cvssVector: d.cvssVector || "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        recommendation: d.recommendation,
      });
      ctx.resumo.promocoes++;
    }
    for (const c of ordem.slice(1, 4)) await service.triar(ctx.admin, c.id, { triageStatus: "CONFIRMED", note: "Versão em uso confirmada com o time responsável." });
    const semVersao = ordem.find((c) => !c.versionConfirmed);
    if (semVersao && semVersao !== alvo) await service.triar(ctx.admin, semVersao.id, { triageStatus: "FALSE_POSITIVE", note: "A distribuição aplica o backport da correção; versão do pacote não reflete o patch." });
  }
}

// ===========================================================================
// main
// ===========================================================================

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed-cenarios é só para desenvolvimento — recusando com NODE_ENV=production");
  const argVolume = process.argv.find((a) => a.startsWith("--volume="));
  const volume = argVolume ? Number(argVolume.split("=")[1]) : 600;
  if (!Number.isFinite(volume) || volume < 50 || volume > 5000) throw new Error("--volume precisa ser um número entre 50 e 5000");
  const inicio = Date.now();
  console.log(`🌱 Cenários realistas (volume ≈ ${volume} achados)...`);

  const admin = await prisma.user.findUnique({ where: { email: "admin@vulnera.local" } });
  const technova = await prisma.company.findUnique({ where: { cnpj: "00.000.000/0001-00" } });
  if (!admin || !technova) throw new Error("Rode `npm run db:seed` antes (falta o admin ou a TechNova).");
  ctx.admin = { userId: admin.id, role: "ADMIN" };
  // Mesmas senhas de demo do seed.ts (docs/DEMO.md).
  ctx.senhaCliente = await bcrypt.hash("demo12345", 12);
  ctx.senhaPentester = await bcrypt.hash("senha12345", 12);
  for (const u of await prisma.user.findMany({ select: { id: true, email: true } })) ctx.usuarios.set(u.email, u.id);
  await garantirUsuario(NOVO_PENTESTER.email, NOVO_PENTESTER.name, "PENTESTER");

  const pesoTotal = Object.values(TECHNOVA_CICLO).reduce((s, a) => s + a.peso, 0) + EMPRESAS.flatMap((e) => e.apps).reduce((s, a) => s + a.peso, 0);
  const qtd = (peso: number) => Math.max(5, Math.round((peso / pesoTotal) * volume));
  const planos = new Map((await prisma.plan.findMany()).map((p) => [p.name, p.id]));

  // --- TechNova: um ciclo novo de pentest por aplicação ---------------------
  const clientesTechnova = ["owner@technova.demo", "fernanda@technova.demo"].map((e) => ctx.usuarios.get(e)!);
  for (const [nomeApp, def] of Object.entries(TECHNOVA_CICLO)) {
    const app = await prisma.application.findFirst({ where: { companyId: technova.id, name: nomeApp } });
    if (!app) continue;
    const { projeto, novo } = await garantirProjeto(
      technova.id,
      app.id,
      { name: `Pentest contínuo 2026 — ${nomeApp}`, analysisType: def.tipo === "mobile" ? "COMBO" : "DAST", analysisLevel: "INTERMEDIATE", hasRemediation: true, status: "IN_PROGRESS", scopeIn: `Ciclo trimestral de testes em ${app.url ?? nomeApp}` },
      def.pentesters,
    );
    if (!novo) continue;
    const abertos = await gerarAchados({
      companyId: technova.id, projectId: projeto.id, applicationId: app.id, tipo: def.tipo, rotas: def.rotas, quantidade: qtd(def.peso),
      pentesters: def.pentesters.map((e) => ctx.usuarios.get(e)!), clientes: clientesTechnova, owner: clientesTechnova[0],
    });
    await criarAceite(abertos, comoActor(def.pentesters[0], "PENTESTER"), comoActor("owner@technova.demo", "CLIENT"));
  }
  await criarBuscas(comoActor("owner@technova.demo", "CLIENT"));
  console.log("  ✓ TechNova: ciclo 2026 com histórico, aceites e buscas salvas");

  // --- Empresas novas -------------------------------------------------------
  const empresasTi: { companyId: string; ativos: NovoAtivoDTO[] }[] = [{ companyId: technova.id, ativos: TECHNOVA_ATIVOS }];
  let auroraId = "";
  for (const e of EMPRESAS) {
    const company = await prisma.company.upsert({ where: { cnpj: e.cnpj }, update: {}, create: { name: e.name, cnpj: e.cnpj, planId: planos.get(e.plano)!, createdAt: diasAtras(JANELA_DIAS + 20) } });
    if (!(await prisma.subscription.findFirst({ where: { companyId: company.id } }))) {
      await prisma.subscription.create({ data: { companyId: company.id, planId: planos.get(e.plano)!, status: "ACTIVE", startDate: diasAtras(JANELA_DIAS + 15), approvedBy: admin.id } });
      ctx.resumo.empresas++;
    }
    await garantirUsuario(e.owner.email, e.owner.name, "CLIENT", { companyId: company.id, companyRole: "OWNER" });
    if (e.membro) await garantirUsuario(e.membro.email, e.membro.name, "CLIENT", { companyId: company.id, companyRole: "MEMBER" });
    const clientes = [e.owner.email, ...(e.membro ? [e.membro.email] : [])].map((x) => ctx.usuarios.get(x)!);

    for (const a of e.apps) {
      let app = await prisma.application.findFirst({ where: { companyId: company.id, name: a.name } });
      app ??= await prisma.application.create({
        data: {
          name: a.name, url: a.url, environment: a.environment, techStack: a.techStack, description: a.description, criticality: a.criticality,
          internetFacing: a.internetFacing, dataSensitivity: a.dataSensitivity, businessOwner: a.businessOwner, technicalOwner: a.technicalOwner,
          companyId: company.id, createdAt: diasAtras(JANELA_DIAS + 12),
        },
      });
      const { projeto, novo } = await garantirProjeto(company.id, app.id, a.projeto, a.pentesters);
      if (!novo || a.projeto.status === "PENDING") continue;
      const abertos = await gerarAchados({
        companyId: company.id, projectId: projeto.id, applicationId: app.id, tipo: a.tipo, rotas: a.rotas, quantidade: qtd(a.peso),
        pentesters: a.pentesters.map((x) => ctx.usuarios.get(x)!), clientes, owner: clientes[0],
      });
      await criarAceite(abertos, comoActor(a.pentesters[0], "PENTESTER"), comoActor(e.owner.email, "CLIENT"));
    }
    await criarMaturidade(company.id, e.maturidade);
    await criarBuscas(comoActor(e.owner.email, "CLIENT"));
    empresasTi.push({ companyId: company.id, ativos: e.ativos });
    if (e.name === "Banco Aurora Digital") auroraId = company.id;
    console.log(`  ✓ ${e.name}: ${e.apps.length} aplicações, plano ${e.plano}`);
  }

  // --- Empresa aguardando aprovação ----------------------------------------
  const pendente = await prisma.company.upsert({ where: { cnpj: EMPRESA_PENDENTE.cnpj }, update: {}, create: { name: EMPRESA_PENDENTE.name, cnpj: EMPRESA_PENDENTE.cnpj, planId: planos.get("PRO")! } });
  if (!(await prisma.subscription.findFirst({ where: { companyId: pendente.id } }))) {
    await prisma.subscription.create({ data: { companyId: pendente.id, planId: planos.get("PRO")!, status: "PENDING_APPROVAL" } });
  }
  await garantirUsuario(EMPRESA_PENDENTE.owner.email, EMPRESA_PENDENTE.owner.name, "CLIENT", { companyId: pendente.id, companyRole: "OWNER" });
  console.log(`  ✓ ${EMPRESA_PENDENTE.name}: assinatura aguardando aprovação do admin`);

  // --- Ferramentas -----------------------------------------------------------
  await cenarioDeCodigo(technova.id);
  if (auroraId) await scaDoBanco(auroraId);
  console.log("  ✓ SAST/SCA: Semgrep e Trivy reais (NodeGoat) e SBOM do Internet Banking");
  await cenarioDast(technova.id);
  console.log("  ✓ DAST: 2 scans reais do ZAP na loja da TechNova, com triagem e promoções");
  await cenarioThreatIntel(empresasTi);

  const r = ctx.resumo;
  console.log(
    `\n✅ Cenários prontos em ${Math.round((Date.now() - inicio) / 1000)}s: ${r.empresas} empresas novas, ${r.achados} achados manuais, ${r.comentarios} comentários, ` +
      `${r.evidencias} evidências, ${r.aceites} aceites de risco, ${r.buscas} buscas salvas, ${r.importacoes} importações SAST/SCA, ${r.scans} scans DAST, ` +
      `${r.ativos} tecnologias no inventário, ${r.promocoes} promoções.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
