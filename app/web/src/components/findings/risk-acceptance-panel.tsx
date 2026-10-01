/**
 * risk-acceptance-panel.tsx
 *
 * O QUE FAZ
 * O painel de aceite formal de risco (CP-4) na página de detalhe do finding:
 * mostra o aceite vigente (ou o pedido em análise), o histórico completo, e
 * oferece as ações que o papel de quem está olhando permite.
 *
 * 🎯 O ACEITE NÃO É O STATUS DO FINDING. O painel é uma seção à parte,
 * abaixo do finding, e o badge de "risco aceito" convive com o StatusBadge —
 * nunca o substitui. Um finding com risco aceito continua `OPEN`, e a tela
 * tem de deixar isso visível, porque é essa distinção que torna o aceite
 * auditável ("sabemos, decidimos conviver") em vez de um jeito de esconder
 * problema.
 *
 * 🎯 SEGREGAÇÃO DE FUNÇÃO NA TELA. Quem solicitou não vê os botões de decidir
 * o próprio pedido — o backend recusa com `CANNOT_APPROVE_OWN_REQUEST`, e um
 * formulário que deixa clicar para só depois dizer "não pode" é hostil. A
 * tela é a cortesia; o backend é a barreira.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - Cada estado é TEXTO ("Risco aceito até 12/10/2026"), não só cor.
 *   - Diálogos usam o `Dialog` do design system (foco preso, Esc fecha).
 *   - Campos com `Field` (rótulo + dica + erro associados por aria).
 *   - O histórico é uma lista ordenada por data, com autor nomeado.
 *
 * QUEM USA
 * `pages/finding-detail-page.tsx`.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { riskAcceptancesApi } from "../../lib/api/risk-acceptances.api";
import { useApiError } from "../../hooks/use-api-error";
import { useAuthStore } from "../../store/auth.store";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Badge, type TomBadge } from "../ui/badge";
import { Dialog, DialogDescription, DialogTitle } from "../ui/dialog";
import {
  RISK_ACCEPTANCE_LIMITS,
  RISK_ACCEPTANCE_STATUS_LABELS,
  type RiskAcceptance,
  type RiskAcceptanceStatus,
} from "../../types/risk-acceptance.types";

const TOM: Record<RiskAcceptanceStatus, TomBadge> = {
  REQUESTED: "atencao",
  APPROVED: "acento",
  REJECTED: "neutro",
  REVOKED: "neutro",
  EXPIRED: "neutro",
};

const DIA_MS = 86_400_000;
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

/** `yyyy-mm-dd` para `<input type="date">`, N dias à frente. */
function dataEmDias(dias: number): string {
  return new Date(Date.now() + dias * DIA_MS).toISOString().slice(0, 10);
}

export interface RiskAcceptancePanelProps {
  vulnerabilityId: string;
  /** Para o painel saber se quem olha pode solicitar (PENTESTER precisa ser membro — o backend confere). */
  canRequest: boolean;
}

