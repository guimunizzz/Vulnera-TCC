/**
 * saved-query.service.ts
 *
 * Regras das buscas salvas / watchlists (CP-6).
 *
 * ==========================================================================
 * AS TRÊS REGRAS QUE DEFINEM A FEATURE (docs/DECISIONS.md D6)
 * ==========================================================================
 * 1. GUARDA-SE A PERGUNTA, NUNCA A RESPOSTA. Nenhum método aqui toca em
 *    Vulnerability. A busca é reexecutada pelo `VulnerabilityService` com o
 *    escopo de QUEM ABRE — é isso que faz a watchlist de uma empresa devolver
 *    coisas diferentes para pessoas com acessos diferentes, corretamente.
 *
 * 2. PENTESTER SÓ TEM BUSCA PRIVADA. Ele atravessa empresas (é membro de
 *    projetos, não de uma companhia), então "compartilhar com a empresa" não
 *    tem destinatário definido: compartilhar com qual? A alternativa — deixar
 *    criar COMPANY na empresa do projeto — publicaria, para o cliente, o
 *    vocabulário interno de quem testa.
 *
 * 3. O ESCOPO É DECIDIDO AQUI, NUNCA RECEBIDO PRONTO. `companyId` vem do
 *    banco, do usuário autenticado. Aceitá-lo do corpo deixaria qualquer um
 *    publicar uma watchlist dentro de outra empresa.
 *
 * ⚠️ A QUERY SALVA NÃO É UM PASSE DE ACESSO. Uma busca COMPANY pode conter
 * `companyId=<outra empresa>`; quem executa continua sendo barrado pelo
 * recorte da listagem. A busca é uma pergunta, e perguntar não dá acesso.
 */

import type {
  SavedQueryRepository,
  ListSavedQueriesFilter,
  UpdateSavedQueryData,
} from "../repositories/saved-query.repository";
import type { UserRepository } from "../repositories/user.repository";
import {
  SAVED_QUERY_LIMITS,
  SavedQueryEntity,
  type CreateSavedQueryDTO,
  type SavedQuery,
  type SavedQueryScope,
  type UpdateSavedQueryDTO,
} from "../models/saved-query.model";
import { canonicalizarQuery } from "../utils/saved-query.util";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

interface EscopoDoAtor {
  companyId: string | null;
  todasAsEmpresas: boolean;
}

export interface ResultadoCriacao {
  saved: ReturnType<SavedQueryEntity["toResponse"]>;
  /** Parâmetros descartados na canonização — a tela avisa quem salvou. */
  descartados: Array<{ param: string; motivo: string }>;
}

