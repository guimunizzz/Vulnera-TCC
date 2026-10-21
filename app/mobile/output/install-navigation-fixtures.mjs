/**
 * Dados isolados para conferir navegação com a API local desligada.
 * Mantém os DTOs do mobile sem inserir fixtures no aplicativo ou no banco.
 * Consumidor: roteiro visual do modelo 7 e indicador deslizante.
 */
export async function installNavigationFixtures(page) {
  const date = "2026-10-06T12:00:00.000Z";
  const user = { id: "preview-client", name: "TechNova", email: "preview@example.test", role: "CLIENT", companyId: "preview-company", createdAt: date };
  const projects = ["IN_REVIEW", "COMPLETED", "IN_PROGRESS", "IN_PROGRESS", "IN_REVIEW"].map((status, index) => ({
    id: `preview-project-${index}`, name: ["Pentest Web — Portal do Cliente", "Auditoria Interna — Sistema de Gestão", "Análise — Aplicativo Mobile", "Pentest — API de Integração", "Análise — Portal Administrativo"][index],
    description: null, applicationId: `preview-app-${index}`, companyId: user.companyId, analysisType: index === 1 ? "COMBO" : "DAST", analysisLevel: "INTERMEDIATE", hasRemediation: true,
    scopeIn: "Portal e serviços da aplicação.", scopeOut: null, notes: null, status, requestedAt: date, startedAt: date, closedAt: status === "COMPLETED" ? date : null, updatedAt: date,
  }));
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data;
    if (pathname === "/api/auth/login") data = { user, accessToken: "isolated-preview-token", refreshToken: "isolated-preview-refresh" };
    else if (pathname === "/api/auth/logout") data = {};
    else if (pathname === "/api/users/me") data = user;
    else if (pathname === "/api/projects") data = projects;
    else if (pathname.startsWith("/api/projects/")) data = projects.find((item) => pathname.endsWith(item.id));
    else if (pathname === "/api/vulnerabilities") data = { data: [], pagination: { page: 1, pageSize: 30, total: 0, totalPages: 0 }, facets: { severity: {}, status: {}, company: {}, owasp: {} } };
    await route.fulfill({ status: data ? 200 : 404, contentType: "application/json", body: JSON.stringify(data ?? { error: "NOT_FOUND" }) });
  });
  return { user, projects };
}
