/**
 * findings-export.service.ts
 *
 * Exportação Excel dos findings — a página `/findings` e a aba Findings do
 * projeto. Orquestra: RBAC e recorte (via `VulnerabilityService`, a MESMA
 * fonte da listagem), limite, geração do .xlsx, auditoria.
 *
 * ==========================================================================
 * DUAS FASES, DE PROPÓSITO
 * ==========================================================================
 * `preparar` resolve escopo, conta e confere o limite SEM ler uma linha — uma
 * falha aqui (403, 404, 422) vira status HTTP honesto. `gerar` só roda depois.
 * E como o arquivo é montado INTEIRO num temporário antes do primeiro byte ir
 * ao cliente, mesmo uma falha durante a geração ainda vira status HTTP: nunca
 * existe download "200" que termina truncado.
 *
 * 🚧 PONTO DE EXTENSÃO — MODO ASSÍNCRONO (fora de escopo, só documentado)
 * Hoje a requisição espera a geração (síncrona, em streaming, limitada por
 * `EXPORT_MAX_ROWS`). Para volumes maiores, o corte natural é aqui: `preparar`
 * continuaria igual (RBAC + contagem + limite) e `gerar` — que já escreve num
 * ARQUIVO e não na resposta — passaria a rodar num job, devolvendo um id; um
 * segundo endpoint serviria o arquivo pronto. Nada em `planilha.ts` depende
 * de HTTP.
 *
 * AUDITORIA: `FINDINGS_EXPORTED` (entityType `FindingsExport`) — quem, quando,
 * filtros, quantidade. Gravada DEPOIS de o arquivo estar pronto e ANTES de ir
 * ao cliente: se a gravação falhar, nada é entregue (a exportação é leitura em
 * massa de dados; sem trilha, sem arquivo).
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import type { UserRole } from "../models/user.model";
import type { VulnerabilityQuery } from "../models/vulnerability.model";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { UserRepository } from "../repositories/user.repository";
import { descreverFiltros, descreverOrdenacao, filtroParaAuditoria, nomeDoArquivo, temFiltroAtivo } from "../utils/findings-xlsx/filtros";
import { injetarGraficos } from "../utils/findings-xlsx/injetor";
import { montarPlanilha } from "../utils/findings-xlsx/planilha";
import { ROTULO_PERFIL } from "../utils/findings-xlsx/rotulos";
import type { PreparoDeExportacao, VulnerabilityService } from "./vulnerability.service";

interface Actor {
  userId: string;
  role: UserRole;
}

/** Recorte maior que o limite configurado — 422, com os dois números para a tela explicar. */
export class ExportLimitExceededError extends Error {
  constructor(
    readonly limite: number,
    readonly total: number,
  ) {
    super("EXPORT_LIMIT_EXCEEDED");
  }
}

/** O recorte mudou entre a contagem e a leitura — refazer é barato, entregar um arquivo incoerente não é. */
export class ExportDataChangedError extends Error {
  constructor() {
    super("EXPORT_DATA_CHANGED");
  }
}

export interface ArquivoGerado {
  /** O .xlsx final. Quem consome (a resposta HTTP) deve chamar `limpar` ao terminar. */
  stream: Readable;
  nomeArquivo: string;
  linhas: number;
  /** Apaga o temporário. Idempotente. */
  limpar(): Promise<void>;
}

export class FindingsExportService {
  constructor(
    private readonly vulnerabilityService: VulnerabilityService,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly limiteDeLinhas: number,
  ) {}

  /** Fase 1 — RBAC, recorte, contagem e limite. Não lê nenhum finding. */
  async preparar(actor: Actor, query: VulnerabilityQuery): Promise<PreparoDeExportacao> {
    const preparo = await this.vulnerabilityService.prepararExportacao(actor, query);
    if (preparo.total > this.limiteDeLinhas) throw new ExportLimitExceededError(this.limiteDeLinhas, preparo.total);
    return preparo;
  }

  /** Fase 2 — gera o arquivo, audita e devolve o stream pronto para a resposta. */
  async gerar(actor: Actor, preparo: PreparoDeExportacao, sinal?: AbortSignal): Promise<ArquivoGerado> {
    const { filtro, total, projetoUnico } = preparo;
    const geradoEm = new Date();

    const usuario = await this.userRepository.findById(actor.userId);
    const rotulos = await this.vulnerabilityService.rotulosDoFiltro(filtro);

    const caminho = path.join(os.tmpdir(), `vulnera-export-${randomUUID()}.xlsx`);
    const limpar = async (): Promise<void> => {
      await fs.promises.rm(caminho, { force: true });
    };

    try {
      const saida = await montarPlanilha({
        lotes: this.vulnerabilityService.lerLotesParaExportacao(filtro),
        total,
        caminho,
        sinal,
        resumo: {
          geradoEm,
          geradoPor: usuario?.name ?? "—",
          perfil: ROTULO_PERFIL[actor.role] ?? actor.role,
          filtros: descreverFiltros(filtro, rotulos),
          ordenacao: descreverOrdenacao(filtro),
          limite: this.limiteDeLinhas,
        },
      });

      // O Resumo já foi escrito com `total`; se o recorte andou, o arquivo seria incoerente.
      if (saida.linhas !== total) throw new ExportDataChangedError();

      await this.auditLogRepository.create({
        actorId: actor.userId,
        companyId: usuario?.companyId ?? null,
        entityType: "FindingsExport",
        entityId: randomUUID(),
        action: "FINDINGS_EXPORTED",
        diffJson: JSON.stringify({
          formato: "xlsx",
          linhas: saida.linhas,
          camposTruncados: saida.camposTruncados,
          limiteDeLinhas: this.limiteDeLinhas,
          escopo: filtro.escopo.tipo,
          filtros: filtroParaAuditoria(filtro),
        }),
      });

      return {
        stream: injetarGraficos({ caminho, abaDoDashboard: saida.abaDoDashboard, graficos: saida.graficos }),
        nomeArquivo: nomeDoArquivo({ projetoUnico, filtrado: temFiltroAtivo(filtro), geradoEm }),
        linhas: saida.linhas,
        limpar,
      };
    } catch (erro) {
      await limpar();
      throw erro;
    }
  }
}
