/**
 * graph-comment.service.ts
 *
 * O QUE FAZ
 * Comentários fixados em nós de grafo (ADR-061): listar os de um grafo, criar
 * (notificando quem já comentou no mesmo nó) e apagar.
 *
 * ESCOPO E ACESSO — a regra de cada grafo, sem regra nova
 *   EXPOSURE   o grafo da company do ator: scopeId = companyId lido do
 *              BANCO (nunca do body). Todos os papéis da company comentam
 *              (D22.9 — "todos").
 *   DAST_SCAN  o grafo de um scan: o acesso é exatamente o de ver o scan
 *              (`DastScanService.getById`: o ADMIN e quem pediu o scan — o
 *              módulo DAST é só PENTESTER/ADMIN). Sem acesso ao scan, sem
 *              comentário — nem leitura.
 * Apagar exige acesso ao grafo E ser o autor (ou ADMIN).
 *
 * NOTIFICAÇÃO
 * Sem menção por enquanto (D22.9). Um comentário novo avisa, pelo sino, quem já
 * comentou naquele nó — menos o próprio autor. Quem perdeu o acesso ao grafo
 * depois de comentar ainda recebe o aviso, mas o link não abre nada para ele:
 * o acesso é conferido de novo ao abrir.
 *
 * QUEM USA
 * `graph-comment.controller.ts`, via `graph-comment.factory.ts`.
 */

import type { UserRole } from "../models/user.model";
import type { ComentarioBruto, GraphCommentRepository } from "../repositories/graph-comment.repository";
import type { NotificationRepository } from "../repositories/notification.repository";
import type { UserRepository } from "../repositories/user.repository";
import {
  GRAFOS_COMENTAVEIS,
  linkDoComentario,
  validarNovoComentario,
  type ComentarioDoGrafoDTO,
  type GrafoComentavel,
} from "../models/graph-comment.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/** O pedaço do serviço de DAST que importa aqui: ver o scan, com a regra dele. */
export interface AcessoAoScan {
  getById(actor: Actor, id: string): Promise<{ id: string; toResponse(): { companyId: string | null } }>;
}

interface EscopoResolvido {
  grafo: GrafoComentavel;
  scopeId: string;
  companyId: string | null;
}

export class GraphCommentService {
  constructor(
    private readonly repository: GraphCommentRepository,
    private readonly userRepository: UserRepository,
    private readonly scans: AcessoAoScan,
    private readonly notifications: NotificationRepository,
  ) {}

  private async resolverEscopo(actor: Actor, grafo: unknown, escopo: unknown): Promise<EscopoResolvido> {
    if (typeof grafo !== "string" || !(GRAFOS_COMENTAVEIS as readonly string[]).includes(grafo)) throw new Error("INVALID_GRAPH_KIND");

    if (grafo === "EXPOSURE") {
      const user = await this.userRepository.findById(actor.userId);
      if (!user?.companyId) throw new Error("COMPANY_NOT_FOUND");
      return { grafo, scopeId: user.companyId, companyId: user.companyId };
    }

    // DAST_SCAN: o módulo é só de PENTESTER/ADMIN; o resto da regra é a do scan.
    if (actor.role !== "PENTESTER" && actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    if (typeof escopo !== "string" || !escopo.trim()) throw new Error("MISSING_SCOPE");
    const scan = await this.scans.getById(actor, escopo.trim());
    return { grafo: "DAST_SCAN", scopeId: scan.id, companyId: scan.toResponse().companyId };
  }

  private paraDTO(actor: Actor, c: ComentarioBruto): ComentarioDoGrafoDTO {
    return {
      id: c.id,
      nodeId: c.nodeId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      autor: { id: c.author.id, name: c.author.name },
      podeApagar: c.authorId === actor.userId || actor.role === "ADMIN",
    };
  }

  async listar(actor: Actor, grafo: unknown, escopo: unknown): Promise<ComentarioDoGrafoDTO[]> {
    const alvo = await this.resolverEscopo(actor, grafo, escopo);
    const comentarios = await this.repository.listarDoEscopo(alvo.grafo, alvo.scopeId);
    return comentarios.map((c) => this.paraDTO(actor, c));
  }

  async criar(actor: Actor, corpo: unknown): Promise<ComentarioDoGrafoDTO> {
    const entrada = validarNovoComentario(corpo);
    const alvo = await this.resolverEscopo(actor, entrada.grafo, entrada.escopo);

    // Participantes ANTES de criar: o autor novo não se notifica.
    const participantes = await this.repository.participantes(alvo.grafo, alvo.scopeId, entrada.noId);
    const criado = await this.repository.criar({
      graphKind: alvo.grafo,
      scopeId: alvo.scopeId,
      companyId: alvo.companyId,
      nodeId: entrada.noId,
      authorId: actor.userId,
      body: entrada.texto,
    });

    const destinatarios = participantes.filter((id) => id !== actor.userId);
    if (destinatarios.length > 0) {
      const onde = entrada.rotulo ? `em "${entrada.rotulo}"` : "num nó que você comentou";
      const grafoNome = alvo.grafo === "EXPOSURE" ? "Exposure Graph" : "grafo do scan DAST";
      // Notificação é efeito colateral: falhar aqui não desfaz o comentário salvo.
      await this.notifications
        .criarVarias(destinatarios.map((userId) => ({
          userId,
          category: "COMMENT",
          title: `Novo comentário no ${grafoNome}`,
          message: `${criado.author.name} comentou ${onde}.`,
          link: linkDoComentario(alvo.grafo, alvo.scopeId, entrada.noId),
        })))
        .catch((erro: unknown) => console.error("GraphCommentService.criar: notificação falhou", erro));
    }

    return this.paraDTO(actor, criado);
  }

  async apagar(actor: Actor, id: string): Promise<void> {
    const comentario = await this.repository.buscar(id);
    if (!comentario) throw new Error("COMMENT_NOT_FOUND");
    // Mesmo acesso de quem lê o grafo. Um comentário de outra company responde
    // NOT_FOUND, não FORBIDDEN: não confirma que o id existe.
    const alvo = await this.resolverEscopo(actor, comentario.graphKind, comentario.scopeId).catch(() => null);
    if (!alvo || alvo.scopeId !== comentario.scopeId) throw new Error("COMMENT_NOT_FOUND");
    if (comentario.authorId !== actor.userId && actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    await this.repository.apagar(id);
  }
}
