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

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="text-2xl font-bold text-fg">Olá, {user?.name}</h1>
      <p className="mt-1 text-fg-muted">Bem-vindo à Vulnera. Esta é a sua área de trabalho.</p>

      <div className="mt-6">
        {user?.role === "CLIENT" && <ClientDashboard />}
        {user?.role === "PENTESTER" && <PentesterDashboard />}
        {user?.role === "ADMIN" && <AdminDashboard />}
      </div>
    </div>
  );
}
