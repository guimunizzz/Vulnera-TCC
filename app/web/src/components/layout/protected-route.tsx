import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import type { UserRole } from "../../types/auth.types";

interface ProtectedRouteProps {
  /** Se informado, só libera a rota pra esses roles — senão, qualquer autenticado passa. */
  roles?: UserRole[];
  requireCompanyOwner?: boolean;
}

export function ProtectedRoute({ roles, requireCompanyOwner }: ProtectedRouteProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireCompanyOwner && (user.role !== "CLIENT" || !user.companyId || user.companyRole !== "OWNER")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
