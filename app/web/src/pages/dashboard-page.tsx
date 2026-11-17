/**
 * dashboard-page.tsx
 *
 * Roteia o conteúdo pela role do Zustand (Fase 6) — cada perfil vê um
 * recorte de dados bem diferente (RN16/RN17 já resolvem o escopo no
 * backend; aqui só decide QUAL componente montar).
 *
 * Refactor web-motion-3d (Fase 5): o hero grande deu lugar a um cabeçalho
 * compacto com os críticos em aberto, e os atalhos "Continue seu trabalho"
 * fecham a página para os três papéis.
 */

import { useAuthStore } from "../store/auth.store";
import { ClientDashboard } from "../components/dashboard/client-dashboard";
import { PentesterDashboard } from "../components/dashboard/pentester-dashboard";
import { AdminDashboard } from "../components/dashboard/admin-dashboard";
import { DashboardHeader } from "../components/dashboard/dashboard-header";
import { DashboardAtalhos } from "../components/dashboard/dashboard-atalhos";
import { DashboardAtmosphere } from "../components/dashboard/hero/dashboard-atmosphere";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="dashboard-workspace relative isolate min-h-[calc(100dvh-7rem)]">
      <DashboardAtmosphere />
      <div className="relative flex flex-col gap-6">
        <DashboardHeader userName={user?.name ?? ""} role={user?.role} />

        <div>
          {user?.role === "CLIENT" && <ClientDashboard />}
          {user?.role === "PENTESTER" && <PentesterDashboard />}
          {user?.role === "ADMIN" && <AdminDashboard />}
        </div>

        <DashboardAtalhos role={user?.role} />
      </div>
    </div>
  );
}
