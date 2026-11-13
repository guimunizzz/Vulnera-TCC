import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/landing-page";
import { AppLayout } from "./components/layout/app-layout";
import { ProtectedRoute } from "./components/layout/protected-route";
import { LimiteDeRota } from "./components/layout/route-boundary";
import { paginaLazy } from "./lib/lazy-page";

/*
 * CODE-SPLITTING POR ROTA
 * Cada página vira um chunk buscado só quando a rota é visitada: quem abre o
 * login não baixa pdf-lib nem o editor de findings. Ficam no chunk
 * principal apenas as molduras que precisam estar prontas antes de qualquer
 * página — `AppLayout` e `ProtectedRoute` — e a `LandingPage`, que já faz o
 * próprio `lazy()` da landing inteira.
 *
 * O cenário de acesso anima a troca login ↔ cadastro e foca o título no fim da
 * animação. Layout e as duas páginas vêm num só lote para que essa troca nunca
 * espere download (o que piscaria o cenário ou perderia o foco).
 */
const carregarAcesso = () =>
  Promise.all([
    import("./pages/auth/auth-layout"),
    import("./pages/auth/login-page"),
    import("./pages/auth/register-page"),
  ]);
const AuthLayout = paginaLazy(() => carregarAcesso().then(([layout]) => layout), "AuthLayout");
const LoginPage = paginaLazy(() => carregarAcesso().then(([, login]) => login), "LoginPage");
const RegisterPage = paginaLazy(() => carregarAcesso().then(([, , cadastro]) => cadastro), "RegisterPage");

const PlansPage = paginaLazy(() => import("./pages/plans-page"), "PlansPage");
const OnboardingPage = paginaLazy(() => import("./pages/onboarding-page"), "OnboardingPage");
const DashboardPage = paginaLazy(() => import("./pages/dashboard-page"), "DashboardPage");
const ApplicationsPage = paginaLazy(() => import("./pages/applications-page"), "ApplicationsPage");
const ExposureGraphPage = paginaLazy(() => import("./pages/exposure-graph-page"), "ExposureGraphPage");
const NewAnalysisPage = paginaLazy(() => import("./pages/new-analysis-page"), "NewAnalysisPage");
const ProjectsPage = paginaLazy(() => import("./pages/projects-page"), "ProjectsPage");
const ProjectDetailPage = paginaLazy(() => import("./pages/project-detail-page"), "ProjectDetailPage");
const FindingEditorPage = paginaLazy(() => import("./pages/finding-editor-page"), "FindingEditorPage");
const FindingDetailPage = paginaLazy(() => import("./pages/finding-detail-page"), "FindingDetailPage");
const FindingsPage = paginaLazy(() => import("./pages/findings-page"), "FindingsPage");
const PendingSubscriptionsPage = paginaLazy(
  () => import("./pages/admin/pending-subscriptions-page"),
  "PendingSubscriptionsPage",
);
const ApplicationDashboardPage = paginaLazy(
  () => import("./pages/application-dashboard-page"),
  "ApplicationDashboardPage",
);
const MaturityAssessmentPage = paginaLazy(
  () => import("./pages/maturity-assessment-page"),
  "MaturityAssessmentPage",
);
const DastPage = paginaLazy(() => import("./pages/dast-page"), "DastPage");
const DastScanDetailPage = paginaLazy(() => import("./pages/dast-scan-detail-page"), "DastScanDetailPage");
const DastScanReportPage = paginaLazy(() => import("./pages/dast-scan-report-page"), "DastScanReportPage");
const SastScaPage = paginaLazy(() => import("./pages/sast-sca-page"), "SastScaPage");
const CodeImportDetailPage = paginaLazy(() => import("./pages/code-import-detail-page"), "CodeImportDetailPage");
const SlaSettingsPage = paginaLazy(() => import("./pages/settings/sla-settings-page"), "SlaSettingsPage");
const PlaybooksPage = paginaLazy(() => import("./pages/playbooks-page"), "PlaybooksPage");
const PlaybookDetailPage = paginaLazy(() => import("./pages/playbook-detail-page"), "PlaybookDetailPage");
const RemediationPage = paginaLazy(() => import("./pages/remediation-page"), "RemediationPage");

// O ternário com `import.meta.env.DEV` é resolvido em build time: em produção o
// ramo vira `null`, o `import()` some e o styleguide nem é empacotado.
const StyleguidePage = import.meta.env.DEV
  ? paginaLazy(() => import("./pages/styleguide-page"), "StyleguidePage")
  : null;
import { ComMenuAcessibilidade } from "./design/accessibility-menu";

