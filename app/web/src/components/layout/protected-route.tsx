import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import type { UserRole } from "../../types/auth.types";

interface ProtectedRouteProps {
  /** Se informado, só libera a rota pra esses roles — senão, qualquer autenticado passa. */
  roles?: UserRole[];
  companyRoles?: Array<"OWNER" | "MEMBER">;
}

export function ProtectedRoute({ roles, companyRoles }: ProtectedRouteProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const sessionVersion = useAuthStore((s) => s.sessionVersion);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (companyRoles && (user.role !== "CLIENT" || !user.companyId || !companyRoles.some((role) => role === user.companyRole))) {
    return <Navigate to="/dashboard" replace />;
  }

  // Descarta a árvore anterior, inclusive conteúdo mantido pela animação de saída.
  return <Outlet key={sessionVersion} />;
}
