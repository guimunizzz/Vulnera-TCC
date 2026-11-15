/**
 * threat-intel-sync.service.ts
 *
 * O QUE FAZ
 * Uma execução da sincronização da Threat Intel (ADR-053), em passos que não
 * derrubam uns aos outros — cada fonte que falha vira aviso na execução
 * (status PARTIAL), nunca dado inventado:
 *   1. KEV  — catálogo de exploração ativa (marca CVEs conhecidas, traz as recentes);
 *   2. NVD  — CVEs publicadas desde a última execução (o "feed");
 *   3. NVD  — por PRODUTO do inventário (CPE + versão), só o que mudou desde a última consulta;
 *   4. OSV  — por PACOTE do inventário (ecossistema + nome + versão);
 *   5. EPSS — probabilidade de exploração das CVEs que afetam alguém;
 *   6. notificações — o que é novo e grave (D19.6, D19.7).
 *
 * Os passos 3 e 4 consultam UMA vez por tecnologia distinta, mesmo que várias
 * empresas usem a mesma (é dado público), e criam o casamento para cada uma.
 *
 * QUEM DISPARA
 *  - o agendador (`agendador.ts`), a cada `THREAT_INTEL_SYNC_INTERVAL_MIN`;
 *  - o ADMIN, pelo botão "Sincronizar agora";
 *  - o inventário, ao confirmar uma tecnologia (só os passos 3–6 para ela, o
 *    backfill da D19.7: o que já existia aparece, mas não notifica).
 *
 * CONCORRÊNCIA
 * Uma execução por vez neste processo (flag em memória) e, entre processos,
 * a execução RUNNING no banco. ⚠️ shortcut: assume uma instância da API (como o
 * watchdog do DAST); com várias, trocar por lock no banco (ADR-053, Consequências).
 */

import type { TechAsset } from "@prisma/client";
import type { TechAssetRepository } from "../../repositories/tech-asset.repository";
import type { NovoCasamento, ThreatIntelRepository } from "../../repositories/threat-intel.repository";
import type { NotificationRepository, NovaNotificacao } from "../../repositories/notification.repository";
import { FonteIndisponivel, type FontesDeAvisos } from "./fontes";
import {
  MAX_NOTIFICACOES_INDIVIDUAIS,
  chaveDeIdentidade,
  cpeDeBusca,
  eventosQueNotificam,
  normalizarVersao,
  versaoCorrigidaNoNvd,
  versaoCorrigidaNoOsv,
  type AvisoNormalizado,
  type EntradaKev,
  type EventoCandidato,
} from "../../utils/threat-intel.util";

export type Gatilho = "SCHEDULED" | "MANUAL" | "ASSET";

interface ResultadoFonte {
  ok: boolean;
  itens: number;
  erro?: string;
}

export interface ResumoExecucao {
  id: string;
  status: string;
  newAdvisories: number;
  newMatches: number;
  notifications: number;
  sources: Record<string, ResultadoFonte>;
}

const DIA_MS = 24 * 3600_000;
/** Primeira execução: o feed começa 2 dias atrás (o NVD publica centenas de CVEs por dia). */
const JANELA_INICIAL_FEED_MS = 2 * DIA_MS;
/** Teto da janela do feed: uma API parada por semanas não puxa um mês de CVEs de uma vez. */
const JANELA_MAX_FEED_MS = 7 * DIA_MS;
/** KEV adicionadas nos últimos N dias entram no feed mesmo sem o NVD. */
const DIAS_KEV_NO_FEED = 30;
const EPSS_VALIDADE_MS = DIA_MS;
const MAX_CVES_EPSS = 500;
/** Avisos do OSV buscados em paralelo (a API pública não tem limite declarado; somos educados). */
const PARALELO_OSV = 5;
/** Execução RUNNING mais velha que isto é órfã (reinício do servidor). */
const ORFA_MS = 2 * 3600_000;

