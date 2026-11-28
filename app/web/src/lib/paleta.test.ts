/**
 * paleta.test.ts — busca da paleta de comandos (ADR-062).
 *   PAL-01  normaliza acento e caixa
 *   PAL-02  pontuação: começo > começo de palavra > contém > palavras-chave
 *   PAL-03  filtro mantém a ordem dos grupos e limita por grupo
 */

import { describe, expect, it } from "vitest";
import { filtrarComandos, normalizar, pontuar, type Comando } from "./paleta";

const cmd = (id: string, grupo: string, rotulo: string, palavrasChave?: string[]): Comando => ({ id, grupo, rotulo, palavrasChave, executar: () => undefined });

describe("paleta de comandos", () => {
  it("PAL-01 — normaliza", () => {
    expect(normalizar("  Remediação ")).toBe("remediacao");
  });

  it("PAL-02 — pontua", () => {
    expect(pontuar({ rotulo: "Remediação" }, "reme")).toBe(100);
    expect(pontuar({ rotulo: "Políticas de SLA" }, "sla")).toBe(70);
    expect(pontuar({ rotulo: "Exposure Graph" }, "sure")).toBe(40);
    expect(pontuar({ rotulo: "Tema escuro", palavrasChave: ["dark"] }, "dark")).toBe(20);
    expect(pontuar({ rotulo: "Dashboard" }, "xyz")).toBe(0);
    expect(pontuar({ rotulo: "Qualquer" }, "")).toBe(1);
  });

  it("PAL-03 — filtra por grupo, na ordem dos grupos", () => {
    const comandos = [
      cmd("n1", "Ir para", "Findings"),
      cmd("n2", "Ir para", "Remediação"),
      cmd("a1", "Ações", "Tema escuro", ["dark"]),
      cmd("v1", "Vulnerabilidades", "SQL Injection em /login"),
      cmd("n3", "Ir para", "Exposure Graph"),
    ];
    expect(filtrarComandos(comandos, "").map((c) => c.id)).toEqual(["n1", "n2", "n3", "a1", "v1"]);
    // "Findings" não tem "e": fica de fora. Exposure (começa) > Remediação (contém).
    expect(filtrarComandos(comandos, "e").map((c) => c.id)).toEqual(["n3", "n2", "a1", "v1"]);
    expect(filtrarComandos(comandos, "", 1).map((c) => c.id)).toEqual(["n1", "a1", "v1"]);
  });
});
