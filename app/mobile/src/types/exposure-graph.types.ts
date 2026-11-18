/** Contrato da projeção de exposição da empresa; consumido pela tela e pelo modelo do grafo. */
export type GraphSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ExposureCategory = { owaspCategory: string; abertas: number; piorSeveridade: GraphSeverity };
export type ExposureFinding = { id: string; title: string; severityFinal: string; status: string; owaspCategory: string; sourceType: string };
export type ExposureApplication = {
  id: string; name: string; url: string | null; environment: string; criticality: string;
  internetFacing: boolean; dataSensitivity: string; abertas: Record<GraphSeverity, number>;
  abertasPorOrigem: Record<string, number>; totalAbertas: number; totalResolvidas: number;
  piorSeveridade: GraphSeverity | null; categorias: ExposureCategory[]; principais: ExposureFinding[];
};
export type ExposureGraph = { companyId: string; geradoEm: string; aplicacoes: ExposureApplication[] };