export class ThreatIntelSyncService {
  private rodando = false;
  /**
   * Backfills pedidos enquanto outra execução rodava: confirmar duas tecnologias
   * seguidas não pode perder a segunda. Rodam logo depois, numa execução só.
   */
  private readonly pendentes = new Set<string>();
  private ultimaExecucao: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fontes: FontesDeAvisos,
    private readonly repository: ThreatIntelRepository,
    private readonly assets: TechAssetRepository,
    private readonly notificacoes: NotificationRepository,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  emAndamento(): boolean {
    return this.rodando || this.pendentes.size > 0;
  }

  /** Para testes e encerramento: resolve quando não há execução nem backfill pendente. */
  async aguardarOcioso(): Promise<void> {
    while (this.emAndamento()) await this.ultimaExecucao.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, 10)));
  }

  /**
   * Executa a sincronização. `apenasAtivos` restringe os passos 3–6 a essas
   * tecnologias (backfill ao confirmar) e pula KEV/feed. Devolve null se já
   * havia outra execução rodando.
   */
  async executar(gatilho: Gatilho, apenasAtivos?: string[]): Promise<ResumoExecucao | null> {
    if (this.rodando) {
      if (gatilho === "ASSET") for (const id of apenasAtivos ?? []) this.pendentes.add(id);
      return null;
    }
    this.rodando = true;
    const execucao = this.executarAgora(gatilho, apenasAtivos);
    this.ultimaExecucao = execucao;
    try {
      return await execucao;
    } finally {
      this.rodando = false;
      if (this.pendentes.size > 0) {
        const ids = [...this.pendentes];
        this.pendentes.clear();
        this.executar("ASSET", ids).catch((e) => console.error("Threat Intel: backfill pendente falhou", e));
      }
    }
  }

  private async executarAgora(gatilho: Gatilho, apenasAtivos?: string[]): Promise<ResumoExecucao | null> {
    const inicio = this.agora();
    await this.repository.encerrarOrfas(new Date(inicio.getTime() - ORFA_MS));
    if (await this.repository.execucaoEmAndamento(new Date(inicio.getTime() - ORFA_MS))) return null;

    const ultima = gatilho === "ASSET" ? null : await this.repository.ultimaExecucaoComFeedNvd();
    const execucao = await this.repository.iniciarExecucao(gatilho);
    const fontes: Record<string, ResultadoFonte> = {};
    let novosAvisos = 0;
    let novosCasamentos = 0;
    let kevMapa = new Map<string, EntradaKev>();

    // 1. KEV
    if (gatilho !== "ASSET") {
      try {
        const entradas = await this.fontes.kev();
        kevMapa = new Map(entradas.map((e) => [e.cveId, e]));
        const r = await this.repository.aplicarKev(entradas, DIAS_KEV_NO_FEED, inicio);
        novosAvisos += r.criadas;
        fontes.KEV = { ok: true, itens: entradas.length };
      } catch (e) {
        fontes.KEV = falha(e);
      }
    }

    // 2. NVD — feed de publicadas
    if (gatilho !== "ASSET") {
      const desde = ultima
        ? new Date(Math.max(ultima.startedAt.getTime() - 3600_000, inicio.getTime() - JANELA_MAX_FEED_MS))
        : new Date(inicio.getTime() - JANELA_INICIAL_FEED_MS);
      try {
        const r = await this.fontes.nvdPublicadas(desde, inicio);
        novosAvisos += await this.repository.gravarAvisos(r.avisos, kevMapa);
        fontes.NVD_FEED = { ok: true, itens: r.avisos.length, ...(r.truncado ? { erro: "janela com mais CVEs que o teto; as mais antigas ficaram de fora" } : {}) };
      } catch (e) {
        fontes.NVD_FEED = falha(e);
      }
    }

    const ativos = await this.assets.confirmados(apenasAtivos);

    // 3. NVD — por produto
    const produtos = agrupar(ativos.filter((a) => a.kind === "PRODUCT"));
    if (produtos.size > 0) {
      let itens = 0;
      let erro: string | undefined;
      for (const grupo of produtos.values()) {
        const ref = grupo[0]!;
        try {
          const r = await this.fontes.nvdPorProduto(cpeDeBusca(ref), menorSincronizacao(grupo), inicio);
          itens += r.avisos.length;
          novosAvisos += await this.repository.gravarAvisos(r.avisos, kevMapa);
          novosCasamentos += await this.casar(grupo, r.avisos, (a) => versaoCorrigidaNoNvd(r.bruto, a.id, ref.cpeVendor ?? "", ref.cpeProduct ?? ""));
          await this.assets.marcarSincronizados(grupo.map((g) => g.id), inicio);
        } catch (e) {
          erro = mensagem(e);
          // NVD fora do ar ou limitando: insistir só prolonga o bloqueio.
          if (e instanceof FonteIndisponivel) break;
        }
      }
      fontes.NVD_PRODUTOS = { ok: !erro, itens, ...(erro ? { erro } : {}) };
    }

    // 4. OSV — por pacote
    const pacotes = agrupar(ativos.filter((a) => a.kind === "PACKAGE"));
    if (pacotes.size > 0) {
      try {
        const grupos = [...pacotes.values()];
        const ids = await this.fontes.osvLote(grupos.map((g) => ({ ecosystem: g[0]!.ecosystem ?? "", name: g[0]!.packageName ?? "", version: normalizarVersao(g[0]!.version) })));
        const detalhes = await this.detalhesOsv([...new Set(ids.flat())]);
        let itens = 0;
        for (let i = 0; i < grupos.length; i++) {
          const grupo = grupos[i]!;
          const ref = grupo[0]!;
          const avisos = (ids[i] ?? []).flatMap((id) => (detalhes.has(id) ? [detalhes.get(id)!] : []));
          itens += avisos.length;
          novosAvisos += await this.repository.gravarAvisos(avisos.map((d) => d.aviso), kevMapa);
          const brutoPorAviso = new Map(avisos.map((d) => [d.aviso.id, d.bruto]));
          novosCasamentos += await this.casar(
            grupo,
            avisos.map((d) => d.aviso),
            (a) => versaoCorrigidaNoOsv(brutoPorAviso.get(a.id), ref.ecosystem ?? "", ref.packageName ?? "", normalizarVersao(ref.version)),
          );
        }
        await this.assets.marcarSincronizados(grupos.flat().map((g) => g.id), inicio);
        fontes.OSV = { ok: true, itens };
      } catch (e) {
        fontes.OSV = falha(e);
      }
    }

    // 5. EPSS
    try {
      const cves = await this.repository.cvesSemEpssRecente(new Date(inicio.getTime() - EPSS_VALIDADE_MS), MAX_CVES_EPSS);
      if (cves.length > 0) {
        const notas = await this.fontes.epss(cves);
        await this.repository.gravarEpss(notas, inicio);
        fontes.EPSS = { ok: true, itens: notas.size };
      }
    } catch (e) {
      fontes.EPSS = falha(e);
    }

    // 6. Notificações
    const enviadas = await this.notificar();

    const algumaFalhou = Object.values(fontes).some((f) => !f.ok);
    const todasFalharam = Object.keys(fontes).length > 0 && Object.values(fontes).every((f) => !f.ok);
    const status = todasFalharam ? "FAILED" : algumaFalhou ? "PARTIAL" : "OK";
    await this.repository.concluirExecucao(execucao.id, {
      status,
      finishedAt: this.agora(),
      sources: fontes as object,
      newAdvisories: novosAvisos,
      newMatches: novosCasamentos,
      notifications: enviadas,
      errorMessage: algumaFalhou ? Object.entries(fontes).filter(([, f]) => !f.ok).map(([k, f]) => `${k}: ${f.erro}`).join("; ") : null,
    });
    return { id: execucao.id, status, newAdvisories: novosAvisos, newMatches: novosCasamentos, notifications: enviadas, sources: fontes };
  }

  /**
   * Busca os detalhes dos avisos do OSV, alguns por vez. Aviso que falhar fica de fora desta execução.
   * shortcut: rebusca o detalhe a cada execução (sem cache por `modified`); cachear quando o inventário passar de alguns milhares de pacotes.
   */
  private async detalhesOsv(ids: string[]): Promise<Map<string, { aviso: AvisoNormalizado; bruto: unknown }>> {
    const saida = new Map<string, { aviso: AvisoNormalizado; bruto: unknown }>();
    let erros = 0;
    for (let i = 0; i < ids.length; i += PARALELO_OSV) {
      const lote = ids.slice(i, i + PARALELO_OSV);
      const r = await Promise.allSettled(lote.map((id) => this.fontes.osvAviso(id)));
      r.forEach((x, j) => {
        if (x.status === "fulfilled" && x.value) saida.set(lote[j]!, x.value);
        else if (x.status === "rejected") erros++;
      });
    }
    // Se TODOS falharam, a fonte está fora: a execução precisa saber (PARTIAL), não fingir "0 avisos".
    if (ids.length > 0 && erros === ids.length) throw new FonteIndisponivel("OSV", "nenhum aviso pôde ser lido");
    return saida;
  }

  /**
   * Cria o casamento de cada tecnologia do grupo com cada aviso. "Pré-existente"
   * (D19.7) = publicado antes de a tecnologia entrar no inventário; sem data de
   * publicação também conta como pré-existente (na dúvida, não notifica).
   */
  private async casar(grupo: TechAsset[], avisos: AvisoNormalizado[], corrigida: (a: AvisoNormalizado) => string | null): Promise<number> {
    if (avisos.length === 0) return 0;
    const kevAgora = new Map((await this.repository.avisosPorIds(avisos.map((a) => a.id))).map((a) => [a.id, a.kev]));
    const agora = this.agora();
    const novos: NovoCasamento[] = [];
    for (const ativo of grupo) {
      const confirmado = ativo.confirmedAt ?? ativo.createdAt;
      for (const a of avisos) {
        const fixed = corrigida(a);
        novos.push({
          companyId: ativo.companyId,
          assetId: ativo.id,
          advisoryId: a.id,
          versionConfirmed: Boolean(normalizarVersao(ativo.version)),
          preexisting: !a.publishedAt || a.publishedAt < confirmado,
          fixedVersion: fixed,
          // Já KEV quando o casamento nasce: o fato entra na notificação da própria CVE (ou não, se
          // pré-existente). O evento "entrou no KEV" fica para quem virar KEV depois.
          kevNotifiedAt: kevAgora.get(a.id) ? agora : null,
        });
      }
    }
    const criados = await this.repository.criarCasamentos(novos);
    // Versão corrigida pode aparecer depois (o NVD analisa dias após publicar).
    for (const n of novos) await this.repository.atualizarVersaoCorrigida(n.assetId, n.advisoryId, n.fixedVersion);
    return criados;
  }

  /**
   * Decide e grava as notificações (D19.6): por empresa, até 3 individuais;
   * acima disso, um resumo só — um SBOM de 400 pacotes não pode virar 90
   * linhas no sino de cada pessoa. Devolve quantas linhas foram criadas.
   */
  async notificar(): Promise<number> {
    const agora = this.agora();
    const candidatos = await this.repository.candidatosANotificar();
    const kevTratarSemAviso: string[] = [];
    const tratadosSemAviso: string[] = [];
    const eventos: EventoCandidato[] = [];

    for (const c of candidatos) {
      const confirmado = c.asset.confirmedAt ?? c.asset.createdAt;
      const kevPendente = c.advisory.kev && !c.kevNotifiedAt;
      const kevNovo = kevPendente && Boolean(c.advisory.kevAddedAt && c.advisory.kevAddedAt >= confirmado);
      if (kevPendente && !kevNovo) kevTratarSemAviso.push(c.id);
      // CVE nova sem nota: espera o NVD analisar; com nota < 7 (e sem KEV), está tratada.
      if (!c.notifiedAt && !c.preexisting && !c.advisory.kev && c.advisory.cvssScore !== null && c.advisory.cvssScore < 7) tratadosSemAviso.push(c.id);
      eventos.push({
        matchId: c.id,
        companyId: c.companyId,
        advisoryId: c.advisoryId,
        titulo: c.advisory.title,
        ativo: c.asset.displayName,
        cvssScore: c.advisory.cvssScore,
        kev: c.advisory.kev,
        preexisting: c.preexisting,
        kevNovo,
        jaNotificada: Boolean(c.notifiedAt),
        versionConfirmed: c.versionConfirmed,
      });
    }

    const notificar = eventosQueNotificam(eventos);
    const porEmpresa = new Map<string, EventoCandidato[]>();
    for (const e of notificar) porEmpresa.set(e.companyId, [...(porEmpresa.get(e.companyId) ?? []), e]);

    let criadas = 0;
    for (const [companyId, lista] of porEmpresa) {
      const destinatarios = await this.repository.destinatarios(companyId);
      const mensagens = montarMensagens(companyId, lista);
      const linhas: NovaNotificacao[] = destinatarios.flatMap((userId) => mensagens.map((m) => ({ userId, ...m })));
      criadas += await this.notificacoes.criarVarias(linhas);
    }

    await this.repository.marcarNotificados([...notificar.filter((e) => !e.kevNovo || !e.jaNotificada).map((e) => e.matchId), ...tratadosSemAviso], agora);
    await this.repository.marcarKevTratado([...notificar.filter((e) => e.kevNovo || e.kev).map((e) => e.matchId), ...kevTratarSemAviso], agora);
    return criadas;
  }
}

