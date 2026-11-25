/**
 * Primitive de lock para operações que mudam vínculos de uma empresa.
 * A linha Company é bloqueada antes dos usuários e convites ligados a ela.
 */
import { Prisma } from "@prisma/client";
import type { AccessDatabaseClient } from "./access-transaction.repository";

export class TenantLockRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  async lockCompany(companyId: string): Promise<{ id: string } | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("TENANT_LOCK_REQUIRES_TRANSACTION");
    }
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Company WHERE id = ${companyId} FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  async lockUsers(userIds: string[]): Promise<Array<{ id: string }>> {
    if ("$transaction" in this.prisma) {
      throw new Error("TENANT_LOCK_REQUIRES_TRANSACTION");
    }
    const ids = [...new Set(userIds)].sort();
    if (ids.length === 0) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM \`User\` WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
    `;
    return rows;
  }
}
