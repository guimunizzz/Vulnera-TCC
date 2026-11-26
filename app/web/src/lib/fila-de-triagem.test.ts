/**
 * fila-de-triagem.test.ts — triagem por teclado (ADR-062).
 *   FTR-01  teclas viram ações; em campo ou com modificador, não
 *   FTR-02  mover respeita as bordas da fila
 *   FTR-03  decidir tira o ativo; o próximo assume; no fim, o anterior
 *   FTR-04  desfazer devolve o item ao lugar, ativo; vários desfazeres em ordem
 *   FTR-05  falha da chamada reverte só aquela decisão
 */

import { describe, expect, it } from "vitest";
import type { ItemDaCaixa } from "../types/triage.types";
import { decidir, desfazer, filaInicial, mover, reverterDecisao, teclaParaAcao } from "./fila-de-triagem";

const item = (id: string): ItemDaCaixa => ({ fonte: "DAST", id, titulo: id, severidade: "HIGH", contexto: "", detalhe: null, criadoEm: "", link: "/", companyId: null });
const ids = (estado: { itens: ItemDaCaixa[] }) => estado.itens.map((i) => i.id);

describe("fila de triagem", () => {
  it("FTR-01 — mapa de teclas", () => {
    expect(teclaParaAcao({ key: "j" }, false)).toEqual({ tipo: "mover", delta: 1 });
    expect(teclaParaAcao({ key: "ArrowUp" }, false)).toEqual({ tipo: "mover", delta: -1 });
    expect(teclaParaAcao({ key: "a" }, false)).toEqual({ tipo: "decidir", decisao: "CONFIRMED" });
    expect(teclaParaAcao({ key: "f" }, false)).toEqual({ tipo: "decidir", decisao: "FALSE_POSITIVE" });
    expect(teclaParaAcao({ key: "r" }, false)).toEqual({ tipo: "decidir", decisao: "ACCEPTED_RISK" });
    expect(teclaParaAcao({ key: "u" }, false)).toEqual({ tipo: "desfazer" });
    expect(teclaParaAcao({ key: "Enter" }, false)).toEqual({ tipo: "abrir" });
    expect(teclaParaAcao({ key: "a" }, true)).toBeNull();
    expect(teclaParaAcao({ key: "f", ctrlKey: true }, false)).toBeNull();
    expect(teclaParaAcao({ key: "x" }, false)).toBeNull();
  });

  it("FTR-02 — mover respeita as bordas", () => {
    const f = filaInicial([item("a"), item("b")]);
    expect(mover(f, -1).ativo).toBe(0);
    expect(mover(mover(f, 1), 1).ativo).toBe(1);
    expect(mover(filaInicial([]), 1).ativo).toBe(0);
  });

  it("FTR-03 — decidir tira o ativo e o próximo assume", () => {
    let f = mover(filaInicial([item("a"), item("b"), item("c")]), 1);
    const r1 = decidir(f, "CONFIRMED");
    expect(ids(r1.estado)).toEqual(["a", "c"]);
    expect(r1.estado.ativo).toBe(1); // "c" assumiu o lugar de "b"
    f = r1.estado;
    const r2 = decidir(f, "FALSE_POSITIVE");
    expect(ids(r2.estado)).toEqual(["a"]);
    expect(r2.estado.ativo).toBe(0); // era o último: volta para o anterior
    expect(decidir(filaInicial([]), "CONFIRMED").decidido).toBeNull();
  });

  it("FTR-04 — desfazer devolve na ordem inversa", () => {
    let f = filaInicial([item("a"), item("b"), item("c")]);
    f = decidir(f, "CONFIRMED").estado; // tira a
    f = decidir(f, "ACCEPTED_RISK").estado; // tira b
    expect(ids(f)).toEqual(["c"]);
    const d1 = desfazer(f);
    expect(d1.desfeito?.item.id).toBe("b");
    expect(ids(d1.estado)).toEqual(["b", "c"]);
    expect(d1.estado.ativo).toBe(0);
    const d2 = desfazer(d1.estado);
    expect(ids(d2.estado)).toEqual(["a", "b", "c"]);
    expect(desfazer(d2.estado).desfeito).toBeNull();
  });

  it("FTR-05 — falha reverte só aquela decisão", () => {
    let f = filaInicial([item("a"), item("b"), item("c")]);
    const r1 = decidir(f, "CONFIRMED");
    f = r1.estado;
    const r2 = decidir(f, "CONFIRMED");
    f = reverterDecisao(r2.estado, r1.decidido!);
    expect(ids(f)).toEqual(["a", "c"]);
    expect(f.historico).toEqual([r2.decidido]);
  });
});
