/**
 * hash.util.ts
 *
 * Wrappers simples sobre bcrypt para hash e comparação de senhas.
 *
 * Por que existe:
 * - Centraliza o cost em um único lugar (lido de env: 12 em prod, 4 em testes)
 * - Esconde detalhes da lib (se trocarmos bcrypt por argon2 no futuro,
 *   só este arquivo muda)
 *
 * Quem usa:
 * - AuthService.register (faz hash da senha antes de salvar)
 * - AuthService.login (compara senha enviada com hash do banco)
 */

import bcrypt from "bcrypt";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";

/** Faz hash da senha. Cost lido do env (12 em prod, 4 em teste). */
export async function hashPassword(plain: string): Promise<string> {
  const cost = Number(EnvVar.getOptional(EnvKeys.BCRYPT_COST, "12"));
  return bcrypt.hash(plain, cost);
}

/** Compara senha em claro com hash do banco. Retorna true se confere. */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
