import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/auth/login-page";
import { RegisterPage } from "./pages/auth/register-page";
import { PlansPage } from "./pages/plans-page";
import { OnboardingPage } from "./pages/onboarding-page";
import { DashboardPage } from "./pages/dashboard-page";
import { PendingSubscriptionsPage } from "./pages/admin/pending-subscriptions-page";
import { AppLayout } from "./components/layout/app-layout";
import { ProtectedRoute } from "./components/layout/protected-route";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/plans" element={<PlansPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route path="/admin/subscriptions" element={<PendingSubscriptionsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
