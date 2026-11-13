/**
 * lib/code-import.ts
 *
 * Regras puras das telas SAST/SCA (ADR-052), fora dos componentes para o
 * fast-refresh funcionar e para serem testáveis sem renderizar nada.
 */

import {
  CODE_SEVERITY_LABELS,
  CODE_SEVERITY_ORDER,
  type CodeCategory,
  type CodeFinding,
  type CodeScanImport,
  type CodeSeverity,
} from "../types/code-import.types";
import type { DastTriageStatus } from "../types/dast.types";

export const LIMITE_IMPORTACAO_BYTES = 10 * 1024 * 1024;
const EXTENSOES = [".sarif", ".json"];

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Só o que poupa um upload inútil; se o conteúdo é SARIF/CycloneDX quem decide é a API. */
export function validarArquivo(file: Pick<File, "name" | "size">): string | null {
  const nome = file.name.toLowerCase();
  if (!EXTENSOES.some((ext) => nome.endsWith(ext))) return "Envie o arquivo .sarif ou .json gerado pela ferramenta.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > LIMITE_IMPORTACAO_BYTES) return `O arquivo tem ${tamanhoLegivel(file.size)}; o limite é 10 MB.`;
  return null;
}

export function descreverSeveridades(counts: Record<CodeSeverity, number>): string {
  const partes = CODE_SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${CODE_SEVERITY_LABELS[s].toLowerCase()}`);
  return partes.length > 0 ? partes.join(", ") : "nenhum achado";
}

/** Só http(s) vira link; o resto (javascript:, data:, file:) é exibido como texto. */
export function urlSegura(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface FiltrosAchados {
  busca: string;
  severidades: CodeSeverity[];
  categoria: CodeCategory | "";
  triagem: DastTriageStatus | "";
  soNovos: boolean;
}

export const FILTROS_INICIAIS: FiltrosAchados = { busca: "", severidades: [], categoria: "", triagem: "", soNovos: false };

export function filtrarAchados(findings: CodeFinding[], filtros: FiltrosAchados, novos: Set<string>): CodeFinding[] {
  const termo = filtros.busca.trim().toLowerCase();
  return findings.filter(
    (f) =>
      (filtros.severidades.length === 0 || filtros.severidades.includes(f.severity)) &&
      (!filtros.categoria || f.category === filtros.categoria) &&
      (!filtros.triagem || f.triageStatus === filtros.triagem) &&
      (!filtros.soNovos || novos.has(f.fingerprint)) &&
      (!termo ||
        [f.title, f.ruleId, f.filePath, f.packageName, f.advisoryId, f.cweId ? `cwe-${f.cweId}` : null]
          .filter((campo): campo is string => !!campo)
          .some((campo) => campo.toLowerCase().includes(termo))),
  );
}

/**
 * A importação mais recente de cada projeto+formato+ferramenta (a lista vem
 * da mais nova para a mais antiga). Somar todas contaria o mesmo achado uma
 * vez por reimportação.
 */
export function ultimasPorFonte(imports: CodeScanImport[]): CodeScanImport[] {
  const vistos = new Set<string>();
  return imports.filter((i) => {
    const chave = `${i.projectId}|${i.format}|${i.toolName}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}
