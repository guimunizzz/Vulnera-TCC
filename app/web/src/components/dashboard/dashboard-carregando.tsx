/**
 * dashboard-carregando.tsx
 *
 * O QUE FAZ
 * Esqueleto de carregamento dos dashboards por papel: três KPIs e um bloco
 * de lista, no mesmo desenho do conteúdo que vai chegar.
 *
 * POR QUE EXISTE
 * CLIENT e PENTESTER mostravam um "Carregando..." solto enquanto o ADMIN já
 * tinha esqueleto; os três passam a ter o mesmo estado (Fase 5 do refactor
 * web-motion-3d).
 *
 * QUEM USA
 * `admin-dashboard`, `client-dashboard` e `pentester-dashboard`.
 */

import { Card, RegiaoCarregando, Skeleton } from "../ui/card";

export function DashboardCarregando({ rotulo }: { rotulo: string }) {
  return (
    <RegiaoCarregando rotulo={rotulo} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} semPadding className="min-h-[8rem] p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-8" />
            </div>
            <Skeleton className="mt-6 h-8 w-20" />
          </Card>
        ))}
      </div>
      <Card semPadding className="p-5">
        <Skeleton className="h-4 w-1/3" />
        <div className="mt-5 flex flex-col gap-4">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-10 w-full" />)}
        </div>
      </Card>
    </RegiaoCarregando>
  );
}
