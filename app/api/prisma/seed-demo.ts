/**
 * seed-demo.ts — cenário de demonstração da TechNova
 *
 * O QUE FAZ
 * Enriquece o banco de DESENVOLVIMENTO com findings distribuídos ao longo de
 * 90 dias, em severidades e estados variados, com a trilha de `AuditLog`
 * correspondente — para que os dashboards da Fase 6.5 tenham o que desenhar.
 *
 * POR QUE EXISTE
 * O `seed.ts` cria a estrutura mínima (3 planos, 1 admin, a TechNova, 1
 * assinatura ACTIVE). Com 2 findings criados no mesmo dia, um burndown é uma
 * linha reta, um gráfico de aging é uma barra só e o MTTR não existe. Isso não
 * prova que as métricas funcionam nem serve para a demonstração da banca.
 *
 * ⚠️ NÃO SUBSTITUI O `seed.ts`. Roda DEPOIS dele e só acrescenta. Não apaga
 * nada e é idempotente por marcação: findings gerados aqui levam o prefixo
 * `[demo]` na descrição, e uma segunda execução remove os anteriores antes de
 * criar os novos — assim rodar duas vezes não duplica o cenário.
 *
 * ⚠️ SÓ EM DESENVOLVIMENTO. Recusa rodar com `NODE_ENV=production`.
 *
 * COMO USAR
 *   npm run db:seed        # estrutura (seed.ts)
 *   npm run db:seed:demo   # este arquivo
 *   npm run db:seed:demo -- --volume=500   # carga para o teste de desempenho
 *
 * QUEM USA
 * Desenvolvimento local, a demonstração do TCC e o teste de desempenho do CP4.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MARCA_DEMO = "[demo]";
const DIA_MS = 86_400_000;

/** Catálogo de findings plausíveis, com vetor CVSS real e categoria OWASP. */
const CATALOGO = [
  { titulo: "SQL Injection no parâmetro de busca", owasp: "A03", vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", score: 9.8 },
  { titulo: "Execução remota de código via desserialização", owasp: "A08", vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", score: 9.8 },
  { titulo: "Falha de controle de acesso em /admin", owasp: "A01", vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N", score: 8.1 },
  { titulo: "IDOR na consulta de pedidos", owasp: "A01", vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N", score: 6.5 },
  { titulo: "Ausência de rate limiting no login", owasp: "A07", vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L", score: 6.5 },
  { titulo: "Cookie de sessão sem flag Secure", owasp: "A05", vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N", score: 3.1 },
  { titulo: "Cabeçalho Server expõe versão", owasp: "A05", vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", score: 5.3 },
  { titulo: "Biblioteca desatualizada com CVE conhecida", owasp: "A06", vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", score: 7.5 },
  { titulo: "Log de autenticação sem trilha de falhas", owasp: "A09", vetor: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N", score: 3.1 },
  { titulo: "SSRF no importador de imagem por URL", owasp: "A10", vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N", score: 8.5 },
  { titulo: "Senha armazenada com hash fraco", owasp: "A02", vetor: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N", score: 5.9 },
  { titulo: "Falta de validação de tipo no upload", owasp: "A04", vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N", score: 8.1 },
];

/** Faixas do schema.prisma — a mesma tabela usada por `cvss.util.ts`. */
function severidadeDe(score: number): string {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

/**
 * Gerador pseudoaleatório com semente fixa.
 *
 * `Math.random()` faria cada execução produzir um cenário diferente — e um
 * cenário que muda a cada seed é inútil tanto para o teste de desempenho
 * (números incomparáveis entre execuções) quanto para a demonstração (a banca
 * veria um gráfico diferente do ensaiado). Com semente, o cenário é sempre o
 * mesmo.
 */
function criarAleatorio(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-demo é exclusivo de desenvolvimento — recusando rodar com NODE_ENV=production");
  }

  const argVolume = process.argv.find((a) => a.startsWith("--volume="));
  const volume = argVolume ? Number(argVolume.split("=")[1]) : 90;
  if (!Number.isFinite(volume) || volume < 1 || volume > 5000) {
    throw new Error("--volume precisa ser um número entre 1 e 5000");
  }

  const company = await prisma.company.findFirst({ where: { name: { contains: "TechNova" } } });
  if (!company) throw new Error("Company TechNova não encontrada — rode `npm run db:seed` primeiro");

  const application = await prisma.application.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!application) throw new Error("Nenhuma aplicação ativa da TechNova — crie uma pela interface ou pelo seed");

  const project = await prisma.project.findFirst({ where: { applicationId: application.id } });
  if (!project) throw new Error("Nenhum projeto para a aplicação — crie um pela interface");

  const autor = await prisma.user.findFirst({ where: { role: "PENTESTER" } });
  const ator = autor ?? (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));

  // --- limpeza do cenário anterior (idempotência) --------------------------
  const anteriores = await prisma.vulnerability.findMany({
    where: { applicationId: application.id, description: { startsWith: MARCA_DEMO } },
    select: { id: true },
  });
  if (anteriores.length > 0) {
    const ids = anteriores.map((v) => v.id);
    // AuditLog não tem FK com onDelete: Cascade para Vulnerability (é
    // append-only e aponta por entityId genérico), então sai à parte.
    await prisma.auditLog.deleteMany({ where: { entityType: "Vulnerability", entityId: { in: ids } } });
    await prisma.vulnerability.deleteMany({ where: { id: { in: ids } } });
    console.log(`  limpou ${anteriores.length} findings [demo] anteriores`);
  }

  // --- geração -------------------------------------------------------------
  const rnd = criarAleatorio(20260810);
  const agora = new Date();
  let criados = 0;
  let transicoes = 0;

  for (let i = 0; i < volume; i++) {
    const modelo = CATALOGO[i % CATALOGO.length];

    // Distribuição ao longo de 90 dias, com viés para o passado: mais findings
    // antigos que recentes é o formato realista de uma aplicação que vem sendo
    // analisada — e é o que faz o gráfico de aging ter as quatro faixas
    // preenchidas em vez de uma só.
    const diasAtras = Math.floor(Math.pow(rnd(), 0.7) * 90);
    const criadoEm = new Date(agora.getTime() - diasAtras * DIA_MS - Math.floor(rnd() * DIA_MS));

    // Variação de ±1.5 no CVSS para o mesmo modelo não render sempre a mesma
    // severidade — senão a distribuição por severidade fica artificial.
    const score = Math.min(10, Math.max(0.1, Math.round((modelo.score + (rnd() - 0.5) * 3) * 10) / 10));
    const severidade = severidadeDe(score);

    // 55% remediados. É uma taxa plausível e faz a barra de "taxa de
    // remediação" ficar na faixa amarela do Progress, que é mais interessante
    // de mostrar que 100% verde.
    const foiRemediado = rnd() < 0.55;
    // Findings antigos têm mais chance de terem sido fechados de vez.
    const status = foiRemediado ? (diasAtras > 45 && rnd() < 0.5 ? "CLOSED" : "FIXED") : rnd() < 0.25 ? "IN_PROGRESS" : "OPEN";

    const vuln = await prisma.vulnerability.create({
      data: {
        title: `${modelo.titulo} #${i + 1}`,
        description: `${MARCA_DEMO} Cenário de demonstração da TechNova. Gerado por prisma/seed-demo.ts.`,
        owaspCategory: modelo.owasp,
        cvssVector: modelo.vetor,
        cvssScore: score,
        severityCalculated: severidade,
        severityFinal: severidade,
        impact: `${MARCA_DEMO} Impacto simulado para a demonstração.`,
        recommendation: `${MARCA_DEMO} Recomendação simulada para a demonstração.`,
        status,
        projectId: project.id,
        applicationId: application.id,
        companyId: company.id,
        createdBy: ator.id,
        createdAt: criadoEm,
      },
    });
    criados++;

    // --- trilha de auditoria ------------------------------------------------
    // Sem estas entradas o MTTR e a série de resolvidos ficam vazios: as duas
    // métricas são RECONSTRUÍDAS do AuditLog, não lidas de uma coluna.
    await prisma.auditLog.create({
      data: {
        actorId: ator.id,
        companyId: company.id,
        entityType: "Vulnerability",
        entityId: vuln.id,
        action: "CREATE",
        createdAt: criadoEm,
      },
    });

    if (status === "IN_PROGRESS" || foiRemediado) {
      const inicioEm = new Date(criadoEm.getTime() + Math.floor(rnd() * 3 + 1) * DIA_MS);
      if (inicioEm < agora) {
        await prisma.auditLog.create({
          data: {
            actorId: ator.id,
            companyId: company.id,
            entityType: "Vulnerability",
            entityId: vuln.id,
            action: "STATUS_CHANGE",
            diffJson: JSON.stringify({ from: "OPEN", to: "IN_PROGRESS" }),
            createdAt: inicioEm,
          },
        });
        transicoes++;

        if (foiRemediado) {
          // Tempo até corrigir por severidade: crítico é tratado mais rápido.
          // É o que faz o MTTR por severidade ter uma ordem que se defende.
          const base = severidade === "CRITICAL" ? 4 : severidade === "HIGH" ? 9 : severidade === "MEDIUM" ? 18 : 30;
          const dias = Math.max(1, Math.round(base * (0.4 + rnd() * 1.6)));
          const corrigidoEm = new Date(inicioEm.getTime() + dias * DIA_MS);
          if (corrigidoEm < agora) {
            await prisma.auditLog.create({
              data: {
                actorId: ator.id,
                companyId: company.id,
                entityType: "Vulnerability",
                entityId: vuln.id,
                action: "STATUS_CHANGE",
                diffJson: JSON.stringify({ from: "IN_PROGRESS", to: "FIXED" }),
                createdAt: corrigidoEm,
              },
            });
            transicoes++;

            // ~8% reabrem — é o que alimenta o insight de taxa de reabertura,
            // que sem nenhum caso real nunca apareceria na demonstração.
            if (rnd() < 0.08) {
              const reabertoEm = new Date(corrigidoEm.getTime() + Math.floor(rnd() * 10 + 1) * DIA_MS);
              if (reabertoEm < agora) {
                await prisma.auditLog.create({
                  data: {
                    actorId: ator.id,
                    companyId: company.id,
                    entityType: "Vulnerability",
                    entityId: vuln.id,
                    action: "STATUS_CHANGE",
                    diffJson: JSON.stringify({ from: "FIXED", to: "OPEN" }),
                    createdAt: reabertoEm,
                  },
                });
                transicoes++;
                await prisma.vulnerability.update({ where: { id: vuln.id }, data: { status: "OPEN" } });
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n✓ Cenário de demonstração da TechNova`);
  console.log(`  aplicação : ${application.name} (${application.id})`);
  console.log(`  findings  : ${criados}`);
  console.log(`  transições: ${transicoes} entradas STATUS_CHANGE no AuditLog`);
  console.log(`  janela    : últimos 90 dias\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
