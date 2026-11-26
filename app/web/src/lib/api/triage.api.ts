import { apiClient } from "./client";
import { codeImportsApi } from "./code-imports.api";
import { dastApi } from "./dast.api";
import { threatIntelApi } from "./threat-intel.api";
import type { CaixaDeTriagem, FonteDeTriagem } from "../../types/triage.types";
import type { DastTriageStatus } from "../../types/dast.types";

export const triageApi = {
  async caixa(): Promise<CaixaDeTriagem> {
    const { data } = await apiClient.get<CaixaDeTriagem>("/triage/inbox");
    return data;
  },

  /**
   * Tria um item da caixa pela rota DA FONTE (ADR-062): a caixa só junta, a
   * regra de cada triagem continua a de cada módulo.
   */
  async triar(fonte: FonteDeTriagem, id: string, triageStatus: DastTriageStatus, note: string | null): Promise<void> {
    if (fonte === "DAST") await dastApi.triage(id, triageStatus, note);
    else if (fonte === "CODIGO") await codeImportsApi.triage(id, triageStatus, note);
    else await threatIntelApi.triage(id, triageStatus, note);
  },
};
