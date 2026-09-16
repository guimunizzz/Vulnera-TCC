/**
 * finding-detail-page.tsx
 *
 * O QUE FAZ
 * A tela de UM finding: contexto, severidade (calculada e aplicada), CVSS
 * decomposto, descrição, evidências, comentários, trilha de auditoria e as
 * ações permitidas ao ator.
 *
 * ACESSO
 * A rota resolve o acesso pelo PRÓPRIO finding — não há guarda de papel aqui,
 * de propósito. Quem carrega esta página necessariamente passou pelo
 * `assertCanView` do backend: CLIENT de outra empresa e PENTESTER não-membro
 * recebem **403 FORBIDDEN** no `GET /vulnerabilities/:id` (mesmo status que as
 * demais rotas do recurso usam — ver a limitação L-04 no `docs/BACKLOG.md`
 * sobre 403-vs-404). Por isso o botão "Editar" pode confiar em
 * `role !== "CLIENT"`: se o PENTESTER chegou aqui, ele é membro do projeto.
 *
 * VOLTAR
 * O botão de voltar usa o histórico do navegador (`navigate(-1)`), não um link
 * fixo para a listagem. É o que preserva os filtros de onde a pessoa veio:
 * um link fixo para `/findings` jogaria fora o recorte que ela montou.
 *
 * QUEM USA
 * Rota `/findings/:id` (App.tsx), aberta pela listagem global e pela aba do
 * projeto.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { decomporVetor } from "../lib/cvss";
import { Breadcrumb } from "../components/ui/navigation";
import { Button, LinkButton } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Alert } from "../components/ui/alert";
import { ErrorState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/card";
import { Badge, SeverityBadge, StatusBadge } from "../components/ui/badge";
import { RiskContextChips } from "../components/applications/risk-context-chips";
import { SlaBadge } from "../components/findings/sla-badge";
import { VrsBadge } from "../components/findings/vrs-badge";
import { RiskAcceptancePanel } from "../components/findings/risk-acceptance-panel";
import { HowToFixPanel } from "../components/findings/how-to-fix-panel";
import { transitionLabel } from "../types/vulnerability.types";
import { EvidenceUploader } from "../components/findings/evidence-uploader";
import { CommentTimeline } from "../components/findings/comment-timeline";
import { AuditTrail } from "../components/findings/audit-trail";
import { OverrideSeverityDialog } from "../components/findings/override-severity-dialog";
import {
  ALLOWED_TRANSITIONS,
  OWASP_LABELS,
  type OwaspCategory,
  type VulnerabilityStatus,
} from "../types/vulnerability.types";

export function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const companyRole = useAuthStore((s) => s.user?.companyRole);
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();

  const [erro, setErro] = useState<string | null>(null);
  const [overrideAberto, setOverrideAberto] = useState(false);

  const {
    data: finding,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["vulnerabilities", id],
    queryFn: () => vulnerabilitiesApi.getById(id!),
    enabled: !!id,
  });

  const transicao = useMutation({
    mutationFn: (toStatus: VulnerabilityStatus) => vulnerabilitiesApi.transition(id!, toStatus),
    onSuccess: () => {
      // A trilha ganhou um evento novo e a listagem tem um status diferente —
      // invalidar as duas evita a tela mostrar o status novo com a história velha.
      queryClient.invalidateQueries({ queryKey: ["vulnerabilities", id] });
      queryClient.invalidateQueries({ queryKey: ["vulnerabilities", "search"] });
      setErro(null);
    },
    onError: (err: unknown) => setErro(getErrorMessage(err)),
  });

  if (isLoading) return <EsqueletoDaPagina />;

  if (error || !finding) {
    return (
      <ErrorState
        titulo="Não foi possível abrir este finding"
        descricao="Ele pode ter sido removido, ou você não tem acesso a ele."
        aoTentarNovamente={() => navigate(-1)}
      />
    );
  }

  const owaspLabel = OWASP_LABELS[finding.owaspCategory as OwaspCategory] ?? finding.owaspCategory;
  const metricas = decomporVetor(finding.cvssVector);
  const temOverride = finding.severityFinal !== finding.severityCalculated;
  const transicoes = ALLOWED_TRANSITIONS[finding.status] ?? [];
  const podeEscrever = role !== "CLIENT";
  // Quem pode PEDIR aceite (D10): ADMIN, CLIENT OWNER, PENTESTER membro.
  // O CLIENT MEMBER fica de fora; o backend confere a filiação do pentester.
  const podeSolicitarAceite =
    role === "ADMIN" || role === "PENTESTER" || (role === "CLIENT" && companyRole === "OWNER");

  return (
    <div>
      <Breadcrumb
        itens={[
          { rotulo: finding.companyName ?? "Empresa" },
          {
            rotulo: finding.applicationName ?? "Aplicação",
            para: finding.applicationId ? `/applications/${finding.applicationId}/dashboard` : undefined,
          },
          { rotulo: finding.projectName ?? "Projeto", para: `/projects/${finding.projectId}` },
          { rotulo: finding.title },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-2 inline-flex items-center gap-1 rounded-control text-sm text-fg-muted transition-colors duration-fast hover:text-fg"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="m10 3-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar
          </button>

          <h1 className="text-2xl font-bold text-fg">{finding.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={finding.status} />
            <SeverityBadge severidade={finding.severityFinal} cvss={finding.cvssScore} />
            {/* Risco aceito é um badge AO LADO do status (CP-4), nunca no lugar
                dele: o finding continua aberto, e a tela precisa mostrar isso. */}
            {finding.sla?.state === "ACCEPTED" && <Badge tom="acento">Risco aceito</Badge>}
            <span className="text-xs text-fg-muted">{owaspLabel}</span>
          </div>

          {/* Onde o finding ESTÁ (CP-1). Vem embutido no DTO — o PENTESTER não
              lê /applications, e é justamente ele quem mais precisa saber se
              isto é uma app crítica exposta ou um ambiente de dev interno. */}
          {finding.applicationContext && (
            <RiskContextChips contexto={finding.applicationContext} className="mt-2" />
          )}

          {/* Responsável pela remediação (CP-7). Só leitura aqui: atribuir é
              operação do quadro de remediação, onde se vê a fila inteira e a
              decisão "quem pega o quê" faz sentido. */}
          <p className="mt-2 text-sm text-fg-muted">
            Responsável:{" "}
            {finding.assigneeName ? (
              <span className="font-medium text-fg">{finding.assigneeName}</span>
            ) : (
              <span>ninguém ainda — atribua no <Link to="/remediation" className="text-accent-ink hover:underline">quadro de remediação</Link></span>
            )}
          </p>

          {/* VRS (CP-3): prioridade contextual ao lado do CVSS — nunca no lugar
              dele. O número vem do banco; a explicação parcela a parcela vem
              junto (`vrs.factors`) e é desenhada como lista, não escondida. */}
          {finding.vrs && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span>Prioridade (VRS):</span>
              <VrsBadge score={finding.vrs.score} band={finding.vrs.band} factors={finding.vrs.factors} />
              {finding.vrs.factors && (
                <span className="font-mono" data-numeric>
                  = CVSS {finding.vrs.factors.cvss.toFixed(1)}×6 → {finding.vrs.factors.basePoints}
                  {finding.vrs.factors.factors.map((f) => ` + ${f.points}`).join("")}
                </span>
              )}
            </div>
          )}

          {/* SLA (CP-2): frase, não só cor — "vence em 2 dias" / "vencido há 4 dias".
              O estado vem derivado do servidor; aqui só se desenha. */}
          {finding.sla && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span>SLA de remediação:</span>
              <SlaBadge state={finding.sla.state} remainingMs={finding.sla.remainingMs} dueAt={finding.sla.dueAt} />
              {finding.sla.dueAt && (
                <span>
                  prazo {new Date(finding.sla.dueAt).toLocaleDateString("pt-BR")}
                  {finding.sla.pausedMs > 0 && " (inclui pausa por risco aceito)"}
                </span>
              )}
            </div>
          )}
        </div>

        {podeEscrever && (
          <div className="flex flex-wrap gap-2">
            {transicoes.map((destino) => (
              <Button
                key={destino}
                variant="secundario"
                disabled={transicao.isPending}
                onClick={() => transicao.mutate(destino)}
              >
                {transitionLabel(finding.status, destino)}
              </Button>
            ))}
            <Button variant="sutil" onClick={() => setOverrideAberto(true)}>
              Sobrescrever severidade
            </Button>
            <LinkButton to={`/findings/${finding.id}/edit`}>Editar</LinkButton>
          </div>
        )}
      </div>

      {erro && <Alert className="mt-4">{erro}</Alert>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* A sobrescrita vem ANTES da descrição de propósito: quem abre um
              finding cuja severidade foi alterada à mão precisa saber disso
              antes de ler qualquer outra coisa. */}
          {temOverride && (
            <Card className="border-warning">
              <h2 className="mb-3 font-semibold text-fg">Severidade sobrescrita manualmente</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-fg-muted">Calculada pelo CVSS</dt>
                  <dd className="mt-1">
                    <SeverityBadge severidade={finding.severityCalculated} cvss={finding.cvssScore} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-fg-muted">Aplicada</dt>
                  <dd className="mt-1">
                    <SeverityBadge severidade={finding.severityFinal} />
                  </dd>
                </div>
              </dl>
              {finding.severityOverrideReason && (
                <div className="mt-3">
                  <p className="text-xs uppercase text-fg-muted">Justificativa registrada</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{finding.severityOverrideReason}</p>
                </div>
              )}
            </Card>
          )}

          {/* Aceite formal de risco (CP-4) — seção própria: o aceite não é o
              status do finding, é uma decisão paralela com autor e validade. */}
          <RiskAcceptancePanel vulnerabilityId={finding.id} canRequest={podeSolicitarAceite} />

          {/* "Como corrigir" (CP-5): playbooks da categoria OWASP deste
              finding — o da própria empresa antes do oficial da OWASP. Fica
              ANTES da descrição técnica porque quem abre um finding aberto
              quer saber o que fazer, não reler o que já sabe. */}
          <HowToFixPanel owaspCategory={finding.owaspCategory} companyId={finding.companyId} />

          <Card>
            <h2 className="mb-2 font-semibold text-fg">Descrição</h2>
            <p className="whitespace-pre-wrap text-sm text-fg">{finding.description}</p>
          </Card>

          {finding.cvssVector && (
            <Card>
              <h2 className="mb-2 font-semibold text-fg">CVSS 3.1</h2>
              <p className="break-all font-mono text-sm text-fg">{finding.cvssVector}</p>
              <p className="mt-1 text-sm text-fg-muted">
                Score:{" "}
                <span data-numeric className="tabular-nums">
                  {finding.cvssScore?.toFixed(1) ?? "—"}
                </span>{" "}
                · Severidade calculada: {finding.severityCalculated}
              </p>

              {metricas ? (
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  {metricas.map((m) => (
                    <div key={m.sigla}>
                      <dt className="text-xs text-fg-muted" title={m.nome}>
                        {m.sigla} · {m.nome}
                      </dt>
                      <dd className="text-sm font-medium text-fg">{m.rotulo}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-fg-muted">
                  O vetor registrado não pôde ser decomposto — pode estar incompleto ou em outra versão do CVSS.
                </p>
              )}
            </Card>
          )}

          {finding.impact && (
            <Card>
              <h2 className="mb-2 font-semibold text-fg">Impacto</h2>
              <p className="whitespace-pre-wrap text-sm text-fg">{finding.impact}</p>
            </Card>
          )}

          {finding.recommendation && (
            <Card>
              <h2 className="mb-2 font-semibold text-fg">Recomendação</h2>
              <p className="whitespace-pre-wrap text-sm text-fg">{finding.recommendation}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold text-fg">Trilha de auditoria</h2>
            <AuditTrail vulnerabilityId={finding.id} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 font-semibold text-fg">Evidências</h2>
            <EvidenceUploader vulnerabilityId={finding.id} canUpload={false} />
          </div>
          <div>
            <h2 className="mb-3 font-semibold text-fg">Comentários</h2>
            <CommentTimeline vulnerabilityId={finding.id} />
          </div>
        </div>
      </div>

      {podeEscrever && (
        <OverrideSeverityDialog
          vulnerabilityId={finding.id}
          currentSeverity={finding.severityFinal}
          open={overrideAberto}
          onOpenChange={setOverrideAberto}
        />
      )}
    </div>
  );
}

/** Esqueleto com a forma da página — reserva a altura e evita o salto de layout. */
function EsqueletoDaPagina() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-4 w-[16rem]" />
      <Skeleton className="mt-4 h-8 w-[24rem] max-w-full" />
      <Skeleton className="mt-3 h-6 w-[12rem]" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-[8rem] w-full" />
          <Skeleton className="h-[10rem] w-full" />
        </div>
        <Skeleton className="h-[16rem] w-full" />
      </div>
    </div>
  );
}