export class SavedQueryService {
  constructor(
    private readonly repository: SavedQueryRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async list(actor: Actor, opcoes: { apenasFixadas?: boolean } = {}) {
    const escopo = await this.resolverEscopo(actor);
    const filtro: ListSavedQueriesFilter = {
      actorId: actor.userId,
      companyId: escopo.companyId,
      todasAsEmpresas: escopo.todasAsEmpresas,
      apenasFixadas: opcoes.apenasFixadas,
    };
    const registros = await this.repository.list(filtro);
    return registros.map((r) => new SavedQueryEntity(r).toResponse(actor.userId));
  }

  async getById(actor: Actor, id: string) {
    const saved = await this.buscarVisivel(actor, id);
    return new SavedQueryEntity(saved).toResponse(actor.userId);
  }

  async create(actor: Actor, dto: CreateSavedQueryDTO): Promise<ResultadoCriacao> {
    const escopo = await this.resolverEscopo(actor);
    const nome = this.validarNome(dto.name);
    const descricao = this.validarDescricao(dto.description);
    const { queryString, descartados } = canonicalizarQuery(dto.queryString);
    const scope = this.resolverScope(actor, escopo, dto.scope);

    if ((await this.repository.countByOwner(actor.userId)) >= SAVED_QUERY_LIMITS.maxPorUsuario) {
      throw new Error("SAVED_QUERY_LIMIT_REACHED");
    }

    // Mesma pergunta, salva duas vezes, é ruído na barra lateral. A comparação
    // é sobre a forma CANÔNICA — por isso a ordem dos filtros não engana.
    const pinned = dto.pinned === true;
    if (pinned) await this.assertPodeFixar(actor.userId);

    const resultado = await this.criarTratandoNomeDuplicado({
      name: nome,
      description: descricao,
      queryString,
      scope,
      ownerId: actor.userId,
      // COMPANY sem empresa não existe (resolverScope garante), e PRIVATE
      // guarda a empresa mesmo assim: é o que permite limpar tudo junto se a
      // empresa for removida.
      companyId: escopo.companyId,
      pinned,
    });
    if (resultado.kind === "QUERY_DUPLICATE") throw new Error("SAVED_QUERY_ALREADY_EXISTS");
    if (resultado.kind === "LIMIT_REACHED") throw new Error("SAVED_QUERY_LIMIT_REACHED");
    if (resultado.kind === "PINNED_LIMIT_REACHED") throw new Error("PINNED_LIMIT_REACHED");

    return { saved: new SavedQueryEntity(resultado.saved).toResponse(actor.userId), descartados };
  }

  async update(actor: Actor, id: string, dto: UpdateSavedQueryDTO): Promise<ResultadoCriacao> {
    const existente = await this.buscarVisivel(actor, id);
    // Ver é uma coisa; editar é outra. Uma watchlist COMPANY é visível para o
    // time inteiro e editável só por quem a criou (e por ADMIN).
    if (existente.ownerId !== actor.userId && actor.role !== "ADMIN") throw new Error("FORBIDDEN");

    const escopo = await this.resolverEscopo(actor);
    const dados: UpdateSavedQueryData = {};
    let descartados: ResultadoCriacao["descartados"] = [];

    if (dto.name !== undefined) dados.name = this.validarNome(dto.name);
    if (dto.description !== undefined) dados.description = this.validarDescricao(dto.description);
    if (dto.queryString !== undefined) {
      const r = canonicalizarQuery(dto.queryString);
      dados.queryString = r.queryString;
      descartados = r.descartados;
    }
    if (dto.scope !== undefined) {
      const dono = existente.ownerId === actor.userId ? escopo : await this.escopoDoDono(existente.ownerId);
      dados.scope = this.resolverScope(actor, dono, dto.scope, existente.ownerId);
    }
    if (dto.pinned !== undefined) {
      if (dto.pinned && !existente.pinned) await this.assertPodeFixar(existente.ownerId);
      dados.pinned = dto.pinned;
    }

    const atualizado = await this.atualizarTratandoNomeDuplicado(existente.ownerId, id, dados);
    return { saved: new SavedQueryEntity(atualizado).toResponse(actor.userId), descartados };
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const existente = await this.buscarVisivel(actor, id);
    if (existente.ownerId !== actor.userId && actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    await this.repository.delete(id);
  }

  /* ======================================================================
     Regras auxiliares
     ====================================================================== */

  private validarNome(bruto: unknown): string {
    const nome = typeof bruto === "string" ? bruto.trim() : "";
    if (!nome || nome.length > SAVED_QUERY_LIMITS.name) throw new Error("INVALID_NAME");
    return nome;
  }

  private validarDescricao(bruto: unknown): string | null {
    if (bruto == null) return null;
    if (typeof bruto !== "string") throw new Error("INVALID_DESCRIPTION");
    const d = bruto.trim();
    if (d.length > SAVED_QUERY_LIMITS.description) throw new Error("INVALID_DESCRIPTION");
    return d || null;
  }

  /**
   * O escopo final. PENTESTER é sempre PRIVATE (regra 2 do topo), e COMPANY
   * exige uma empresa de verdade — sem ela, "compartilhar com a empresa"
   * criaria um registro que ninguém veria.
   */
  private resolverScope(
    actor: Actor,
    escopoDoDono: EscopoDoAtor,
    pedido: SavedQueryScope | undefined,
    ownerId = actor.userId,
  ): SavedQueryScope {
    if (!pedido || pedido === "PRIVATE") return "PRIVATE";
    if (pedido !== "COMPANY") throw new Error("INVALID_SCOPE");

    // O papel de QUEM É DONO da busca é o que importa, não o de quem edita.
    const papelDoDono = ownerId === actor.userId ? actor.role : null;
    if (papelDoDono === "PENTESTER") throw new Error("PENTESTER_CANNOT_SHARE_QUERY");
    if (!escopoDoDono.companyId) throw new Error("USER_HAS_NO_COMPANY");
    return "COMPANY";
  }

  private async assertPodeFixar(ownerId: string): Promise<void> {
    const fixadas = await this.repository.countPinnedByOwner(ownerId);
    if (fixadas >= SAVED_QUERY_LIMITS.maxPinned) throw new Error("PINNED_LIMIT_REACHED");
  }

  /** Visível = própria, ou COMPANY da empresa do ator (ADMIN vê as COMPANY todas). */
  private async buscarVisivel(actor: Actor, id: string): Promise<SavedQuery> {
    const saved = await this.repository.findById(id);
    if (!saved) throw new Error("SAVED_QUERY_NOT_FOUND");
    if (saved.ownerId === actor.userId) return saved;
    if (saved.scope === "COMPANY") {
      if (actor.role === "ADMIN") return saved;
      const escopo = await this.resolverEscopo(actor);
      if (escopo.companyId && escopo.companyId === saved.companyId) return saved;
    }
    // 404, não 403: dizer "existe, mas não é sua" já entrega que existe.
    throw new Error("SAVED_QUERY_NOT_FOUND");
  }

  private async resolverEscopo(actor: Actor): Promise<EscopoDoAtor> {
    const user = await this.userRepository.findById(actor.userId);
    return { companyId: user?.companyId ?? null, todasAsEmpresas: actor.role === "ADMIN" };
  }

  private async escopoDoDono(ownerId: string): Promise<EscopoDoAtor> {
    const user = await this.userRepository.findById(ownerId);
    return { companyId: user?.companyId ?? null, todasAsEmpresas: false };
  }

  /**
   * O unique `[ownerId, name]` é a regra; traduzi-lo aqui evita que um nome
   * repetido chegue à tela como 500 do Prisma.
   */
  private async criarTratandoNomeDuplicado(data: Parameters<SavedQueryRepository["createSerialized"]>[0]) {
    try {
      return await this.repository.createSerialized(data, {
        maxPorUsuario: SAVED_QUERY_LIMITS.maxPorUsuario,
        maxPinned: SAVED_QUERY_LIMITS.maxPinned,
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new Error("SAVED_QUERY_NAME_TAKEN");
      throw e;
    }
  }

  private async atualizarTratandoNomeDuplicado(ownerId: string, id: string, dados: UpdateSavedQueryData) {
    try {
      const atualizado = await this.repository.updateSerialized(id, ownerId, dados);
      if (!atualizado) throw new Error("SAVED_QUERY_ALREADY_EXISTS");
      return atualizado;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new Error("SAVED_QUERY_NAME_TAKEN");
      throw e;
    }
  }
}
