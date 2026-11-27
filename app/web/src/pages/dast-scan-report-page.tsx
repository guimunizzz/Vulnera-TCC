/**
 * dast-scan-report-page.tsx
 *
 * Exibe o report.html ORIGINAL do ZAP — conteúdo de terceiro, nunca
 * confiável, renderizado dentro do nosso domínio. Por isso:
 *
 *  - O HTML é buscado via axios autenticado (a rota exige Bearer token; um
 *    `<iframe src="...">` apontando direto pra API não carregaria o header
 *    de autorização) e injetado com `srcDoc`, nunca com `dangerouslySetInnerHTML`
 *    direto na página (que rodaria o HTML de terceiro no MESMO documento/
 *    origem que o resto do app).
 *  - `sandbox=""` no iframe é a MESMA barreira que o backend já aplica via
 *    header `Content-Security-Policy: sandbox` — sem `allow-scripts` nem
 *    `allow-same-origin`, então mesmo se o relatório carregasse algo
 *    malicioso, ele roda numa origem opaca, sem acesso a cookie/DOM nosso.
 *
 * Aberta em nova aba pelo botão "Ver relatório do ZAP" da tela de detalhe.
 */

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dastApi } from "../lib/api/dast.api";
import { ResourceLoadError, ResourceUnavailable } from "../components/ui/resource-unavailable";
import { getResourceFailure } from "../lib/resource-failure";
import { Skeleton } from "../components/ui/card";

export function DastScanReportPage() {
  const { id } = useParams<{ id: string }>();

  const htmlQuery = useQuery({
    queryKey: ["dast", "scans", id, "report", "html"],
    queryFn: () => dastApi.getReportHtml(id!),
    enabled: !!id,
  });

  if (htmlQuery.isLoading) {
    return (
      <div className="p-6" aria-busy="true">
        <span className="sr-only">Carregando relatório do ZAP</span>
        <Skeleton className="h-8 w-[16rem] bg-inset" />
        <Skeleton className="mt-4 h-[24rem] w-full bg-inset" />
      </div>
    );
  }

  const failure = getResourceFailure(htmlQuery.error);
  if (failure === "unavailable") return <ResourceUnavailable backTo="/dast" backLabel="Voltar para DAST" />;
  if (failure) return <ResourceLoadError failure={failure} onRetry={() => void htmlQuery.refetch()} />;
  if (!htmlQuery.data) return <ResourceUnavailable backTo="/dast" backLabel="Voltar para DAST" />;

  return (
    <iframe
      title="Relatório original do OWASP ZAP"
      srcDoc={htmlQuery.data}
      sandbox=""
      className="h-dvh w-full border-0"
    />
  );
}
