import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/landing-page";
import { LoginPage } from "./pages/auth/login-page";
import { RegisterPage } from "./pages/auth/register-page";
import { PlansPage } from "./pages/plans-page";
import { OnboardingPage } from "./pages/onboarding-page";
import { DashboardPage } from "./pages/dashboard-page";
import { ApplicationsPage } from "./pages/applications-page";
import { NewAnalysisPage } from "./pages/new-analysis-page";
import { ProjectsPage } from "./pages/projects-page";
import { ProjectDetailPage } from "./pages/project-detail-page";
import { FindingEditorPage } from "./pages/finding-editor-page";
import { FindingDetailPage } from "./pages/finding-detail-page";
import { PendingSubscriptionsPage } from "./pages/admin/pending-subscriptions-page";
import { StyleguidePage } from "./pages/styleguide-page";
import { ApplicationDashboardPage } from "./pages/application-dashboard-page";
import { MaturityAssessmentPage } from "./pages/maturity-assessment-page";
import { AppLayout } from "./components/layout/app-layout";
import { ProtectedRoute } from "./components/layout/protected-route";

export function App() {
  return (
    <Routes>
      {/* Pública, sem ProtectedRoute. Renderiza igual com ou sem sessão — ver
          landing-page.tsx sobre o porquê de não redirecionar quem já está
          logado (é material de apresentação da banca). */}
      <Route path="/" element={<LandingPage />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/plans" element={<PlansPage />} />

      {/* O styleguide é ferramenta de desenvolvimento e evidência para a banca,
          não parte do produto. `import.meta.env.DEV` é avaliado em build time:
          no bundle de produção o Vite elimina o ramo inteiro, e a página nem
          sequer é empacotada. */}
      {import.meta.env.DEV && <Route path="/styleguide" element={<StyleguidePage />} />}

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/findings/:id" element={<FindingDetailPage />} />

          {/* Leitura liberada pros 3 roles (RN19 — ADMIN/CLIENT da própria
              company/PENTESTER atribuído); a distinção ESCREVE-vs-LÊ é feita
              dentro da própria página (canEdit) e reforçada pelo backend. */}
          <Route path="/companies/:companyId/maturity" element={<MaturityAssessmentPage />} />

          <Route element={<ProtectedRoute roles={["ADMIN", "CLIENT"]} />}>
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/:id/dashboard" element={<ApplicationDashboardPage />} />
            <Route path="/new-analysis" element={<NewAnalysisPage />} />
          </Route>

          {/* Escrita de finding (create/update/transition/override) é ADMIN
              ou PENTESTER-membro — CLIENT é sempre read-only (FindingDetailPage). */}
          <Route element={<ProtectedRoute roles={["ADMIN", "PENTESTER"]} />}>
            <Route path="/projects/:projectId/findings/new" element={<FindingEditorPage />} />
            <Route path="/findings/:id/edit" element={<FindingEditorPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route path="/admin/subscriptions" element={<PendingSubscriptionsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Rota desconhecida: mantém o comportamento anterior a este fix (manda
          pro dashboard, que redireciona pro login se não houver sessão) —
          fora do escopo deste bug, não mexido. */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
