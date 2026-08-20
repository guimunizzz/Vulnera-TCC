import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import type { UserRole } from "../../types/auth.types";

interface ProtectedRouteProps {
  /** Se informado, só libera a rota pra esses roles — senão, qualquer autenticado passa. */
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
