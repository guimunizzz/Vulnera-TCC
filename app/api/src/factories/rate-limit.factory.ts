/**
 * rate-limit.factory.ts
 *
 * FACTORY METHOD da infraestrutura de rate limit. Centraliza a única leitura
 * de Company necessária ao bucket e mantém Prisma restrito ao repository.
 * Consumido por app.ts e por testes que montam um app com config própria.
 */

import { prisma } from "../database/prisma.database";
import { loadRateLimitConfig, type RateLimitConfig } from "../config/rate-limit.config";
import { UserRepository } from "../repositories/user.repository";
import { RateLimitService, TenantRateLimitResolver } from "../services/rate-limit.service";

export function makeRateLimitService(config: RateLimitConfig = loadRateLimitConfig()): RateLimitService {
  const users = new UserRepository(prisma);
  const tenantResolver = new TenantRateLimitResolver(
    users,
    config.tenantCacheTtlMs,
    config.tenantCacheMaxKeys,
  );
  return new RateLimitService(config, tenantResolver);
}