export function App() {
  return (
    // Rotas fora do AppLayout mostram o skeleton de tela inteira; as de dentro
    // usam o limite do próprio layout, mais próximo, e não chegam aqui.
    <LimiteDeRota variante="tela">
      <Routes>
        {/* Pública, sem ProtectedRoute. Renderiza igual com ou sem sessão — ver
            landing-page.tsx sobre o porquê de não redirecionar quem já está
            logado (é material de apresentação da banca). */}
        <Route path="/" element={<LandingPage />} />

        {/* Rotas sem cabeçalho próprio ganham o menu de acessibilidade fixo no
            canto superior direito. A landing e o AppLayout o têm no cabeçalho. */}
        <Route element={<ComMenuAcessibilidade />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route path="/plans" element={<PlansPage />} />

          {/* O styleguide é ferramenta de desenvolvimento e evidência para a banca,
              não parte do produto. `import.meta.env.DEV` é avaliado em build time:
              no bundle de produção o Vite elimina o ramo inteiro, e a página nem
              sequer é empacotada. */}
          {import.meta.env.DEV && StyleguidePage && <Route path="/styleguide" element={<StyleguidePage />} />}
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<ComMenuAcessibilidade />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/findings/:id" element={<FindingDetailPage />} />

            {/* Leitura liberada pros 3 roles (RN19 — ADMIN/CLIENT da própria
                company/PENTESTER atribuído); a distinção ESCREVE-vs-LÊ é feita
                dentro da própria página (canEdit) e reforçada pelo backend. */}
            <Route path="/companies/:companyId/maturity" element={<MaturityAssessmentPage />} />

            {/* Catálogo de remediação (CP-5). Leitura para os três papéis: o
                CLIENT precisa entender o que foi pedido para corrigir. A
                ESCRITA é barrada no backend (D5) e a tela não a oferece. */}
            <Route path="/playbooks" element={<PlaybooksPage />} />
            <Route path="/playbooks/:id" element={<PlaybookDetailPage />} />

            {/* Varredura global de findings — ferramenta de quem analisa.
                O CLIENT é barrado aqui e não vê o item na Sidebar; o backend
                continua servindo os findings da própria empresa a ele (RN16),
                que é o que o dashboard e o app mobile consomem. */}
            <Route element={<ProtectedRoute roles={["ADMIN", "PENTESTER"]} />}>
              <Route path="/findings" element={<FindingsPage />} />
              {/* Quadro de remediação (CP-7). Mesmo recorte da listagem global:
                  mover e atribuir são escrita em finding, e o CLIENT não escreve. */}
              <Route path="/remediation" element={<RemediationPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={["ADMIN", "CLIENT"]} />}>
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/applications/:id/dashboard" element={<ApplicationDashboardPage />} />
            {/* Exposure Graph (CP-8): a empresa de quem está logado; o backend deriva do token. */}
            <Route path="/exposure-graph" element={<ExposureGraphPage />} />
              <Route path="/new-analysis" element={<NewAnalysisPage />} />
              {/* SLA (CP-2): governança da empresa — ADMIN e CLIENT (OWNER edita,
                  MEMBER lê; o backend reforça). PENTESTER não chega aqui. */}
              <Route path="/settings/sla" element={<SlaSettingsPage />} />
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

            {/* Módulo DAST — não existe pro CLIENT: nem item de menu, nem rota
                acessível (403 se forçar a URL, ver ProtectedRoute). */}
            <Route element={<ProtectedRoute roles={["ADMIN", "PENTESTER"]} />}>
              <Route path="/dast" element={<DastPage />} />
              <Route path="/dast/scans/:id" element={<DastScanDetailPage />} />
              {/* SAST/SCA (ADR-052) — mesmos papéis do DAST; a API repete a checagem. */}
              <Route path="/sast-sca" element={<SastScaPage />} />
              <Route path="/sast-sca/imports/:id" element={<CodeImportDetailPage />} />
            </Route>
          </Route>

          {/* Relatório do ZAP fora do AppLayout — tela cheia, sem sidebar, é
              aberta em nova aba a partir do detalhe do scan. Sem menu de
              acessibilidade: o relatório é um iframe isolado de terceiros, onde
              nossas preferências não chegam (o zoom do navegador chega). */}
          <Route element={<ProtectedRoute roles={["ADMIN", "PENTESTER"]} />}>
            <Route path="/dast/scans/:id/report" element={<DastScanReportPage />} />
          </Route>
        </Route>

        {/* Rota desconhecida: mantém o comportamento anterior a este fix (manda
            pro dashboard, que redireciona pro login se não houver sessão) —
            fora do escopo deste bug, não mexido. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </LimiteDeRota>
  );
}
