/**
 * notification-bell.test.tsx — o sino (ADR-053): contagem no rótulo
 * acessível, lista ao abrir, abrir marca como lida e navega pelo link.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../../design/theme-provider";
import { NotificationBell } from "./notification-bell";

const api = vi.hoisted(() => ({ list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() }));
vi.mock("../../lib/api/threat-intel.api", () => ({ notificationsApi: api, threatIntelApi: {} }));

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <NotificationBell />
          <Routes>
            <Route path="/dashboard" element={<p>dashboard</p>} />
            <Route path="/threat-intel" element={<p>pagina threat intel</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.unreadCount.mockResolvedValue({ naoLidas: 2 });
  api.markRead.mockResolvedValue(undefined);
  api.list.mockResolvedValue({
    naoLidas: 2,
    data: [
      { id: "n1", category: "THREAT_MATCH", title: "CVE-2026-50001 afeta lodash 4.17.15 (npm)", message: "CVSS 9.8.", link: "/threat-intel?empresa=c1&aba=afeta&match=m1", isRead: false, createdAt: new Date().toISOString() },
      { id: "n2", category: "THREAT_KEV", title: "Lida antes", message: "x", link: "https://evil.example", isRead: true, createdAt: new Date().toISOString() },
    ],
  });
});

describe("NotificationBell", () => {
  it("anuncia a contagem e só busca a lista ao abrir", async () => {
    renderBell();
    const sino = await screen.findByRole("button", { name: "Notificações: 2 não lidas" });
    expect(api.list).not.toHaveBeenCalled();
    fireEvent.click(sino);
    expect(await screen.findByText("CVE-2026-50001 afeta lodash 4.17.15 (npm)")).toBeInTheDocument();
  });

  it("abrir marca como lida e navega para o link interno", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /Notificações: 2/ }));
    fireEvent.click(await screen.findByText("CVE-2026-50001 afeta lodash 4.17.15 (npm)"));
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith("n1"));
    expect(await screen.findByText("pagina threat intel")).toBeInTheDocument();
  });

  it("link externo nunca navega (só rotas internas)", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /Notificações: 2/ }));
    fireEvent.click(await screen.findByText("Lida antes"));
    expect(api.markRead).not.toHaveBeenCalled(); // já estava lida
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
