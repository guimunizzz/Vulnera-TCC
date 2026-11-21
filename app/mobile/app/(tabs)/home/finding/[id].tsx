/** Mantém a rota de detalhe compartilhada pelos projetos e pelo grafo de exposição. */
import { FindingDetailScreen } from "../../../../src/components/finding-detail-screen";

export default function ProjectFinding() {
  return <FindingDetailScreen backFallback="/(tabs)/home" />;
}
