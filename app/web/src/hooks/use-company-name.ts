/**
 * use-company-name.ts
 *
 * Resolve o nome de uma company a partir do id, pro breadcrumb
 * company → aplicação → projeto. CLIENT só tem acesso à própria (via /me);
 * ADMIN busca na listagem completa (admin-only no backend).
 */

import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "../lib/api/companies.api";
import { useAuthStore } from "../store/auth.store";

export function useCompanyName(companyId: string | undefined, enabled = true): string | undefined {
  const role = useAuthStore((s) => s.user?.role);

  const meQuery = useQuery({
    queryKey: ["companies", "me"],
    queryFn: companiesApi.me,
    enabled: enabled && role === "CLIENT",
  });

  const listQuery = useQuery({
    queryKey: ["companies"],
    queryFn: companiesApi.list,
    enabled: enabled && role === "ADMIN",
  });

  if (!enabled) return undefined;
  if (role === "CLIENT") return meQuery.data?.name;
  if (role === "ADMIN") return listQuery.data?.find((c) => c.id === companyId)?.name;
  return undefined;
}