/** Agrupa tecnologias iguais de empresas diferentes: a fonte é consultada uma vez por grupo. */
function agrupar(ativos: TechAsset[]): Map<string, TechAsset[]> {
  const grupos = new Map<string, TechAsset[]>();
  for (const a of ativos) {
    const chave = chaveDeIdentidade(a);
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }
  return grupos;
}

/**
 * Desde quando consultar o NVD por mudanças: a sincronização mais antiga do
 * grupo. Uma tecnologia nunca sincronizada (recém-confirmada) força a consulta
 * completa — é o backfill.
 */
function menorSincronizacao(grupo: TechAsset[]): Date | null {
  if (grupo.some((g) => !g.lastSyncedAt)) return null;
  return new Date(Math.min(...grupo.map((g) => g.lastSyncedAt!.getTime())));
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : "erro desconhecido";
}

function falha(e: unknown): ResultadoFonte {
  if (!(e instanceof FonteIndisponivel)) console.error("Threat Intel: falha inesperada numa fonte", e);
  return { ok: false, itens: 0, erro: mensagem(e) };
}

const nota = (n: number | null) => (n === null ? "sem nota ainda" : `CVSS ${n.toFixed(1)}`);

/** Texto das notificações de uma empresa numa execução. Link para a aba "Afeta você" já na empresa certa. */
export function montarMensagens(companyId: string, eventos: EventoCandidato[]): Omit<NovaNotificacao, "userId">[] {
  const base = `/threat-intel?empresa=${encodeURIComponent(companyId)}&aba=afeta`;
  if (eventos.length > MAX_NOTIFICACOES_INDIVIDUAIS) {
    const kev = eventos.filter((e) => e.kev).length;
    return [
      {
        category: "THREAT_DIGEST",
        title: `${eventos.length} CVEs novas afetam o inventário`,
        message: `${eventos.length} CVEs publicadas ou exploradas depois do mapeamento afetam tecnologias da empresa${kev ? `, ${kev} delas exploradas ativamente (CISA KEV)` : ""}.`,
        link: base,
      },
    ];
  }
  return eventos.map((e) => ({
    category: e.kevNovo ? "THREAT_KEV" : "THREAT_MATCH",
    title: (e.kevNovo ? `${e.advisoryId} está sendo explorada ativamente` : `${e.advisoryId} afeta ${e.ativo}`).slice(0, 255),
    message: [
      e.kevNovo ? `A CVE entrou no catálogo KEV da CISA e afeta ${e.ativo}.` : `${e.titulo ?? "Nova vulnerabilidade publicada"}.`,
      `${nota(e.cvssScore)}${e.kev ? " · explorada ativamente (KEV)" : ""}${e.versionConfirmed ? "" : " · versão não confirmada no inventário"}.`,
    ].join(" "),
    link: `${base}&match=${encodeURIComponent(e.matchId)}`,
  }));
}
