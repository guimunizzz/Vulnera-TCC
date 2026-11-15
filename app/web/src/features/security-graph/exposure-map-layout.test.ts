import { describe, expect, it } from "vitest";
import type { AplicacaoExposta } from "../../types/exposure-graph.types";
import { alturaDoPredio, montarCidade } from "./exposure-map-layout";

const app = (id: string, environment: string, totalAbertas: number, piorSeveridade: AplicacaoExposta["piorSeveridade"], criticality = "MEDIUM") =>
  ({ id, name: id, environment, totalAbertas, piorSeveridade, criticality, internetFacing: false }) as AplicacaoExposta;

describe("montarCidade", () => {
  const apps = [app("dev1", "DEV", 1, "LOW"), app("p1", "PROD", 2, "MEDIUM"), app("p2", "PROD", 9, "CRITICAL", "CRITICAL"), app("h1", "HOMOL", 0, null)];
  const { bairros, largura } = montarCidade(apps);

  it("um bairro por ambiente, na ordem Produção, Homologação, Desenvolvimento", () => {
    expect(bairros.map((b) => b.rotulo)).toEqual(["Produção", "Homologação", "Desenvolvimento"]);
  });

  it("mais grave primeiro no bairro; altura cresce com abertas e a base com a criticidade", () => {
    const [p2, p1] = bairros[0].predios;
    expect(p2.app.id).toBe("p2");
    expect(p2.altura).toBeGreaterThan(p1.altura);
    expect(p2.base).toBeGreaterThan(p1.base);
    expect(alturaDoPredio(0)).toBeGreaterThan(0);
  });

  it("cidade centrada na origem, prédios sem se sobrepor e dentro do bairro", () => {
    const todos = bairros.flatMap((b) => b.predios);
    expect(Math.min(...todos.map((p) => p.x))).toBeGreaterThan(-largura / 2);
    expect(Math.max(...todos.map((p) => p.x))).toBeLessThan(largura / 2);
    for (let i = 0; i < todos.length; i++)
      for (let j = i + 1; j < todos.length; j++) expect(Math.hypot(todos[i].x - todos[j].x, todos[i].z - todos[j].z)).toBeGreaterThan(todos[i].base);
    for (const b of bairros) for (const p of b.predios) expect(Math.abs(p.x - b.x)).toBeLessThan(b.largura / 2);
  });

  it("sem aplicações, cidade vazia", () => {
    expect(montarCidade([]).bairros).toEqual([]);
  });
});
