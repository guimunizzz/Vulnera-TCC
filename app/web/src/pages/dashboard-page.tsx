import { useAuthStore } from "../store/auth.store";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Olá, {user?.name}</h1>
      <p className="mt-2 text-muted">Bem-vindo à Vulnera. Esta é a sua área de trabalho.</p>
    </div>
  );
}
