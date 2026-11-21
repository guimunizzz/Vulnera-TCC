/** Abre o detalhe compartilhado para os achados priorizados no Painel. */
import { FindingDetailScreen } from "../../../../src/components/finding-detail-screen";

export default function DashboardFinding() {
  return <FindingDetailScreen backFallback="/(tabs)/dashboard" />;
}
