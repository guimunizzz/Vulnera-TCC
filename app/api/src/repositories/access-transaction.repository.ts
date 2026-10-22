/**
 * Infraestrutura transacional do domínio de acesso, restrita aos repositories.
 * Serializa escritas pelo pedido antes de tocar seus tokens, evitando ordens de
 * lock incompatíveis e snapshots antigos durante rotação, consumo e encerramento.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AccessRequest } from "../models/access-request.model";

export type AccessDatabaseClient = PrismaClient | Prisma.TransactionClient;

export function inAccessTransaction<T>(client: AccessDatabaseClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in client ? client.$transaction(operation) : operation(client);
}

export async function lockAccessRequest(tx: Prisma.TransactionClient, id: string): Promise<AccessRequest | null> {
  const rows = await tx.$queryRaw<AccessRequest[]>`SELECT * FROM AccessRequest WHERE id = ${id} FOR UPDATE`;
  return rows[0] ?? null;
}
