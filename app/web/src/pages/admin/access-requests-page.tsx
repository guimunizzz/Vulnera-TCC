/**
 * O que faz: centraliza adesões empresariais e solicitações comerciais para o ADMIN.
 * Por que existe: reúne a navegação administrativa preservando os dois domínios de aprovação.
 * Quem consome: rota protegida de administração e equipe ADMIN.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { PendingSubscriptionsPage } from "./pending-subscriptions-page";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { TABELA } from "../../components/ui/table-estilos";
import { useApiError } from "../../hooks/use-api-error";
import { adminAccessRequestsApi } from "../../lib/api/admin-access-requests.api";
import { useAuthStore } from "../../store/auth.store";
import type { AdminAccessRequest, AdminAccessRequestStatus } from "../../types/admin-access-requests.types";
import "./access-requests-page.css";

type Action = { type: "approve" | "reject" | "resend"; request: AdminAccessRequest } | null;
const PAGE_SIZE = 20;
const LABELS: Record<AdminAccessRequestStatus | "ALL", string> = {
  ALL: "Todos os estados",
  PENDING_EMAIL_VERIFICATION: "Aguardando verificação de e-mail",
  PENDING_REVIEW: "Aguardando análise",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  EXPIRED: "Expirada",
  ACTIVATED: "Conta ativada",
};
const statusOptions = Object.entries(LABELS).map(([valor, rotulo]) => ({ valor, rotulo }));
const ENROLLMENT_LABELS = {
  LEGACY: "Legada",
  ELIGIBLE: "Plano compatível",
  PLAN_NOT_FOUND: "Plano indisponível",
  PLAN_UNAVAILABLE: "Plano indisponível",
  PLAN_CHANGED: "Condições do plano alteradas",
  COMPANY_CNPJ_CONFLICT: "CNPJ já cadastrado",
} as const;

export function AccessRequestsPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const [searchParams] = useSearchParams();
  const isCommercial = searchParams.get("section") === "commercial";

  if (!isAdmin) return <section className="access-requests-page"><h1>Central de solicitações</h1><Alert tom="perigo">Acesso restrito a administradores.</Alert></section>;

  return (
    <section className="access-requests-page" data-ops-hero="governance" aria-labelledby="access-requests-title">
      <header className="access-requests-header">
        <p className="access-requests-eyebrow">Administração</p>
        <h1 id="access-requests-title">Central de solicitações</h1>
        <p>Revise adesões empresariais e solicitações comerciais em um só lugar.</p>
      </header>
      <nav className="access-requests-sections" aria-label="Seções da central de solicitações">
        <Link to="/admin/access-requests" aria-current={!isCommercial ? "page" : undefined}>Adesões empresariais</Link>
        <Link to="/admin/access-requests?section=commercial" aria-current={isCommercial ? "page" : undefined}>Solicitações comerciais</Link>
      </nav>
      {isCommercial ? <PendingSubscriptionsPage /> : <BusinessEnrollmentRequestsPanel />}
    </section>
  );
}

function BusinessEnrollmentRequestsPanel() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ADMIN";
  const [status, setStatus] = useState<AdminAccessRequestStatus | "ALL">("PENDING_REVIEW");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const inFlight = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timeout = window.setTimeout(() => setCooldownUntil(0), cooldownUntil - Date.now());
    return () => window.clearTimeout(timeout);
  }, [cooldownUntil]);

  const listQuery = useQuery({
    queryKey: ["admin-access-requests", "list", status, page],
    queryFn: () => adminAccessRequestsApi.list({ page, pageSize: PAGE_SIZE, ...(status === "ALL" ? {} : { status }) }),
    enabled: isAdmin,
  });
  const detailQuery = useQuery({
    queryKey: ["admin-access-requests", "detail", selectedId],
    queryFn: () => adminAccessRequestsApi.get(selectedId!),
    enabled: isAdmin && Boolean(selectedId),
  });
  const eventsQuery = useQuery({
    queryKey: ["admin-access-requests", "events", selectedId, eventPage],
    queryFn: () => adminAccessRequestsApi.events(selectedId!, { page: eventPage, pageSize: PAGE_SIZE }),
    enabled: isAdmin && Boolean(selectedId),
  });

  const handleError = (err: unknown) => {
    const code = (err as { response?: { status?: number; data?: { error?: string }; headers?: Record<string, string> } })?.response;
    if (code?.status === 429 && code.data?.error === "ACCESS_INVITATION_COOLDOWN") {
      const seconds = Number(code.headers?.["retry-after"] ?? 1);
      setCooldownUntil(Date.now() + Math.max(1, seconds) * 1000);
      setError(`Aguarde ${Math.max(1, seconds)} segundo(s) antes de tentar enviar novamente.`);
      return;
    }
    const message = getErrorMessage(err);
    setError(message);
    if (code?.status === 409) {
      void queryClient.invalidateQueries({ queryKey: ["admin-access-requests", "list"] });
      if (selectedId) void queryClient.invalidateQueries({ queryKey: ["admin-access-requests", "detail", selectedId] });
    }
  };

  const mutation = useMutation({
    mutationFn: async ({ type, id, reason: rejectionReason }: { type: "approve" | "reject" | "resend"; id: string; reason: string }) => {
      if (type === "approve") return { kind: "decision" as const, result: await adminAccessRequestsApi.approve(id) };
      if (type === "reject") return { kind: "rejection" as const, result: await adminAccessRequestsApi.reject(id, { reason: rejectionReason.trim() || null }) };
      return { kind: "delivery" as const, result: await adminAccessRequestsApi.resendInvitation(id) };
    },
    onSuccess: async (result, variables) => {
      setAction(null);
      setReason("");
      setError(null);
      setDeliveryFailed(result.kind !== "rejection" && result.result.invitationDelivery === "DELIVERY_FAILED");
      const returnedRequest = result.result.request;
      queryClient.setQueryData(["admin-access-requests", "detail", variables.id], returnedRequest);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-access-requests", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-access-requests", "detail", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-access-requests", "events", variables.id] }),
      ]);
      if (selectedIdRef.current !== variables.id) setDeliveryFailed(false);
    },
    onError: handleError,
    onSettled: () => { inFlight.current = false; },
  });

  const selected = detailQuery.data;
  const canReview = selected?.status === "PENDING_REVIEW" && Boolean(selected.emailVerifiedAt)
    && (selected.enrollmentEligibility === "LEGACY" || selected.enrollmentEligibility === "ELIGIBLE");
  const incompatibleApproved = selected?.status === "APPROVED"
    && Boolean(selected.enrollment)
    && selected.enrollmentEligibility !== "LEGACY"
    && selected.enrollmentEligibility !== "ELIGIBLE";
  const rejectable = (selected?.status === "PENDING_REVIEW" && Boolean(selected.emailVerifiedAt)) || incompatibleApproved;
  const rejectionReasonRequired = Boolean(incompatibleApproved);
  const canResend = selected?.status === "APPROVED" && !selected.invitation?.usedAt;
  const isBusy = mutation.isPending;

  function beginAction(type: NonNullable<Action>["type"], request: AdminAccessRequest) {
    if (!isAdmin || inFlight.current) return;
    setError(null);
    setAction({ type, request });
    setReason("");
  }

  function confirm() {
    if (!isAdmin || !action || inFlight.current) return;
    if (action.type === "approve" && (!canReview || action.request.status !== "PENDING_REVIEW" || !action.request.emailVerifiedAt)) return;
    if (action.type === "reject" && !rejectable) return;
    if (action.type === "reject" && rejectionReasonRequired && !reason.trim()) {
      setError("Informe o motivo para rejeitar uma adesão aprovada incompatível.");
      return;
    }
    if (action.type === "resend" && action.request.status !== "APPROVED") return;
    inFlight.current = true;
    mutation.mutate({ type: action.type, id: action.request.id, reason });
  }

  function retryQueries() {
    if (selectedId) {
      void detailQuery.refetch();
      void eventsQuery.refetch();
    } else void listQuery.refetch();
  }

  if (!isAdmin) return <section className="access-requests-page"><h1>Solicitações de acesso</h1><Alert tom="perigo">Acesso restrito a administradores.</Alert></section>;

  const pages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / PAGE_SIZE));
  return (
    <section className="access-requests-panel" aria-labelledby="business-enrollments-title">
      <header className="access-requests-panel-heading">
        <h2 id="business-enrollments-title">Adesões empresariais</h2>
        <p>Aprove responsável, empresa e plano em uma única decisão. Pedidos de acesso legados e seus históricos continuam disponíveis nesta fila.</p>
      </header>

      {error && <Alert className="access-requests-alert" tom="perigo" aoFechar={() => setError(null)}>{error}</Alert>}
      {deliveryFailed && selected?.status === "APPROVED" && (
        <Alert className="access-requests-alert" tom="atencao">A solicitação foi aprovada, mas o convite não foi enviado. Você pode tentar enviar novamente nesta tela.</Alert>
      )}

      <section className="access-requests-toolbar" aria-label="Filtros da fila">
        <label className="access-requests-filter-label" htmlFor="access-status-filter">Filtrar solicitações por estado</label>
        <Select id="access-status-filter" aria-label={`Filtrar solicitações por estado, ${LABELS[status]}`} opcoes={statusOptions} valor={status} aoMudar={(next) => { setStatus(next as AdminAccessRequestStatus | "ALL"); setPage(1); setSelectedId(null); setDeliveryFailed(false); }} />
        <span className="access-requests-total">{listQuery.data?.total ?? 0} solicitações</span>
      </section>

      {listQuery.isLoading ? <p role="status" className="access-requests-state">Carregando solicitações…</p> : null}
      {listQuery.isError && <div className="access-requests-state"><p>Não foi possível carregar as solicitações.</p><Button variant="secundario" onClick={retryQueries}>Tentar novamente</Button></div>}
      {!listQuery.isLoading && !listQuery.isError && listQuery.data?.items.length === 0 && <p className="access-requests-state">Nenhuma solicitação neste estado.</p>}
      {listQuery.data && listQuery.data.items.length > 0 && (
        <div className="access-requests-table-scroll">
          <table className="access-requests-table">
            <caption className="sr-only">Solicitações de acesso recebidas</caption>
            <thead className={TABELA.cabecalho}><tr><th scope="col">Pessoa</th><th scope="col">Empresa</th><th scope="col">Adesão</th><th scope="col">Recebida em</th><th scope="col">Estado</th><th scope="col">Ações</th></tr></thead>
            <tbody>{listQuery.data.items.map((request) => <tr key={request.id} className={TABELA.linha} aria-selected={request.id === selectedId}>
              <th scope="row"><button className="access-requests-person" onClick={() => { setSelectedId(request.id); setEventPage(1); setDeliveryFailed(false); }}>{request.name}<span>{request.email}</span></button></th>
              <td>{request.companyName}</td><td>{request.enrollmentEligibility ? ENROLLMENT_LABELS[request.enrollmentEligibility] : request.enrollment ? "Plano selecionado" : "Legada"}</td><td>{new Date(request.createdAt).toLocaleString("pt-BR")}</td><td>{LABELS[request.status]}</td>
              <td><Button size="sm" variant="secundario" onClick={() => { setSelectedId(request.id); setEventPage(1); }}>Ver detalhes</Button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <nav className="access-requests-pagination" aria-label="Paginação de solicitações">
        <Button variant="secundario" disabled={page <= 1 || listQuery.isFetching} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
        <span>Página {page} de {pages}</span>
        <Button variant="secundario" disabled={page >= pages || listQuery.isFetching} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
      </nav>

      {selectedId && <section className="access-requests-detail" aria-label="Detalhes da solicitação">
        <div className="access-requests-detail-heading"><div><p className="access-requests-eyebrow">Detalhe e auditoria</p><h2>{selected?.name ?? "Solicitação"}</h2></div><Button variant="sutil" onClick={() => { setSelectedId(null); setDeliveryFailed(false); }}>Fechar detalhes</Button></div>
        {detailQuery.isLoading && <p role="status">Carregando detalhes…</p>}
        {detailQuery.isError && <div><p>Não foi possível carregar o detalhe.</p><Button variant="secundario" onClick={() => void detailQuery.refetch()}>Tentar novamente</Button></div>}
        {selected && <>
          <dl className="access-requests-facts"><div><dt>Responsável</dt><dd>{selected.name}</dd></div><div><dt>E-mail</dt><dd>{selected.email}</dd></div><div><dt>Empresa</dt><dd>{selected.companyName}</dd></div><div><dt>Telefone</dt><dd>{selected.phone ?? "Não informado"}</dd></div><div><dt>Estado</dt><dd>{LABELS[selected.status]}</dd></div><div><dt>E-mail verificado</dt><dd>{selected.emailVerifiedAt ? new Date(selected.emailVerifiedAt).toLocaleString("pt-BR") : "Ainda não"}</dd></div><div><dt>Expira em</dt><dd>{new Date(selected.expiresAt).toLocaleString("pt-BR")}</dd></div><div><dt>Motivo da recusa</dt><dd>{selected.rejectionReason ?? "—"}</dd></div>
            <div><dt>Adesão</dt><dd>{selected.enrollment ? "Solicitação unificada" : "Solicitação legada"}</dd></div>
            {selected.enrollment && <><div><dt>CNPJ</dt><dd>{selected.enrollment.companyCnpj ?? "Não informado"}</dd></div><div><dt>Plano analisado</dt><dd>{selected.enrollment.planName} · {formatPrice(selected.enrollment.planPrice)}</dd></div><div><dt>Limites do plano</dt><dd>{selected.enrollment.planMaxApplications} aplicações · {selected.enrollment.planMaxProjects} projetos · {selected.enrollment.planIncludesRemediation ? "com remediação" : "sem remediação"}</dd></div></>}
            <div><dt>Compatibilidade atual</dt><dd>{ENROLLMENT_LABELS[selected.enrollmentEligibility]}</dd></div>
          </dl>
          {selected.enrollmentEligibility !== "ELIGIBLE" && selected.enrollmentEligibility !== "LEGACY" && <Alert className="access-requests-alert" tom="atencao">As condições desta adesão mudaram ou não estão disponíveis. Revise os dados antes de decidir. A solicitação aprovada pode ser rejeitada com um motivo.</Alert>}
          <div className="access-requests-actions">
            {selected.status === "PENDING_REVIEW" && <Button disabled={!canReview || isBusy} onClick={() => beginAction("approve", selected)}>Aprovar</Button>}
            {(selected.status === "PENDING_REVIEW" || incompatibleApproved) && <Button variant="destrutivo" disabled={!rejectable || isBusy} onClick={() => beginAction("reject", selected)}>Rejeitar</Button>}
            {selected.status === "APPROVED" && <Button variant="secundario" disabled={!canResend || isBusy || cooldownUntil > Date.now()} onClick={() => beginAction("resend", selected)}>Reenviar convite</Button>}
          </div>
        </>}
        <section className="access-requests-history" aria-label="Histórico de eventos"><h3>Histórico</h3>
          {eventsQuery.isLoading && <p role="status">Carregando histórico…</p>}
          {eventsQuery.isError && <div><p>Não foi possível carregar o histórico.</p><Button variant="secundario" onClick={() => void eventsQuery.refetch()}>Tentar novamente</Button></div>}
          {eventsQuery.data?.items.length === 0 && <p>Nenhum evento registrado.</p>}
          {eventsQuery.data && eventsQuery.data.items.length > 0 && <ol>{eventsQuery.data.items.map((event) => <li key={event.id}><strong>{event.eventType}</strong><span>{event.fromStatus ? `${LABELS[event.fromStatus as AdminAccessRequestStatus] ?? event.fromStatus} → ` : ""}{LABELS[event.toStatus as AdminAccessRequestStatus] ?? event.toStatus}</span>{event.reason && <p>{event.reason}</p>}<time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("pt-BR")}</time></li>)}</ol>}
          <div className="access-requests-pagination"><Button variant="secundario" disabled={eventPage <= 1 || eventsQuery.isFetching} onClick={() => setEventPage((value) => value - 1)}>Anterior</Button><span>Página {eventPage} de {Math.max(1, Math.ceil((eventsQuery.data?.total ?? 0) / PAGE_SIZE))}</span><Button variant="secundario" disabled={!eventsQuery.data || eventPage * PAGE_SIZE >= eventsQuery.data.total || eventsQuery.isFetching} onClick={() => setEventPage((value) => value + 1)}>Próxima</Button></div>
        </section>
      </section>}

      <Dialog aberto={Boolean(action)} aoFechar={() => { if (!isBusy) setAction(null); }} tamanho={action?.type === "reject" ? "md" : "sm"}>
        <DialogTitle>{action?.type === "approve" ? "Aprovar solicitação?" : action?.type === "reject" ? "Rejeitar solicitação?" : "Reenviar convite?"}</DialogTitle>
        <DialogDescription>{action?.type === "approve" ? action.request.enrollment ? "Esta decisão aprova o responsável, a empresa e o plano solicitado. A assinatura inicial não exige outra aprovação; o responsável receberá um convite para ativar a conta." : "A pessoa receberá um convite para concluir a criação da conta." : action?.type === "reject" ? rejectionReasonRequired ? "A aprovação será encerrada porque as condições analisadas não são mais compatíveis. Informe o motivo para registrar a decisão." : "A solicitação será marcada como rejeitada. O motivo é opcional." : "Um novo convite será enviado para o e-mail cadastrado."}</DialogDescription>
        {action?.type === "reject" && <Field rotulo={rejectionReasonRequired ? "Motivo obrigatório" : "Motivo (opcional)"} obrigatorio={rejectionReasonRequired} dica="Até 2.000 caracteres.">{(attrs) => <Input {...attrs} value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} />}</Field>}
        <DialogFooter><Button variant="secundario" onClick={() => setAction(null)} disabled={isBusy}>Cancelar</Button><Button variant={action?.type === "reject" ? "destrutivo" : "primario"} onClick={confirm} disabled={isBusy || (action?.type === "resend" && cooldownUntil > Date.now())}>{isBusy ? "Processando…" : "Confirmar"}</Button></DialogFooter>
      </Dialog>
    </section>
  );
}

function formatPrice(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Valor indisponível";
  if (parsed <= 0) return "Sob consulta";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
