import * as dotenv from "dotenv";
import { EnvKeys } from "./enum/EnvKeys";

// `import "dotenv/config"` não aceita opções, e o dotenv 17.x imprime um
// banner promocional a cada carga. Carregamos explicitamente com quiet: true
// pra manter a saída de `npm run dev` e `npm test` limpa.
dotenv.config({ quiet: true });

export class EnvVar {
  static get(key: EnvKeys): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing environment variable: ${key}`);
    return value;
  }

  static getOptional(key: EnvKeys, defaultValue: string): string {
    return process.env[key] ?? defaultValue;
  }

  static getNumber(key: EnvKeys): number {
    const value = EnvVar.get(key);
    const num = Number(value);
    if (Number.isNaN(num)) throw new Error(`Env ${key} is not a number`);
    return num;
  }
}
