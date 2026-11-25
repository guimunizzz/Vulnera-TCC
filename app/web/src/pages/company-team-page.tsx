/**
 * Gestão de pessoas, convites e trilha de eventos da empresa do OWNER autenticado.
 * A API define tenant e autorização; esta página só apresenta ações permitidas.
 * Consumida pela rota protegida /team.
 */
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Field, Input } from "../components/ui";
import { useApiError } from "../hooks/use-api-error";
import { companyInvitationsApi } from "../lib/api/company-invitations.api";
import { useAuthStore } from "../store/auth.store";
import type { CompanyInvitation } from "../types/company-invitations.types";

type Notice = { kind: "success" | "error" | "warning"; text: string } | null;
const labels = { PENDING: "Pendente", ACCEPTED: "Aceito", REVOKED: "Revogado", EXPIRED: "Expirado" };
const eventLabels: Record<string, string> = {
  ISSUED: "Convite emitido",
  REISSUED: "Convite reemitido",
  RESENT: "Convite reenviado",
  DELIVERY_FAILED: "Falha no envio do e-mail",
  REVOKED: "Convite revogado",
  ACCEPTED: "Convite aceito",
  DEACTIVATE: "Membro desativado",
};

function responseStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function CompanyTeamPage() {
  const user = useAuthStore((state) => state.user);
  const owner = user?.role === "CLIENT" && user.companyRole === "OWNER" && Boolean(user.companyId);
  const sessionScope = `${user?.id ?? "anonymous"}:${user?.companyId ?? "none"}`;
  const activeScope = useRef(sessionScope);
  activeScope.current = sessionScope;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const teamKey = ["company-team", user?.id, user?.companyId] as const;
  const members = useQuery({
    queryKey: [...teamKey, "members"],
    queryFn: companyInvitationsApi.listMembers,
    enabled: owner,
  });
  const invitations = useQuery({
    queryKey: [...teamKey, "invitations"],
    queryFn: companyInvitationsApi.list,
    enabled: owner,
  });
  const history = useQuery({
    queryKey: [...teamKey, "history"],
    queryFn: companyInvitationsApi.history,
    enabled: owner,
  });

  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...teamKey, "members"] }),
      queryClient.invalidateQueries({ queryKey: [...teamKey, "invitations"] }),
      queryClient.invalidateQueries({ queryKey: [...teamKey, "history"] }),
    ]);
  }
  function onFailure(error: unknown) {
    if (activeScope.current !== sessionScope) return;
    if (responseStatus(error) === 409) {
      setNotice({ kind: "error", text: "O convite não está disponível para esta ação. A lista foi atualizada." });
      void refresh();
    } else if (responseStatus(error) === 429) {
      setNotice({ kind: "error", text: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." });
    } else {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    }
  }
  function onDelivery(delivery: "SENT" | "DELIVERY_FAILED", verb: string) {
    if (activeScope.current !== sessionScope) return;
    setNotice(delivery === "SENT"
      ? { kind: "success", text: `${verb} e enviado por e-mail.` }
      : { kind: "warning", text: `${verb}, mas o e-mail não foi entregue. O convite foi encerrado; verifique o endereço e crie um novo convite para continuar.` });
    void refresh();
  }
  const create = useMutation({
    mutationFn: companyInvitationsApi.create,
    onSuccess: ({ delivery }) => {
      if (activeScope.current !== sessionScope) return;
      setName("");
      setEmail("");
      onDelivery(delivery, "Convite registrado");
    },
    onError: onFailure,
  });
  const resend = useMutation({
    mutationFn: companyInvitationsApi.resend,
    onSuccess: ({ delivery }) => onDelivery(delivery, "Convite atualizado"),
    onError: onFailure,
  });
  const revoke = useMutation({
    mutationFn: companyInvitationsApi.revoke,
    onSuccess: () => {
      if (activeScope.current !== sessionScope) return;
      setNotice({ kind: "success", text: "Convite revogado." });
      void refresh();
    },
    onError: onFailure,
  });
  const deactivate = useMutation({
    mutationFn: companyInvitationsApi.deactivateMember,
    onSuccess: () => {
      if (activeScope.current !== sessionScope) return;
      setNotice({ kind: "success", text: "Acesso da pessoa desativado." });
      void refresh();
    },
    onError: onFailure,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || create.isPending || !name.trim() || !email.trim()) return;
    setNotice(null);
    create.mutate({ name: name.trim(), email: email.trim() });
  }
  function confirmRevoke(invitation: CompanyInvitation) {
    if (window.confirm(`Revogar o convite enviado para ${invitation.email}?`)) revoke.mutate(invitation.id);
  }
  function confirmDeactivate(member: { id: string; name: string }) {
    if (window.confirm(`Desativar o acesso de ${member.name}? As sessões dessa pessoa serão encerradas.`)) deactivate.mutate(member.id);
  }

  if (!owner) {
    return (
      <section className="mx-auto max-w-5xl p-6" aria-labelledby="team-title">
        <h1 id="team-title" className="text-2xl font-bold text-fg">Minha equipe</h1>
        <Alert className="mt-5" tom="perigo">
          A gestão da equipe está disponível somente para o OWNER da empresa.
        </Alert>
      </section>
    );
  }

  const activeInvitations = invitations.data?.filter((invitation) => invitation.status === "PENDING") ?? [];
  const busy = create.isPending || resend.isPending || revoke.isPending || deactivate.isPending;
  return (
    <section className="mx-auto max-w-6xl space-y-6 p-4 md:p-8" aria-labelledby="team-title">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-accent-ink">Empresa</p>
        <h1 id="team-title" className="mt-1 text-3xl font-bold text-fg">Minha equipe</h1>
        <p className="mt-2 text-fg-muted">Convide pessoas como membros e acompanhe as alterações realizadas.</p>
      </header>
      {notice && (
        <Alert
          tom={notice.kind === "success" ? "sucesso" : notice.kind === "warning" ? "atencao" : "perigo"}
          aoFechar={() => setNotice(null)}
        >
          {notice.text}
        </Alert>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Convidar membro</h2>
          <p className="text-sm text-fg-muted">O convite dá acesso operacional como MEMBER.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={submit}>
          <Field rotulo="Nome" obrigatorio>
            {(attrs) => <Input {...attrs} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <Field rotulo="E-mail" obrigatorio>
            {(attrs) => <Input {...attrs} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
          </Field>
          <Button type="submit" disabled={busy || !name.trim() || !email.trim()} carregando={create.isPending}>
            Enviar convite
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-semibold text-fg">Pessoas</h2>
        {members.isLoading && <p role="status">Carregando equipe…</p>}
        {members.isError && (
          <div role="alert">
            <p>Não foi possível carregar a equipe.</p>
            <Button variant="secundario" onClick={() => void members.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {members.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Membros ativos da empresa</caption>
              <thead>
                <tr className="border-b border-subtle text-fg-muted">
                  <th scope="col" className="p-3">Nome</th>
                  <th scope="col" className="p-3">E-mail</th>
                  <th scope="col" className="p-3">Papel</th>
                  <th scope="col" className="p-3">Desde</th>
                  <th scope="col" className="p-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {members.data.map((member) => (
                  <tr key={member.id} className="border-b border-subtle">
                    <th scope="row" className="p-3 font-medium text-fg">{member.name}</th>
                    <td className="p-3">{member.email}</td>
                    <td className="p-3">{member.companyRole === "OWNER" ? "Responsável" : "Membro"}</td>
                    <td className="p-3">{new Date(member.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      {member.companyRole === "MEMBER" && (
                        <Button size="sm" variant="destrutivo" disabled={busy} onClick={() => confirmDeactivate(member)}>
                          Desativar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-semibold text-fg">Convites</h2>
        {invitations.isLoading && <p role="status">Carregando convites…</p>}
        {invitations.isError && (
          <div role="alert">
            <p>Não foi possível carregar convites.</p>
            <Button variant="secundario" onClick={() => void invitations.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {invitations.data?.length === 0 && <p className="text-sm text-fg-muted">Nenhum convite enviado.</p>}
        {invitations.data && invitations.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <caption className="sr-only">Histórico de convites</caption>
              <thead>
                <tr className="border-b border-subtle text-fg-muted">
                  <th scope="col" className="p-3">Pessoa</th>
                  <th scope="col" className="p-3">Estado</th>
                  <th scope="col" className="p-3">Enviado</th>
                  <th scope="col" className="p-3">Expira</th>
                  <th scope="col" className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invitations.data.map((invitation) => (
                  <tr key={invitation.id} className="border-b border-subtle">
                    <th scope="row" className="p-3 font-medium text-fg">
                      {invitation.name}
                      <span className="block font-normal text-fg-muted">{invitation.email}</span>
                    </th>
                    <td className="p-3">{labels[invitation.status]}</td>
                    <td className="p-3">{new Date(invitation.issuedAt).toLocaleString("pt-BR")}</td>
                    <td className="p-3">{new Date(invitation.expiresAt).toLocaleString("pt-BR")}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {(invitation.status === "PENDING" || invitation.status === "EXPIRED") && (
                          <Button size="sm" variant="secundario" disabled={busy} onClick={() => resend.mutate(invitation.id)}>
                            Reenviar
                          </Button>
                        )}
                        {invitation.status === "PENDING" && (
                          <Button size="sm" variant="destrutivo" disabled={busy} onClick={() => confirmRevoke(invitation)}>
                            Revogar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeInvitations.length > 0 && (
          <p className="mt-3 text-sm text-fg-muted">{activeInvitations.length} convite(s) aguardando ativação.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-semibold text-fg">Histórico de eventos</h2>
        <p className="mb-4 text-sm text-fg-muted">
          Registro cronológico de emissões, reenvios, falhas de entrega, aceitações e revogações.
        </p>
        {history.isLoading && <p role="status">Carregando histórico…</p>}
        {history.isError && (
          <div role="alert">
            <p>Não foi possível carregar o histórico.</p>
            <Button variant="secundario" onClick={() => void history.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {history.data?.length === 0 && <p className="text-sm text-fg-muted">Nenhum evento registrado.</p>}
        {history.data && history.data.length > 0 && (
          <ol className="space-y-3">
            {[...history.data]
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
              .map((event) => (
                <li key={event.id} className="border-l-2 border-accent pl-4">
                  <strong className="text-fg">{eventLabels[event.action] ?? "Evento de convite"}</strong>
                  <span className="block text-sm text-fg-muted">{event.email ?? "Convite"} · por {event.actorName}</span>
                  <time className="text-xs text-fg-muted" dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString("pt-BR")}
                  </time>
                </li>
              ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
