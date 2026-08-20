import { PrismaClient } from "@prisma/client";

// Singleton — uma única instância pro processo inteiro.
// Múltiplos PrismaClient vazam conexões.
export const prisma = new PrismaClient({
  log: ["error", "warn"],
});