export function RiskAcceptancePanel({ vulnerabilityId, canRequest }: RiskAcceptancePanelProps) {
  const user = useAuthStore((s) => s.user);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const [pedirAberto, setPedirAberto] = useState(false);
  const [decidirAlvo, setDecidirAlvo] = useState<RiskAcceptance | null>(null);
  const [revogarAlvo, setRevogarAlvo] = useState<RiskAcceptance | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: aceites, isLoading } = useQuery({
    queryKey: ["risk-acceptances", vulnerabilityId],
    queryFn: () => riskAcceptancesApi.listByVulnerability(vulnerabilityId),
  });

  const vigente = useMemo(() => aceites?.find((a) => a.isActive), [aceites]);
  const emAnalise = useMemo(() => aceites?.find((a) => a.status === "REQUESTED"), [aceites]);
  const historico = useMemo(
    () => (aceites ?? []).filter((a) => a.id !== vigente?.id && a.id !== emAnalise?.id),
    [aceites, vigente, emAnalise],
  );

  // Só ADMIN e CLIENT OWNER decidem; e nunca o próprio pedido (D10).
  const podeDecidir = user?.role === "ADMIN" || (user?.role === "CLIENT" && user?.companyRole === "OWNER");
  const ehMeuPedido = (a: RiskAcceptance) => a.requestedById === user?.id;

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ["risk-acceptances", vulnerabilityId] });
    // o SLA do finding vira/deixa de ser ACCEPTED, e a listagem mostra o badge
    queryClient.invalidateQueries({ queryKey: ["vulnerability", vulnerabilityId] });
    queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
  }

  const solicitar = useMutation({
    mutationFn: (input: { reason: string; businessJustification: string; compensatingControls: string; prazo: string }) =>
      riskAcceptancesApi.request(vulnerabilityId, {
        reason: input.reason,
        businessJustification: input.businessJustification,
        compensatingControls: input.compensatingControls.trim() || null,
        requestedExpiresAt: input.prazo ? new Date(`${input.prazo}T23:59:59`).toISOString() : null,
      }),
    onSuccess: () => {
      invalidar();
      setPedirAberto(false);
    },
    onError: (e: unknown) => setErro(getErrorMessage(e)),
  });

  const aprovar = useMutation({
    mutationFn: (input: { id: string; expiresAt: string; reviewNote: string }) =>
      riskAcceptancesApi.approve(input.id, {
        expiresAt: new Date(`${input.expiresAt}T23:59:59`).toISOString(),
        reviewNote: input.reviewNote.trim() || null,
      }),
    onSuccess: () => {
      invalidar();
      setDecidirAlvo(null);
    },
    onError: (e: unknown) => setErro(getErrorMessage(e)),
  });

  const rejeitar = useMutation({
    mutationFn: (input: { id: string; reviewNote: string }) => riskAcceptancesApi.reject(input.id, input),
    onSuccess: () => {
      invalidar();
      setDecidirAlvo(null);
    },
    onError: (e: unknown) => setErro(getErrorMessage(e)),
  });

  const revogar = useMutation({
    mutationFn: (input: { id: string; reason: string }) => riskAcceptancesApi.revoke(input.id, input),
    onSuccess: () => {
      invalidar();
      setRevogarAlvo(null);
    },
    onError: (e: unknown) => setErro(getErrorMessage(e)),
  });

  if (isLoading) return null;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-fg">Aceite formal de risco</h2>
        {canRequest && !vigente && !emAnalise && (
          <Button variant="secundario" size="sm" onClick={() => { setErro(null); setPedirAberto(true); }}>
            Solicitar aceite
          </Button>
        )}
      </div>

      {erro && <Alert tom="perigo" className="mb-3" aoFechar={() => setErro(null)}>{erro}</Alert>}

      {!vigente && !emAnalise && (
        <p className="text-sm text-fg-muted">
          Nenhum aceite ativo. O risco deste finding não foi formalmente aceito — ele segue no fluxo normal de
          remediação.
        </p>
      )}

      {emAnalise && (
        <div className="rounded-container border border-warning p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tom={TOM.REQUESTED}>{RISK_ACCEPTANCE_STATUS_LABELS.REQUESTED}</Badge>
            <span className="text-sm text-fg-muted">
              solicitado por {emAnalise.requestedByName} em {dataBR(emAnalise.requestedAt)}
              {emAnalise.requestedExpiresAt && ` · prazo pedido até ${dataBR(emAnalise.requestedExpiresAt)}`}
            </span>
          </div>
          <Detalhes aceite={emAnalise} />
          {podeDecidir && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ehMeuPedido(emAnalise) ? (
                <p className="text-xs text-fg-muted">
                  Você solicitou este aceite — quem pede não assina. Outro administrador ou dono da empresa precisa
                  decidir.
                </p>
              ) : (
                <Button size="sm" onClick={() => { setErro(null); setDecidirAlvo(emAnalise); }}>
                  Analisar pedido
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {vigente && (
        <div className="rounded-container border border-subtle bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tom={TOM.APPROVED}>{RISK_ACCEPTANCE_STATUS_LABELS.APPROVED}</Badge>
            <span className="text-sm text-fg">até {dataBR(vigente.expiresAt)}</span>
            <span className="text-sm text-fg-muted">
              aprovado por {vigente.reviewedByName} · solicitado por {vigente.requestedByName}
            </span>
          </div>
          <Alert tom="info" className="mb-3">
            O finding continua <strong>aberto</strong> e conta normalmente nas métricas. O relógio de SLA está pausado
            enquanto o aceite vale.
          </Alert>
          <Detalhes aceite={vigente} />
          {podeDecidir && (
            <div className="mt-3">
              <Button variant="destrutivo" size="sm" onClick={() => { setErro(null); setRevogarAlvo(vigente); }}>
                Revogar aceite
              </Button>
            </div>
          )}
        </div>
      )}

      {historico.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-fg-muted">Histórico ({historico.length})</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {historico.map((a) => (
              <li key={a.id} className="border-l-2 border-subtle pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tom={TOM[a.status]}>{RISK_ACCEPTANCE_STATUS_LABELS[a.status]}</Badge>
                  <span className="text-xs text-fg-muted">
                    pedido por {a.requestedByName} em {dataBR(a.requestedAt)}
                    {a.reviewedByName && ` · decidido por ${a.reviewedByName} em ${dataBR(a.reviewedAt)}`}
                    {a.revokedByName && ` · revogado por ${a.revokedByName} em ${dataBR(a.revokedAt)}`}
                  </span>
                </div>
                {a.reviewNote && <p className="mt-1 text-xs text-fg-muted">Parecer: {a.reviewNote}</p>}
                {a.revokeReason && <p className="mt-1 text-xs text-fg-muted">Motivo da revogação: {a.revokeReason}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* --- solicitar --- */}
      <Dialog aberto={pedirAberto} aoFechar={() => setPedirAberto(false)}>
        <>
          <DialogTitle>Solicitar aceite de risco</DialogTitle>
          <DialogDescription>
            O finding continuará aberto. O aceite registra formalmente que a organização decidiu conviver com este
            risco por um prazo determinado.
          </DialogDescription>
          <FormularioPedido
            pendente={solicitar.isPending}
            onCancelar={() => setPedirAberto(false)}
            onEnviar={(v) => { setErro(null); solicitar.mutate(v); }}
          />
        </>
      </Dialog>

      {/* --- decidir --- */}
      <Dialog aberto={decidirAlvo !== null} aoFechar={() => setDecidirAlvo(null)}>
        <>
          <DialogTitle>Analisar pedido de aceite</DialogTitle>
          <DialogDescription>
            Aprovar pausa o relógio de SLA até a data escolhida. A decisão fica registrada na auditoria e não pode ser
            editada depois.
          </DialogDescription>
          {decidirAlvo && (
            <FormularioDecisao
              aceite={decidirAlvo}
              pendente={aprovar.isPending || rejeitar.isPending}
              onCancelar={() => setDecidirAlvo(null)}
              onAprovar={(expiresAt, reviewNote) => { setErro(null); aprovar.mutate({ id: decidirAlvo.id, expiresAt, reviewNote }); }}
              onRejeitar={(reviewNote) => { setErro(null); rejeitar.mutate({ id: decidirAlvo.id, reviewNote }); }}
            />
          )}
        </>
      </Dialog>

      {/* --- revogar --- */}
      <Dialog aberto={revogarAlvo !== null} aoFechar={() => setRevogarAlvo(null)}>
        <>
          <DialogTitle>Revogar aceite de risco</DialogTitle>
          <DialogDescription>
            O relógio de SLA volta a correr, com o tempo pausado devolvido ao prazo. A revogação fica na auditoria.
          </DialogDescription>
          {revogarAlvo && (
            <FormularioRevogacao
              pendente={revogar.isPending}
              onCancelar={() => setRevogarAlvo(null)}
              onEnviar={(reason) => { setErro(null); revogar.mutate({ id: revogarAlvo.id, reason }); }}
            />
          )}
        </>
      </Dialog>
    </Card>
  );
}

/** Razão, justificativa e controles compensatórios — o conteúdo do aceite. */
function Detalhes({ aceite }: { aceite: RiskAcceptance }) {
  return (
    <dl className="grid gap-2 text-sm">
      <div>
        <dt className="text-xs uppercase text-fg-muted">Razão</dt>
        <dd className="whitespace-pre-wrap text-fg">{aceite.reason}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase text-fg-muted">Justificativa de negócio</dt>
        <dd className="whitespace-pre-wrap text-fg">{aceite.businessJustification}</dd>
      </div>
      {aceite.compensatingControls && (
        <div>
          <dt className="text-xs uppercase text-fg-muted">Controles compensatórios</dt>
          <dd className="whitespace-pre-wrap text-fg">{aceite.compensatingControls}</dd>
        </div>
      )}
      {aceite.reviewNote && (
        <div>
          <dt className="text-xs uppercase text-fg-muted">Parecer</dt>
          <dd className="whitespace-pre-wrap text-fg">{aceite.reviewNote}</dd>
        </div>
      )}
    </dl>
  );
}

function FormularioPedido({
  pendente,
  onCancelar,
  onEnviar,
}: {
  pendente: boolean;
  onCancelar: () => void;
  onEnviar: (v: { reason: string; businessJustification: string; compensatingControls: string; prazo: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [businessJustification, setJustificativa] = useState("");
  const [compensatingControls, setControles] = useState("");
  const [prazo, setPrazo] = useState(dataEmDias(90));

  const reasonCurto = reason.trim().length > 0 && reason.trim().length < RISK_ACCEPTANCE_LIMITS.reasonMin;
  const justCurta =
    businessJustification.trim().length > 0 && businessJustification.trim().length < RISK_ACCEPTANCE_LIMITS.justificationMin;
  const valido =
    reason.trim().length >= RISK_ACCEPTANCE_LIMITS.reasonMin &&
    businessJustification.trim().length >= RISK_ACCEPTANCE_LIMITS.justificationMin;

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar({ reason, businessJustification, compensatingControls, prazo });
      }}
    >
      <Field
        rotulo="Razão"
        dica={`Por que conviver com este risco. Mínimo ${RISK_ACCEPTANCE_LIMITS.reasonMin} caracteres.`}
        erro={reasonCurto ? `Mínimo ${RISK_ACCEPTANCE_LIMITS.reasonMin} caracteres.` : null}
        obrigatorio
      >
        {(attrs) => (
          <Textarea {...attrs} rows={2} value={reason} maxLength={RISK_ACCEPTANCE_LIMITS.reasonMax} onChange={(e) => setReason(e.target.value)} />
        )}
      </Field>

      <Field
        rotulo="Justificativa de negócio"
        dica="O que impede a correção agora, e o que muda para ela acontecer."
        erro={justCurta ? `Mínimo ${RISK_ACCEPTANCE_LIMITS.justificationMin} caracteres.` : null}
        obrigatorio
      >
        {(attrs) => (
          <Textarea
            {...attrs}
            rows={3}
            value={businessJustification}
            maxLength={RISK_ACCEPTANCE_LIMITS.justificationMax}
            onChange={(e) => setJustificativa(e.target.value)}
          />
        )}
      </Field>

      <Field rotulo="Controles compensatórios" dica="Opcional — o que reduz o risco enquanto ele não é corrigido.">
        {(attrs) => (
          <Textarea
            {...attrs}
            rows={2}
            value={compensatingControls}
            maxLength={RISK_ACCEPTANCE_LIMITS.compensatingControlsMax}
            onChange={(e) => setControles(e.target.value)}
          />
        )}
      </Field>

      <Field rotulo="Prazo proposto" dica="Quem aprovar pode encurtar, nunca estender além desta data.">
        {(attrs) => <Input {...attrs} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />}
      </Field>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secundario" onClick={onCancelar} disabled={pendente}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valido || pendente}>
          {pendente ? "Enviando..." : "Solicitar"}
        </Button>
      </div>
    </form>
  );
}

function FormularioDecisao({
  aceite,
  pendente,
  onCancelar,
  onAprovar,
  onRejeitar,
}: {
  aceite: RiskAcceptance;
  pendente: boolean;
  onCancelar: () => void;
  onAprovar: (expiresAt: string, reviewNote: string) => void;
  onRejeitar: (reviewNote: string) => void;
}) {
  // O padrão é o prazo PEDIDO (não o teto): aprovar não deve estender sem que
  // quem decide escolha isso conscientemente — e o backend recusa passar disso.
  const prazoPedido = aceite.requestedExpiresAt ? aceite.requestedExpiresAt.slice(0, 10) : dataEmDias(90);
  const [expiresAt, setExpiresAt] = useState(prazoPedido);
  const [reviewNote, setReviewNote] = useState("");

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Detalhes aceite={aceite} />

      <Field
        rotulo="Válido até"
        dica={
          aceite.requestedExpiresAt
            ? `Foi pedido até ${dataBR(aceite.requestedExpiresAt)}. Você pode encurtar, não estender.`
            : `No máximo ${RISK_ACCEPTANCE_LIMITS.maxDays} dias.`
        }
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="date"
            value={expiresAt}
            max={prazoPedido}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        )}
      </Field>

      <Field rotulo="Parecer" dica="Obrigatório para recusar; opcional para aprovar.">
        {(attrs) => (
          <Textarea
            {...attrs}
            rows={2}
            value={reviewNote}
            maxLength={RISK_ACCEPTANCE_LIMITS.reviewNoteMax}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        )}
      </Field>

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secundario" onClick={onCancelar} disabled={pendente}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destrutivo"
          disabled={pendente || reviewNote.trim().length === 0}
          onClick={() => onRejeitar(reviewNote)}
        >
          Recusar
        </Button>
        <Button type="button" disabled={pendente || !expiresAt} onClick={() => onAprovar(expiresAt, reviewNote)}>
          {pendente ? "Salvando..." : "Aprovar aceite"}
        </Button>
      </div>
    </div>
  );
}

function FormularioRevogacao({
  pendente,
  onCancelar,
  onEnviar,
}: {
  pendente: boolean;
  onCancelar: () => void;
  onEnviar: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valido = reason.trim().length >= RISK_ACCEPTANCE_LIMITS.revokeReasonMin;
  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(reason);
      }}
    >
      <Field
        rotulo="Motivo da revogação"
        dica={`Mínimo ${RISK_ACCEPTANCE_LIMITS.revokeReasonMin} caracteres.`}
        obrigatorio
      >
        {(attrs) => <Textarea {...attrs} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secundario" onClick={onCancelar} disabled={pendente}>
          Cancelar
        </Button>
        <Button type="submit" variant="destrutivo" disabled={!valido || pendente}>
          {pendente ? "Revogando..." : "Revogar"}
        </Button>
      </div>
    </form>
  );
}
