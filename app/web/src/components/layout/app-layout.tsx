import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Button } from "../ui/button";
import { useAuthStore } from "../../store/auth.store";
import { authApi } from "../../lib/api/auth.api";

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // mesmo se a chamada falhar, o estado local é limpo do mesmo jeito
      }
    }
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <span className="text-sm text-muted">{user?.name}</span>
          <Button variant="ghost" onClick={handleLogout}>
            Sair
          </Button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
