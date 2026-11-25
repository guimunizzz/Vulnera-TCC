/**
 * Confirma que o ator administrativo continua válido no banco.
 * Existe para invalidar JWTs de admins removidos ou rebaixados; é consumido
 * por services e pelo middleware das operações administrativas de acesso.
 */

import type { AccessRequestAdminActor } from "../models/admin-access-request.model";
import type { UserRepository } from "../repositories/user.repository";

export class AccessRequestAdminAuthorizationService {
  constructor(private readonly users: UserRepository) {}

  async ensureAdmin(actor: AccessRequestAdminActor): Promise<void> {
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");

    const user = await this.users.findById(actor.userId);
    if (!user || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  }
}
