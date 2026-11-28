/**
 * alvo-de-impacto.ts — o alvo do raio de impacto (ADR-061) como texto: rótulo
 * do tipo, chave do Combobox e o caminho de volta. Fora do componente para o
 * fast refresh do Vite continuar funcionando.
 */

import type { TipoDeImpacto } from "../../../types/exposure-graph.types";
import { rotuloCategoria } from "../exposure-graph-model";

export const ROTULO_TIPO_DE_IMPACTO: Record<TipoDeImpacto, string> = { PACOTE: "Pacote", CVE: "CVE", CATEGORIA: "Categoria" };

/** Chave do Combobox: tipo e valor juntos, para um pacote e uma CVE de mesmo texto não se confundirem. */
export const chaveDoAlvo = (tipo: TipoDeImpacto, valor: string) => `${tipo}|${valor}`;
export function alvoDaChave(chave: string): { tipo: TipoDeImpacto; valor: string } | null {
  const separador = chave.indexOf("|");
  if (separador < 0) return null;
  const tipo = chave.slice(0, separador) as TipoDeImpacto;
  return tipo in ROTULO_TIPO_DE_IMPACTO ? { tipo, valor: chave.slice(separador + 1) } : null;
}

export const rotuloDoAlvo = (tipo: TipoDeImpacto, valor: string) => (tipo === "CATEGORIA" ? rotuloCategoria(valor) : valor);
