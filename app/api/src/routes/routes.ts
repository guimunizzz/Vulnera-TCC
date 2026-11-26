import { Router } from "express";
import { planRoutes } from "./plan.routes";
import { companyRoutes } from "./company.routes";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { userRoutes } from "./user.routes";
import { subscriptionRoutes } from "./subscription.routes";
import { applicationRoutes } from "./application.routes";
import { projectRoutes } from "./project.routes";
import { vulnerabilityRoutes } from "./vulnerability.routes";
import { reportRoutes } from "./report.routes";
import { notificationRoutes } from "./notification.routes";
import { maturityRoutes } from "./maturity.routes";
import { dastScanRoutes } from "./dast-scan.routes";
import { riskAcceptanceRoutes } from "./risk-acceptance.routes";
import { remediationPlaybookRoutes } from "./remediation-playbook.routes";
import { savedQueryRoutes } from "./saved-query.routes";
import { makeAccessRequestRoutes } from "./access-request.routes";
import type { AccessRequestRouteDependencies } from "../factories/access-request.factory";
import { makeAdminAccessRequestRoutes } from "./admin-access-request.routes";
import type { AdminAccessRequestRouteDependencies } from "../factories/admin-access-request.factory";
import { codeScanRoutes } from "./code-scan.routes";
import { threatIntelRoutes } from "./threat-intel.routes";
import { makeAccountActivationRoutes } from "./account-activation.routes";
import type { AccountActivationRouteDependencies } from "../factories/account-activation.factory";
import { dastScheduleRoutes } from "./dast-schedules.routes";
import { adminQueuesRoutes } from "./admin-queues.routes";
import { graphCommentRoutes } from "./graph-comment.routes";

export function makeApiRoutes(options: {
  accessRequestDependencies?: AccessRequestRouteDependencies;
  adminAccessRequestDependencies?: AdminAccessRequestRouteDependencies;
  accountActivationDependencies?: AccountActivationRouteDependencies;
} = {}) {
  const router = Router();

  router.use("/health", healthRoutes);
  router.use("/auth", authRoutes);
  router.use("/access-requests", makeAccessRequestRoutes(options.accessRequestDependencies));
  router.use("/admin/access-requests", makeAdminAccessRequestRoutes(options.adminAccessRequestDependencies));
  router.use("/account-activation", makeAccountActivationRoutes(options.accountActivationDependencies));
  router.use("/users", userRoutes);
  router.use("/plans", planRoutes);
  router.use("/companies", companyRoutes);
  router.use("/subscriptions", subscriptionRoutes);
  router.use("/applications", applicationRoutes);
  router.use("/projects", projectRoutes);
  router.use("/vulnerabilities", vulnerabilityRoutes);
  router.use("/reports", reportRoutes);
  router.use("/notifications", notificationRoutes);
  router.use("/maturity", maturityRoutes);
  router.use("/dast/scans", dastScanRoutes);
  // ADR-056 — agendamentos DAST por URL e histórico por agendamento.
  router.use("/dast-schedules", dastScheduleRoutes);
  // ADR-056 — painel global de filas restrito a ADMIN.
  router.use("/admin/queues", adminQueuesRoutes);
  // CP-4 — decisões sobre um aceite já existente (aprovar/rejeitar/revogar).
  // Solicitar e listar ficam aninhados em /vulnerabilities/:id/risk-acceptances.
  router.use("/risk-acceptances", riskAcceptanceRoutes);

  // CP-5 — catálogo de remediação: System OWASP (global) + custom do tenant.
  router.use("/playbooks", remediationPlaybookRoutes);

  // CP-6 — buscas salvas e watchlists (a pergunta, nunca a resposta).
  router.use("/saved-queries", savedQueryRoutes);

  // ADR-052 — importação de relatórios SAST (SARIF) e SCA (CycloneDX) por projeto.
  router.use("/code-imports", codeScanRoutes);
  // Threat Intel (ADR-053) — inventário, CVEs que afetam a empresa, feed e sincronização.
  router.use("/threat-intel", threatIntelRoutes);
  // ADR-061 — comentários fixados nos nós do Exposure Graph e do grafo do scan DAST.
  router.use("/graph-comments", graphCommentRoutes);

  return router;
}

// Mantém o export histórico para consumidores que montam o router diretamente.
export const apiRoutes = makeApiRoutes();
