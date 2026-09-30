/**
 * dashboard-page.tsx
 *
 * Roteia o conteúdo pela role do Zustand (Fase 6) — cada perfil vê um
 * recorte de dados bem diferente (RN16/RN17 já resolvem o escopo no
 * backend; aqui só decide QUAL componente montar).
 */

import { useAuthStore } from "../store/auth.store";
import { ClientDashboard } from "../components/dashboard/client-dashboard";
import { PentesterDashboard } from "../components/dashboard/pentester-dashboard";
import { AdminDashboard } from "../components/dashboard/admin-dashboard";
import { DashboardHero } from "../components/dashboard/hero/dashboard-hero";
import { DashboardAtmosphere } from "../components/dashboard/hero/dashboard-atmosphere";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="dashboard-workspace relative isolate min-h-[calc(100dvh-7rem)]">
      <DashboardAtmosphere />
      <div className="relative flex flex-col gap-6">
        <DashboardHero userName={user?.name ?? ""} />

        <div>
          {user?.role === "CLIENT" && <ClientDashboard />}
          {user?.role === "PENTESTER" && <PentesterDashboard />}
          {user?.role === "ADMIN" && <AdminDashboard />}
        </div>
      </div>
    </div>
  );
}
