/**
 * sla-monitor.service.ts
 *
 * O QUE FAZ
 * Uma execução do monitor de SLA (ADR-056 / FILA-FUT-02): avisa quem precisa
 * saber que uma vulnerabilidade está perto do prazo ou já venceu.
 *
 *   1. Acha as vulnerabilidades com o relógio correndo (OPEN/IN_PROGRESS), prazo
 *      até 3 dias à frente ou já passado, e sem aceite de risco vigente;
 *   2. Para cada uma, os destinatários (ADMIN, CLIENT da empresa, PENTESTER membro do
 *      projeto) recebem o aviso de "vence em breve" ou de "vencida";
 *   3. Por pessoa: o que já foi avisado (mesma categoria + mesmo link) sai da lista;
 *      se sobrarem mais de 3, sai UMA notificação de resumo; senão, um aviso por achado.
 *
 * DEDUPLICAÇÃO
 * Cada aviso individual é único por (pessoa, categoria, achado): rodar de novo não
 * duplica. O resumo é identificado pelo CONJUNTO de avisos pendentes (chave no `lote`
 * do link). Isso NÃO é exato por vulnerabilidade: um achado coberto por um resumo não
 * ganha marca própria, então, se o conjunto mudar, ele pode reaparecer num resumo
 * novo. Deduplicação exata exigiria estado por vulnerabilidade (migration), e esta
 * entrega não criou migration: ver o relatório da branch.
 *
 * O "agora" entra por parâmetro, então os testes controlam o relógio.
 *
 * QUEM DISPARA
 * Só o worker da fila `sla-monitor` (motor bullmq, job scheduler diário às 08:00).
 * Com o motor memory não existe agendamento: ver `server.ts`.
 */

import type { NovaNotificacao, NotificationRepository } from "../repositories/notification.repository";
import type { SlaMonitorRepository, VulnerabilidadeComPrazo } from "../repositories/sla-monitor.repository";
import { DIA_MS } from "../utils/sla.util";
import {
  CATEGORIA_SLA,
  JANELA_AVISO_DIAS,
  MAX_AVISOS_INDIVIDUAIS_SLA,
  chaveDoLote,
  classificarPrazo,
  linkDoAchado,
  linkDoResumo,
  textoAvisoIndividual,
  textoResumo,
  type TipoAvisoSla,
} from "../utils/sla-monitor.util";

export interface ResumoSlaMonitor {
  /** Vulnerabilidades com prazo na janela ou vencidas, com o relógio correndo. */
  candidatas: number;
  /** Avisos individuais gravados nesta execução. */
  individuais: number;
  /** Resumos gravados nesta execução (no máximo um por pessoa). */
  resumos: number;
}

/** Um aviso que uma pessoa deveria receber, antes de descontar o que já foi enviado. */
interface AvisoPendente {
  vulnerabilidade: VulnerabilidadeComPrazo;
  tipo: TipoAvisoSla;
  categoria: string;
  link: string;
}

const CATEGORIAS_DE_AVISO = [CATEGORIA_SLA.VENCE_EM_BREVE, CATEGORIA_SLA.VENCIDA] as const;

export class SlaMonitorService {
  constructor(
    private readonly repository: SlaMonitorRepository,
    private readonly notificacoes: NotificationRepository,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async executar(): Promise<ResumoSlaMonitor> {
    const agora = this.agora();
    const limite = new Date(agora.getTime() + JANELA_AVISO_DIAS * DIA_MS);
    const candidatas = await this.repository.vulnerabilidadesComPrazoAte(agora, limite);

    // Destinatários são iguais para todo achado do mesmo projeto: consulta uma vez por par.
    const destinatariosPorProjeto = new Map<string, string[]>();
    const avisosPorPessoa = new Map<string, AvisoPendente[]>();

    for (const vulnerabilidade of candidatas) {
      const tipo = classificarPrazo(vulnerabilidade.slaDueAt, agora);
      if (!tipo) continue;
      const chaveProjeto = `${vulnerabilidade.companyId}|${vulnerabilidade.projectId}`;
      let destinatarios = destinatariosPorProjeto.get(chaveProjeto);
      if (!destinatarios) {
        destinatarios = await this.repository.destinatariosDoAchado(vulnerabilidade.companyId, vulnerabilidade.projectId);
        destinatariosPorProjeto.set(chaveProjeto, destinatarios);
      }
      const aviso: Omit<AvisoPendente, "categoria"> = { vulnerabilidade, tipo, link: linkDoAchado(vulnerabilidade.id) };
      const categoria = tipo === "VENCIDA" ? CATEGORIA_SLA.VENCIDA : CATEGORIA_SLA.VENCE_EM_BREVE;
      for (const userId of destinatarios) {
        avisosPorPessoa.set(userId, [...(avisosPorPessoa.get(userId) ?? []), { ...aviso, categoria }]);
      }
    }

    const linhas: NovaNotificacao[] = [];
    let individuais = 0;
    let resumos = 0;

    for (const [userId, avisos] of avisosPorPessoa) {
      // Desconta o que esta pessoa já recebeu (categoria + link).
      const enviados = await this.notificacoes.jaEnviadas(userId, [...CATEGORIAS_DE_AVISO], avisos.map((a) => a.link));
      const jaEnviado = new Set(enviados.map((n) => `${n.category}|${n.link}`));
      // `candidatas` já vem por prazo crescente, então a lista continua nessa ordem.
      const pendentes = avisos.filter((a) => !jaEnviado.has(`${a.categoria}|${a.link}`));
      if (pendentes.length === 0) continue;

      if (pendentes.length > MAX_AVISOS_INDIVIDUAIS_SLA) {
        const maisUrgente = pendentes[0];
        if (!maisUrgente) continue;
        const lote = chaveDoLote(pendentes.map((a) => `${a.categoria}|${a.link}`));
        const linkResumo = linkDoResumo(maisUrgente.vulnerabilidade.id, lote);
        const resumoJaEnviado = await this.notificacoes.jaEnviadas(userId, [CATEGORIA_SLA.RESUMO], [linkResumo]);
        if (resumoJaEnviado.length > 0) continue;
        const vencidas = pendentes.filter((a) => a.tipo === "VENCIDA").length;
        linhas.push({ userId, category: CATEGORIA_SLA.RESUMO, ...textoResumo(vencidas, pendentes.length - vencidas), link: linkResumo });
        resumos++;
        continue;
      }

      for (const a of pendentes) {
        linhas.push({ userId, category: a.categoria, ...textoAvisoIndividual(a.tipo, a.vulnerabilidade, agora), link: a.link });
        individuais++;
      }
    }

    await this.notificacoes.criarVarias(linhas);
    return { candidatas: candidatas.length, individuais, resumos };
  }
}
